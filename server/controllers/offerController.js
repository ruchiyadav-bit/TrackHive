const Offer = require('../models/Offer');
const xss = require('xss');

const sanitizeOffer = (data) => {
  if (data.name) data.name = xss(data.name);
  if (data.description) data.description = xss(data.description);
  if (data.internalNotes) data.internalNotes = xss(data.internalNotes);
  // Clean empty ObjectId ref fields — '' causes Mongoose CastError
  ['advertiser', 'trackingDomain', 'offerGroup'].forEach(key => {
    if (data[key] === '' || data[key] === null) delete data[key];
  });
  return data;
};

exports.listOffers = async (req, res, next) => {
  try {
    const {
      status, category, search,
      sort = '-createdAt', page = 1, limit = 50,
    } = req.query;

    const filter = { status: { $ne: 'deleted' } };
    if (status) filter.status = status;
    if (category) filter.category = category;

    if (req.user.offerAccess === 'specific') {
      filter._id = { $in: req.user.allowedOffers };
    }

    let query;
    if (search) {
      filter.$text = { $search: search };
      query = Offer.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      query = Offer.find(filter).sort(sort);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [offers, total] = await Promise.all([
      query.skip(skip).limit(parseInt(limit)).populate('advertiser', 'name'),
      Offer.countDocuments(filter),
    ]);

    res.json({
      offers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createOffer = async (req, res, next) => {
  try {
    const data = sanitizeOffer(req.body);
    if (!data.name?.trim()) return res.status(400).json({ error: 'Name is required' });
    data.createdBy = req.user._id;

    if (data.expirationDate) data.expirationDate = new Date(data.expirationDate);

    const offer = new Offer(data);
    await offer.save();

    res.status(201).json({ offer });
  } catch (error) {
    next(error);
  }
};

exports.getOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findOne({
      _id: req.params.id,
      status: { $ne: 'deleted' },
    }).populate('advertiser', 'name').populate('trackingDomain', 'domain status');
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    if (req.user.offerAccess === 'specific' &&
        !req.user.allowedOffers.some(id => id.toString() === offer._id.toString())) {
      return res.status(403).json({ error: 'Access denied to this offer' });
    }

    res.json({ offer });
  } catch (error) {
    next(error);
  }
};

exports.updateOffer = async (req, res, next) => {
  try {
    const data = sanitizeOffer(req.body);
    if (data.expirationDate) data.expirationDate = new Date(data.expirationDate);

    const offer = await Offer.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'deleted' } },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    res.json({ offer });
  } catch (error) {
    next(error);
  }
};

exports.deleteOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'deleted' } },
      { status: 'deleted' },
      { new: true }
    );
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    res.json({ message: 'Offer deleted' });
  } catch (error) {
    next(error);
  }
};

exports.duplicateOffer = async (req, res, next) => {
  try {
    const source = await Offer.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Offer not found' });

    const dup = source.toObject();
    delete dup._id;
    delete dup.__v;
    delete dup.createdAt;
    delete dup.updatedAt;
    dup.name = `${source.name} (Copy)`;
    dup.slug = null;
    dup.status = 'draft';
    dup.totalClicks = 0;
    dup.totalConversions = 0;
    dup.totalRevenue = 0;
    dup.totalPayout = 0;
    dup.totalProfit = 0;
    dup.createdBy = req.user._id;

    const offer = new Offer(dup);
    await offer.save();

    res.status(201).json({ offer });
  } catch (error) {
    next(error);
  }
};

exports.autocomplete = async (req, res, next) => {
  try {
    const { field } = req.params;
    const allowed = ['advertiser', 'labels', 'category'];
    if (!allowed.includes(field)) {
      return res.status(400).json({ error: `Cannot autocomplete field: ${field}` });
    }
    const values = await Offer.distinct(field, { status: { $ne: 'deleted' } });
    const flat = values.flat().filter(Boolean);
    res.json({ values: [...new Set(flat)] });
  } catch (error) {
    next(error);
  }
};

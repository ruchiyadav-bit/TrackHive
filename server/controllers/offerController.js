const Offer = require('../models/Offer');
const xss = require('xss');
const { ownerFilter, ownsDoc, denyNotFound } = require('../utils/scope');
const Advertiser = require('../models/Advertiser');
const OfferGroup = require('../models/OfferGroup');
const TrackingDomain = require('../models/TrackingDomain');

/**
 * Every ObjectId a client can put on an offer has to be checked, not just
 * accepted. Without this a partner could point their own offer at ANOTHER
 * partner's advertiser — the offer passes the ownership check, and reading it
 * returns that advertiser's postbackSecret, which is the only thing gating
 * /postback. That is a forged-conversion path, not just a data leak.
 *
 * trackingDomain is the exception: domains are created by the manager and are
 * meant to be selectable by everyone, so it only has to exist.
 */
async function assertRefsOwned(data, user) {
  if (data.advertiser) {
    const ok = await Advertiser.exists({ _id: data.advertiser, ...ownerFilter(user) });
    if (!ok) return 'Advertiser not found';
  }
  if (data.offerGroup) {
    const ok = await OfferGroup.exists({ _id: data.offerGroup, ...ownerFilter(user) });
    if (!ok) return 'Offer group not found';
  }
  if (data.trackingDomain) {
    const ok = await TrackingDomain.exists({ _id: data.trackingDomain });
    if (!ok) return 'Tracking domain not found';
  }
  return null;
}

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

    // Partners only ever list their own offers.
    const filter = { status: { $ne: 'deleted' }, ...ownerFilter(req.user) };
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

    const refError = await assertRefsOwned(data, req.user);
    if (refError) return res.status(400).json({ error: refError });

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
    // Both roles see the advertiser's postbackSecret: partners are the ones who
    // paste the postback URL into the network, and the URL is useless without
    // it. Worth knowing what that grants — the secret is the ONLY thing gating
    // /postback, so whoever holds it can forge conversions with arbitrary
    // revenue. If that ever needs narrowing, gate it here on isManager().
    const advertiserFields = 'name postbackSecret network trackingDomain';

    const offer = await Offer.findOne({
      _id: req.params.id,
      status: { $ne: 'deleted' },
    })
      // Nested populate: the postback URL shown on this page belongs to the
      // ADVERTISER, so it needs the advertiser's domain — not the offer's.
      .populate({
        path: 'advertiser',
        select: advertiserFields,
        populate: { path: 'trackingDomain', select: 'domain status' },
      })
      .populate('trackingDomain', 'domain status');
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (!ownsDoc(offer, req.user)) return denyNotFound(res, 'Offer not found');

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
    // Ownership is not editable — otherwise a partner could hand their offer to
    // someone else, or claim one.
    delete data.createdBy;

    const refError = await assertRefsOwned(data, req.user);
    if (refError) return res.status(400).json({ error: refError });

    const offer = await Offer.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'deleted' }, ...ownerFilter(req.user) },
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
      { _id: req.params.id, status: { $ne: 'deleted' }, ...ownerFilter(req.user) },
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
    if (!ownsDoc(source, req.user)) return denyNotFound(res, 'Offer not found');

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
    const values = await Offer.distinct(field, {
      status: { $ne: 'deleted' },
      ...ownerFilter(req.user),
    });
    const flat = values.flat().filter(Boolean);
    res.json({ values: [...new Set(flat)] });
  } catch (error) {
    next(error);
  }
};

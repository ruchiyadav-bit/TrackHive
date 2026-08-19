const Advertiser = require('../models/Advertiser');
const Offer = require('../models/Offer');
const crypto = require('crypto');
const { ownerFilter, ownsDoc, denyNotFound } = require('../utils/scope');

exports.list = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    // Partners see only the advertisers they created. Leaking this list would
    // also leak each advertiser's postbackSecret, which is enough to forge
    // conversions against someone else's offers.
    const filter = { ...ownerFilter(req.user) };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }
    const advertisers = await Advertiser.find(filter).sort('-createdAt');
    res.json({ advertisers });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const advertiser = await Advertiser.findById(req.params.id);
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    if (!ownsDoc(advertiser, req.user)) return denyNotFound(res, 'Advertiser not found');

    // Fetch offers linked to this advertiser — still owner-scoped, because a
    // manager may have offers under an advertiser a partner can see.
    const offers = await Offer.find({ advertiser: advertiser._id, ...ownerFilter(req.user) })
      .select('name status category totalClicks totalConversions totalRevenue totalPayout totalProfit currency')
      .sort('-createdAt')
      .lean();

    // Aggregated stats
    const stats = {
      totalOffers: offers.length,
      activeOffers: offers.filter(o => o.status === 'active').length,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      totalPayout: 0,
      totalProfit: 0,
    };
    for (const o of offers) {
      stats.totalClicks += o.totalClicks || 0;
      stats.totalConversions += o.totalConversions || 0;
      stats.totalRevenue += o.totalRevenue || 0;
      stats.totalPayout += o.totalPayout || 0;
      stats.totalProfit += o.totalProfit || 0;
    }

    res.json({ advertiser, offers, stats });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, company, website, status, network, clickIdParam, contactName, contactEmail, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const advertiser = new Advertiser({
      name: name.trim(),
      company, website, status,
      network: network || 'custom',
      clickIdParam: clickIdParam || 'click_id',
      contactName, contactEmail, notes,
      postbackSecret: crypto.randomBytes(16).toString('hex'),
      createdBy: req.user._id,
    });
    await advertiser.save();
    res.status(201).json({ advertiser });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    // Ownership is not editable, and the secret is not settable through a plain
    // update — it only changes via regenerateSecret.
    const data = { ...req.body };
    delete data.createdBy;
    delete data.postbackSecret;

    const advertiser = await Advertiser.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req.user) },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    res.json({ advertiser });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    // Block delete if offers are linked
    const owned = await Advertiser.findOne({ _id: req.params.id, ...ownerFilter(req.user) }).select('_id');
    if (!owned) return denyNotFound(res, 'Advertiser not found');

    // Count only the caller's own offers. The raw count used to include other
    // users' offers, so the error message disclosed how many offers someone
    // else had attached to this advertiser.
    const linkedOffers = await Offer.countDocuments({
      advertiser: req.params.id,
      ...ownerFilter(req.user),
    });
    if (linkedOffers > 0) {
      return res.status(400).json({
        error: `Cannot delete — ${linkedOffers} offer${linkedOffers > 1 ? 's are' : ' is'} linked to this advertiser`,
      });
    }

    // Someone else may still reference it. Refuse without revealing by whom.
    const foreignLinks = await Offer.countDocuments({ advertiser: req.params.id });
    if (foreignLinks > 0) {
      return res.status(400).json({ error: 'Cannot delete — this advertiser is still in use' });
    }

    const advertiser = await Advertiser.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req.user) });
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    res.json({ message: 'Advertiser deleted' });
  } catch (error) {
    next(error);
  }
};

exports.regenerateSecret = async (req, res, next) => {
  try {
    const advertiser = await Advertiser.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req.user) },
      { postbackSecret: crypto.randomBytes(16).toString('hex') },
      { new: true }
    );
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    res.json({ advertiser });
  } catch (error) {
    next(error);
  }
};

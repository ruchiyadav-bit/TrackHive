const Advertiser = require('../models/Advertiser');
const Offer = require('../models/Offer');
const TrackingDomain = require('../models/TrackingDomain');
const crypto = require('crypto');
const { ownerFilter, ownsDoc, denyNotFound } = require('../utils/scope');

/**
 * Tracking domain is REQUIRED on every advertiser, and there is no default:
 * the postback URL is built on it and registered once on the network, so it
 * has to be picked on purpose, never inherited. Returns an error string, or
 * null when the value is a real, existing domain.
 */
async function checkTrackingDomain(value) {
  if (!value) return 'Tracking domain is required';
  if (!/^[a-f\d]{24}$/i.test(String(value))) return 'Tracking domain not found';
  const ok = await TrackingDomain.exists({ _id: value });
  return ok ? null : 'Tracking domain not found';
}

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
    const advertisers = await Advertiser.find(filter).sort('-createdAt').populate('trackingDomain', 'domain status');
    res.json({ advertisers });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const advertiser = await Advertiser.findById(req.params.id).populate('trackingDomain', 'domain status');
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    if (!ownsDoc(advertiser, req.user)) return denyNotFound(res, 'Advertiser not found');

    // Fetch offers linked to this advertiser — still owner-scoped, because a
    // manager may have offers under an advertiser a partner can see.
    const offers = await Offer.find({
      advertiser: advertiser._id,
      // Soft-deleted offers are still rows in the collection; listing them here
      // showed offers the user had deleted and counted them into the stats below.
      status: { $ne: 'deleted' },
      ...ownerFilter(req.user),
    })
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
    const { name, company, website, status, network, clickIdParam, contactName, contactEmail, notes, trackingDomain } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const domainError = await checkTrackingDomain(trackingDomain);
    if (domainError) return res.status(400).json({ error: domainError });

    const advertiser = new Advertiser({
      name: name.trim(),
      company, website, status,
      network: network || 'custom',
      clickIdParam: clickIdParam || 'click_id',
      contactName, contactEmail, notes,
      trackingDomain,
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
    // Tracking domain is required and has no default. When the update carries
    // it, it must be a real domain (clearing it is refused). When it does not,
    // the advertiser must already have one — older advertisers saved before
    // this rule have to pick a domain on their next edit.
    if (Object.prototype.hasOwnProperty.call(data, 'trackingDomain')) {
      const domainError = await checkTrackingDomain(data.trackingDomain);
      if (domainError) return res.status(400).json({ error: domainError });
    } else {
      const current = await Advertiser.findOne({ _id: req.params.id, ...ownerFilter(req.user) }).select('trackingDomain');
      if (!current) return res.status(404).json({ error: 'Advertiser not found' });
      if (!current.trackingDomain) return res.status(400).json({ error: 'Tracking domain is required' });
    }

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
    // `status: { $ne: 'deleted' }` is the important part. Deleting an offer is a
    // SOFT delete — offerController sets status:'deleted' and the row stays in
    // the collection. Without this filter the count included offers the user had
    // already deleted, so the advertiser could never be removed and the message
    // named an offer that no longer appears anywhere in the UI.
    const linkedOffers = await Offer.countDocuments({
      advertiser: req.params.id,
      status: { $ne: 'deleted' },
      ...ownerFilter(req.user),
    });
    if (linkedOffers > 0) {
      return res.status(400).json({
        error: `Cannot delete — ${linkedOffers} offer${linkedOffers > 1 ? 's are' : ' is'} linked to this advertiser`,
      });
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

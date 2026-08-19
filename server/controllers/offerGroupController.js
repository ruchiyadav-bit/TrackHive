const OfferGroup = require('../models/OfferGroup');
const { ownerFilter, ownsDoc, denyNotFound, visibleOfferIds, offerScopeMatch } = require('../utils/scope');
const Offer = require('../models/Offer');

/**
 * A group is a container of offer ids supplied by the client. Owning the
 * CONTAINER is not the same as owning its CONTENTS — without this check a
 * partner could create a group listing another partner's offers and then read
 * their names, revenue and full daily history through get() and report().
 */
async function assertOffersOwned(offers, user) {
  if (offers === undefined || offers === null) return null;
  // Must be an ARRAY. Mongoose silently casts a bare string into a one-element
  // array, so `offers: "<someone else's id>"` used to slip past both the
  // `offers.length < 2` gate (a 24-char id has length 24) and this check, and
  // land in the document as a real reference.
  if (!Array.isArray(offers)) return 'offers must be an array of offer ids';
  if (!offers.length) return null;
  const owned = await Offer.find({
    _id: { $in: offers },
    status: { $ne: 'deleted' },
    ...ownerFilter(user),
  }).select('_id').lean();
  return owned.length === offers.length ? null : 'One or more offers not found';
}
const DailyStat = require('../models/DailyStat');
const { logActivity } = require('../utils/activityLogger');


/** Drop any offer the caller is not allowed to see from a populated group. */
function stripForeignOffers(group, scopeIds) {
  if (!group || scopeIds === null || !Array.isArray(group.offers)) return group;
  group.offers = group.offers.filter(o =>
    scopeIds.some(id => String(id) === String(o?._id || o)));
  return group;
}

exports.list = async (req, res, next) => {
  try {
    const groups = await OfferGroup.find(ownerFilter(req.user)).sort({ createdAt: -1 }).populate('offers', 'name status');
    const scopeIds = await visibleOfferIds(req.user);
    groups.forEach(g => stripForeignOffers(g, scopeIds));
    res.json({ groups });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description, offers, color, dailyCap, monthlyCap } = req.body;
    if (!name || !offers || offers.length < 2) {
      return res.status(400).json({ error: 'name and at least 2 offers required' });
    }

    const offerError = await assertOffersOwned(offers, req.user);
    if (offerError) return res.status(400).json({ error: offerError });

    const group = await OfferGroup.create({
      name, description, offers, color, dailyCap, monthlyCap,
      createdBy: req.user._id,
    });

    await logActivity({
      user: req.user, action: 'group_created', entityType: 'group',
      entityId: group._id, entityName: name,
    });

    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const group = await OfferGroup.findById(req.params.id).populate('offers', 'name status totalClicks totalConversions totalRevenue totalPayout totalProfit');
    if (group && !ownsDoc(group, req.user)) return denyNotFound(res, 'Group not found');
    stripForeignOffers(group, await visibleOfferIds(req.user));
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Aggregate stats
    const totals = group.offers.reduce((acc, o) => ({
      clicks: acc.clicks + (o.totalClicks || 0),
      conversions: acc.conversions + (o.totalConversions || 0),
      revenue: acc.revenue + (o.totalRevenue || 0),
      payout: acc.payout + (o.totalPayout || 0),
      profit: acc.profit + (o.totalProfit || 0),
    }), { clicks: 0, conversions: 0, revenue: 0, payout: 0, profit: 0 });

    res.json({ group, totals });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description, offers, color, dailyCap, monthlyCap } = req.body;
    const update = {};
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (offers) update.offers = offers;
    if (color) update.color = color;
    if (dailyCap !== undefined) update.dailyCap = dailyCap;
    if (monthlyCap !== undefined) update.monthlyCap = monthlyCap;

    if (update.offers) {
      const offerError = await assertOffersOwned(update.offers, req.user);
      if (offerError) return res.status(400).json({ error: offerError });
    }

    const group = await OfferGroup.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req.user) }, update, { new: true });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    await logActivity({
      user: req.user, action: 'group_edited', entityType: 'group',
      entityId: group._id, entityName: group.name,
    });

    res.json({ group });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const group = await OfferGroup.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req.user) });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    await logActivity({
      user: req.user, action: 'group_deleted', entityType: 'group',
      entityId: group._id, entityName: group.name,
    });

    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
};

exports.report = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const group = await OfferGroup.findById(req.params.id);
    if (group && !ownsDoc(group, req.user)) return denyNotFound(res, 'Group not found');
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const scopeIds = await visibleOfferIds(req.user);
    const groupOfferIds = scopeIds === null
      ? group.offers
      : group.offers.filter(id => scopeIds.some(s => String(s) === String(id)));

    const data = await DailyStat.aggregate([
      // Intersect with the caller's scope as well, so a group saved before
      // this validation existed still cannot surface foreign stats.
      {
        $match: {
          offerId: { $in: groupOfferIds },
          date: { $gte: dateFrom, $lte: dateTo },
        },
      },
      {
        $group: {
          _id: '$date',
          clicks: { $sum: '$clicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          profit: { $sum: '$profit' },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json({ group: { name: group.name }, data: data.map(d => ({ date: d._id, ...d, _id: undefined })) });
  } catch (err) {
    next(err);
  }
};

function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

const OfferGroup = require('../models/OfferGroup');
const DailyStat = require('../models/DailyStat');
const { logActivity } = require('../utils/activityLogger');

exports.list = async (req, res, next) => {
  try {
    const groups = await OfferGroup.find().sort({ createdAt: -1 }).populate('offers', 'name status');
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

    const group = await OfferGroup.findByIdAndUpdate(req.params.id, update, { new: true });
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
    const group = await OfferGroup.findByIdAndDelete(req.params.id);
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
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const data = await DailyStat.aggregate([
      { $match: { offerId: { $in: group.offers }, date: { $gte: dateFrom, $lte: dateTo } } },
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

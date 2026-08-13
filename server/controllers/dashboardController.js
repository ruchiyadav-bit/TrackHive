const Offer = require('../models/Offer');
const Click = require('../models/Click');
const DailyStat = require('../models/DailyStat');

exports.getSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const offerFilter = { status: { $ne: 'deleted' } };

    // Offer access filtering
    if (req.user.offerAccess === 'specific') {
      offerFilter._id = { $in: req.user.allowedOffers };
    }

    const [offers, todayStats, allTimeStats] = await Promise.all([
      Offer.find(offerFilter).select('status totalClicks totalConversions totalRevenue totalPayout totalProfit'),
      getDayStats(from || todayStr(), to || todayStr(), offerFilter),
      getAggregateStats(offerFilter),
    ]);

    const activeOffers = offers.filter(o => o.status === 'active').length;

    res.json({
      totalOffers: offers.length,
      activeOffers,
      today: todayStats,
      allTime: allTimeStats,
    });
  } catch (err) {
    next(err);
  }
};

exports.getChart = async (req, res, next) => {
  try {
    const { from, to, metric = 'clicks', groupBy = 'day' } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = { date: { $gte: dateFrom, $lte: dateTo } };
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const stats = await DailyStat.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: groupBy === 'hour' ? '$date' : '$date',
          clicks: { $sum: '$clicks' },
          uniqueClicks: { $sum: '$uniqueClicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          profit: { $sum: '$profit' },
          blockedClicks: { $sum: '$blockedClicks' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      data: stats.map(s => ({
        date: s._id,
        clicks: s.clicks,
        uniqueClicks: s.uniqueClicks,
        conversions: s.conversions,
        revenue: s.revenue,
        payout: s.payout,
        profit: s.profit,
        blockedClicks: s.blockedClicks,
        cr: s.clicks > 0 ? (s.conversions / s.clicks * 100).toFixed(2) : 0,
        epc: s.clicks > 0 ? (s.revenue / s.clicks).toFixed(4) : 0,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.getTopOffers = async (req, res, next) => {
  try {
    const { from, to, sort = 'revenue', limit = 10 } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = { date: { $gte: dateFrom, $lte: dateTo } };
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const sortField = ['revenue', 'clicks', 'conversions', 'profit'].includes(sort) ? sort : 'revenue';

    const topOffers = await DailyStat.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$offerId',
          offerName: { $first: '$offerName' },
          clicks: { $sum: '$clicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          profit: { $sum: '$profit' },
        },
      },
      { $sort: { [sortField]: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({ offers: topOffers });
  } catch (err) {
    next(err);
  }
};

exports.getRecentClicks = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.offerAccess === 'specific') {
      filter.offerId = { $in: req.user.allowedOffers };
    }

    const clicks = await Click.find(filter)
      .sort({ clickedAt: -1 })
      .limit(20)
      .select('clickId offerName country device browser converted revenue clickedAt');

    res.json({ clicks });
  } catch (err) {
    next(err);
  }
};

exports.getGeoBreakdown = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = { date: { $gte: dateFrom, $lte: dateTo } };
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const stats = await DailyStat.find(matchFilter);
    const geoMap = {};

    for (const stat of stats) {
      if (stat.byCountry) {
        for (const [country, count] of stat.byCountry) {
          if (!geoMap[country]) geoMap[country] = 0;
          geoMap[country] += count;
        }
      }
    }

    const geoData = Object.entries(geoMap)
      .map(([country, clicks]) => ({ country, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);

    res.json({ data: geoData });
  } catch (err) {
    next(err);
  }
};

// Helpers
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function getDayStats(from, to, offerFilter) {
  const matchFilter = { date: { $gte: from, $lte: to } };
  if (offerFilter._id) matchFilter.offerId = offerFilter._id;

  const result = await DailyStat.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        clicks: { $sum: '$clicks' },
        uniqueClicks: { $sum: '$uniqueClicks' },
        conversions: { $sum: '$conversions' },
        revenue: { $sum: '$revenue' },
        payout: { $sum: '$payout' },
        profit: { $sum: '$profit' },
        blockedClicks: { $sum: '$blockedClicks' },
      },
    },
  ]);

  return result[0] || { clicks: 0, uniqueClicks: 0, conversions: 0, revenue: 0, payout: 0, profit: 0, blockedClicks: 0 };
}

async function getAggregateStats(offerFilter) {
  const result = await Offer.aggregate([
    { $match: offerFilter },
    {
      $group: {
        _id: null,
        totalClicks: { $sum: '$totalClicks' },
        totalConversions: { $sum: '$totalConversions' },
        totalRevenue: { $sum: '$totalRevenue' },
        totalPayout: { $sum: '$totalPayout' },
        totalProfit: { $sum: '$totalProfit' },
      },
    },
  ]);

  return result[0] || { totalClicks: 0, totalConversions: 0, totalRevenue: 0, totalPayout: 0, totalProfit: 0 };
}

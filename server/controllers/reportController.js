const DailyStat = require('../models/DailyStat');
const Click = require('../models/Click');
const Offer = require('../models/Offer');

/**
 * Offer performance report
 */
exports.offerReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, status, sort = '-revenue', page = 1, limit = 50 } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = { date: { $gte: dateFrom, $lte: dateTo } };
    if (offer_id) matchFilter.offerId = toObjectId(offer_id);
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const sortDir = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace(/^-/, '');

    const data = await DailyStat.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$offerId',
          offerName: { $first: '$offerName' },
          clicks: { $sum: '$clicks' },
          uniqueClicks: { $sum: '$uniqueClicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          profit: { $sum: '$profit' },
          blockedClicks: { $sum: '$blockedClicks' },
        },
      },
      {
        $addFields: {
          cr: { $cond: [{ $gt: ['$clicks', 0] }, { $multiply: [{ $divide: ['$conversions', '$clicks'] }, 100] }, 0] },
          epc: { $cond: [{ $gt: ['$clicks', 0] }, { $divide: ['$revenue', '$clicks'] }, 0] },
          rpc: { $cond: [{ $gt: ['$clicks', 0] }, { $divide: ['$profit', '$clicks'] }, 0] },
        },
      },
      { $sort: { [sortField]: sortDir } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ]);

    res.json({ data, dateRange: { from: dateFrom, to: dateTo } });
  } catch (err) {
    next(err);
  }
};

/**
 * Daily report — day-by-day breakdown
 */
exports.dailyReport = async (req, res, next) => {
  try {
    const { from, to, offer_id } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = { date: { $gte: dateFrom, $lte: dateTo } };
    if (offer_id) matchFilter.offerId = toObjectId(offer_id);
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const data = await DailyStat.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$date',
          clicks: { $sum: '$clicks' },
          uniqueClicks: { $sum: '$uniqueClicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          profit: { $sum: '$profit' },
        },
      },
      {
        $addFields: {
          cr: { $cond: [{ $gt: ['$clicks', 0] }, { $multiply: [{ $divide: ['$conversions', '$clicks'] }, 100] }, 0] },
          epc: { $cond: [{ $gt: ['$clicks', 0] }, { $divide: ['$revenue', '$clicks'] }, 0] },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json({ data: data.map(d => ({ date: d._id, ...d, _id: undefined })), dateRange: { from: dateFrom, to: dateTo } });
  } catch (err) {
    next(err);
  }
};

/**
 * SubID report — performance by sub affiliate/source
 */
exports.subIdReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, subField = 'subId1' } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = {
      clickedAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo + 'T23:59:59Z') },
    };
    if (offer_id) matchFilter.offerId = toObjectId(offer_id);
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const validFields = ['subId1', 'subId2', 'subId3', 'subId4', 'subId5', 'source'];
    const field = validFields.includes(subField) ? subField : 'subId1';

    const data = await Click.aggregate([
      { $match: { ...matchFilter, [field]: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: `$${field}`,
          clicks: { $sum: 1 },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          profit: { $sum: '$profit' },
        },
      },
      {
        $addFields: {
          cr: { $cond: [{ $gt: ['$clicks', 0] }, { $multiply: [{ $divide: ['$conversions', '$clicks'] }, 100] }, 0] },
          epc: { $cond: [{ $gt: ['$clicks', 0] }, { $divide: ['$revenue', '$clicks'] }, 0] },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 200 },
    ]);

    res.json({ data: data.map(d => ({ subId: d._id, ...d, _id: undefined })), field, dateRange: { from: dateFrom, to: dateTo } });
  } catch (err) {
    next(err);
  }
};

/**
 * GEO report — clicks/conversions by country
 */
exports.geoReport = async (req, res, next) => {
  try {
    const { from, to, offer_id } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = {
      clickedAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo + 'T23:59:59Z') },
    };
    if (offer_id) matchFilter.offerId = toObjectId(offer_id);
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const data = await Click.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$country',
          clicks: { $sum: 1 },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          profit: { $sum: '$profit' },
        },
      },
      {
        $addFields: {
          cr: { $cond: [{ $gt: ['$clicks', 0] }, { $multiply: [{ $divide: ['$conversions', '$clicks'] }, 100] }, 0] },
        },
      },
      { $sort: { clicks: -1 } },
    ]);

    res.json({ data: data.map(d => ({ country: d._id, ...d, _id: undefined })), dateRange: { from: dateFrom, to: dateTo } });
  } catch (err) {
    next(err);
  }
};

/**
 * Device/OS/Browser report
 */
exports.deviceReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, groupBy = 'device' } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = {
      clickedAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo + 'T23:59:59Z') },
    };
    if (offer_id) matchFilter.offerId = toObjectId(offer_id);
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    const validGroups = ['device', 'os', 'browser'];
    const field = validGroups.includes(groupBy) ? groupBy : 'device';

    const data = await Click.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: `$${field}`,
          clicks: { $sum: 1 },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          revenue: { $sum: '$revenue' },
        },
      },
      { $sort: { clicks: -1 } },
    ]);

    res.json({ data: data.map(d => ({ [field]: d._id, ...d, _id: undefined })), dateRange: { from: dateFrom, to: dateTo } });
  } catch (err) {
    next(err);
  }
};

/**
 * CSV export
 */
exports.exportCsv = async (req, res, next) => {
  try {
    const { from, to, offer_id, type = 'daily' } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    const matchFilter = { date: { $gte: dateFrom, $lte: dateTo } };
    if (offer_id) matchFilter.offerId = toObjectId(offer_id);
    if (req.user.offerAccess === 'specific') {
      matchFilter.offerId = { $in: req.user.allowedOffers };
    }

    let data;
    if (type === 'offer') {
      data = await DailyStat.aggregate([
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
        { $sort: { revenue: -1 } },
      ]);
    } else {
      data = await DailyStat.aggregate([
        { $match: matchFilter },
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
    }

    // Build CSV
    const headers = type === 'offer'
      ? 'Offer,Clicks,Conversions,Revenue,Payout,Profit'
      : 'Date,Clicks,Conversions,Revenue,Payout,Profit';

    const rows = data.map(d => {
      const label = type === 'offer' ? `"${d.offerName}"` : d._id;
      return `${label},${d.clicks},${d.conversions},${d.revenue.toFixed(2)},${d.payout.toFixed(2)},${d.profit.toFixed(2)}`;
    });

    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report_${type}_${dateFrom}_${dateTo}.csv"`);
    res.send(csv);
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

function toObjectId(id) {
  const mongoose = require('mongoose');
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return id;
  }
}

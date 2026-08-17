const DailyStat = require('../models/DailyStat');
const Click = require('../models/Click');
const Offer = require('../models/Offer');

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/** Safe division — returns 0 on zero denominator */
function safeDivide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Mongo $cond expression for "Invalid Clicks" on raw Click aggregations.
 * Frequency-cap blocks (blockReason: 'frequency_cap') are excluded here —
 * they are still duplicates and count in Dup Clicks, but must NOT also
 * count as Invalid (Invalid is reserved for bot/geo/device/IP blocks) so
 * a single click is never counted in both buckets at once.
 */
const INVALID_CLICKS_EXPR = {
  $cond: [
    { $and: ['$isBlocked', { $ne: ['$blockReason', 'frequency_cap'] }] },
    1,
    0,
  ],
};

/** Build summary metrics object from raw aggregated numbers */
function buildSummary(raw) {
  const grossClicks = raw.grossClicks || 0;
  const dupClicks = raw.dupClicks || 0;
  const invalidClicks = raw.invalidClicks || 0;
  const clicks = grossClicks - invalidClicks;
  const uniqueClicks = raw.uniqueClicks || 0;
  const conversions = raw.conversions || 0;
  const revenue = raw.revenue || 0;
  const payout = raw.payout || 0;
  const profit = revenue - payout;

  return {
    grossClicks,
    clicks,
    uniqueClicks,
    dupClicks,
    invalidClicks,
    totalCv: conversions,
    cv: conversions,
    cvr: Number(safeDivide(conversions, clicks) * 100).toFixed(3),
    cpc: Number(safeDivide(revenue, clicks)).toFixed(2),
    cpa: Number(safeDivide(revenue, conversions)).toFixed(2),
    rpc: Number(safeDivide(profit, clicks)).toFixed(2),
    rpa: Number(safeDivide(profit, conversions)).toFixed(2),
    revenue: Number(revenue).toFixed(2),
    payout: Number(payout).toFixed(2),
    profit: Number(profit).toFixed(2),
    margin: Number(safeDivide(profit, revenue) * 100).toFixed(3),
  };
}

/** Add computed rate fields to a row object */
function addRateFields(row) {
  const clicks = (row.grossClicks || row.clicks || 0) - (row.invalidClicks || 0);
  const effectiveClicks = clicks > 0 ? clicks : (row.clicks || 0);
  const conversions = row.conversions || 0;
  const revenue = row.revenue || 0;
  const payout = row.payout || 0;
  const profit = revenue - payout;

  return {
    ...row,
    profit,
    cvr: Number(safeDivide(conversions, effectiveClicks) * 100).toFixed(3),
    cpc: Number(safeDivide(revenue, effectiveClicks)).toFixed(2),
    cpa: Number(safeDivide(revenue, conversions)).toFixed(2),
    rpc: Number(safeDivide(profit, effectiveClicks)).toFixed(2),
    rpa: Number(safeDivide(profit, conversions)).toFixed(2),
    margin: Number(safeDivide(profit, revenue) * 100).toFixed(3),
  };
}

/** Common date filter for DailyStat-based queries */
function dailyStatDateMatch(from, to, offerId, user) {
  const match = { date: { $gte: from, $lte: to } };
  if (offerId) match.offerId = toObjectId(offerId);
  if (user.offerAccess === 'specific') {
    match.offerId = { $in: user.allowedOffers };
  }
  return match;
}

/** Common date filter for Click-based queries */
function clickDateMatch(from, to, offerId, user) {
  const match = {
    clickedAt: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59.999Z') },
  };
  if (offerId) match.offerId = toObjectId(offerId);
  if (user.offerAccess === 'specific') {
    match.offerId = { $in: user.allowedOffers };
  }
  return match;
}

// ─── 1. CONVERSION REPORT ──────────────────────────────────────────────────
// Individual conversions from Click where converted: true

exports.conversionReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, sort = '-conversionAt', page = 1, limit = 50 } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const match = clickDateMatch(dateFrom, dateTo, offer_id, req.user);
    match.converted = true;

    // Summary
    const summaryAgg = await Click.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          conversions: { $sum: 1 },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
    ]);
    const rawSummary = summaryAgg[0] || { conversions: 0, revenue: 0, payout: 0 };

    // For summary we also need total clicks in the same date range (not just converted)
    const clickMatch = clickDateMatch(dateFrom, dateTo, offer_id, req.user);
    const clickSummary = await Click.aggregate([
      { $match: clickMatch },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: [{ $not: '$isDuplicate' }, 1, 0] } },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
        },
      },
    ]);
    const cs = clickSummary[0] || { grossClicks: 0, uniqueClicks: 0, dupClicks: 0, invalidClicks: 0 };

    const summary = buildSummary({
      grossClicks: cs.grossClicks,
      uniqueClicks: cs.uniqueClicks,
      dupClicks: cs.dupClicks,
      invalidClicks: cs.invalidClicks,
      conversions: rawSummary.conversions,
      revenue: rawSummary.revenue,
      payout: rawSummary.payout,
    });

    // Chart data — conversions by date
    const chart = await Click.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$conversionAt' } },
          conversions: { $sum: 1 },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const chartData = chart.map(c => ({
      date: c._id,
      conversions: c.conversions,
      revenue: Number(c.revenue.toFixed(2)),
      profit: Number((c.revenue - c.payout).toFixed(2)),
    }));

    // Sort
    const sortDir = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace(/^-/, '');

    // Rows
    const total = await Click.countDocuments(match);
    const rows = await Click.find(match)
      .sort({ [sortField]: sortDir })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('clickId offerId offerName conversionAt conversionEvent revenue payout ip country device source subId1')
      .lean();

    const formattedRows = rows.map(r => ({
      clickId: r.clickId,
      offerId: r.offerId,
      offerName: r.offerName || '—',
      conversionAt: r.conversionAt,
      conversionEvent: r.conversionEvent || 'default',
      revenue: Number((r.revenue || 0).toFixed(2)),
      payout: Number((r.payout || 0).toFixed(2)),
      profit: Number(((r.revenue || 0) - (r.payout || 0)).toFixed(2)),
      ip: r.ip,
      country: r.country || '—',
      device: r.device || '—',
      source: r.source || '—',
      subId1: r.subId1 || '—',
    }));

    res.json({
      summary,
      chart: chartData,
      rows: formattedRows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    next(err);
  }
};

// ─── 2. OFFER REPORT ────────────────────────────────────────────────────────
// Grouped by offer, uses DailyStat. Expand rows include country/device breakdown.

exports.offerReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, sort = '-revenue', page = 1, limit = 50 } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const match = dailyStatDateMatch(dateFrom, dateTo, offer_id, req.user);

    // Summary
    const summaryAgg = await DailyStat.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: '$clicks' },
          uniqueClicks: { $sum: '$uniqueClicks' },
          dupClicks: { $sum: '$duplicateClicks' },
          invalidClicks: { $sum: '$blockedClicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
    ]);
    const summary = buildSummary(summaryAgg[0] || {});

    // Chart — by date
    const chart = await DailyStat.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$date',
          clicks: { $sum: '$clicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const chartData = chart.map(c => ({
      date: c._id,
      clicks: c.clicks,
      conversions: c.conversions,
      revenue: Number(c.revenue.toFixed(2)),
      profit: Number((c.revenue - c.payout).toFixed(2)),
    }));

    // Rows — grouped by offer
    const sortDir = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace(/^-/, '');

    const countPipeline = [
      { $match: match },
      { $group: { _id: '$offerId' } },
      { $count: 'total' },
    ];
    const countRes = await DailyStat.aggregate(countPipeline);
    const total = countRes[0]?.total || 0;

    const data = await DailyStat.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$offerId',
          offerName: { $first: '$offerName' },
          grossClicks: { $sum: '$clicks' },
          uniqueClicks: { $sum: '$uniqueClicks' },
          dupClicks: { $sum: '$duplicateClicks' },
          invalidClicks: { $sum: '$blockedClicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          // Collect breakdowns for expand
          _byCountry: { $push: '$byCountry' },
          _byDevice: { $push: '$byDevice' },
        },
      },
      { $sort: { [sortField]: sortDir } },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
    ]);

    const rows = data.map(d => {
      const row = addRateFields({
        offerId: d._id,
        offerName: d.offerName || '—',
        grossClicks: d.grossClicks,
        clicks: d.grossClicks - d.invalidClicks,
        uniqueClicks: d.uniqueClicks,
        dupClicks: d.dupClicks,
        invalidClicks: d.invalidClicks,
        conversions: d.conversions,
        revenue: d.revenue,
        payout: d.payout,
      });

      // Merge breakdown maps across days
      const countryMap = {};
      (d._byCountry || []).forEach(dayMap => {
        if (dayMap) {
          const entries = dayMap instanceof Map ? dayMap.entries() : Object.entries(dayMap);
          for (const [k, v] of entries) {
            countryMap[k] = (countryMap[k] || 0) + v;
          }
        }
      });
      const deviceMap = {};
      (d._byDevice || []).forEach(dayMap => {
        if (dayMap) {
          const entries = dayMap instanceof Map ? dayMap.entries() : Object.entries(dayMap);
          for (const [k, v] of entries) {
            deviceMap[k] = (deviceMap[k] || 0) + v;
          }
        }
      });

      row.expand = {
        byCountry: Object.entries(countryMap).map(([k, v]) => ({ country: k, clicks: v })).sort((a, b) => b.clicks - a.clicks).slice(0, 20),
        byDevice: Object.entries(deviceMap).map(([k, v]) => ({ device: k, clicks: v })).sort((a, b) => b.clicks - a.clicks).slice(0, 20),
      };

      return row;
    });

    res.json({
      summary,
      chart: chartData,
      rows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    next(err);
  }
};

// ─── 3. DAILY REPORT ────────────────────────────────────────────────────────
// Day-by-day breakdown from DailyStat

exports.dailyReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, sort = '-date', page = 1, limit = 50 } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const match = dailyStatDateMatch(dateFrom, dateTo, offer_id, req.user);

    // Summary
    const summaryAgg = await DailyStat.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: '$clicks' },
          uniqueClicks: { $sum: '$uniqueClicks' },
          dupClicks: { $sum: '$duplicateClicks' },
          invalidClicks: { $sum: '$blockedClicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
    ]);
    const summary = buildSummary(summaryAgg[0] || {});

    // Chart — same as rows but sorted asc for chart display
    const chartAgg = await DailyStat.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$date',
          clicks: { $sum: '$clicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const chartData = chartAgg.map(c => ({
      date: c._id,
      clicks: c.clicks,
      conversions: c.conversions,
      revenue: Number(c.revenue.toFixed(2)),
      profit: Number((c.revenue - c.payout).toFixed(2)),
    }));

    // Rows
    const sortDir = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace(/^-/, '') === 'date' ? '_id' : sort.replace(/^-/, '');

    const countPipeline = [
      { $match: match },
      { $group: { _id: '$date' } },
      { $count: 'total' },
    ];
    const countRes = await DailyStat.aggregate(countPipeline);
    const total = countRes[0]?.total || 0;

    const data = await DailyStat.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$date',
          grossClicks: { $sum: '$clicks' },
          uniqueClicks: { $sum: '$uniqueClicks' },
          dupClicks: { $sum: '$duplicateClicks' },
          invalidClicks: { $sum: '$blockedClicks' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
      { $sort: { [sortField]: sortDir } },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
    ]);

    const rows = data.map(d => addRateFields({
      date: d._id,
      grossClicks: d.grossClicks,
      clicks: d.grossClicks - d.invalidClicks,
      uniqueClicks: d.uniqueClicks,
      dupClicks: d.dupClicks,
      invalidClicks: d.invalidClicks,
      conversions: d.conversions,
      revenue: d.revenue,
      payout: d.payout,
    }));

    res.json({
      summary,
      chart: chartData,
      rows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    next(err);
  }
};

// ─── 4. HOURLY REPORT ───────────────────────────────────────────────────────
// From Click collection, $group by hour. Max 7 day range.

exports.hourlyReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, timezone = 'UTC', sort = '-hour', page = 1, limit = 100 } = req.query;
    const dateFrom = from || daysAgo(1);
    const dateTo = to || todayStr();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));

    // Enforce max 7 day range
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const dayDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (dayDiff > 7) {
      return res.status(400).json({ error: 'Hourly report supports a maximum of 7 days range' });
    }

    const match = clickDateMatch(dateFrom, dateTo, offer_id, req.user);

    // Summary from same click data
    const summaryAgg = await Click.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: [{ $not: '$isDuplicate' }, 1, 0] } },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
    ]);
    const summary = buildSummary(summaryAgg[0] || {});

    // Rows — group by hour with timezone
    const hourFormat = '%Y-%m-%d %H:00';

    const countPipeline = [
      { $match: match },
      { $group: { _id: { $dateToString: { format: hourFormat, date: '$clickedAt', timezone } } } },
      { $count: 'total' },
    ];
    const countRes = await Click.aggregate(countPipeline);
    const total = countRes[0]?.total || 0;

    const sortDir = sort.startsWith('-') ? -1 : 1;

    const data = await Click.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: hourFormat, date: '$clickedAt', timezone } },
          grossClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: [{ $not: '$isDuplicate' }, 1, 0] } },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
      { $sort: { _id: sortDir } },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
    ]);

    const rows = data.map(d => addRateFields({
      hour: d._id,
      grossClicks: d.grossClicks,
      clicks: d.grossClicks - d.invalidClicks,
      uniqueClicks: d.uniqueClicks,
      dupClicks: d.dupClicks,
      invalidClicks: d.invalidClicks,
      conversions: d.conversions,
      revenue: d.revenue,
      payout: d.payout,
    }));

    // Chart — same data sorted ascending
    const chartData = [...rows].sort((a, b) => a.hour.localeCompare(b.hour)).map(r => ({
      date: r.hour,
      clicks: r.grossClicks,
      conversions: r.conversions,
      revenue: Number(r.revenue),
      profit: Number(r.profit),
    }));

    res.json({
      summary,
      chart: chartData,
      rows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    next(err);
  }
};

// ─── 5. LOG REPORT ──────────────────────────────────────────────────────────
// Raw click log with status badges, filters for status type

exports.logReport = async (req, res, next) => {
  try {
    const { from, to, offer_id, status = 'all', search, sort = '-clickedAt', page = 1, limit = 50 } = req.query;
    const dateFrom = from || daysAgo(7);
    const dateTo = to || todayStr();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const match = clickDateMatch(dateFrom, dateTo, offer_id, req.user);

    // Status filter
    switch (status) {
      case 'valid':
        match.isBlocked = { $ne: true };
        match.isDuplicate = { $ne: true };
        match.isBot = { $ne: true };
        break;
      case 'duplicates':
        match.isDuplicate = true;
        break;
      case 'blocked':
        match.isBlocked = true;
        break;
      case 'blocked_cap':
        match.isBlocked = true;
        match.blockReason = 'frequency_cap';
        break;
      case 'bots':
        match.isBot = true;
        break;
      case 'converted':
        match.converted = true;
        break;
      // 'all' — no extra filter
    }

    // Search filter (IP or clickId)
    if (search) {
      match.$or = [
        { ip: { $regex: search, $options: 'i' } },
        { clickId: { $regex: search, $options: 'i' } },
      ];
    }

    // Summary counts
    const baseMatch = clickDateMatch(dateFrom, dateTo, offer_id, req.user);
    const summaryAgg = await Click.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: [{ $not: '$isDuplicate' }, 1, 0] } },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
          botClicks: { $sum: { $cond: ['$isBot', 1, 0] } },
        },
      },
    ]);
    const s = summaryAgg[0] || {};
    const summary = {
      ...buildSummary(s),
      botClicks: s.botClicks || 0,
    };

    // Sort
    const sortDir = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace(/^-/, '');

    // Rows
    const total = await Click.countDocuments(match);
    const clicks = await Click.find(match)
      .sort({ [sortField]: sortDir })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('clickId offerId offerName clickedAt ip country city device os browser source subId1 subId2 isDuplicate isBlocked isBot isVpn blockReason converted conversionAt revenue payout referrer redirectUrl userAgent')
      .lean();

    const rows = clicks.map(c => {
      // Determine primary status (used for sorting/legacy single-badge consumers)
      let clickStatus = 'ok';
      if (c.isBot) clickStatus = 'bot';
      else if (c.isBlocked) clickStatus = 'blocked';
      else if (c.isDuplicate) clickStatus = 'duplicate';
      else if (c.isVpn) clickStatus = 'vpn';
      if (c.converted) clickStatus = 'converted';

      return {
        clickId: c.clickId,
        offerId: c.offerId,
        offerName: c.offerName || '—',
        clickedAt: c.clickedAt,
        ip: c.ip,
        country: c.country || '—',
        city: c.city || '—',
        device: c.device || '—',
        os: c.os || '—',
        browser: c.browser || '—',
        source: c.source || '—',
        subId1: c.subId1 || '—',
        subId2: c.subId2 || '—',
        status: clickStatus,
        // Explicit flags — a click can be BOTH blocked and duplicate at once
        // (frequency-cap block), so the UI shows both badges together.
        isDuplicate: !!c.isDuplicate,
        isBlocked: !!c.isBlocked,
        isBot: !!c.isBot,
        isVpn: !!c.isVpn,
        blockReason: c.blockReason || '',
        converted: c.converted || false,
        conversionAt: c.conversionAt || null,
        revenue: Number((c.revenue || 0).toFixed(2)),
        payout: Number((c.payout || 0).toFixed(2)),
        profit: Number(((c.revenue || 0) - (c.payout || 0)).toFixed(2)),
        referrer: c.referrer || '',
        redirectUrl: c.redirectUrl || '',
      };
    });

    res.json({
      summary,
      chart: [],
      rows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    next(err);
  }
};

// ─── 6. CSV EXPORT ──────────────────────────────────────────────────────────

exports.exportCsv = async (req, res, next) => {
  try {
    const { from, to, offer_id, type = 'daily' } = req.query;
    const dateFrom = from || daysAgo(30);
    const dateTo = to || todayStr();

    let headers, rows, filename;

    switch (type) {
      case 'conversion': {
        const match = clickDateMatch(dateFrom, dateTo, offer_id, req.user);
        match.converted = true;
        const data = await Click.find(match).sort({ conversionAt: -1 }).select('clickId offerName conversionAt conversionEvent revenue payout country device source').lean();
        headers = 'Click ID,Offer,Conversion At,Event,Revenue,Payout,Profit,Country,Device,Source';
        rows = data.map(d => `${d.clickId},"${d.offerName || ''}",${d.conversionAt?.toISOString() || ''},${d.conversionEvent || 'default'},${(d.revenue || 0).toFixed(2)},${(d.payout || 0).toFixed(2)},${((d.revenue || 0) - (d.payout || 0)).toFixed(2)},${d.country || ''},${d.device || ''},${d.source || ''}`);
        filename = `conversion_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      case 'offer': {
        const match = dailyStatDateMatch(dateFrom, dateTo, offer_id, req.user);
        const data = await DailyStat.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$offerId',
              offerName: { $first: '$offerName' },
              grossClicks: { $sum: '$clicks' },
              uniqueClicks: { $sum: '$uniqueClicks' },
              dupClicks: { $sum: '$duplicateClicks' },
              invalidClicks: { $sum: '$blockedClicks' },
              conversions: { $sum: '$conversions' },
              revenue: { $sum: '$revenue' },
              payout: { $sum: '$payout' },
            },
          },
          { $sort: { revenue: -1 } },
        ]);
        headers = 'Offer,Gross Clicks,Clicks,Unique,Dup,Invalid,CV,CVR,Revenue,Payout,Profit,Margin';
        rows = data.map(d => {
          const clicks = d.grossClicks - d.invalidClicks;
          const profit = d.revenue - d.payout;
          return `"${d.offerName || ''}",${d.grossClicks},${clicks},${d.uniqueClicks},${d.dupClicks},${d.invalidClicks},${d.conversions},${(safeDivide(d.conversions, clicks) * 100).toFixed(3)}%,${d.revenue.toFixed(2)},${d.payout.toFixed(2)},${profit.toFixed(2)},${(safeDivide(profit, d.revenue) * 100).toFixed(3)}%`;
        });
        filename = `offer_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      case 'hourly': {
        const match = clickDateMatch(dateFrom, dateTo, offer_id, req.user);
        const data = await Click.aggregate([
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$clickedAt' } },
              grossClicks: { $sum: 1 },
              uniqueClicks: { $sum: { $cond: [{ $not: '$isDuplicate' }, 1, 0] } },
              conversions: { $sum: { $cond: ['$converted', 1, 0] } },
              revenue: { $sum: '$revenue' },
              payout: { $sum: '$payout' },
            },
          },
          { $sort: { _id: -1 } },
        ]);
        headers = 'Hour,Gross Clicks,Unique,CV,Revenue,Payout,Profit';
        rows = data.map(d => `${d._id},${d.grossClicks},${d.uniqueClicks},${d.conversions},${d.revenue.toFixed(2)},${d.payout.toFixed(2)},${(d.revenue - d.payout).toFixed(2)}`);
        filename = `hourly_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      case 'log': {
        const match = clickDateMatch(dateFrom, dateTo, offer_id, req.user);
        const data = await Click.find(match).sort({ clickedAt: -1 }).limit(10000).select('clickId offerName clickedAt ip country device browser os source subId1 isDuplicate isBlocked isBot isVpn blockReason converted revenue payout').lean();
        headers = 'Click ID,Offer,Timestamp,IP,Country,Device,Browser,OS,Source,Sub1,Status,Revenue,Payout,Profit';
        rows = data.map(d => {
          // A click can carry more than one flag at once (e.g. a frequency-cap
          // block is both BLOCKED and DUP) — join every applicable label.
          const labels = [];
          if (d.isBot) labels.push('BOT');
          if (d.isBlocked) labels.push('BLOCKED');
          if (d.isDuplicate) labels.push('DUP');
          if (d.isVpn) labels.push('VPN');
          if (d.converted) labels.push('CONVERTED');
          const status = labels.length ? labels.join('+') : 'OK';
          return `${d.clickId},"${d.offerName || ''}",${d.clickedAt?.toISOString() || ''},${d.ip || ''},${d.country || ''},${d.device || ''},${d.browser || ''},${d.os || ''},${d.source || ''},${d.subId1 || ''},${status},${(d.revenue || 0).toFixed(2)},${(d.payout || 0).toFixed(2)},${((d.revenue || 0) - (d.payout || 0)).toFixed(2)}`;
        });
        filename = `log_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      default: {
        // daily
        const match = dailyStatDateMatch(dateFrom, dateTo, offer_id, req.user);
        const data = await DailyStat.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$date',
              grossClicks: { $sum: '$clicks' },
              uniqueClicks: { $sum: '$uniqueClicks' },
              dupClicks: { $sum: '$duplicateClicks' },
              invalidClicks: { $sum: '$blockedClicks' },
              conversions: { $sum: '$conversions' },
              revenue: { $sum: '$revenue' },
              payout: { $sum: '$payout' },
            },
          },
          { $sort: { _id: -1 } },
        ]);
        headers = 'Date,Gross Clicks,Clicks,Unique,Dup,Invalid,CV,CVR,Revenue,Payout,Profit,Margin';
        rows = data.map(d => {
          const clicks = d.grossClicks - d.invalidClicks;
          const profit = d.revenue - d.payout;
          return `${d._id},${d.grossClicks},${clicks},${d.uniqueClicks},${d.dupClicks},${d.invalidClicks},${d.conversions},${(safeDivide(d.conversions, clicks) * 100).toFixed(3)}%,${d.revenue.toFixed(2)},${d.payout.toFixed(2)},${profit.toFixed(2)},${(safeDivide(profit, d.revenue) * 100).toFixed(3)}%`;
        });
        filename = `daily_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
    }

    const csv = [headers, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

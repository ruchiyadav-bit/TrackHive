// NOTE: reports no longer read DailyStat. Its rows are pre-bucketed by UTC day,
// which cannot be re-bucketed into another timezone after the fact. Everything
// is now aggregated from the raw Click collection, where clickedAt/conversionAt
// are exact UTC instants that can be bucketed into any timezone at query time.
// DailyStat is still written (see utils/clickHelpers.js) and remains useful as a
// fast rollup if these queries ever get heavy at higher volume.
const Click = require('../models/Click');
const { visibleOfferIds, offerScopeMatch } = require('../utils/scope');
const Offer = require('../models/Offer');
const {
  resolveTimezone, zonedStartOfDayUtc, zonedEndOfDayUtc,
  todayInTz, daysAgoInTz,
} = require('../utils/appTime');
// Read-only team members get the same rows with the money taken out and a
// profit/loss badge put in. Applied at the res.json boundary so no report can
// ship a figure the viewer is not allowed to see — see utils/teamView.js.
const { teamReportPayload, earningsBadge, teamFields, loadSpend } = require('../utils/teamView');
const { isTeam } = require('../config/roles');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Timezone model (same as Everflow): event timestamps are stored in UTC and
 * bucketed into days at QUERY time using the timezone resolved per request
 * (?timezone= → Settings.timezone → UTC). Because nothing is baked into stored
 * data, changing the timezone re-buckets ALL history correctly, including rows
 * written before this behaviour existed.
 */

function todayStr(tz) {
  return todayInTz(tz);
}

function daysAgo(n, tz) {
  return daysAgoInTz(n, tz);
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

/**
 * Mongo $cond expression for "Blocked Clicks" — EVERY block, frequency-cap
 * included. This is the right subtrahend for the Clicks total: a blocked
 * visitor never reached the offer, so counting it in Clicks inflates the CVR
 * denominator. Invalid stays frequency-cap-free (see above) so a single click
 * is never shown in both the Dup and the Invalid card at once.
 */
const BLOCKED_CLICKS_EXPR = {
  $cond: ['$isBlocked', 1, 0],
};

/**
 * Mongo $cond expression for "Unique Clicks" on raw Click aggregations.
 * Excludes duplicates AND any blocked click (bot/geo/device/ip/frequency-cap)
 * — a blocked visitor was never actually delivered to the offer.
 */
const UNIQUE_CLICKS_EXPR = {
  $cond: [
    { $and: [{ $not: '$isDuplicate' }, { $not: '$isBlocked' }] },
    1,
    0,
  ],
};

/** Build summary metrics object from raw aggregated numbers */
function buildSummary(raw) {
  const grossClicks = raw.grossClicks || 0;
  const dupClicks = raw.dupClicks || 0;
  const invalidClicks = raw.invalidClicks || 0;
  // Subtract EVERY block, not just Invalid — a frequency-capped click was
  // never delivered to the offer, so it must not sit in the CVR denominator.
  // `?? invalidClicks` keeps older callers that don't supply blockedClicks working.
  const blockedClicks = raw.blockedClicks ?? invalidClicks;
  const clicks = grossClicks - blockedClicks;
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
    blockedClicks,
    totalCv: conversions,
    cv: conversions,
    cvr: Number(safeDivide(conversions, clicks) * 100).toFixed(3),
    // C* = cost side (what we PAY OUT), R* = revenue side (what we EARN).
    // Same convention as the offer wizard, where Revenue types are RP* and
    // Payout types CP*. These four previously all ran off revenue/profit, so
    // CPC showed RPC's value and RPC showed profit-per-click.
    cpc: Number(safeDivide(payout, clicks)).toFixed(4),
    cpa: Number(safeDivide(payout, conversions)).toFixed(2),
    rpc: Number(safeDivide(revenue, clicks)).toFixed(4),
    rpa: Number(safeDivide(revenue, conversions)).toFixed(2),
    revenue: Number(revenue).toFixed(2),
    payout: Number(payout).toFixed(2),
    profit: Number(profit).toFixed(2),
    margin: Number(safeDivide(profit, revenue) * 100).toFixed(3),
  };
}

/** Add computed rate fields to a row object */
function addRateFields(row) {
  const clicks = (row.grossClicks || row.clicks || 0) - (row.blockedClicks ?? row.invalidClicks ?? 0);
  const effectiveClicks = clicks > 0 ? clicks : (row.clicks || 0);
  const conversions = row.conversions || 0;
  const revenue = row.revenue || 0;
  const payout = row.payout || 0;
  const profit = revenue - payout;

  return {
    ...row,
    profit,
    cvr: Number(safeDivide(conversions, effectiveClicks) * 100).toFixed(3),
    // See buildSummary — C* = payout side, R* = revenue side.
    cpc: Number(safeDivide(payout, effectiveClicks)).toFixed(4),
    cpa: Number(safeDivide(payout, conversions)).toFixed(2),
    rpc: Number(safeDivide(revenue, effectiveClicks)).toFixed(4),
    rpa: Number(safeDivide(revenue, conversions)).toFixed(2),
    margin: Number(safeDivide(profit, revenue) * 100).toFixed(3),
  };
}

/**
 * Common date filter for Click-based queries.
 *
 * The from/to strings are LOCAL dates in `tz`; they're converted to the UTC
 * instants at which that local day starts and ends, so the range lines up with
 * the caller's calendar day. Previously this did `new Date(from)` (UTC midnight),
 * which in IST (UTC+5:30) cut the day at 05:30 local — so every click between
 * 00:00 and 05:29 IST was counted on the PREVIOUS day.
 *
 * `field` selects which timestamp to filter on — 'clickedAt' for click metrics,
 * 'conversionAt' for conversion metrics (conversions belong to the day the
 * postback landed, not the day the click happened).
 */
function clickDateMatch(from, to, offerId, scopeIds, tz, field = 'clickedAt', clickId = '') {
  const match = {
    [field]: { $gte: zonedStartOfDayUtc(from, tz), $lte: zonedEndOfDayUtc(to, tz) },
  };

  // `scopeIds` is what the caller is allowed to see at all (their own offers).
  // `offerId` is the optional UI filter on top of that. The scope must win: an
  // explicit offer_id in the query string must never widen visibility, or a
  // partner could read another partner's offer by guessing its id.
  Object.assign(match, offerScopeMatch(scopeIds));

  if (offerId) {
    const requested = toObjectId(offerId);
    const allowed = scopeIds === null ||
      scopeIds.some(id => String(id) === String(requested));
    match.offerId = allowed ? requested : { $in: [] };
  }

  // Optional Click ID search, available on every report. Matches ids that
  // START with what was typed, so a full id or its first few characters both
  // work. Click ids are lowercase hex; the anchored, case-sensitive regex can
  // use the clickId index.
  const cid = String(clickId || '').trim().toLowerCase();
  if (cid) {
    match.clickId = { $regex: '^' + cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
  }

  return match;
}

/** Local-day bucket expression for a timestamp field, evaluated in `tz`. */
function localDay(field, tz) {
  return { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } };
}

/** The click-side metric accumulators shared by the offer and daily reports. */
function clickMetricAccumulators() {
  return {
    grossClicks: { $sum: 1 },
    uniqueClicks: { $sum: UNIQUE_CLICKS_EXPR },
    dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
    invalidClicks: { $sum: INVALID_CLICKS_EXPR },
    blockedClicks: { $sum: BLOCKED_CLICKS_EXPR },
  };
}

/** Merge click-side and conversion-side aggregation results keyed by _id. */
function mergeByKey(clickRows, convRows) {
  const out = new Map();
  for (const c of clickRows) {
    out.set(String(c._id), {
      _id: c._id,
      grossClicks: c.grossClicks || 0,
      uniqueClicks: c.uniqueClicks || 0,
      dupClicks: c.dupClicks || 0,
      invalidClicks: c.invalidClicks || 0,
      blockedClicks: c.blockedClicks || 0,
      conversions: 0, revenue: 0, payout: 0,
      offerName: c.offerName,
    });
  }
  for (const v of convRows) {
    const key = String(v._id);
    const row = out.get(key) || {
      _id: v._id,
      grossClicks: 0, uniqueClicks: 0, dupClicks: 0, invalidClicks: 0, blockedClicks: 0,
      conversions: 0, revenue: 0, payout: 0,
      offerName: v.offerName,
    };
    row.conversions = v.conversions || 0;
    row.revenue = v.revenue || 0;
    row.payout = v.payout || 0;
    if (!row.offerName) row.offerName = v.offerName;
    out.set(key, row);
  }
  return [...out.values()];
}

/** Sort merged rows in JS (the merge happens outside Mongo). */
function sortRows(rows, sort) {
  const dir = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return rows.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === undefined && bv === undefined) return 0;
    // Numeric even when addRateFields stringified it (cvr, margin, cpc, ...)
    const an = Number(av);
    const bn = Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir;
    return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
  });
}

// ─── 1. CONVERSION REPORT ──────────────────────────────────────────────────
// Individual conversions from Click where converted: true

exports.conversionReport = async (req, res, next) => {
  try {
    // Everything below is limited to the offers this user created.
    // Applies to every role: [] means they own nothing and must match no
    // rows rather than all rows.
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, offer_id, sort = '-conversionAt', page = 1, limit = 50 } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgo(30, tz);
    const dateTo = to || todayStr(tz);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    // Conversions are windowed on conversionAt, not clickedAt
    const match = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'conversionAt', req.query.click_id);
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
    const clickMatch = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);
    const clickSummary = await Click.aggregate([
      { $match: clickMatch },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: 1 },
          uniqueClicks: { $sum: UNIQUE_CLICKS_EXPR },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
          blockedClicks: { $sum: BLOCKED_CLICKS_EXPR },
        },
      },
    ]);
    const cs = clickSummary[0] || { grossClicks: 0, uniqueClicks: 0, dupClicks: 0, invalidClicks: 0, blockedClicks: 0 };

    const summary = buildSummary({
      grossClicks: cs.grossClicks,
      uniqueClicks: cs.uniqueClicks,
      dupClicks: cs.dupClicks,
      invalidClicks: cs.invalidClicks,
      blockedClicks: cs.blockedClicks,
      conversions: rawSummary.conversions,
      revenue: rawSummary.revenue,
      payout: rawSummary.payout,
    });

    // Chart data — conversions by date
    const chart = await Click.aggregate([
      { $match: match },
      {
        $group: {
          _id: localDay('conversionAt', tz),
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
      .select('clickId offerId offerName conversionAt conversionEvent revenue payout saleAmount ip country device source subId1')
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
      // The merchant's order total, for reference. teamView strips it.
      saleAmount: Number((r.saleAmount || 0).toFixed(2)),
      ip: r.ip,
      country: r.country || '—',
      device: r.device || '—',
      source: r.source || '—',
      subId1: r.subId1 || '—',
    }));

    res.json(await teamReportPayload({
      summary,
      chart: chartData,
      rows: formattedRows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
      // The client renders every row timestamp in this zone. Omitting it made
      // the rows silently fall back to the VIEWER's browser timezone while the
      // summary above them stayed bucketed in the account zone — one page, two
      // timezones, and totals that refused to line up with the advertiser's.
      timezone: tz,
    }, req.user, { from: dateFrom, to: dateTo, rowMode: 'event', scopeIds, offerId: offer_id }));
  } catch (err) {
    next(err);
  }
};

// ─── 2. OFFER REPORT ────────────────────────────────────────────────────────
// Grouped by offer. Aggregated from the raw Click collection (NOT DailyStat) so
// day buckets honour the requested timezone — DailyStat rows are pre-bucketed in
// UTC and cannot be re-bucketed after the fact. Expand rows include
// country/device breakdown, computed from the same raw clicks.

exports.offerReport = async (req, res, next) => {
  try {
    // Everything below is limited to the offers this user created.
    // Applies to every role: [] means they own nothing and must match no
    // rows rather than all rows.
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, offer_id, sort = '-revenue', page = 1, limit = 50 } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgo(30, tz);
    const dateTo = to || todayStr(tz);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    // Clicks are windowed on clickedAt; conversions on conversionAt.
    const clickMatch = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);
    const convMatch = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'conversionAt', req.query.click_id);
    convMatch.converted = true;

    const [clicksByOffer, convByOffer] = await Promise.all([
      Click.aggregate([
        { $match: clickMatch },
        { $group: { _id: '$offerId', offerName: { $first: '$offerName' }, ...clickMetricAccumulators() } },
      ]),
      Click.aggregate([
        { $match: convMatch },
        {
          $group: {
            _id: '$offerId',
            offerName: { $first: '$offerName' },
            conversions: { $sum: 1 },
            revenue: { $sum: '$revenue' },
            payout: { $sum: '$payout' },
          },
        },
      ]),
    ]);

    const merged = mergeByKey(clicksByOffer, convByOffer);

    // Summary across every offer in range
    const totals = merged.reduce((a, r) => ({
      grossClicks: a.grossClicks + r.grossClicks,
      uniqueClicks: a.uniqueClicks + r.uniqueClicks,
      dupClicks: a.dupClicks + r.dupClicks,
      invalidClicks: a.invalidClicks + r.invalidClicks,
      blockedClicks: a.blockedClicks + r.blockedClicks,
      conversions: a.conversions + r.conversions,
      revenue: a.revenue + r.revenue,
      payout: a.payout + r.payout,
    }), { grossClicks: 0, uniqueClicks: 0, dupClicks: 0, invalidClicks: 0, blockedClicks: 0, conversions: 0, revenue: 0, payout: 0 });
    const summary = buildSummary(totals);

    // Chart — by local day across the whole selection
    const [clicksByDay, convByDay] = await Promise.all([
      Click.aggregate([
        { $match: clickMatch },
        { $group: { _id: localDay('clickedAt', tz), grossClicks: { $sum: 1 } } },
      ]),
      Click.aggregate([
        { $match: convMatch },
        {
          $group: {
            _id: localDay('conversionAt', tz),
            conversions: { $sum: 1 },
            revenue: { $sum: '$revenue' },
            payout: { $sum: '$payout' },
          },
        },
      ]),
    ]);
    const dayMap = new Map();
    for (const c of clicksByDay) dayMap.set(c._id, { date: c._id, clicks: c.grossClicks, conversions: 0, revenue: 0, payout: 0 });
    for (const v of convByDay) {
      const row = dayMap.get(v._id) || { date: v._id, clicks: 0, conversions: 0, revenue: 0, payout: 0 };
      row.conversions = v.conversions; row.revenue = v.revenue; row.payout = v.payout;
      dayMap.set(v._id, row);
    }
    const chartData = [...dayMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(c => ({
        date: c.date,
        clicks: c.clicks,
        conversions: c.conversions,
        revenue: Number(c.revenue.toFixed(2)),
        profit: Number((c.revenue - c.payout).toFixed(2)),
      }));

    // Rows — sort + paginate the merged set
    const total = merged.length;
    const sorted = sortRows(merged.map(r => addRateFields({
      offerId: r._id,
      offerName: r.offerName || '—',
      grossClicks: r.grossClicks,
      clicks: r.grossClicks - (r.blockedClicks ?? r.invalidClicks),
      uniqueClicks: r.uniqueClicks,
      dupClicks: r.dupClicks,
      invalidClicks: r.invalidClicks,
      blockedClicks: r.blockedClicks ?? r.invalidClicks,
      conversions: r.conversions,
      revenue: r.revenue,
      payout: r.payout,
    })), sort);
    const pageRows = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Expand data (country + device) for just the offers on this page
    const pageOfferIds = pageRows.map(r => r.offerId).filter(Boolean);
    let expandByOffer = new Map();
    if (pageOfferIds.length) {
      const expandMatch = { ...clickMatch, offerId: { $in: pageOfferIds } };
      const [byCountry, byDevice] = await Promise.all([
        Click.aggregate([
          { $match: expandMatch },
          { $group: { _id: { offerId: '$offerId', k: '$country' }, clicks: { $sum: 1 } } },
        ]),
        Click.aggregate([
          { $match: expandMatch },
          { $group: { _id: { offerId: '$offerId', k: '$device' }, clicks: { $sum: 1 } } },
        ]),
      ]);
      const push = (map, offerId, key, field, value, clicks) => {
        const id = String(offerId);
        if (!map.has(id)) map.set(id, { byCountry: [], byDevice: [] });
        map.get(id)[field].push({ [value]: key || '—', clicks });
      };
      for (const r of byCountry) push(expandByOffer, r._id.offerId, r._id.k, 'byCountry', 'country', r.clicks);
      for (const r of byDevice) push(expandByOffer, r._id.offerId, r._id.k, 'byDevice', 'device', r.clicks);
      for (const v of expandByOffer.values()) {
        v.byCountry.sort((a, b) => b.clicks - a.clicks);
        v.byDevice.sort((a, b) => b.clicks - a.clicks);
        v.byCountry = v.byCountry.slice(0, 20);
        v.byDevice = v.byDevice.slice(0, 20);
      }
    }
    for (const row of pageRows) {
      row.expand = expandByOffer.get(String(row.offerId)) || { byCountry: [], byDevice: [] };
    }

    res.json(await teamReportPayload({
      summary,
      chart: chartData,
      rows: pageRows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
      timezone: tz,
    }, req.user, { from: dateFrom, to: dateTo, rowKey: 'offerId', scopeIds, offerId: offer_id }));
  } catch (err) {
    next(err);
  }
};

// ─── 3. DAILY REPORT ────────────────────────────────────────────────────────
// Day-by-day breakdown, aggregated from raw Clicks in the requested timezone.

exports.dailyReport = async (req, res, next) => {
  try {
    // Everything below is limited to the offers this user created.
    // Applies to every role: [] means they own nothing and must match no
    // rows rather than all rows.
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, offer_id, sort = '-date', page = 1, limit = 50 } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgo(30, tz);
    const dateTo = to || todayStr(tz);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const clickMatch = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);
    const convMatch = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'conversionAt', req.query.click_id);
    convMatch.converted = true;

    const [clicksByDay, convByDay] = await Promise.all([
      Click.aggregate([
        { $match: clickMatch },
        { $group: { _id: localDay('clickedAt', tz), ...clickMetricAccumulators() } },
      ]),
      Click.aggregate([
        { $match: convMatch },
        {
          $group: {
            _id: localDay('conversionAt', tz),
            conversions: { $sum: 1 },
            revenue: { $sum: '$revenue' },
            payout: { $sum: '$payout' },
          },
        },
      ]),
    ]);

    const merged = mergeByKey(clicksByDay, convByDay);

    const totals = merged.reduce((a, r) => ({
      grossClicks: a.grossClicks + r.grossClicks,
      uniqueClicks: a.uniqueClicks + r.uniqueClicks,
      dupClicks: a.dupClicks + r.dupClicks,
      invalidClicks: a.invalidClicks + r.invalidClicks,
      blockedClicks: a.blockedClicks + r.blockedClicks,
      conversions: a.conversions + r.conversions,
      revenue: a.revenue + r.revenue,
      payout: a.payout + r.payout,
    }), { grossClicks: 0, uniqueClicks: 0, dupClicks: 0, invalidClicks: 0, blockedClicks: 0, conversions: 0, revenue: 0, payout: 0 });
    const summary = buildSummary(totals);

    const chartData = [...merged]
      .sort((a, b) => String(a._id).localeCompare(String(b._id)))
      .map(c => ({
        date: c._id,
        clicks: c.grossClicks,
        conversions: c.conversions,
        revenue: Number(c.revenue.toFixed(2)),
        profit: Number((c.revenue - c.payout).toFixed(2)),
      }));

    const total = merged.length;
    const sorted = sortRows(merged.map(r => addRateFields({
      date: r._id,
      grossClicks: r.grossClicks,
      clicks: r.grossClicks - (r.blockedClicks ?? r.invalidClicks),
      uniqueClicks: r.uniqueClicks,
      dupClicks: r.dupClicks,
      invalidClicks: r.invalidClicks,
      blockedClicks: r.blockedClicks ?? r.invalidClicks,
      conversions: r.conversions,
      revenue: r.revenue,
      payout: r.payout,
    })), sort === '-date' ? '-date' : sort);
    const pageRows = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json(await teamReportPayload({
      summary,
      chart: chartData,
      rows: pageRows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
      timezone: tz,
    }, req.user, { from: dateFrom, to: dateTo, rowKey: 'date', scopeIds, offerId: offer_id }));
  } catch (err) {
    next(err);
  }
};
// ─── 4. HOURLY REPORT ───────────────────────────────────────────────────────
// From Click collection, $group by hour. Max 7 day range.

exports.hourlyReport = async (req, res, next) => {
  try {
    // Everything below is limited to the offers this user created.
    // Applies to every role: [] means they own nothing and must match no
    // rows rather than all rows.
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, offer_id, sort = '-hour', page = 1, limit = 100 } = req.query;
    // Explicit ?timezone= wins, else the account default (Settings.timezone)
    const tz = await resolveTimezone(req);
    const timezone = tz;
    const dateFrom = from || daysAgo(1, tz);
    const dateTo = to || todayStr(tz);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));

    // Enforce max 7 day range
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const dayDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (dayDiff > 7) {
      return res.status(400).json({ error: 'Hourly report supports a maximum of 7 days range' });
    }

    const match = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);

    // Summary from same click data
    const summaryAgg = await Click.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: 1 },
          uniqueClicks: { $sum: UNIQUE_CLICKS_EXPR },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
          blockedClicks: { $sum: BLOCKED_CLICKS_EXPR },
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
          uniqueClicks: { $sum: UNIQUE_CLICKS_EXPR },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
          blockedClicks: { $sum: BLOCKED_CLICKS_EXPR },
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
      clicks: d.grossClicks - (d.blockedClicks ?? d.invalidClicks),
      uniqueClicks: d.uniqueClicks,
      dupClicks: d.dupClicks,
      invalidClicks: d.invalidClicks,
      blockedClicks: d.blockedClicks ?? d.invalidClicks,
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

    res.json(await teamReportPayload({
      summary,
      chart: chartData,
      rows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
      // The client renders every row timestamp in this zone. Omitting it made
      // the rows silently fall back to the VIEWER's browser timezone while the
      // summary above them stayed bucketed in the account zone — one page, two
      // timezones, and totals that refused to line up with the advertiser's.
      timezone: tz,
    }, req.user, { from: dateFrom, to: dateTo, rowKey: null, scopeIds, offerId: offer_id }));
  } catch (err) {
    next(err);
  }
};

// ─── 5. LOG REPORT ──────────────────────────────────────────────────────────
// Raw click log with status badges, filters for status type

exports.logReport = async (req, res, next) => {
  try {
    // Everything below is limited to the offers this user created.
    // Applies to every role: [] means they own nothing and must match no
    // rows rather than all rows.
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, offer_id, status = 'all', search, sort = '-clickedAt', page = 1, limit = 50 } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgo(7, tz);
    const dateTo = to || todayStr(tz);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const match = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);

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
    const baseMatch = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);
    const summaryAgg = await Click.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          grossClicks: { $sum: 1 },
          uniqueClicks: { $sum: UNIQUE_CLICKS_EXPR },
          dupClicks: { $sum: { $cond: ['$isDuplicate', 1, 0] } },
          invalidClicks: { $sum: INVALID_CLICKS_EXPR },
          blockedClicks: { $sum: BLOCKED_CLICKS_EXPR },
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
      .select('clickId offerId offerName clickedAt ip country city device os browser source subId1 subId2 isDuplicate isBlocked isBot isVpn blockReason converted conversionAt conversionStatus revenue payout referrer redirectUrl userAgent')
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
        // Approval status the network reported (Katalys: approved / pending /
        // reversed). Empty for networks that don't send one.
        conversionStatus: c.conversionStatus || '',
        revenue: Number((c.revenue || 0).toFixed(2)),
        payout: Number((c.payout || 0).toFixed(2)),
        profit: Number(((c.revenue || 0) - (c.payout || 0)).toFixed(2)),
        referrer: c.referrer || '',
        redirectUrl: c.redirectUrl || '',
      };
    });

    res.json(await teamReportPayload({
      summary,
      chart: [],
      rows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      dateRange: { from: dateFrom, to: dateTo },
      // The client renders every row timestamp in this zone. Omitting it made
      // the rows silently fall back to the VIEWER's browser timezone while the
      // summary above them stayed bucketed in the account zone — one page, two
      // timezones, and totals that refused to line up with the advertiser's.
      timezone: tz,
    }, req.user, { from: dateFrom, to: dateTo, rowMode: 'event', scopeIds, offerId: offer_id }));
  } catch (err) {
    next(err);
  }
};

// ─── 6. CSV EXPORT ──────────────────────────────────────────────────────────

exports.exportCsv = async (req, res, next) => {
  try {
    // Everything below is limited to the offers this user created.
    // Applies to every role: [] means they own nothing and must match no
    // rows rather than all rows.
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, offer_id, type = 'daily' } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgo(30, tz);
    const dateTo = to || todayStr(tz);

    // A team member's CSV must carry exactly what their screen carries.
    // Exporting is the obvious way around a hidden column, so the same rules
    // are applied here rather than trusted to the UI.
    const team = isTeam(req.user);
    const fields = team ? teamFields(req.user) : null;
    // Entered ad spend for the range — the badge is scored against it.
    const spend = team ? await loadSpend(req.user, { from: dateFrom, to: dateTo, scopeIds, offerId: offer_id }) : null;

    // Helper: same click/conversion split the on-screen reports use, so a CSV
    // always matches what the user just looked at.
    const aggregateBy = async (groupExpr, convGroupExpr) => {
      const cm = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);
      const vm = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'conversionAt', req.query.click_id);
      vm.converted = true;
      const [ca, va] = await Promise.all([
        Click.aggregate([
          { $match: cm },
          { $group: { _id: groupExpr, offerName: { $first: '$offerName' }, ...clickMetricAccumulators() } },
        ]),
        Click.aggregate([
          { $match: vm },
          {
            $group: {
              _id: convGroupExpr,
              offerName: { $first: '$offerName' },
              conversions: { $sum: 1 },
              revenue: { $sum: '$revenue' },
              payout: { $sum: '$payout' },
            },
          },
        ]),
      ]);
      return mergeByKey(ca, va);
    };

    /** Quote a free-text cell so a comma in an offer name cannot shift columns. */
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const money = v => (Number(v) || 0).toFixed(2);
    const pct = v => `${(Number(v) || 0).toFixed(3)}%`;

    /**
     * Columns are declared rather than concatenated so the team filter has
     * something to filter. `money: true` never reaches a team member, and
     * `field` ties a column to the manager's per-member toggle.
     */
    const build = (cols, data, badgeOpts = { mode: 'none' }) => {
      const visible = cols.filter(c => {
        if (!team) return true;
        if (c.money) return false;
        if (c.field && !fields[c.field]) return false;
        return true;
      });
      if (team && fields.status) {
        visible.push({
          h: 'Performance',
          v: d => {
            const cv = d.conversions !== undefined
              ? d.conversions
              : (d.converted !== undefined ? (d.converted ? 1 : 0) : 1);
            const { spendFor, ...rest } = badgeOpts;
            const opts = spendFor ? { ...rest, spend: spendFor(d) } : rest;
            return q(earningsBadge(d.revenue, cv, opts).pnlLabel || '');
          },
        });
      }
      return {
        headers: visible.map(c => c.h).join(','),
        rows: data.map(d => visible.map(c => c.v(d)).join(',')),
      };
    };

    let headers, rows, filename;

    switch (type) {
      case 'conversion': {
        const match = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'conversionAt', req.query.click_id);
        match.converted = true;
        const data = await Click.find(match).sort({ conversionAt: -1 }).select('clickId offerName conversionAt conversionEvent revenue payout country device source').lean();
        ({ headers, rows } = build([
          { h: 'Click ID',      v: d => d.clickId || '' },
          { h: 'Offer',         v: d => q(d.offerName) },
          { h: 'Conversion At', v: d => d.conversionAt?.toISOString() || '' },
          { h: 'Event',         v: d => d.conversionEvent || 'default' },
          { h: 'Revenue', money: true, v: d => money(d.revenue) },
          { h: 'Payout',  money: true, v: d => money(d.payout) },
          { h: 'Profit',  money: true, v: d => money((d.revenue || 0) - (d.payout || 0)) },
          { h: 'Country', field: 'country', v: d => d.country || '' },
          { h: 'Device',  field: 'device',  v: d => d.device || '' },
          { h: 'Source',  field: 'source',  v: d => d.source || '' },
        ], data, { mode: 'event' }));
        filename = `conversion_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      case 'offer': {
        const data = (await aggregateBy('$offerId', '$offerId'))
          .sort((a, b) => b.revenue - a.revenue);
        const clicksOf = d => d.grossClicks - (d.blockedClicks ?? d.invalidClicks);
        ({ headers, rows } = build([
          { h: 'Offer',        v: d => q(d.offerName) },
          { h: 'Gross Clicks', field: 'grossClicks',   v: d => d.grossClicks },
          { h: 'Clicks',       field: 'clicks',        v: d => clicksOf(d) },
          { h: 'Unique',       field: 'uniqueClicks',  v: d => d.uniqueClicks },
          { h: 'Dup',          field: 'dupClicks',     v: d => d.dupClicks },
          { h: 'Invalid',      field: 'invalidClicks', v: d => d.invalidClicks },
          { h: 'CV',           field: 'conversions',   v: d => d.conversions },
          { h: 'CVR',          field: 'cvr',           v: d => pct(safeDivide(d.conversions, clicksOf(d)) * 100) },
          { h: 'Revenue', money: true, v: d => money(d.revenue) },
          { h: 'Payout',  money: true, v: d => money(d.payout) },
          { h: 'Profit',  money: true, v: d => money(d.revenue - d.payout) },
          { h: 'Margin',  money: true, v: d => pct(safeDivide(d.revenue - d.payout, d.revenue) * 100) },
        ], data, {
          mode: 'aggregate',
          spendFor: d => (spend && spend.byOffer.has(String(d._id)) ? spend.byOffer.get(String(d._id)) : undefined),
        }));
        filename = `offer_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      case 'hourly': {
        const match = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);
        const data = await Click.aggregate([
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$clickedAt', timezone: tz } },
              grossClicks: { $sum: 1 },
              uniqueClicks: { $sum: UNIQUE_CLICKS_EXPR },
              conversions: { $sum: { $cond: ['$converted', 1, 0] } },
              revenue: { $sum: '$revenue' },
              payout: { $sum: '$payout' },
            },
          },
          { $sort: { _id: -1 } },
        ]);
        ({ headers, rows } = build([
          { h: 'Hour',         v: d => d._id },
          { h: 'Gross Clicks', field: 'grossClicks',  v: d => d.grossClicks },
          { h: 'Unique',       field: 'uniqueClicks', v: d => d.uniqueClicks },
          { h: 'CV',           field: 'conversions',  v: d => d.conversions },
          { h: 'Revenue', money: true, v: d => money(d.revenue) },
          { h: 'Payout',  money: true, v: d => money(d.payout) },
          { h: 'Profit',  money: true, v: d => money(d.revenue - d.payout) },
        ], data, { mode: 'none' }));
        filename = `hourly_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      case 'log': {
        const match = clickDateMatch(dateFrom, dateTo, offer_id, scopeIds, tz, 'clickedAt', req.query.click_id);
        const data = await Click.find(match).sort({ clickedAt: -1 }).limit(10000).select('clickId offerName clickedAt ip country device browser os source subId1 isDuplicate isBlocked isBot isVpn blockReason converted revenue payout').lean();
        // A click can carry more than one flag at once (e.g. a frequency-cap
        // block is both BLOCKED and DUP) — join every applicable label.
        const clickStatus = d => {
          const labels = [];
          if (d.isBot) labels.push('BOT');
          if (d.isBlocked) labels.push('BLOCKED');
          if (d.isDuplicate) labels.push('DUP');
          if (d.isVpn) labels.push('VPN');
          if (d.converted) labels.push('CONVERTED');
          return labels.length ? labels.join('+') : 'OK';
        };
        ({ headers, rows } = build([
          { h: 'Click ID',  v: d => d.clickId || '' },
          { h: 'Offer',     v: d => q(d.offerName) },
          { h: 'Timestamp', v: d => d.clickedAt?.toISOString() || '' },
          { h: 'IP',        v: d => d.ip || '' },
          { h: 'Country',   field: 'country', v: d => d.country || '' },
          { h: 'Device',    field: 'device',  v: d => d.device || '' },
          { h: 'Browser',   v: d => d.browser || '' },
          { h: 'OS',        v: d => d.os || '' },
          { h: 'Source',    field: 'source',  v: d => d.source || '' },
          { h: 'Sub1',      v: d => d.subId1 || '' },
          { h: 'Status',    v: d => clickStatus(d) },
          { h: 'Revenue', money: true, v: d => money(d.revenue) },
          { h: 'Payout',  money: true, v: d => money(d.payout) },
          { h: 'Profit',  money: true, v: d => money((d.revenue || 0) - (d.payout || 0)) },
        ], data, { mode: 'event' }));
        filename = `log_${dateFrom}_to_${dateTo}.csv`;
        break;
      }
      default: {
        // daily — same Click-based, timezone-bucketed source as the on-screen report
        const data = (await aggregateBy(localDay('clickedAt', tz), localDay('conversionAt', tz)))
          .sort((a, b) => String(b._id).localeCompare(String(a._id)));
        const clicksOf = d => d.grossClicks - (d.blockedClicks ?? d.invalidClicks);
        ({ headers, rows } = build([
          { h: 'Date',         v: d => d._id },
          { h: 'Gross Clicks', field: 'grossClicks',   v: d => d.grossClicks },
          { h: 'Clicks',       field: 'clicks',        v: d => clicksOf(d) },
          { h: 'Unique',       field: 'uniqueClicks',  v: d => d.uniqueClicks },
          { h: 'Dup',          field: 'dupClicks',     v: d => d.dupClicks },
          { h: 'Invalid',      field: 'invalidClicks', v: d => d.invalidClicks },
          { h: 'CV',           field: 'conversions',   v: d => d.conversions },
          { h: 'CVR',          field: 'cvr',           v: d => pct(safeDivide(d.conversions, clicksOf(d)) * 100) },
          { h: 'Revenue', money: true, v: d => money(d.revenue) },
          { h: 'Payout',  money: true, v: d => money(d.payout) },
          { h: 'Profit',  money: true, v: d => money(d.revenue - d.payout) },
          { h: 'Margin',  money: true, v: d => pct(safeDivide(d.revenue - d.payout, d.revenue) * 100) },
        ], data, {
          mode: 'aggregate',
          spendFor: d => (spend && spend.byDate.has(String(d._id)) ? spend.byDate.get(String(d._id)) : undefined),
        }));
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

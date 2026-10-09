/**
 * Team view — what a read-only team member is allowed to see of a report.
 *
 * Two jobs, both done on the SERVER and never on the client:
 *
 *  1. Remove money. revenue, payout, profit, sale amount and every rate
 *     derived from them are deleted from the summary, from every row, and from
 *     the chart. Hiding a column in React hides nothing — the numbers are still
 *     one Network-tab click away — so the fields must not be in the response.
 *
 *  2. Replace them with a signal. Each aggregate row (and the summary) gets a
 *     performance badge — V. Good / Good / Avg / Breakeven / Loss — computed
 *     here from revenue and the ad spend the team member entered (see below).
 *
 * On top of that the manager's per-member toggles are applied, so a field the
 * manager switched off for this person is deleted too.
 *
 * Call this LAST, right before res.json, on a payload that is already scoped.
 */

const { isTeam, normalizeTeamReportFields } = require('../config/roles');

/**
 * Every money-bearing key a report can carry. The rates are here because they
 * are revenue divided by a click count we DO publish — shipping one hands the
 * revenue back by arithmetic.
 */
const MONEY_KEYS = [
  'revenue', 'payout', 'profit', 'margin',
  'cpc', 'cpa', 'rpc', 'rpa', 'epc',
  'totalRevenue', 'totalPayout', 'totalProfit',
  'revenueAmount', 'payoutAmount',
  // The merchant's order total. Not our money, but still money.
  'saleAmount',
];

/** Which response key(s) each toggle controls. */
const FIELD_KEYS = {
  grossClicks: ['grossClicks'],
  clicks: ['clicks'],
  uniqueClicks: ['uniqueClicks'],
  dupClicks: ['dupClicks'],
  invalidClicks: ['invalidClicks'],
  conversions: ['conversions', 'cv', 'totalCv'],
  cvr: ['cvr'],
  status: ['pnlStatus', 'pnlLabel'],
  country: ['country'],
  device: ['device'],
  source: ['source'],
};

/**
 * Performance scoring — driven by the ad spend a team member enters.
 *
 *   Profit   = Revenue − Ad Spend
 *   Profit % = Profit ÷ Ad Spend × 100   — profit measured against what was spent
 *
 *   Spend $50, revenue $100 → profit $50  → 100%  (profit equals the spend)
 *   Spend $50, revenue $150 → profit $100 → 200%  (profit is double the spend)
 *
 *   Profit % ≥ 200   V. Good
 *   Profit % ≥ 100   Good
 *   Profit % ≥ 50    Avg
 *   Profit % ≥ 0     Breakeven
 *   below 0          Loss — and the team member sees HOW MUCH was lost
 *                    (e.g. "Loss −$10.00"). On profit they see the status only.
 *
 * A number exactly on a line belongs to the higher tier (exactly 100% = Good).
 *
 * Fixed rules, not settings: the manager does not type per-period targets.
 */
const SCORE_TIERS = { veryGood: 200, good: 100, avg: 50, breakeven: 0 };

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Inclusive day count for a 'YYYY-MM-DD' range; 1 for a single day. */
function daysInRange(from, to) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/**
 * How many conversions a row represents.
 *
 * Three row shapes reach here: aggregate rows carry `conversions`, log rows
 * carry a `converted` flag, and conversion rows are one conversion each and
 * carry neither.
 */
function rowConversions(row) {
  if (row.conversions !== undefined) return num(row.conversions);
  if (row.converted !== undefined) return row.converted ? 1 : 0;
  return 1;
}

/**
 * Profit % = (Revenue − Ad Spend) ÷ Ad Spend × 100.
 *
 * null when no spend was entered — there is no ratio to take, which is NOT the
 * same as a ratio of zero. The caller renders null as an em dash.
 * Rounded to 2 decimals so a value that should sit exactly on a line (100%)
 * is not pushed under it by floating-point noise.
 */
function performanceScore(revenue, spend) {
  const spent = num(spend);
  if (spent <= 0) return null;
  return Math.round(((num(revenue) - spent) / spent) * 100 * 100) / 100;
}

/** "−$10.00" — the loss amount a team member is shown on a Loss row. */
function lossText(amount) {
  const v = Math.abs(num(amount));
  return `−$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tierForScore(score) {
  if (score === null) return { pnlStatus: 'NO_DATA', pnlLabel: 'No data' };
  if (score >= SCORE_TIERS.veryGood) return { pnlStatus: 'VERY_GOOD', pnlLabel: 'V. Good' };
  if (score >= SCORE_TIERS.good) return { pnlStatus: 'GOOD', pnlLabel: 'Good' };
  if (score >= SCORE_TIERS.avg) return { pnlStatus: 'AVG', pnlLabel: 'Avg' };
  if (score >= SCORE_TIERS.breakeven) return { pnlStatus: 'BREAK_EVEN', pnlLabel: 'Breakeven' };
  return { pnlStatus: 'LOSS', pnlLabel: 'Loss' };
}

/**
 * The badge for one set of figures. Carries NO percentage. Carries an amount
 * ONLY on a Loss — "Loss −$10.00" — so the team sees how much was lost; on
 * profit the status alone is shown.
 *
 * `mode`:
 *   'aggregate' — an offer / day row. Needs `spend` (undefined = nobody has
 *                 entered spend for it yet → Pending).
 *   'event'     — one conversion or click: state only.
 *   'none'      — strip the money, add no badge (hourly rows, all-time totals).
 *
 * Lands on `pnlStatus`, NOT `status` (the click log has its own `status`).
 */
function earningsBadge(revenue, conversions, { mode = 'aggregate', spend } = {}) {
  const rev = num(revenue);
  const cv = num(conversions);

  if (mode === 'none') return {};

  if (mode === 'event') {
    if (cv <= 0) return { pnlStatus: 'NO_DATA', pnlLabel: '—' };
    return rev > 0
      ? { pnlStatus: 'GOOD', pnlLabel: 'Converted' }
      : { pnlStatus: 'PENDING', pnlLabel: 'Pending' };
  }

  if (spend === undefined || spend === null) {
    // Nothing ran and nothing was entered.
    if (cv <= 0 && rev === 0) return { pnlStatus: 'NO_DATA', pnlLabel: 'No data' };
    // Traffic or revenue exists but no spend has been entered for it yet.
    return { pnlStatus: 'PENDING', pnlLabel: 'Pending' };
  }

  const spent = num(spend);

  // Spend entered as zero. No ratio exists, so tierForScore is not consulted:
  // earning on no spend is as good as it gets, earning nothing on no spend is
  // simply a row that never ran.
  if (spent <= 0) {
    return rev > 0
      ? { pnlStatus: 'VERY_GOOD', pnlLabel: 'V. Good' }
      : { pnlStatus: 'NO_DATA', pnlLabel: 'No data' };
  }

  // rev === 0 lands here too: −100% → Loss, which is exactly right when the
  // money went out and nothing came back.
  const tier = tierForScore(performanceScore(rev, spent));
  if (tier.pnlStatus === 'LOSS') tier.pnlLabel = `Loss ${lossText(spent - rev)}`;
  return tier;
}

/**
 * Load entered ad spend for the offers a user may see, over a date range.
 *
 * Returns sums keyed three ways so any report shape can find its figure:
 *   byOffer     offerId            → spend
 *   byDate      'YYYY-MM-DD'       → spend
 *   byOfferDate 'offerId|date'     → spend
 * A key that is absent means NO entry exists (→ Pending), which is different
 * from an entry of 0.
 */
async function loadSpend(user, { from, to, scopeIds, offerId } = {}) {
  const AdSpend = require('../models/AdSpend');
  const { dataOwnerId } = require('./scope');
  const mongoose = require('mongoose');

  const empty = { total: undefined, byOffer: new Map(), byDate: new Map(), byOfferDate: new Map(), count: 0 };
  const ids = Array.isArray(scopeIds) ? scopeIds.map(String) : null;

  const match = { createdBy: dataOwnerId(user) };
  if (from && to) match.date = { $gte: from, $lte: to };
  if (offerId) {
    if (ids && !ids.includes(String(offerId))) return empty;
    try { match.offerId = new mongoose.Types.ObjectId(String(offerId)); } catch { return empty; }
  } else if (ids) {
    match.offerId = { $in: scopeIds };
  }

  let rows = [];
  try {
    rows = await AdSpend.aggregate([
      { $match: match },
      { $group: { _id: { offerId: '$offerId', date: '$date' }, amount: { $sum: '$amount' } } },
    ]);
  } catch {
    return empty;
  }
  if (!rows.length) return empty;

  const out = { total: 0, byOffer: new Map(), byDate: new Map(), byOfferDate: new Map(), count: rows.length };
  const add = (map, key, v) => map.set(key, (map.get(key) || 0) + v);
  for (const r of rows) {
    const o = String(r._id.offerId);
    const d = r._id.date;
    const a = num(r.amount);
    out.total += a;
    add(out.byOffer, o, a);
    add(out.byDate, d, a);
    add(out.byOfferDate, `${o}|${d}`, a);
  }
  return out;
}

/** Spend for one report row, or undefined when nobody entered any. */
function spendForRow(row, rowKey, spend) {
  if (!spend || !rowKey) return undefined;
  if (rowKey === 'offerId') {
    const k = String(row.offerId ?? row._id ?? '');
    return spend.byOffer.has(k) ? spend.byOffer.get(k) : undefined;
  }
  if (rowKey === 'date') {
    const k = String(row.date ?? row._id ?? '');
    return spend.byDate.has(k) ? spend.byDate.get(k) : undefined;
  }
  return undefined;
}

/** Delete every money key from a plain object, in place. */
function stripMoney(obj) {
  for (const k of MONEY_KEYS) delete obj[k];
  return obj;
}

/**
 * Strip money from ANY document, at every depth, for a team member.
 *
 * Offers and advertisers are not reports, so they never pass through
 * teamReportPayload — but an offer carries totalRevenue / totalPayout /
 * totalProfit and a revenueAmount on every configured event. Recursion is not
 * caution for its own sake: those event amounts are nested two levels down and
 * a shallow delete would have shipped them.
 */
function stripMoneyDeep(value) {
  if (Array.isArray(value)) return value.map(stripMoneyDeep);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (MONEY_KEYS.includes(k)) continue;
    out[k] = stripMoneyDeep(v);
  }
  return out;
}

/** stripMoneyDeep for team members; everyone else gets the document untouched. */
function stripMoneyForUser(doc, user) {
  if (!isTeam(user) || !doc) return doc;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return stripMoneyDeep(plain);
}

/** Delete the response keys behind every toggle this member does not have. */
function applyToggles(obj, fields) {
  for (const [field, keys] of Object.entries(FIELD_KEYS)) {
    if (fields[field]) continue;
    for (const k of keys) delete obj[k];
  }
  return obj;
}

/** One row: badge in, money out, toggles applied. */
function sanitizeRow(row, fields, badgeOpts) {
  const out = { ...row };
  Object.assign(out, earningsBadge(out.revenue, rowConversions(out), badgeOpts));
  stripMoney(out);
  return applyToggles(out, fields);
}

/** The summary cards. Scored over the whole selected range. */
function sanitizeSummary(summary, fields, badgeOpts) {
  if (!summary) return summary;
  const out = { ...summary };
  Object.assign(out, earningsBadge(
    out.revenue,
    out.totalCv ?? out.cv ?? out.conversions,
    badgeOpts
  ));
  stripMoney(out);
  return applyToggles(out, fields);
}

/**
 * The performance graph. Its points carry revenue and profit, which would have
 * leaked the whole picture as a line.
 */
function sanitizeChart(chart, fields) {
  if (!Array.isArray(chart)) return chart;
  return chart.map(point => {
    const out = stripMoney({ ...point });
    if (!fields.conversions) delete out.conversions;
    if (!fields.clicks) delete out.clicks;
    return out;
  });
}

/** The toggles for this user, defaulted and complete. */
function teamFields(user) {
  const stored = user?.teamReportFields;
  return normalizeTeamReportFields(
    stored && typeof stored.toObject === 'function' ? stored.toObject() : stored
  );
}

/**
 * Entry point. Returns the payload untouched for anyone who is not a team
 * member, so a caller can wrap res.json unconditionally.
 *
 * opts:
 *   from, to   the report range ('YYYY-MM-DD')
 *   rowMode    'aggregate' | 'event' | 'none'
 *   rowKey     'offerId' | 'date' | null — how a row finds its ad spend.
 *              null on an aggregate report (hourly) means rows get no badge;
 *              spend is entered per day and cannot be split into hours.
 *   scopeIds   visibleOfferIds(user)
 *   offerId    the report's optional offer filter
 */
async function teamReportPayload(payload, user, opts = {}) {
  if (!isTeam(user)) return payload;

  const fields = teamFields(user);
  const rowMode = opts.rowMode || 'aggregate';
  const spend = await loadSpend(user, {
    from: opts.from, to: opts.to, scopeIds: opts.scopeIds, offerId: opts.offerId,
  });

  const rowOpts = row => {
    if (rowMode !== 'aggregate') return { mode: rowMode };
    if (!opts.rowKey) return { mode: 'none' };
    return { mode: 'aggregate', spend: spendForRow(row, opts.rowKey, spend) };
  };

  return {
    ...payload,
    summary: sanitizeSummary(payload.summary, fields, { mode: 'aggregate', spend: spend.total }),
    chart: sanitizeChart(payload.chart, fields),
    rows: Array.isArray(payload.rows)
      ? payload.rows.map(r => sanitizeRow(r, fields, rowOpts(r)))
      : payload.rows,
    teamView: true,
    teamReportFields: fields,
  };
}

/**
 * The Dashboard is not a report, but its cards and top-offer list carry the
 * same figures. Same treatment, object by object. Pass `spend` in badgeOpts.
 */
async function sanitizeDashboardObject(obj, user, badgeOpts) {
  if (!isTeam(user) || !obj || typeof obj !== 'object') return obj;
  return sanitizeRow(obj, teamFields(user), badgeOpts);
}

/**
 * Strip money from a list of dashboard rows. `badgeOpts.spendFor(item)` gives
 * the spend for one item when the list is scored.
 */
async function sanitizeDashboardList(list, user, badgeOpts = {}) {
  if (!isTeam(user) || !Array.isArray(list)) return list;
  const fields = teamFields(user);
  const { spendFor, ...rest } = badgeOpts;
  return list.map(item => {
    const plain = typeof item?.toObject === 'function' ? item.toObject() : item;
    const opts = spendFor ? { ...rest, spend: spendFor(plain) } : rest;
    return sanitizeRow(plain, fields, opts);
  });
}

module.exports = {
  MONEY_KEYS,
  SCORE_TIERS,
  stripMoneyDeep,
  stripMoneyForUser,
  FIELD_KEYS,
  daysInRange,
  performanceScore,
  tierForScore,
  earningsBadge,
  loadSpend,
  spendForRow,
  sanitizeRow,
  sanitizeSummary,
  sanitizeChart,
  sanitizeDashboardObject,
  sanitizeDashboardList,
  teamFields,
  teamReportPayload,
};

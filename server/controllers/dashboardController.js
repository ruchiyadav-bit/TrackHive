const Offer = require('../models/Offer');
const { ownerFilter, visibleOfferIds, offerScopeMatch } = require('../utils/scope');
const Click = require('../models/Click');
const {
  resolveTimezone, zonedStartOfDayUtc, zonedEndOfDayUtc, todayInTz, daysAgoInTz,
} = require('../utils/appTime');
// The Dashboard carries the same money as the reports do. A read-only team
// member must not read it here either — see utils/teamView.js.
const {
  sanitizeDashboardObject, sanitizeDashboardList, sanitizeChart, teamFields, loadSpend,
} = require('../utils/teamView');
const { isTeam } = require('../config/roles');

/**
 * Like the reports, the dashboard aggregates from the raw Click collection and
 * buckets days in the requested timezone at query time (?timezone= →
 * Settings.timezone → UTC). Reading DailyStat here would pin every figure to a
 * UTC day boundary: in IST (UTC+5:30) the day would cut at 05:30 local, so all
 * traffic between 00:00 and 05:29 IST landed on the previous day's row.
 */

/** Clicks are windowed on clickedAt, conversions on conversionAt. */
function dayWindow(from, to, tz, field) {
  return { [field]: { $gte: zonedStartOfDayUtc(from, tz), $lte: zonedEndOfDayUtc(to, tz) } };
}

function localDay(field, tz) {
  return { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } };
}

exports.getSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const tz = await resolveTimezone(req);
    // Partners only ever see their own offers on the dashboard.
    const offerFilter = { status: { $ne: 'deleted' }, ...ownerFilter(req.user) };

    // Offer access filtering
    if (req.user.offerAccess === 'specific') {
      offerFilter._id = { $in: req.user.allowedOffers };
    }

    // Resolve the non-deleted offer ids ONCE and scope both windows to them.
    // getDayStats used to copy only offerFilter._id, dropping the
    // status != 'deleted' clause — so a soft-deleted offer's traffic still
    // counted in "Today" while getAggregateStats excluded it from "All Time",
    // and today's revenue could exceed all-time revenue.
    const visibleOffers = await Offer.find(offerFilter)
      .select('status totalClicks totalConversions totalRevenue totalPayout totalProfit');
    const visibleIds = visibleOffers.map(o => o._id);

    const [offers, todayStats, allTimeStats] = await Promise.all([
      Promise.resolve(visibleOffers),
      getDayStats(from || todayInTz(tz), to || todayInTz(tz), visibleIds, tz),
      getAggregateStats(offerFilter),
    ]);

    const activeOffers = offers.filter(o => o.status === 'active').length;

    res.json({
      totalOffers: offers.length,
      activeOffers,
      // The "today" card is scored against the daily target for the days it
      // actually covers. "All time" is not: it spans an unknown number of
      // months, so any target would be meaningless — it just loses its money.
      today: await sanitizeDashboardObject(todayStats, req.user, {
        mode: 'aggregate',
        spend: isTeam(req.user)
          ? (await loadSpend(req.user, { from: from || todayInTz(tz), to: to || todayInTz(tz), scopeIds: visibleIds })).total
          : undefined,
      }),
      allTime: await sanitizeDashboardObject(allTimeStats, req.user, { mode: 'none' }),
    });
  } catch (err) {
    next(err);
  }
};

exports.getChart = async (req, res, next) => {
  try {
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, metric = 'clicks', groupBy = 'day' } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgoInTz(30, tz);
    const dateTo = to || todayInTz(tz);

    // groupBy=hour used to return day buckets (both branches of the ternary
    // were '$date'), silently giving daily data for an hourly request.
    if (groupBy !== 'day' && groupBy !== 'hour') {
      return res.status(400).json({ error: "groupBy must be 'day' or 'hour'" });
    }
    const fmt = groupBy === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
    const bucket = (field) => ({ $dateToString: { format: fmt, date: `$${field}`, timezone: tz } });

    const scope = {};
    // visibleOfferIds() already intersects createdBy with allowedOffers.
    // Re-applying allowedOffers here used to OVERWRITE that and hand back
    // offers the partner did not create.
    Object.assign(scope, offerScopeMatch(scopeIds));

    const clickMatch = { ...scope, ...dayWindow(dateFrom, dateTo, tz, 'clickedAt') };
    const convMatch = { ...scope, ...dayWindow(dateFrom, dateTo, tz, 'conversionAt'), converted: true };

    const [clickAgg, convAgg] = await Promise.all([
      Click.aggregate([
        { $match: clickMatch },
        {
          $group: {
            _id: bucket('clickedAt'),
            clicks: { $sum: 1 },
            uniqueClicks: {
              $sum: { $cond: [{ $and: [{ $not: '$isDuplicate' }, { $not: '$isBlocked' }] }, 1, 0] },
            },
            blockedClicks: { $sum: { $cond: ['$isBlocked', 1, 0] } },
          },
        },
      ]),
      Click.aggregate([
        { $match: convMatch },
        {
          $group: {
            _id: bucket('conversionAt'),
            conversions: { $sum: 1 },
            revenue: { $sum: '$revenue' },
            payout: { $sum: '$payout' },
          },
        },
      ]),
    ]);

    const map = new Map();
    const blank = (id) => ({
      _id: id, clicks: 0, uniqueClicks: 0, blockedClicks: 0,
      conversions: 0, revenue: 0, payout: 0,
    });
    for (const c of clickAgg) {
      map.set(c._id, { ...blank(c._id), clicks: c.clicks, uniqueClicks: c.uniqueClicks, blockedClicks: c.blockedClicks });
    }
    for (const v of convAgg) {
      const row = map.get(v._id) || blank(v._id);
      row.conversions = v.conversions;
      row.revenue = v.revenue;
      row.payout = v.payout;
      map.set(v._id, row);
    }

    const stats = [...map.values()].sort((a, b) => String(a._id).localeCompare(String(b._id)));

    const points = stats.map(s => ({
        date: s._id,
        clicks: s.clicks,
        uniqueClicks: s.uniqueClicks,
        conversions: s.conversions,
        revenue: s.revenue,
        payout: s.payout,
        profit: s.revenue - s.payout,
        blockedClicks: s.blockedClicks,
        cr: s.clicks > 0 ? (s.conversions / s.clicks * 100).toFixed(2) : 0,
        epc: s.clicks > 0 ? (s.revenue / s.clicks).toFixed(4) : 0,
    }));

    res.json({
      timezone: tz,
      data: isTeam(req.user) ? sanitizeChart(points, teamFields(req.user)) : points,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTopOffers = async (req, res, next) => {
  try {
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to, sort = 'revenue', limit = 10 } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgoInTz(30, tz);
    const dateTo = to || todayInTz(tz);

    const scope = {};
    // visibleOfferIds() already intersects createdBy with allowedOffers.
    // Re-applying allowedOffers here used to OVERWRITE that and hand back
    // offers the partner did not create.
    Object.assign(scope, offerScopeMatch(scopeIds));

    const clickMatch = { ...scope, ...dayWindow(dateFrom, dateTo, tz, 'clickedAt') };
    const convMatch = { ...scope, ...dayWindow(dateFrom, dateTo, tz, 'conversionAt'), converted: true };

    const [clickAgg, convAgg] = await Promise.all([
      Click.aggregate([
        { $match: clickMatch },
        { $group: { _id: '$offerId', offerName: { $first: '$offerName' }, clicks: { $sum: 1 } } },
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

    const map = new Map();
    for (const c of clickAgg) {
      map.set(String(c._id), {
        _id: c._id, offerName: c.offerName,
        clicks: c.clicks, conversions: 0, revenue: 0, payout: 0, profit: 0,
      });
    }
    for (const v of convAgg) {
      const key = String(v._id);
      const row = map.get(key) || { _id: v._id, offerName: v.offerName, clicks: 0, conversions: 0, revenue: 0, payout: 0, profit: 0 };
      row.conversions = v.conversions;
      row.revenue = v.revenue;
      row.payout = v.payout;
      row.profit = v.revenue - v.payout;
      if (!row.offerName) row.offerName = v.offerName;
      map.set(key, row);
    }

    const sortField = ['revenue', 'clicks', 'conversions', 'profit'].includes(sort) ? sort : 'revenue';
    // Clamp: $limit: 0 / NaN made MongoDB throw, and an unbounded ?limit=100000
    // would dump every offer.
    const lim = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const topOffers = [...map.values()]
      .sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0))
      .slice(0, lim);

    res.json({
      offers: await sanitizeDashboardList(topOffers, req.user, isTeam(req.user) ? await (async () => {
        const spend = await loadSpend(req.user, { from: dateFrom, to: dateTo, scopeIds });
        return {
          mode: 'aggregate',
          spendFor: o => (spend.byOffer.has(String(o._id)) ? spend.byOffer.get(String(o._id)) : undefined),
        };
      })() : {}),
      timezone: tz,
    });
  } catch (err) {
    next(err);
  }
};

exports.getRecentClicks = async (req, res, next) => {
  try {
    const scopeIds = await visibleOfferIds(req.user);
    const filter = {};
    // visibleOfferIds() already intersects createdBy with allowedOffers.
    // Re-applying allowedOffers here used to OVERWRITE that and hand back
    // offers the partner did not create.
    Object.assign(filter, offerScopeMatch(scopeIds));

    const clicks = await Click.find(filter)
      .sort({ clickedAt: -1 })
      .limit(20)
      .select('clickId offerName country device browser converted revenue clickedAt');

    // The client renders clickedAt in this timezone — without it the rows fall
    // back to the viewer's browser zone and stop matching the dashboard totals.
    res.json({
      // One click each — a single event cannot be scored against a daily target.
      clicks: await sanitizeDashboardList(clicks, req.user, { mode: 'event' }),
      timezone: await resolveTimezone(req),
    });
  } catch (err) {
    next(err);
  }
};

exports.getGeoBreakdown = async (req, res, next) => {
  try {
    const scopeIds = await visibleOfferIds(req.user);
    const { from, to } = req.query;
    const tz = await resolveTimezone(req);
    const dateFrom = from || daysAgoInTz(30, tz);
    const dateTo = to || todayInTz(tz);

    const match = dayWindow(dateFrom, dateTo, tz, 'clickedAt');
    // visibleOfferIds() already intersects createdBy with allowedOffers.
    // Re-applying allowedOffers here used to OVERWRITE that and hand back
    // offers the partner did not create.
    Object.assign(match, offerScopeMatch(scopeIds));

    const agg = await Click.aggregate([
      { $match: match },
      { $group: { _id: '$country', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 50 },
    ]);

    res.json({ data: agg.map(g => ({ country: g._id || '—', clicks: g.clicks })), timezone: tz });
  } catch (err) {
    next(err);
  }
};

// Helpers

async function getDayStats(from, to, offerIds, tz) {
  // offerScopeMatch, NOT a truthiness check: an empty array means "this user
  // owns nothing" and must match no rows. The old ternary turned that into {},
  // which matched the entire Click collection.
  const scope = offerScopeMatch(offerIds);

  const [clickAgg, convAgg] = await Promise.all([
    Click.aggregate([
      { $match: { ...scope, ...dayWindow(from, to, tz, 'clickedAt') } },
      {
        $group: {
          _id: null,
          clicks: { $sum: 1 },
          uniqueClicks: {
            $sum: { $cond: [{ $and: [{ $not: '$isDuplicate' }, { $not: '$isBlocked' }] }, 1, 0] },
          },
          blockedClicks: { $sum: { $cond: ['$isBlocked', 1, 0] } },
        },
      },
    ]),
    Click.aggregate([
      { $match: { ...scope, ...dayWindow(from, to, tz, 'conversionAt'), converted: true } },
      {
        $group: {
          _id: null,
          conversions: { $sum: 1 },
          revenue: { $sum: '$revenue' },
          payout: { $sum: '$payout' },
        },
      },
    ]),
  ]);

  const c = clickAgg[0] || {};
  const v = convAgg[0] || {};
  const revenue = v.revenue || 0;
  const payout = v.payout || 0;

  return {
    clicks: c.clicks || 0,
    uniqueClicks: c.uniqueClicks || 0,
    blockedClicks: c.blockedClicks || 0,
    conversions: v.conversions || 0,
    revenue,
    payout,
    profit: revenue - payout,
  };
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

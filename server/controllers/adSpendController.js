/**
 * Ad Spend — a team member enters what they spent on an offer on a given day;
 * the manager sees every entry next to the revenue it earned.
 *
 *   GET    /api/ad-spend/offers   offers the user may enter spend for
 *   GET    /api/ad-spend          entries (+ report figures for a manager)
 *   POST   /api/ad-spend          add or update { offerId, date, amount }
 *   DELETE /api/ad-spend/:id      remove an entry
 *
 * Scoring rules live in utils/teamView.js (Profit % = (Revenue − Spend) ÷ Spend × 100).
 *
 * A team member is read-only everywhere else; these writes are the one
 * exception, allow-listed in middleware/auth.js.
 */
const mongoose = require('mongoose');
const AdSpend = require('../models/AdSpend');
const Offer = require('../models/Offer');
const Click = require('../models/Click');
const User = require('../models/User');
const { dataOwnerId, visibleOfferIds, denyNotFound } = require('../utils/scope');
const { isTeam } = require('../config/roles');
const {
  resolveTimezone, zonedStartOfDayUtc, zonedEndOfDayUtc, todayInTz, daysAgoInTz,
} = require('../utils/appTime');
const { earningsBadge, performanceScore } = require('../utils/teamView');

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

function isValidDate(str) {
  if (!DATE_RX.test(str || '')) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

/** GET /api/ad-spend/offers */
exports.listOffers = async (req, res, next) => {
  try {
    const ids = await visibleOfferIds(req.user);
    const offers = await Offer.find({ _id: { $in: ids } })
      .select('_id name status')
      .sort({ name: 1 })
      .lean();
    res.json({ offers: offers.map(o => ({ _id: o._id, name: o.name, status: o.status })) });
  } catch (err) {
    next(err);
  }
};

/**
 * Revenue per offer per local day, for the given offer ids and range —
 * bucketed on conversionAt in the account timezone, same as the Daily report.
 */
async function revenueByOfferDate(offerIds, from, to, tz) {
  if (!offerIds.length) return new Map();
  const rows = await Click.aggregate([
    {
      $match: {
        offerId: { $in: offerIds },
        converted: true,
        conversionAt: { $gte: zonedStartOfDayUtc(from, tz), $lte: zonedEndOfDayUtc(to, tz) },
      },
    },
    {
      $group: {
        _id: {
          offerId: '$offerId',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$conversionAt', timezone: tz } },
        },
        revenue: { $sum: '$revenue' },
        conversions: { $sum: 1 },
      },
    },
  ]);
  const map = new Map();
  for (const r of rows) {
    map.set(`${r._id.offerId}|${r._id.date}`, { revenue: r.revenue || 0, conversions: r.conversions || 0 });
  }
  return map;
}

/** GET /api/ad-spend?from=&to=&offer_id=&member= */
exports.list = async (req, res, next) => {
  try {
    const tz = await resolveTimezone(req);
    const from = isValidDate(req.query.from) ? req.query.from : daysAgoInTz(30, tz);
    const to = isValidDate(req.query.to) ? req.query.to : todayInTz(tz);
    const team = isTeam(req.user);

    const scopeIds = await visibleOfferIds(req.user);
    const scopeSet = new Set(scopeIds.map(String));

    const match = { createdBy: dataOwnerId(req.user), date: { $gte: from, $lte: to } };
    if (req.query.offer_id) {
      if (!scopeSet.has(String(req.query.offer_id))) return res.json({ rows: [], summary: null, members: [], from, to, timezone: tz });
      match.offerId = new mongoose.Types.ObjectId(String(req.query.offer_id));
    } else {
      match.offerId = { $in: scopeIds };
    }
    if (!team && req.query.member && mongoose.isValidObjectId(req.query.member)) {
      match.enteredBy = new mongoose.Types.ObjectId(String(req.query.member));
    }

    const entries = await AdSpend.find(match).sort({ date: -1, offerName: 1 }).lean();

    // Group every entry by offer + day: that is the unit revenue is earned in.
    const groups = new Map();
    for (const e of entries) {
      const key = `${e.offerId}|${e.date}`;
      if (!groups.has(key)) {
        groups.set(key, { offerId: e.offerId, offerName: e.offerName, date: e.date, spend: 0, entries: [] });
      }
      const g = groups.get(key);
      g.spend += e.amount;
      g.entries.push(e);
    }

    // A team member's badge must use the offer's TOTAL spend that day, even if
    // a colleague entered part of it — so load all entries for those keys.
    if (!team && match.enteredBy) {
      // Manager filtered to one member: totals still include everyone.
      const others = await AdSpend.find({
        createdBy: match.createdBy,
        offerId: match.offerId instanceof mongoose.Types.ObjectId ? match.offerId : { $in: scopeIds },
        date: match.date,
        enteredBy: { $ne: match.enteredBy },
      }).lean();
      for (const e of others) {
        const g = groups.get(`${e.offerId}|${e.date}`);
        if (g) g.spend += e.amount;
      }
    }

    const offerIds = [...new Set([...groups.values()].map(g => String(g.offerId)))]
      .map(id => new mongoose.Types.ObjectId(id));
    const revenue = await revenueByOfferDate(offerIds, from, to, tz);

    const memberIds = [...new Set(entries.map(e => String(e.enteredBy)))];
    const users = await User.find({ _id: { $in: memberIds } }).select('_id name email').lean();
    const nameOf = new Map(users.map(u => [String(u._id), u.name || u.email]));

    if (team) {
      // Only this member's own entries; badge only — no revenue, no score.
      const me = String(req.user._id);
      const rows = [];
      for (const g of groups.values()) {
        const r = revenue.get(`${g.offerId}|${g.date}`) || { revenue: 0, conversions: 0 };
        for (const e of g.entries) {
          if (String(e.enteredBy) !== me) continue;
          rows.push({
            _id: e._id,
            offerId: e.offerId,
            offerName: e.offerName,
            date: e.date,
            amount: round2(e.amount),
            ...earningsBadge(r.revenue, r.conversions, { mode: 'aggregate', spend: g.spend }),
          });
        }
      }
      rows.sort((a, b) => b.date.localeCompare(a.date) || String(a.offerName).localeCompare(String(b.offerName)));
      return res.json({ rows, from, to, timezone: tz, teamView: true });
    }

    // Manager / owner: full figures.
    let totSpend = 0;
    let totRevenue = 0;
    let totConv = 0;
    const rows = [...groups.values()].map(g => {
      const r = revenue.get(`${g.offerId}|${g.date}`) || { revenue: 0, conversions: 0 };
      totSpend += g.spend;
      totRevenue += r.revenue;
      totConv += r.conversions;
      const score = performanceScore(r.revenue, g.spend);
      return {
        offerId: g.offerId,
        offerName: g.offerName,
        date: g.date,
        members: [...new Set(g.entries.map(e => nameOf.get(String(e.enteredBy)) || '—'))],
        entries: g.entries.map(e => ({
          _id: e._id,
          member: nameOf.get(String(e.enteredBy)) || '—',
          amount: round2(e.amount),
        })),
        spend: round2(g.spend),
        revenue: round2(r.revenue),
        net: round2(r.revenue - g.spend),
        conversions: r.conversions,
        score: score === null ? null : round2(score),
        ...earningsBadge(r.revenue, r.conversions, { mode: 'aggregate', spend: g.spend }),
      };
    }).sort((a, b) => b.date.localeCompare(a.date) || String(a.offerName).localeCompare(String(b.offerName)));

    const totScore = performanceScore(totRevenue, totSpend);
    const summary = {
      spend: round2(totSpend),
      revenue: round2(totRevenue),
      net: round2(totRevenue - totSpend),
      score: totScore === null ? null : round2(totScore),
      ...(rows.length ? earningsBadge(totRevenue, totConv, { mode: 'aggregate', spend: totSpend }) : {}),
    };

    // Team members of this manager / partner, for the filter dropdown.
    const members = await User.find({ teamOwner: req.user._id }).select('_id name email').sort({ name: 1 }).lean();

    res.json({
      rows,
      summary,
      members: members.map(m => ({ _id: m._id, name: m.name || m.email })),
      from,
      to,
      timezone: tz,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/ad-spend  { offerId, date, amount } — add or update. */
exports.upsert = async (req, res, next) => {
  try {
    const { offerId, date } = req.body || {};
    const amount = Number(req.body?.amount);
    const tz = await resolveTimezone(req);

    if (!offerId || !mongoose.isValidObjectId(offerId)) return res.status(400).json({ error: 'Select an offer' });
    if (!isValidDate(date)) return res.status(400).json({ error: 'Select a valid date' });
    if (date > todayInTz(tz)) return res.status(400).json({ error: 'Date cannot be in the future' });
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Enter a valid ad spend amount' });

    const scopeIds = await visibleOfferIds(req.user);
    if (!scopeIds.some(id => String(id) === String(offerId))) return denyNotFound(res, 'Offer not found');

    const offer = await Offer.findById(offerId).select('name').lean();
    if (!offer) return denyNotFound(res, 'Offer not found');

    const entry = await AdSpend.findOneAndUpdate(
      { enteredBy: req.user._id, offerId, date },
      {
        $set: { amount: round2(amount), offerName: offer.name, createdBy: dataOwnerId(req.user) },
        $setOnInsert: { enteredBy: req.user._id, offerId, date },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ entry });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/ad-spend/:id — own entry, or any entry in the caller's own book (manager or partner). */
exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return denyNotFound(res, 'Entry not found');
    const entry = await AdSpend.findById(req.params.id);
    if (!entry) return denyNotFound(res, 'Entry not found');

    const own = String(entry.enteredBy) === String(req.user._id);
    // The owner of the book (a manager or a partner — never a team member) may
    // remove any entry their own team made in it.
    const bookOwner = !isTeam(req.user) && String(entry.createdBy) === String(req.user._id);
    if (!own && !bookOwner) return denyNotFound(res, 'Entry not found');

    await entry.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

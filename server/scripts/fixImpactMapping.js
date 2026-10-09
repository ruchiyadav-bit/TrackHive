/**
 * One-time repair for the inverted Impact revenue/payout mapping.
 *
 * WHAT WENT WRONG
 * ---------------
 * The Impact postback preset used to read:
 *
 *     revenue = {Amount}    <- Sale Amount: the customer's order total, the
 *                              MERCHANT's money. It never reaches us.
 *     payout  = {Payout}    <- Action Earnings: the commission Impact pays US.
 *                              This is our actual income.
 *
 * Both numbers arrived correctly; they landed in the wrong fields. "Payout"
 * means opposite things in the two systems — to Impact it is what they pay us,
 * to TrackHive it is what we pay someone downstream — and we pay nobody.
 *
 * The visible damage is not the two columns (a human can read across them) but
 * every TOTAL: summary cards, daily reports and offer totals all sum `revenue`,
 * so each of them reports the merchant's turnover as ours. On the verified
 * sample that is ~5x too high, and the factor differs per offer because it is
 * really the commission rate (Mystic lab 20%, geetahair 10%).
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * Per affected conversion:
 *
 *     saleAmount = old revenue     ($119.98 — the merchant's order total)
 *     revenue    = old payout      ($24.00  — our real commission)
 *     payout     = 0               (we pay nobody)
 *     profit     = revenue
 *
 * Nothing is discarded. Both numbers survive, they simply swap places, which is
 * why --rollback can put them back exactly. Offer totals and DailyStat rows are
 * moved by the same deltas in the same run, because the offer pages and the
 * daily report read those pre-aggregated sums and would otherwise keep showing
 * the old figures.
 *
 * SAFETY
 * ------
 *   - Dry run is the DEFAULT. Nothing is written without --apply.
 *   - Scope is narrow: only advertisers whose network is `impact`, only
 *     conversions with payout > 0 and no saleAmount, only before the cutoff.
 *     Every other network is untouched.
 *   - Migrated rows are stamped `mappingFixedAt`. That makes the run
 *     idempotent (a second run finds nothing) and gives --rollback an exact
 *     set to undo — it never has to guess from the numbers, which matters
 *     because rows booked AFTER the fix look identical by value.
 *   - --offer lets you do one offer first, check it against Impact's own
 *     report, and only then run the rest.
 *
 * Take a mongodump before the first --apply anyway. This is production data.
 *
 * USAGE
 * -----
 *   node server/scripts/fixImpactMapping.js                     # dry run, everything in scope
 *   node server/scripts/fixImpactMapping.js --offer="Mystic lab"# dry run, one offer
 *   node server/scripts/fixImpactMapping.js --offer="Mystic lab" --apply
 *   node server/scripts/fixImpactMapping.js --apply             # the rest
 *   node server/scripts/fixImpactMapping.js --rollback --apply  # undo everything this script did
 *
 *   --before=2026-09-18        only conversions before this date (default: now)
 *   --network=impact           advertiser network to scope to (default: impact)
 *   --limit=50                 cap the rows touched, for a cautious first run
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Advertiser = require('../models/Advertiser');
const Offer = require('../models/Offer');

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
const has = name => argv.includes(`--${name}`);
const val = (name, fallback = null) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const APPLY = has('apply');
const ROLLBACK = has('rollback');
const NETWORK = val('network', 'impact');
const OFFER_FILTER = val('offer');
const LIMIT = Number(val('limit', 0)) || 0;

const cutoffRaw = val('before');
const CUTOFF = cutoffRaw ? new Date(cutoffRaw) : new Date();
if (Number.isNaN(CUTOFF.getTime())) {
  console.error(`--before="${cutoffRaw}" is not a date I can read. Use 2026-09-18 or a full ISO timestamp.`);
  process.exit(1);
}

// ---------------------------------------------------------------- formatting

const money = n => `$${(Number(n) || 0).toFixed(2)}`;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const rule = (c = '-') => console.log(c.repeat(78));

/**
 * The date key a DailyStat row was written under.
 *
 * updateDailyStats() keys on `new Date().toISOString().split('T')[0]` at the
 * moment the postback lands — UTC, not the report timezone — so the conversion
 * timestamp in UTC is what finds the row again. Getting this wrong does not
 * corrupt anything: the delta simply lands on a row that does not exist and is
 * reported as "missing" below.
 */
const statDate = c => {
  const d = c.conversionAt || c.updatedAt || c.createdAt;
  return d ? new Date(d).toISOString().slice(0, 10) : null;
};

// ---------------------------------------------------------------- main

(async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const clicks = db.collection('clicks');

  try {
    // -- scope: which offers are we allowed to touch -----------------------

    const advertisers = await Advertiser.find({ network: NETWORK }).select('_id name').lean();
    if (!advertisers.length) {
      console.log(`No advertisers with network "${NETWORK}". Nothing to do.`);
      return;
    }

    const offerQuery = { advertiser: { $in: advertisers.map(a => a._id) } };
    if (OFFER_FILTER) {
      offerQuery.$or = [
        { name: new RegExp(OFFER_FILTER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        ...(mongoose.isValidObjectId(OFFER_FILTER) ? [{ _id: new mongoose.Types.ObjectId(OFFER_FILTER) }] : []),
      ];
    }

    const offers = await Offer.find(offerQuery).select('_id name advertiser').lean();
    if (!offers.length) {
      console.log(`No ${NETWORK} offers${OFFER_FILTER ? ` matching "${OFFER_FILTER}"` : ''}. Nothing to do.`);
      return;
    }

    const offerName = new Map(offers.map(o => [String(o._id), o.name]));
    const offerIds = offers.map(o => o._id);

    // -- selection ---------------------------------------------------------

    // Forward: the old shape — our commission sitting in payout, the order
    // total sitting in revenue, and no saleAmount because the field did not
    // exist yet. `mappingFixedAt` absent keeps a second run a no-op.
    //
    // Rollback: exactly the rows this script stamped. Never inferred from the
    // numbers: a conversion booked AFTER the postback was corrected has the
    // same shape (payout 0, saleAmount set) and must not be dragged backwards.
    const filter = ROLLBACK
      ? { offerId: { $in: offerIds }, mappingFixedAt: { $exists: true } }
      : {
          offerId: { $in: offerIds },
          converted: true,
          payout: { $gt: 0 },
          $or: [{ saleAmount: { $exists: false } }, { saleAmount: 0 }],
          mappingFixedAt: { $exists: false },
          conversionAt: { $lt: CUTOFF },
        };

    let cursor = clicks.find(filter).sort({ conversionAt: 1 });
    if (LIMIT) cursor = cursor.limit(LIMIT);
    const rows = await cursor.toArray();

    // -- header ------------------------------------------------------------

    rule('=');
    console.log(ROLLBACK ? '  ROLLBACK — undo the Impact mapping fix' : '  FIX — Impact revenue/payout mapping');
    console.log(`  Mode        : ${APPLY ? '*** APPLY — this WILL write to the database ***' : 'DRY RUN (nothing will be written)'}`);
    console.log(`  Network     : ${NETWORK}  (${advertisers.map(a => a.name).join(', ')})`);
    console.log(`  Offers      : ${offers.length}${OFFER_FILTER ? ` matching "${OFFER_FILTER}"` : ''}`);
    if (!ROLLBACK) console.log(`  Before      : ${CUTOFF.toISOString()}`);
    if (LIMIT) console.log(`  Limit       : ${LIMIT} rows`);
    console.log(`  Conversions : ${rows.length}`);
    rule('=');

    if (!rows.length) {
      console.log('\nNothing matches. Either it has already been done, or the scope is too narrow.\n');
      return;
    }

    // -- work out every change before touching anything --------------------

    const clickOps = [];
    const byOffer = new Map();   // offerId -> running totals for the report and the $inc
    const byStat = new Map();    // "offerId|date" -> deltas for DailyStat
    const samples = [];

    for (const c of rows) {
      const oldRev = Number(c.revenue) || 0;
      const oldPay = Number(c.payout) || 0;
      const oldSale = Number(c.saleAmount) || 0;

      let set;
      let newRev, newPay, newSale;

      if (ROLLBACK) {
        newRev = oldSale;          // the order total goes back into revenue
        newPay = oldRev;           // our commission goes back into payout
        newSale = 0;
        set = {
          $set: { revenue: newRev, payout: newPay, saleAmount: newSale, profit: newRev - newPay },
          $unset: { mappingFixedAt: '' },
        };
      } else {
        newSale = oldRev;          // the order total is kept, for reference only
        newRev = oldPay;           // our commission becomes revenue
        newPay = 0;                // we pay nobody downstream
        set = {
          $set: { revenue: newRev, payout: newPay, saleAmount: newSale, profit: newRev, mappingFixedAt: new Date() },
        };
      }

      clickOps.push({ updateOne: { filter: { _id: c._id }, update: set } });

      const dRev = newRev - oldRev;
      const dPay = newPay - oldPay;
      const dProfit = (newRev - newPay) - (oldRev - oldPay);

      const oid = String(c.offerId);
      const agg = byOffer.get(oid) || { n: 0, oldRev: 0, newRev: 0, oldPay: 0, newPay: 0, dRev: 0, dPay: 0, dProfit: 0 };
      agg.n += 1;
      agg.oldRev += oldRev; agg.newRev += newRev;
      agg.oldPay += oldPay; agg.newPay += newPay;
      agg.dRev += dRev; agg.dPay += dPay; agg.dProfit += dProfit;
      byOffer.set(oid, agg);

      const d = statDate(c);
      if (d) {
        const k = `${oid}|${d}`;
        const s = byStat.get(k) || { offerId: c.offerId, date: d, dRev: 0, dPay: 0, dProfit: 0 };
        s.dRev += dRev; s.dPay += dPay; s.dProfit += dProfit;
        byStat.set(k, s);
      }

      if (samples.length < 6) {
        samples.push({ date: d, offer: offerName.get(oid) || oid, oldRev, oldPay, newRev, newPay, newSale });
      }
    }

    // -- report: sample rows ----------------------------------------------

    console.log('\nSAMPLE ROWS (before -> after)\n');
    console.log(`  ${pad('Date', 12)}${pad('Offer', 16)}${padL('Revenue', 22)}${padL('Payout', 20)}${padL('Sale Amt', 12)}`);
    rule();
    for (const s of samples) {
      console.log(
        `  ${pad(s.date || '?', 12)}${pad(String(s.offer).slice(0, 15), 16)}` +
        `${padL(`${money(s.oldRev)} -> ${money(s.newRev)}`, 22)}` +
        `${padL(`${money(s.oldPay)} -> ${money(s.newPay)}`, 20)}` +
        `${padL(money(s.newSale), 12)}`
      );
    }

    // -- report: per offer -------------------------------------------------

    console.log('\nPER OFFER\n');
    console.log(`  ${pad('Offer', 24)}${padL('Rows', 6)}${padL('Revenue now', 15)}${padL('Revenue after', 15)}${padL('Change', 14)}`);
    rule();
    const grand = { n: 0, oldRev: 0, newRev: 0, oldPay: 0, newPay: 0, dRev: 0, dPay: 0, dProfit: 0 };
    for (const [oid, a] of [...byOffer.entries()].sort((x, y) => y[1].oldRev - x[1].oldRev)) {
      console.log(
        `  ${pad(String(offerName.get(oid) || oid).slice(0, 23), 24)}${padL(a.n, 6)}` +
        `${padL(money(a.oldRev), 15)}${padL(money(a.newRev), 15)}${padL(money(a.dRev), 14)}`
      );
      for (const k of Object.keys(grand)) grand[k] += a[k];
    }
    rule();
    console.log(
      `  ${pad('TOTAL', 24)}${padL(grand.n, 6)}${padL(money(grand.oldRev), 15)}${padL(money(grand.newRev), 15)}${padL(money(grand.dRev), 14)}`
    );

    console.log(`\n  Reported revenue now   : ${money(grand.oldRev)}`);
    console.log(`  Reported revenue after : ${money(grand.newRev)}   <- what Impact should agree with`);
    console.log(`  Payout  ${money(grand.oldPay)} -> ${money(grand.newPay)}`);
    console.log(`  Profit change          : ${money(grand.dProfit)}`);

    // -- report: aggregates that must move with it -------------------------

    const statIds = [...byStat.values()];
    const present = await db.collection('dailystats').countDocuments({
      $or: statIds.map(s => ({ offerId: s.offerId, date: s.date })),
    });
    console.log(`\n  Offer totals to adjust : ${byOffer.size}`);
    console.log(`  DailyStat rows         : ${statIds.length} needed, ${present} found` +
      (present < statIds.length
        ? `, ${statIds.length - present} missing (those days were never aggregated; the reports read from clicks anyway)`
        : ''));

    // -- write, or explain how to ------------------------------------------

    if (!APPLY) {
      rule('=');
      console.log('  DRY RUN — nothing was written. Not one document changed.');
      console.log('');
      console.log('  Check the "Revenue after" column against Impact\'s own report for the');
      console.log('  same dates. If it agrees, re-run with --apply. Start with one offer:');
      console.log('');
      console.log('    node server/scripts/fixImpactMapping.js --offer="Mystic lab" --apply');
      console.log('');
      console.log('  Take a mongodump first.');
      rule('=');
      return;
    }

    console.log('\nApplying...');

    const res = await clicks.bulkWrite(clickOps, { ordered: false });
    console.log(`  clicks      : ${res.modifiedCount} updated`);

    // Offer totals and DailyStat move by the same deltas rather than being
    // recomputed, so nothing else recorded against them is disturbed.
    let offersTouched = 0;
    for (const [oid, a] of byOffer.entries()) {
      await Offer.updateOne(
        { _id: new mongoose.Types.ObjectId(oid) },
        { $inc: { totalRevenue: a.dRev, totalPayout: a.dPay, totalProfit: a.dProfit } }
      );
      offersTouched += 1;
    }
    console.log(`  offers      : ${offersTouched} totals adjusted`);

    let statsTouched = 0;
    for (const s of statIds) {
      const r = await db.collection('dailystats').updateOne(
        { offerId: s.offerId, date: s.date },
        { $inc: { revenue: s.dRev, payout: s.dPay, profit: s.dProfit } }
      );
      statsTouched += r.modifiedCount;
    }
    console.log(`  dailystats  : ${statsTouched} rows adjusted`);

    rule('=');
    console.log('  Done.');
    console.log('');
    console.log('  Now check a single day in TrackHive against the same day in Impact.');
    console.log('  If anything looks wrong:');
    console.log('');
    console.log('    node server/scripts/fixImpactMapping.js --rollback --apply');
    console.log('');
    console.log('  That puts every row this script touched back exactly as it was.');
    rule('=');
  } catch (err) {
    console.error('\nFailed:', err.message);
    console.error(err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();

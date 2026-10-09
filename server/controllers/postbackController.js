const Click = require('../models/Click');
const Offer = require('../models/Offer');
const Advertiser = require('../models/Advertiser');
const DailyStat = require('../models/DailyStat');
const Notification = require('../models/Notification');
const { updateDailyStats } = require('../utils/clickHelpers');
const { getReportTimezone, todayInTz, monthStartInTz } = require('../utils/appTime');
const networkPresets = require('../config/networkPresets');

/** Thrown when a postback sends a revenue/payout value that isn't a finite number. */
class BadAmount extends Error {
  constructor(field, value) {
    super(`Invalid ${field}: "${value}" is not a number`);
    this.field = field;
    this.value = value;
  }
}

/**
 * Refuse a postback WITHOUT telling the network to send it again.
 *
 * Every rejection below used to answer 4xx. Networks read any non-2xx as "not
 * delivered" and re-queue it, so a postback we are never going to accept — no
 * click id, a click id we do not recognise, a conversion already booked — came
 * back every couple of minutes for ever. On live traffic that turned a handful
 * of genuinely broken postbacks into 696 rejections in 24 hours against 72
 * clicks, and buried the ones worth reading. SaleGains' panel also validates a
 * postback URL by calling it, and refused to save ours because of that 400.
 *
 * So the status code now answers only the question the sender is really
 * asking: "will retrying help?" For all of these it will not, so they answer
 * 200 with success:false and a machine-readable `reason`. A genuine server
 * fault still answers 500, because there a retry is exactly right.
 *
 * Nothing is hidden by this. The System Health page counts rejections from
 * `reason`, never from the HTTP status.
 */
const reject = (res, reason, error, extra = {}) =>
  res.status(200).json({ success: false, reason, error, ...extra });

/**
 * Handle postback conversion: GET /postback?click_id=xxx&payout=1.50&event=signup&secret=abc
 */
exports.handlePostback = async (req, res) => {
  try {
    // Read params from BOTH the query string and the JSON/form body. Networks
    // like Impact POST their postbacks with the params in the body — the route
    // mounts express.json() for exactly that, but this handler used to read
    // req.query only, so every POST conversion was rejected as "click_id is
    // required" and silently lost.
    const p = { ...(req.body || {}), ...req.query };

    const clickId = p.click_id || p.clickid || p.cid;
    if (!clickId) {
      return reject(res, 'missing_click_id', 'click_id is required');
    }

    const click = await Click.findOne({ clickId });
    if (!click) {
      return reject(res, 'click_not_found', 'Click not found');
    }

    const offer = await Offer.findById(click.offerId);
    if (!offer) {
      return reject(res, 'offer_not_found', 'Offer not found');
    }

    // --- FIX 1: Postback secret verification ---
    // The secret lives on the ADVERTISER, not the offer, so one postback URL
    // serves every offer under that advertiser. The network is read here too —
    // it decides how this network spells "reversed" further down.
    let advertiserNetwork = 'custom';
    if (offer.advertiser) {
      const advertiser = await Advertiser.findById(offer.advertiser);
      if (advertiser) {
        advertiserNetwork = advertiser.network || 'custom';
        if (advertiser.postbackSecret) {
          const providedSecret = p.secret || p.token || '';
          if (providedSecret !== advertiser.postbackSecret) {
            return reject(res, 'invalid_secret', 'Invalid postback secret');
          }
        }
      }
    }

    // --- FIX 3: Click-to-conversion time window check ---
    if (offer.enableClickToConversionTime && offer.clickToConversionValue > 0) {
      const clickTime = click.clickedAt || click.createdAt;
      const now = new Date();
      let maxMs;
      switch (offer.clickToConversionUnit) {
        case 'days': maxMs = offer.clickToConversionValue * 24 * 60 * 60 * 1000; break;
        case 'months': maxMs = offer.clickToConversionValue * 30 * 24 * 60 * 60 * 1000; break;
        case 'hours':
        default: maxMs = offer.clickToConversionValue * 60 * 60 * 1000; break;
      }
      const elapsed = now - new Date(clickTime);
      if (elapsed > maxMs) {
        return reject(res, 'window_expired', 'Conversion window expired', {
          clickAge: Math.round(elapsed / 3600000) + ' hours',
          maxWindow: offer.clickToConversionValue + ' ' + (offer.clickToConversionUnit || 'hours'),
        });
      }
    }

    // --- FIX 2: Multi-event conversion support ---
    const eventName = p.event || p.goal || '';

    // --- Conversion lifecycle (Katalys sends these; most networks don't) ---
    // {postback_operation} = create | update | delete
    // {conversion_status}  = only 'approved' conversions are actually paid
    const operation = String(p.postback_operation || p.operation || '').trim().toLowerCase();
    const convStatus = String(p.conversion_status || p.status || '').trim().toLowerCase();

    // Word statuses every network shares. Networks that report numerically
    // (Affise: 3 = Declined) or with their own vocabulary (Impact: MODIFIED)
    // extend these through their preset's `lifecycle` block, so adding a
    // network never means editing this controller.
    const REVERSED = ['rejected', 'declined', 'reversed', 'cancelled', 'canceled', 'refunded', 'deleted'];
    const UPDATED = ['modified', 'updated', 'adjusted', 'amended'];

    const lifecycle = networkPresets[advertiserNetwork]?.lifecycle || {};
    const reversedValues = [...REVERSED, ...(lifecycle.reversed || []).map(v => String(v).toLowerCase())];
    const updatedValues = [...UPDATED, ...(lifecycle.updated || []).map(v => String(v).toLowerCase())];

    // An explicit operation always wins over a status guess.
    const isReversal = operation === 'delete' ||
      (operation !== 'update' && operation !== 'create' && reversedValues.includes(convStatus));
    const isUpdate = !isReversal &&
      (operation === 'update' || (!operation && updatedValues.includes(convStatus)));

    // Events already recorded on this click, as a list. conversionEvent is
    // stored comma-joined; the old code compared the incoming event against the
    // whole joined string, so after two events ANY replay (`signup` vs
    // "signup,purchase") looked "different" and was paid out again.
    const recordedEvents = (click.conversionEvent || '').split(',').map(s => s.trim()).filter(Boolean);

    // Check duplicate logic: if already converted, allow only if:
    // 1. allowDuplicateConversions is enabled on the offer, OR
    // 2. A genuinely new event name is provided (multi-event support)
    //
    // Skipped for update/delete — those are CORRECTIONS to an existing
    // conversion, so hitting this guard would 409 them and the correction
    // would be silently lost. They are handled in their own block below.
    if (click.converted && !isReversal && !isUpdate) {
      const isDifferentEvent = eventName && !recordedEvents.includes(eventName);
      if (!offer.allowDuplicateConversions && !isDifferentEvent) {
        return reject(res, 'duplicate', 'Already converted', { conversionId: click.conversionId });
      }
    }

    // Calculate revenue and payout
    // Aliases: amount → revenue, txn_id / transaction_id kept for legacy compat
    let revenue = 0;
    let payout = 0;
    const qRevenue = p.revenue ?? p.amount;
    const qPayout  = p.payout;
    // Reference only — the merchant's order total. Never feeds revenue.
    const qSaleAmount = p.sale_amount ?? p.order_total;
    const txnId    = p.txn_id || p.transaction_id || '';

    // Reject non-numeric amounts up front. parseFloat('{Amount}') → NaN, which
    // Mongoose then refuses to save, turning an un-substituted network macro
    // into a 500 and a silently lost conversion. parseFloat('1,234.56') would
    // also quietly book $1 — Number() rejects both.
    const toAmount = (v, field) => {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new BadAmount(field, v);
      return n;
    };

    // Event-specific overrides. An empty eventName must NOT match — the wizard
    // can save an event row with a blank name, which would otherwise swallow
    // every base conversion and book its default 0 revenue.
    const matchedEvent = eventName
      ? offer.events?.find(e => e.name === eventName)
      : null;

    if (matchedEvent) {
      revenue = matchedEvent.revenueAmount || 0;
      payout = matchedEvent.payoutAmount || 0;
    } else {
      // Use offer-level values. These lists must match the Offer schema enums —
      // they previously listed types that don't exist (CPL/CPI) while omitting
      // real ones (RPM, percent_revenue, CPC, CPM), so e.g. a percent_revenue
      // offer booked $0 payout and 100% margin on every conversion.
      if (qRevenue !== undefined && qRevenue !== '') {
        revenue = toAmount(qRevenue, 'revenue');
      } else if (['RPA', 'RPS', 'RPC', 'RPM'].includes(offer.revenueType)) {
        revenue = offer.revenueAmount || 0;
      }

      if (qPayout !== undefined && qPayout !== '') {
        payout = toAmount(qPayout, 'payout');
      } else if (offer.payoutType === 'percent_revenue') {
        // payoutAmount is a percentage of the conversion's revenue
        payout = revenue * ((offer.payoutAmount || 0) / 100);
      } else if (['CPA', 'CPS', 'CPC', 'CPM'].includes(offer.payoutType)) {
        payout = offer.payoutAmount || 0;
      }
    }

    const profit = revenue - payout;
    const saleAmount = (qSaleAmount !== undefined && qSaleAmount !== '')
      ? toAmount(qSaleAmount, 'sale_amount')
      : 0;

    // ── REVERSAL / UPDATE ──────────────────────────────────────────────────
    // Handled before the create path because both operate on a click that is
    // ALREADY converted — the normal duplicate guard would otherwise reject
    // them with 409 and the correction would be silently dropped.
    // An UPDATE for a click with NO conversion yet is the exception to the
    // above: that is not a correction, it IS the conversion, and it has to be
    // booked. Networks that price on approval (SaleGains sends PENDING with
    // commission 0.00 and the real amount only on APPROVED) send the approval
    // on its own whenever a sale is approved outright, or whenever the pending
    // postback was lost. Treating it as "nothing to correct" would drop the
    // sale AND its money while answering 200 — the worst combination there is.
    // So it falls through to the create path below instead.
    //
    // A REVERSAL with nothing to reverse stays a no-op: a delete for a
    // conversion we never recorded is not an error, and must not create one.
    const priorConversion = await Click.findOne({ clickId }).select('converted').lean();

    if (isReversal || (isUpdate && priorConversion?.converted)) {
      const current = await Click.findOne({ clickId });

      if (!current?.converted) {
        return res.json({
          success: true,
          clickId,
          operation: 'delete',
          applied: false,
          reason: 'Click has no recorded conversion',
        });
      }

      // Deltas needed to move the stored totals to their new value.
      const dRevenue = (isReversal ? 0 : revenue) - (current.revenue || 0);
      const dPayout  = (isReversal ? 0 : payout)  - (current.payout  || 0);
      const dProfit  = dRevenue - dPayout;
      const dConv    = isReversal ? -1 : 0;

      const set = isReversal
        ? {
            converted: false,
            revenue: 0, payout: 0, profit: 0, saleAmount: 0,
            conversionStatus: 'reversed',
            reversedAt: new Date(),
          }
        : {
            revenue, payout, profit,
            ...(saleAmount ? { saleAmount } : {}),
            conversionStatus: convStatus || current.conversionStatus || '',
          };

      await Click.updateOne({ clickId }, { $set: set });

      await Promise.all([
        Offer.updateOne(
          { _id: offer._id },
          {
            $inc: {
              totalConversions: dConv,
              totalRevenue: dRevenue,
              totalPayout: dPayout,
              totalProfit: dProfit,
            },
          }
        ),
        // Apply the correction to the day the conversion originally landed on,
        // not today.
        updateDailyStats(DailyStat, offer._id, offer.name, {
          conversion: true,
          conversionDelta: dConv,
          revenue: dRevenue,
          payout: dPayout,
          date: (current.conversionAt || current.clickedAt || new Date())
            .toISOString().split('T')[0],
        }),
      ]);

      console.log(
        `[POSTBACK] ${clickId} ${isReversal ? 'REVERSED' : 'UPDATED'} ` +
        `status=${convStatus || '-'} dRevenue=${dRevenue.toFixed(2)}`
      );

      return res.json({
        success: true,
        clickId,
        conversionId: current.conversionId,
        operation: isReversal ? 'delete' : 'update',
        applied: true,
        revenue: isReversal ? 0 : revenue,
        payout: isReversal ? 0 : payout,
        profit: isReversal ? 0 : profit,
      });
    }

    const newConversionId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Claim the first conversion ATOMICALLY. Networks routinely fire parallel
    // retries on timeout; the old read-then-save let both requests see
    // converted:false and each $inc the offer totals, permanently double-counting
    // revenue against a click that only ever recorded one conversion.
    const claimed = await Click.findOneAndUpdate(
      { clickId, converted: { $ne: true } },
      {
        $set: {
          converted: true,
          conversionId: newConversionId,
          conversionAt: new Date(),
          revenue, payout, profit, saleAmount,
          conversionEvent: eventName,
          conversionStatus: convStatus,
        },
      },
      { new: true }
    );

    let conversionId;
    if (claimed) {
      conversionId = newConversionId;
    } else {
      // Someone already converted this click (an earlier postback, or a
      // concurrent retry). Re-check the duplicate rule against fresh state.
      const current = await Click.findOne({ clickId });
      const events = (current?.conversionEvent || '').split(',').map(s => s.trim()).filter(Boolean);
      const isDifferentEvent = eventName && !events.includes(eventName);
      if (!offer.allowDuplicateConversions && !isDifferentEvent) {
        return reject(res, 'duplicate', 'Already converted', { conversionId: current?.conversionId });
      }
      // Accumulate. $inc is atomic, so concurrent multi-event postbacks can't
      // lose each other's amounts.
      const updated = await Click.findOneAndUpdate(
        { clickId },
        {
          $inc: { revenue, payout, profit, saleAmount },
          $set: { conversionEvent: [...events, eventName].filter(Boolean).join(',') },
        },
        { new: true }
      );
      // Report the conversionId that is actually stored, not a fresh one that
      // was never persisted — advertisers reconcile disputes against this.
      conversionId = updated?.conversionId || current?.conversionId;
    }

    // Update offer totals
    await Offer.updateOne(
      { _id: offer._id },
      {
        $inc: {
          totalConversions: 1,
          totalRevenue: revenue,
          totalPayout: payout,
          totalProfit: profit,
        },
      }
    );

    // Update daily stats
    await updateDailyStats(DailyStat, offer._id, offer.name, {
      conversion: true,
      revenue,
      payout,
    });

    // Check caps and create notifications
    await checkCapsAndNotify(offer);

    res.json({
      success: true,
      conversionId,
      clickId,
      event: eventName || undefined,
      txnId: txnId || undefined,
      status: convStatus || undefined,
      revenue,
      payout,
      profit,
    });
  } catch (err) {
    if (err instanceof BadAmount) {
      // Almost always an un-substituted network macro (e.g. revenue={Amount}).
      // Tell the caller clearly instead of returning an opaque 500.
      console.warn(`[POSTBACK] ${err.message}`);
      return reject(res, 'bad_amount', err.message, { field: err.field });
    }
    console.error('Postback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Check caps and create notification alerts
 */
async function checkCapsAndNotify(offer) {
  try {
    // Caps only apply when the offer has them switched on in the wizard.
    if (!offer.enableCaps) return;

    const refreshed = await Offer.findById(offer._id);
    if (!refreshed) return;

    const alerts = [];
    // Daily/monthly caps must reset at LOCAL midnight, not 00:00 UTC — in IST
    // (UTC+5:30) a UTC-based reset fired at 05:30 AM local instead of midnight.
    const tz = await getReportTimezone();
    const today = todayInTz(tz);

    // NOTE: this function used to read offer.dailyCap / offer.dailyRevenueCap /
    // offer.capBehavior — none of which exist on the Offer schema. Every one of
    // those reads was `undefined`, so `undefined > 0` was false and NO cap alert
    // ever fired. The real fields are dailyConversionCap / monthlyConversionCap /
    // totalCap, gated by enableCaps.

    // Daily conversion cap
    if (refreshed.dailyConversionCap > 0) {
      const stat = await DailyStat.findOne({ date: today, offerId: offer._id });
      const conversions = stat?.conversions || 0;
      if (conversions >= refreshed.dailyConversionCap) {
        alerts.push({
          type: 'cap_alert',
          title: 'Daily Cap Reached',
          message: `${offer.name} has reached its daily conversion cap of ${refreshed.dailyConversionCap}`,
          severity: 'warning',
        });
      } else if (conversions >= refreshed.dailyConversionCap * 0.9) {
        alerts.push({
          type: 'cap_alert',
          title: 'Daily Cap Warning',
          message: `${offer.name} is at ${Math.round(conversions / refreshed.dailyConversionCap * 100)}% of daily cap`,
          severity: 'info',
        });
      }
    }

    // Monthly conversion cap
    if (refreshed.monthlyConversionCap > 0) {
      const monthStart = monthStartInTz(tz);
      const agg = await DailyStat.aggregate([
        { $match: { offerId: offer._id, date: { $gte: monthStart, $lte: today } } },
        { $group: { _id: null, conversions: { $sum: '$conversions' } } },
      ]);
      const monthConversions = agg[0]?.conversions || 0;
      if (monthConversions >= refreshed.monthlyConversionCap) {
        alerts.push({
          type: 'cap_alert',
          title: 'Monthly Cap Reached',
          message: `${offer.name} has reached its monthly conversion cap of ${refreshed.monthlyConversionCap}`,
          severity: 'warning',
        });
      }
    }

    // Total cap
    if (refreshed.totalCap > 0 && refreshed.totalConversions >= refreshed.totalCap) {
      alerts.push({
        type: 'cap_alert',
        title: 'Total Cap Reached',
        message: `${offer.name} has reached its total conversion cap of ${refreshed.totalCap}`,
        severity: 'error',
      });
    }

    // Save notifications and send to Telegram
    const { sendNotificationToTelegram } = require('../utils/telegram');
    const { sendNotificationEmail } = require('../utils/email');
    for (const alert of alerts) {
      const notification = await Notification.create({
        ...alert,
        offerId: offer._id,
        offerName: offer.name,
        // The alert is about this offer, so it belongs to whoever owns it.
        createdBy: offer.createdBy,
      });
      sendNotificationToTelegram(notification).catch(() => {});
      // Second channel, fired independently — a broken SMTP box must not stop
      // the Telegram message, and vice versa.
      sendNotificationEmail(notification).catch(() => {});
    }
  } catch (err) {
    console.error('Cap check error:', err);
  }
}

// ── Postback logging ──────────────────────────────────────────────────────
//
// Wraps handlePostback rather than editing it. Every exit in that function —
// there are twelve — would otherwise need its own log call, and a future
// thirteenth would be forgotten. Wrapping means the log is derived from the
// response that was actually sent, so it cannot drift from the behaviour.
//
// The wrapper NEVER changes the response: it records the body on its way out
// and restores res.json afterwards. If anything here throws or the write
// fails, the postback is unaffected — a network that gets a 500 retries, and a
// retry storm caused by a logging bug would be far worse than a missing row.

const PostbackLog = require('../models/PostbackLog');
const { REASONS } = PostbackLog;

/** Params never worth storing: the shared secret is the whole security model. */
const SENSITIVE = new Set(['secret', 'token', 'key', 'security_key', 'api_key']);

/** Query + body as received, secrets masked, long values clipped. */
function safeParams(req) {
  const merged = { ...(req.body || {}), ...req.query };
  const out = {};
  for (const [k, v] of Object.entries(merged)) {
    if (SENSITIVE.has(String(k).toLowerCase())) { out[k] = '***'; continue; }
    const s = typeof v === 'string' ? v : String(v ?? '');
    out[k] = s.length > 200 ? `${s.slice(0, 200)}…` : s;
  }
  return out;
}

/**
 * Turn the status + body the handler produced into a reason code.
 *
 * Deliberately reads the response rather than the internal control flow: the
 * status codes are part of the contract with the networks and change far less
 * often than the code that produces them.
 */
function classifyPostback(status, body) {
  const err = String(body?.error || '');
  if (status >= 500) return REASONS.SERVER_ERROR;
  if (status === 403) return REASONS.INVALID_SECRET;
  if (status === 410) return REASONS.WINDOW_EXPIRED;
  if (status === 409) return REASONS.DUPLICATE;
  if (status === 404) return /offer/i.test(err) ? REASONS.OFFER_NOT_FOUND : REASONS.CLICK_NOT_FOUND;
  if (status === 400) return body?.field ? REASONS.BAD_AMOUNT : REASONS.MISSING_CLICK_ID;
  if (status >= 400) return REASONS.REJECTED;
  if (body?.applied === false) return REASONS.NOOP;
  if (body?.operation === 'delete') return REASONS.REVERSED;
  if (body?.operation === 'update') return REASONS.UPDATED;
  return REASONS.ACCEPTED;
}

/**
 * Offer / advertiser / owner for this click id, best effort.
 *
 * `createdBy` is the point of it: without an owner the health page cannot
 * scope the row, and a partner would see another operator's failures. A
 * postback whose click id we do not recognise has no owner and is stored with
 * none — those are shown to everyone, which is the useful behaviour.
 */
async function postbackContext(clickId) {
  const ctx = {};
  if (!clickId) return ctx;

  const click = await Click.findOne({ clickId }).select('offerId offerName').lean();
  if (!click) return ctx;
  ctx.offerId = click.offerId;
  ctx.offerName = click.offerName;

  const offer = await Offer.findById(click.offerId).select('name advertiser createdBy').lean();
  if (!offer) return ctx;
  ctx.offerName = ctx.offerName || offer.name;
  ctx.createdBy = offer.createdBy;

  if (offer.advertiser) {
    const adv = await Advertiser.findById(offer.advertiser).select('name network').lean();
    if (adv) {
      ctx.advertiserId = adv._id;
      ctx.advertiserName = adv.name;
      ctx.network = adv.network || 'custom';
    }
  }
  return ctx;
}

/** Fire and forget. A failed log write is logged and then dropped. */
function logPostback(fields) {
  PostbackLog.create(fields).catch(err => console.error('[POSTBACK LOG]', err.message));
}

const _handlePostback = exports.handlePostback;

exports.handlePostback = async (req, res) => {
  const startedAt = Date.now();
  const p = { ...(req.body || {}), ...req.query };
  const clickId = p.click_id || p.clickid || p.cid || '';

  // Record the body on its way out without altering it.
  let body;
  const sendJson = res.json.bind(res);
  res.json = (payload) => { body = payload; return sendJson(payload); };

  try {
    await _handlePostback(req, res);
  } finally {
    res.json = sendJson;

    const status = res.statusCode || 0;
    // The handler now refuses with 200 + success:false so networks stop
    // retrying what can never succeed — which means the status code alone no
    // longer says whether this was accepted. The body does.
    const refused = body?.success === false && !!body?.reason;
    const outcome = (refused || status >= 400) ? 'rejected' : 'accepted';
    const reason = refused ? body.reason : classifyPostback(status, body);

    postbackContext(clickId)
      .catch(() => ({}))
      .then(ctx => logPostback({
        ...ctx,
        clickId,
        outcome,
        reason,
        status,
        message: body?.error || '',
        method: req.method,
        ip: req.ip,
        durationMs: Date.now() - startedAt,
        params: safeParams(req),
      }))
      .catch(() => {});
  }
};

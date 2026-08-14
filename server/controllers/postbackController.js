const Click = require('../models/Click');
const Offer = require('../models/Offer');
const Advertiser = require('../models/Advertiser');
const DailyStat = require('../models/DailyStat');
const Notification = require('../models/Notification');
const { updateDailyStats } = require('../utils/clickHelpers');

/**
 * Handle postback conversion: GET /postback?click_id=xxx&payout=1.50&event=signup&secret=abc
 */
exports.handlePostback = async (req, res) => {
  try {
    const clickId = req.query.click_id || req.query.clickid || req.query.cid;
    if (!clickId) {
      return res.status(400).json({ error: 'click_id is required' });
    }

    const click = await Click.findOne({ clickId });
    if (!click) {
      return res.status(404).json({ error: 'Click not found' });
    }

    const offer = await Offer.findById(click.offerId);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // --- FIX 1: Postback secret verification ---
    // If offer has an advertiser with a postbackSecret, require it
    if (offer.advertiser) {
      const advertiser = await Advertiser.findById(offer.advertiser);
      if (advertiser && advertiser.postbackSecret) {
        const providedSecret = req.query.secret || req.query.token || '';
        if (providedSecret !== advertiser.postbackSecret) {
          return res.status(403).json({ error: 'Invalid postback secret' });
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
        return res.status(410).json({
          error: 'Conversion window expired',
          clickAge: Math.round(elapsed / 3600000) + ' hours',
          maxWindow: offer.clickToConversionValue + ' ' + (offer.clickToConversionUnit || 'hours'),
        });
      }
    }

    // --- FIX 2: Multi-event conversion support ---
    const eventName = req.query.event || req.query.goal || '';

    // Check duplicate logic: if already converted, allow only if:
    // 1. allowDuplicateConversions is enabled on the offer, OR
    // 2. A different event name is provided (multi-event support)
    if (click.converted) {
      const isDifferentEvent = eventName && eventName !== (click.conversionEvent || '');
      if (!offer.allowDuplicateConversions && !isDifferentEvent) {
        return res.status(409).json({ error: 'Already converted', conversionId: click.conversionId });
      }
    }

    // Calculate revenue and payout
    let revenue = 0;
    let payout = 0;

    // Check for event-specific values
    const matchedEvent = offer.events?.find(e => e.eventId === eventName || e.name === eventName);

    if (matchedEvent) {
      revenue = matchedEvent.revenueAmount || 0;
      payout = matchedEvent.payoutAmount || 0;
    } else {
      // Use offer-level values
      if (req.query.revenue) {
        revenue = parseFloat(req.query.revenue);
      } else if (['RPA', 'CPA', 'RPS', 'RPC'].includes(offer.revenueType)) {
        revenue = offer.revenueAmount || 0;
      }

      if (req.query.payout) {
        payout = parseFloat(req.query.payout);
      } else if (['CPA', 'CPS', 'CPL', 'CPI'].includes(offer.payoutType)) {
        payout = offer.payoutAmount || 0;
      }
    }

    const profit = revenue - payout;
    const conversionId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Update click — for multi-event, accumulate revenue/payout
    if (click.converted) {
      // Multi-event: add to existing values
      click.revenue = (click.revenue || 0) + revenue;
      click.payout = (click.payout || 0) + payout;
      click.profit = (click.profit || 0) + profit;
      // Track all events as comma-separated
      const existingEvents = click.conversionEvent || '';
      click.conversionEvent = existingEvents ? `${existingEvents},${eventName}` : eventName;
    } else {
      click.converted = true;
      click.conversionId = conversionId;
      click.conversionAt = new Date();
      click.revenue = revenue;
      click.payout = payout;
      click.profit = profit;
      click.conversionEvent = eventName;
    }
    await click.save();

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
    await checkCapsAndNotify(offer, revenue);

    res.json({
      success: true,
      conversionId,
      clickId,
      event: eventName || undefined,
      revenue,
      payout,
      profit,
    });
  } catch (err) {
    console.error('Postback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Check caps and create notification alerts
 */
async function checkCapsAndNotify(offer, revenue) {
  try {
    const refreshed = await Offer.findById(offer._id);
    if (!refreshed) return;

    const alerts = [];

    // Daily conversion cap
    if (offer.dailyCap > 0) {
      const today = new Date().toISOString().split('T')[0];
      const stat = await DailyStat.findOne({ date: today, offerId: offer._id });
      if (stat && stat.conversions >= offer.dailyCap) {
        alerts.push({
          type: 'cap_alert',
          title: 'Daily Cap Reached',
          message: `${offer.name} has reached its daily conversion cap of ${offer.dailyCap}`,
          severity: 'warning',
        });
        if (offer.capBehavior === 'hard') {
          await Offer.updateOne({ _id: offer._id }, { status: 'paused' });
        }
      } else if (stat && stat.conversions >= offer.dailyCap * 0.9) {
        alerts.push({
          type: 'cap_alert',
          title: 'Daily Cap Warning',
          message: `${offer.name} is at ${Math.round(stat.conversions / offer.dailyCap * 100)}% of daily cap`,
          severity: 'info',
        });
      }
    }

    // Daily revenue cap
    if (offer.dailyRevenueCap > 0) {
      const today = new Date().toISOString().split('T')[0];
      const stat = await DailyStat.findOne({ date: today, offerId: offer._id });
      if (stat && stat.revenue >= offer.dailyRevenueCap) {
        alerts.push({
          type: 'cap_alert',
          title: 'Daily Revenue Cap Reached',
          message: `${offer.name} has reached its daily revenue cap of $${offer.dailyRevenueCap}`,
          severity: 'warning',
        });
      }
    }

    // Total cap
    if (offer.totalCap > 0 && refreshed.totalConversions >= offer.totalCap) {
      alerts.push({
        type: 'cap_alert',
        title: 'Total Cap Reached',
        message: `${offer.name} has reached its total conversion cap of ${offer.totalCap}`,
        severity: 'error',
      });
      if (offer.capBehavior === 'hard') {
        await Offer.updateOne({ _id: offer._id }, { status: 'paused' });
      }
    }

    // Save notifications and send to Telegram
    const { sendNotificationToTelegram } = require('../utils/telegram');
    for (const alert of alerts) {
      const notification = await Notification.create({
        ...alert,
        offerId: offer._id,
        offerName: offer.name,
      });
      sendNotificationToTelegram(notification).catch(() => {});
    }
  } catch (err) {
    console.error('Cap check error:', err);
  }
}

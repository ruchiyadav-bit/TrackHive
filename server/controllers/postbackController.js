const Click = require('../models/Click');
const Offer = require('../models/Offer');
const DailyStat = require('../models/DailyStat');
const Notification = require('../models/Notification');
const { updateDailyStats } = require('../utils/clickHelpers');

/**
 * Handle postback conversion: GET /postback?click_id=xxx&payout=1.50&event=signup
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

    if (click.converted) {
      return res.status(409).json({ error: 'Already converted', conversionId: click.conversionId });
    }

    const offer = await Offer.findById(click.offerId);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Calculate revenue and payout
    let revenue = 0;
    let payout = 0;

    // Check for event-specific values
    const eventName = req.query.event || req.query.goal || '';
    const matchedEvent = offer.events?.find(e => e.eventId === eventName || e.name === eventName);

    if (matchedEvent) {
      revenue = matchedEvent.revenueAmount || 0;
      payout = matchedEvent.payoutAmount || 0;
    } else {
      // Use offer-level values
      if (req.query.revenue) {
        revenue = parseFloat(req.query.revenue);
      } else if (offer.revenueType === 'CPA') {
        revenue = offer.revenueAmount || 0;
      } else if (offer.revenueType === 'RPS' || offer.revenueType === 'CPC') {
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

    // Update click
    click.converted = true;
    click.conversionId = conversionId;
    click.conversionAt = new Date();
    click.revenue = revenue;
    click.payout = payout;
    click.profit = profit;
    click.conversionEvent = eventName;
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

    // Save notifications
    for (const alert of alerts) {
      await Notification.create({
        ...alert,
        offerId: offer._id,
        offerName: offer.name,
      });
    }
  } catch (err) {
    console.error('Cap check error:', err);
  }
}

const Offer = require('../models/Offer');
const Click = require('../models/Click');
const DailyStat = require('../models/DailyStat');
const {
  generateClickId, parseVisitorInfo, replaceMacros, updateDailyStats,
} = require('../utils/clickHelpers');

/**
 * Handle direct click tracking: GET /click?offer_id=xxx&sub1=...
 */
exports.handleClick = async (req, res) => {
  const startTime = Date.now();

  try {
    const offerId = req.query.offer_id || req.query.oid;
    if (!offerId) {
      return res.status(400).json({ error: 'offer_id is required' });
    }

    const offer = await Offer.findOne({ _id: offerId, status: 'active' });
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found or inactive' });
    }

    const visitor = parseVisitorInfo(req);
    const clickId = generateClickId();

    // Build redirect URL
    const redirectUrl = replaceMacros(offer.offerUrl, {
      clickId, offerId: offer._id.toString(),
      subId1: req.query.sub1 || req.query.subid || '',
      subId2: req.query.sub2 || '', subId3: req.query.sub3 || '',
      subId4: req.query.sub4 || '', subId5: req.query.sub5 || '',
      source: req.query.source || '',
      ...visitor,
    });

    // Log click
    const click = new Click({
      clickId,
      offerId: offer._id,
      offerName: offer.name,
      ...visitor,
      subId1: req.query.sub1 || req.query.subid || '',
      subId2: req.query.sub2 || '',
      subId3: req.query.sub3 || '',
      subId4: req.query.sub4 || '',
      subId5: req.query.sub5 || '',
      source: req.query.source || '',
      redirectUrl,
      redirectType: offer.redirectType,
      responseTimeMs: Date.now() - startTime,
      clickedAt: new Date(),
    });
    await click.save();

    // Update daily stats
    await updateDailyStats(DailyStat, offer._id, offer.name, {
      click: true,
      country: visitor.country,
      device: visitor.device,
      browser: visitor.browser,
      os: visitor.os,
      source: req.query.source,
      subId1: req.query.sub1 || req.query.subid,
    });

    // Update offer totals
    await Offer.updateOne({ _id: offer._id }, { $inc: { totalClicks: 1 } });

    // Redirect
    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('Click handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * API: Get click details by click_id
 */
exports.getClick = async (req, res, next) => {
  try {
    const click = await Click.findOne({ clickId: req.params.clickId });
    if (!click) return res.status(404).json({ error: 'Click not found' });
    res.json({ click });
  } catch (err) {
    next(err);
  }
};

/**
 * API: List clicks for an offer
 */
exports.listClicks = async (req, res, next) => {
  try {
    const { offer_id, from, to, page = 1, limit = 100 } = req.query;
    const filter = {};

    if (offer_id) filter.offerId = offer_id;
    if (from || to) {
      filter.clickedAt = {};
      if (from) filter.clickedAt.$gte = new Date(from);
      if (to) filter.clickedAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [clicks, total] = await Promise.all([
      Click.find(filter).sort({ clickedAt: -1 }).skip(skip).limit(parseInt(limit)),
      Click.countDocuments(filter),
    ]);

    res.json({
      clicks,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

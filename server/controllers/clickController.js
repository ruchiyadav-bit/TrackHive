const Offer = require('../models/Offer');
const Click = require('../models/Click');
const DailyStat = require('../models/DailyStat');
const {
  generateClickId, parseVisitorInfo, checkDuplicate, replaceMacros, updateDailyStats,
  resolveDuplicateAction,
} = require('../utils/clickHelpers');
const { sendBlockedPage } = require('../utils/blockedPage');

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

    // Use correct field — landingPageUrl is primary, offerUrl is legacy fallback
    const landingUrl = offer.landingPageUrl || offer.offerUrl;
    if (!landingUrl) {
      console.error(`[CLICK] Offer ${offer._id} has no landing page URL`);
      return res.status(500).json({ error: 'Offer has no landing page URL configured' });
    }

    const visitor = parseVisitorInfo(req);
    const clickId = generateClickId();

    const subIds = {
      subId1: req.query.sub1 || req.query.subid || '',
      subId2: req.query.sub2 || '',
      subId3: req.query.sub3 || '',
      subId4: req.query.sub4 || '',
      subId5: req.query.sub5 || '',
      source: req.query.source || '',
    };

    // Build redirect URL
    const redirectUrl = replaceMacros(landingUrl, {
      clickId, offerId: offer._id.toString(),
      ...subIds,
      ...visitor,
    });

    // Validate redirect URL before sending
    if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
      console.error(`[CLICK] Invalid redirect URL: ${redirectUrl}`);
      return res.status(500).json({ error: 'Invalid redirect URL' });
    }

    // ── Frequency cap check (only when ipCap > 0) ──
    const cap = Number(offer.ipCap) || 0;
    const isDup = cap > 0
      ? await checkDuplicate(Click, offer, visitor)
      : false;

    // ── On-duplicate behaviour: block | fallback | redirect ──
    let finalUrl = redirectUrl;
    let isBlocked = false;
    let blockReason = '';

    if (isDup) {
      const action = resolveDuplicateAction(offer);
      if (action === 'block') {
        isBlocked = true;
        blockReason = 'frequency_cap';
      } else if (action === 'fallback') {
        finalUrl = offer.fallbackUrl;
      }
      // action === 'redirect' → finalUrl stays as the normal offer URL
    }

    // ── Send the response FIRST — DB writes happen after ──
    if (isBlocked) {
      // Block: no redirect at all, but the click is still logged below so
      // the number of blocks is visible in reporting.
      console.log(`[CLICK] ${clickId} (dup, blocked) offer=${offer._id}`);
      sendBlockedPage(res, { statusCode: 429 });
    } else {
      // redirectMode values from model: '301', '302', 'meta_refresh', 'javascript'
      const statusCode = offer.redirectMode === '301' ? 301 : 302;
      console.log(`[CLICK] ${clickId}${isDup ? ' (dup)' : ''} → ${finalUrl}`);
      res.redirect(statusCode, finalUrl);
    }

    // Fire-and-forget: log click + update stats in the background
    setImmediate(async () => {
      try {
        const click = new Click({
          clickId,
          offerId: offer._id,
          offerName: offer.name,
          ...visitor,
          ...subIds,
          isDuplicate: isDup,
          isBlocked,
          blockReason,
          redirectUrl: isBlocked ? '' : finalUrl,
          redirectType: offer.redirectMode || '302',
          responseTimeMs: Date.now() - startTime,
          clickedAt: new Date(),
        });
        await click.save();

        await Promise.all([
          updateDailyStats(DailyStat, offer._id, offer.name, {
            click: true,
            isDuplicate: isDup,
            isBlocked,
            blockReason,
            country: visitor.country,
            device: visitor.device,
            browser: visitor.browser,
            os: visitor.os,
            source: subIds.source,
            subId1: subIds.subId1,
          }),
          Offer.updateOne({ _id: offer._id }, { $inc: { totalClicks: 1 } }),
        ]);
      } catch (bgErr) {
        console.error('Click background write error:', bgErr);
      }
    });
  } catch (err) {
    console.error('Click handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
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

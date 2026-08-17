const Offer = require('../models/Offer');
const Click = require('../models/Click');
const DailyStat = require('../models/DailyStat');
const {
  generateClickId, parseVisitorInfo, checkDuplicate, replaceMacros, updateDailyStats,
  resolveDuplicateAction,
} = require('../utils/clickHelpers');
const { applyFilters } = require('../utils/trafficFilter');
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

    // .lean() — every field below is read-only, so skip Mongoose document
    // hydration on the hot path.
    const offer = await Offer.findOne({ _id: offerId, status: 'active' }).lean();
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

    // ── 1-4: sync targeting filters — bot → IP blocklist → geo → device/OS/browser.
    // Cheap checks first, no DB query. Shared with /go/:slug via trafficFilter.js
    // so both entry points enforce the same Step 5 targeting rules.
    const filter = applyFilters(offer, visitor, req);

    let finalUrl = redirectUrl;
    let isBlocked = filter.isBlocked;
    let blockReason = filter.blockReason;
    let isDup = false;

    if (isBlocked) {
      // Targeting block (bot / ip_blocked / geo / device) — ALWAYS shows the
      // blocked page, never redirects. `fallbackUrl` belongs to the Frequency
      // Cap section of the wizard and applies ONLY to onDuplicate='fallback';
      // reusing it here made targeting-blocked traffic silently redirect to the
      // duplicate-fallback URL, which looked like targeting wasn't working.
      finalUrl = '';
    } else {
      // ── Frequency cap — last, the only check that hits the DB.
      // cap === 0 short-circuits: no DB query, and the onDuplicate branch below
      // is never entered, so a disabled cap can never block or redirect.
      const cap = Number(offer.ipCap) || 0;
      isDup = cap > 0 ? await checkDuplicate(Click, offer, visitor) : false;

      if (isDup) {
        const action = resolveDuplicateAction(offer);
        if (action === 'block') {
          isBlocked = true;
          blockReason = 'frequency_cap';
          finalUrl = '';
        } else if (action === 'fallback') {
          finalUrl = offer.fallbackUrl;
        }
        // action === 'redirect' → finalUrl stays as the normal offer URL
      }
    }

    // Debug log — shows every input to the decision so nothing has to be guessed.
    console.log(
      `[CLICK] ${clickId} device=${visitor.device}/${visitor.os}/${visitor.browser} ` +
      `country=${visitor.country} ipCap=${Number(offer.ipCap) || 0} dup=${isDup} ` +
      `onDuplicate=${offer.onDuplicate || 'block'} fallbackUrl=${offer.fallbackUrl || '(none)'} ` +
      `blocked=${isBlocked} reason=${blockReason || '-'} → ${isBlocked ? '(blocked page)' : finalUrl}`
    );

    // ── Send the response FIRST — DB writes happen after ──
    if (isBlocked) {
      // 429 for a frequency-cap block, 403 for a targeting block.
      sendBlockedPage(res, { statusCode: blockReason === 'frequency_cap' ? 429 : 403 });
    } else {
      // redirectMode values from model: '301', '302', 'meta_refresh', 'javascript'
      const statusCode = offer.redirectMode === '301' ? 301 : 302;
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
          isBot: filter.isBot,
          isVpn: filter.isVpn,
          isDuplicate: isDup,
          isBlocked,
          blockReason,
          redirectUrl: finalUrl,
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
            isBot: filter.isBot,
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

    // Clamp both: ?page=0 gave a negative skip (Mongo throws → 500) and
    // ?limit=0 means "no limit" in Mongo, which dumped the entire collection.
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
    const skip = (pageNum - 1) * limitNum;

    const [clicks, total] = await Promise.all([
      Click.find(filter).sort({ clickedAt: -1 }).skip(skip).limit(limitNum),
      Click.countDocuments(filter),
    ]);

    res.json({
      clicks,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
};

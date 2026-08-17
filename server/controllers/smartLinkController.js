const Offer = require('../models/Offer');
const Click = require('../models/Click');
const DailyStat = require('../models/DailyStat');
const {
  generateClickId, parseVisitorInfo,
  checkDuplicate, replaceMacros, updateDailyStats,
  resolveDuplicateAction,
} = require('../utils/clickHelpers');
const { applyFilters } = require('../utils/trafficFilter');
const { sendBlockedPage: sendBlockedResponse, DEFAULT_BLOCKED_MESSAGE } = require('../utils/blockedPage');

exports.handleSmartLink = async (req, res) => {
  const startTime = Date.now();

  try {
    const { slug } = req.params;
    const offer = await Offer.findOne({
      smartLinkSlug: slug,
      smartLinkEnabled: true,
      status: { $in: ['active'] },
    });

    if (!offer) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
          <div style="text-align:center"><h2>Offer Not Found</h2><p style="color:#6b7280">This link is no longer available.</p></div>
        </body></html>
      `);
    }

    // Use correct field — landingPageUrl is primary, offerUrl is legacy fallback
    const landingUrl = offer.landingPageUrl || offer.offerUrl;
    if (!landingUrl) {
      console.error(`[SMART-LINK] Offer ${offer._id} (slug: ${slug}) has no landing page URL`);
      return res.status(500).send(`
        <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
          <div style="text-align:center"><h2>Configuration Error</h2><p style="color:#6b7280">This offer has no landing page URL configured.</p></div>
        </body></html>
      `);
    }

    const visitor = parseVisitorInfo(req);
    const clickId = generateClickId();

    // Build redirect URL with macros (needed even for the 'block' path so the
    // Click record can still show what the visitor would have hit)
    const subIds = {
      subId1: req.query.sub1 || req.query.subid || '',
      subId2: req.query.sub2 || '', subId3: req.query.sub3 || '',
      subId4: req.query.sub4 || '', subId5: req.query.sub5 || '',
      source: req.query.source || '',
    };
    const redirectUrl = replaceMacros(landingUrl, {
      clickId, offerId: offer._id.toString(),
      ...subIds,
      ...visitor,
    });

    // Validate redirect URL
    if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
      console.error(`[SMART-LINK] Invalid redirect URL for slug ${slug}: ${redirectUrl}`);
      return res.status(500).send('Invalid redirect URL');
    }

    // ── 1-4: sync targeting filters — bot → IP blocklist → geo → device/OS/browser.
    // Shared with /click via trafficFilter.js so both entry points enforce the
    // same Step 5 targeting rules.
    const filter = applyFilters(offer, visitor, req);

    let finalUrl = redirectUrl;
    let isBlocked = filter.isBlocked;
    let blockReason = filter.blockReason;
    let isDuplicate = false;

    if (isBlocked) {
      // Targeting block (bot / ip_blocked / geo / device) — ALWAYS shows the
      // blocked page, never redirects. `fallbackUrl` belongs to the Frequency
      // Cap section of the wizard and applies ONLY to onDuplicate='fallback'.
      finalUrl = '';
    } else {
      // ── Frequency cap — last, the only check that hits the DB.
      // cap === 0 short-circuits: no DB query, and the onDuplicate branch below
      // is never entered, so a disabled cap can never block or redirect.
      const cap = Number(offer.ipCap) || 0;
      isDuplicate = cap > 0 ? await checkDuplicate(Click, offer, visitor) : false;

      if (isDuplicate) {
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

    console.log(
      `[SMART-LINK] ${clickId} (${slug}) device=${visitor.device}/${visitor.os}/${visitor.browser} ` +
      `country=${visitor.country} ipCap=${Number(offer.ipCap) || 0} dup=${isDuplicate} ` +
      `onDuplicate=${offer.onDuplicate || 'block'} fallbackUrl=${offer.fallbackUrl || '(none)'} ` +
      `blocked=${isBlocked} reason=${blockReason || '-'} → ${isBlocked ? '(blocked page)' : finalUrl}`
    );

    // Log every click first — blocked ones too, so blocks stay visible in reporting.
    await logClick(offer, clickId, visitor, req, {
      isDuplicate, isBot: filter.isBot, isVpn: filter.isVpn, isSmartLink: true, smartLinkSlug: slug,
      isBlocked, blockReason, redirectUrl: finalUrl, startTime,
    });

    if (isBlocked) {
      // 429 for a frequency-cap block, 403 for a targeting block.
      return blockReason === 'frequency_cap'
        ? sendBlockedResponse(res, { statusCode: 429 })
        : sendBlockedResponse(res, { statusCode: 403, message: offer.blockedPageMessage || DEFAULT_BLOCKED_MESSAGE });
    }

    // Redirect — use redirectMode from model ('302', '301', 'meta_refresh', 'javascript')
    switch (offer.redirectMode) {
      case 'meta_refresh':
        return res.send(`<html><head><meta http-equiv="refresh" content="0;url=${finalUrl}"></head><body></body></html>`);
      case 'javascript':
        return res.send(`<html><body><script>window.location.href="${finalUrl}";</script></body></html>`);
      case '301':
        return res.redirect(301, finalUrl);
      default:
        return res.redirect(302, finalUrl);
    }
  } catch (err) {
    console.error('Smart link error:', err);
    res.status(500).send('Internal server error');
  }
};

async function logClick(offer, clickId, visitor, req, opts = {}) {
  try {
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
      isSmartLink: opts.isSmartLink || false,
      smartLinkSlug: opts.smartLinkSlug || '',
      uniqueHash: opts.uniqueHash || '',
      isBot: opts.isBot || false,
      isVpn: opts.isVpn || false,
      isDuplicate: opts.isDuplicate || false,
      isBlocked: opts.isBlocked || false,
      blockReason: opts.blockReason || '',
      redirectUrl: opts.redirectUrl || '',
      redirectType: offer.redirectMode || '302',
      responseTimeMs: Date.now() - (opts.startTime || Date.now()),
      clickedAt: new Date(),
    });
    await click.save();

    // Update daily stats
    await updateDailyStats(DailyStat, offer._id, offer.name, {
      click: true,
      isDuplicate: opts.isDuplicate,
      isBlocked: opts.isBlocked,
      blockReason: opts.blockReason,
      isBot: opts.isBot,
      country: visitor.country,
      device: visitor.device,
      browser: visitor.browser,
      os: visitor.os,
      source: req.query.source,
      subId1: req.query.sub1 || req.query.subid,
    });

    // Update offer totals
    await Offer.updateOne({ _id: offer._id }, { $inc: { totalClicks: 1 } });
  } catch (err) {
    console.error('Failed to log click:', err);
  }
}

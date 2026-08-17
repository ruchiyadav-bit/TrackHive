const Offer = require('../models/Offer');
const Click = require('../models/Click');
const DailyStat = require('../models/DailyStat');
const {
  generateClickId, parseVisitorInfo,
  checkDuplicate, detectBot, detectVpn, isIpBlocked,
  checkGeoTarget, replaceMacros, updateDailyStats,
  resolveDuplicateAction,
} = require('../utils/clickHelpers');
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

    // Bot detection
    const isBot = offer.botDetection && detectBot(visitor.userAgent);
    if (isBot) {
      return sendBlockedPage(res, offer, 'Bot detected');
    }

    // VPN detection
    const isVpn = offer.vpnDetection && detectVpn(req);

    // IP blocklist
    if (isIpBlocked(visitor.ip, offer.ipBlocklist)) {
      return sendBlockedPage(res, offer, 'IP blocked');
    }

    // GEO targeting
    if (!checkGeoTarget(offer, visitor.country)) {
      if (offer.redirectOnFail) return res.redirect(302, offer.redirectOnFail);
      return sendBlockedPage(res, offer, 'GEO restricted');
    }

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

    // Duplicate/IP cap check (MongoDB-based)
    const cap = Number(offer.ipCap) || 0;
    const isDuplicate = cap > 0 ? await checkDuplicate(Click, offer, visitor) : false;

    // ── On-duplicate behaviour: block | fallback | redirect ──
    let finalUrl = redirectUrl;
    let isBlocked = false;
    let blockReason = '';

    if (isDuplicate) {
      const action = resolveDuplicateAction(offer);
      if (action === 'block') {
        isBlocked = true;
        blockReason = 'frequency_cap';
      } else if (action === 'fallback') {
        finalUrl = offer.fallbackUrl;
      }
      // action === 'redirect' → finalUrl stays as the normal offer URL
    }

    if (isBlocked) {
      // Block: no redirect, but still log the click so blocks are visible in reporting.
      await logClick(offer, clickId, visitor, req, {
        isDuplicate: true, isVpn, isSmartLink: true, smartLinkSlug: slug,
        isBlocked: true, blockReason: 'frequency_cap', redirectUrl: '', startTime,
      });
      return sendBlockedResponse(res, { statusCode: 429 });
    }

    console.log(`[SMART-LINK] ${clickId} (${slug}) → ${finalUrl}`);

    // Log click
    await logClick(offer, clickId, visitor, req, {
      isDuplicate, isVpn, isSmartLink: true, smartLinkSlug: slug,
      redirectUrl: finalUrl, startTime,
    });

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

// Used for bot/geo/IP blocks — respects the offer's custom blockedPageMessage.
// Frequency-cap blocks go through sendBlockedResponse() directly with the
// generic default message instead (never reveal *why* the visitor was blocked).
function sendBlockedPage(res, offer) {
  sendBlockedResponse(res, { statusCode: 403, message: offer.blockedPageMessage || DEFAULT_BLOCKED_MESSAGE });
}

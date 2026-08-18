const { v4: uuidv4 } = require('uuid');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

/**
 * Generate a unique click ID
 */
exports.generateClickId = () => uuidv4().replace(/-/g, '');

/**
 * Private / reserved ranges. An address in one of these can never be a real
 * visitor — it is the load balancer or another internal hop.
 */
const PRIVATE_IP = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i;

function isPublicIp(ip) {
  if (!ip) return false;
  return !PRIVATE_IP.test(String(ip).replace(/^::ffff:/, ''));
}

/**
 * Work out the visitor's real IP.
 *
 * Two failure modes to avoid:
 *   1. Reading x-forwarded-for[0] blindly — a proxy APPENDS the real client IP,
 *      so the leftmost entry is whatever the client itself sent. Anyone could
 *      add `X-Forwarded-For: 8.8.8.8` and pick their own country, defeating geo
 *      targeting, the IP blocklist and the frequency cap.
 *   2. Trusting req.ip alone — it depends on TRUST_PROXY matching the real hop
 *      count. Render sits behind more than one hop, so with TRUST_PROXY=1
 *      req.ip came back as an internal 10.x address, geoip resolved it to 'XX'
 *      and every visitor got geo-blocked.
 *
 * So: prefer req.ip when it is a real public address (that is the correct,
 * proxy-aware answer), and only if it isn't, scan the forwarded chain for the
 * first public address. Internal hops are skipped either way.
 */
function resolveClientIp(req) {
  const clean = (v) => String(v || '').trim().replace(/^::ffff:/, '');

  const direct = clean(req.ip);
  if (isPublicIp(direct)) return direct;

  const chain = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(clean)
    .filter(Boolean);
  const firstPublic = chain.find(isPublicIp);
  if (firstPublic) return firstPublic;

  const realIp = clean(req.headers['x-real-ip']);
  if (isPublicIp(realIp)) return realIp;

  // Nothing public anywhere — local dev, or a health check from inside the network.
  return direct || clean(req.socket?.remoteAddress) || '0.0.0.0';
}

exports.isPublicIp = isPublicIp;
exports.resolveClientIp = resolveClientIp;

/**
 * Parse visitor info from request.
 *
 * TEST OVERRIDE — set ALLOW_TEST_GEO=1 to enable `?test_ip=` / `?test_country=`
 * on tracking links, so geo/device rules can be exercised without a VPN. Keep it
 * OFF in production: it lets any visitor choose their own country.
 */
exports.parseVisitorInfo = (req) => {
  const allowTestGeo = process.env.ALLOW_TEST_GEO === '1';

  let ip = resolveClientIp(req);
  if (allowTestGeo && req.query.test_ip) {
    ip = String(req.query.test_ip).trim();
  }

  const ua = new UAParser(req.headers['user-agent']);
  const geo = geoip.lookup(ip) || {};

  let country = geo.country || 'XX';
  if (allowTestGeo && req.query.test_country) {
    country = String(req.query.test_country).trim().toUpperCase();
  }

  return {
    ip,
    userAgent: req.headers['user-agent'] || '',
    referer: req.headers['referer'] || req.query.ref || '',
    country,
    region: geo.region || '',
    city: geo.city || '',
    device: ua.getDevice().type || 'desktop',
    os: ua.getOS().name || 'Unknown',
    browser: ua.getBrowser().name || 'Unknown',
    isp: '', // would require a paid GeoIP DB
  };
};

/**
 * Convert ipCapWindow to hours
 */
function windowHours(window, customHours) {
  switch (window) {
    case '24h':   return 24;
    case '48h':   return 48;
    case '7d':    return 168;
    case '30d':   return 720;
    case 'custom': return customHours || 24;
    case 'forever':
    default:      return 8760; // 1 year
  }
}

/**
 * Check if click is a duplicate using MongoDB
 * Returns true if the visitor has already hit the cap
 */
exports.checkDuplicate = async (Click, offer, visitor) => {
  const cap = Number(offer.ipCap) || 0;
  if (cap <= 0) return false;

  const hours = windowHours(offer.ipCapWindow, offer.ipCapWindowHours);
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const filter = {
    offerId: offer._id,
    ip: visitor.ip,
    clickedAt: { $gte: since },
    isDuplicate: { $ne: true },
  };

  if (offer.uniqueIdentifier === 'ip_ua' ||
      offer.uniqueIdentifier === 'ip_ua_ref') {
    filter.userAgent = visitor.userAgent;
  }
  if (offer.uniqueIdentifier === 'ip_ua_ref') {
    filter.referer = visitor.referer || '';
  }

  const count = await Click.countDocuments(filter);
  return count >= cap;
};

/**
 * Resolve the effective on-duplicate action for an offer.
 * Falls back to 'block' if the offer predates the field, and falls back
 * from 'fallback' to 'block' if no fallbackUrl is configured (logging a
 * warning so the misconfiguration is visible in the server logs).
 */
exports.resolveDuplicateAction = (offer) => {
  let action = offer.onDuplicate || 'block';
  if (action === 'fallback' && !offer.fallbackUrl) {
    console.warn(`[FREQ-CAP] Offer ${offer._id} has onDuplicate='fallback' but no fallbackUrl set — falling back to 'block'`);
    action = 'block';
  }
  return action;
};

/**
 * Basic bot detection via user-agent patterns
 */
exports.detectBot = (userAgent) => {
  if (!userAgent) return true;
  const botPatterns = [
    /bot/i, /spider/i, /crawl/i, /slurp/i, /mediapartners/i,
    /curl/i, /wget/i, /python-requests/i, /go-http-client/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
    /lighthouse/i, /pagespeed/i, /gtmetrix/i,
  ];
  return botPatterns.some(p => p.test(userAgent));
};

/**
 * Basic VPN/proxy detection via headers
 */
exports.detectVpn = (req) => {
  // Header sniffing CANNOT reliably detect a VPN. Two signals that used to be
  // checked here fire on essentially every request once the app is behind a
  // load balancer or CDN (which Render is):
  //   - x-forwarded-for containing a comma: normal whenever there is more than
  //     one hop, so every single click was flagged VPN
  //   - `via`: routinely set by CDNs and caches on legitimate traffic
  // Both are removed. What's left are headers a plain CDN hop does not add.
  //
  // This flag is informational only — it never blocks (see utils/trafficFilter.js).
  // For real VPN/proxy/datacenter detection you need an IP intelligence
  // dataset (IP2Proxy, IPQualityScore, MaxMind Anonymous IP); header
  // inspection alone will always be wrong in both directions.
  const indicators = [
    req.headers['x-proxy-id'],
    req.headers['proxy-connection'],
    req.headers['x-anonymous'],
  ];
  return indicators.some(Boolean);
};

/**
 * Check IP blocklist
 */
exports.isIpBlocked = (ip, blocklist) => {
  if (!blocklist) return false;
  const blocked = blocklist.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  return blocked.includes(ip);
};

/**
 * Check GEO targeting
 */
exports.checkGeoTarget = (offer, country) => {
  // Field names match the Offer model (Step 5: Targeting) — geoCountries + geoMode
  // ('include' | 'exclude'). Previously read the non-existent offer.geoTargets /
  // geoMode === 'blacklist', so geo targeting silently never applied.
  if (!offer.geoCountries || offer.geoCountries.length === 0) return true;

  // "Countries" is a free-text tag field in the wizard, so a user can easily
  // enter "us" or " US ". geoip returns an upper-case ISO-3166 alpha-2 code, and
  // the old comparison was an exact case-sensitive match — "us" never matched
  // "US" and the offer blocked everyone. Normalise both sides.
  const norm = (v) => String(v || '').trim().toUpperCase();
  const list = offer.geoCountries.map(norm).filter(Boolean);
  if (!list.length) return true;

  const isInList = list.includes(norm(country));
  return offer.geoMode === 'exclude' ? !isInList : isInList;
};

/**
 * Replace macros in URL
 */
exports.replaceMacros = (url, data) => {
  if (!url) return url;
  return url
    .replace(/\{click_id\}/g, data.clickId || '')
    .replace(/\{offer_id\}/g, data.offerId || '')
    .replace(/\{sub1\}/g, data.subId1 || '')
    .replace(/\{sub2\}/g, data.subId2 || '')
    .replace(/\{sub3\}/g, data.subId3 || '')
    .replace(/\{sub4\}/g, data.subId4 || '')
    .replace(/\{sub5\}/g, data.subId5 || '')
    .replace(/\{source\}/g, data.source || '')
    .replace(/\{ip\}/g, data.ip || '')
    .replace(/\{country\}/g, data.country || '')
    .replace(/\{device\}/g, data.device || '')
    .replace(/\{os\}/g, data.os || '')
    .replace(/\{browser\}/g, data.browser || '')
    .replace(/\{user_agent\}/g, encodeURIComponent(data.userAgent || ''))
    .replace(/\{referer\}/g, encodeURIComponent(data.referer || ''))
    .replace(/\{timestamp\}/g, Date.now().toString());
};

/**
 * Update daily stats atomically
 */
exports.updateDailyStats = async (DailyStat, offerId, offerName, data) => {
  // data.date lets a correction be applied to the day it belongs to (e.g.
  // reversing a conversion that was recorded last week) instead of today.
  const today = data.date || new Date().toISOString().split('T')[0];
  const update = { $inc: {} };

  if (data.click) {
    update.$inc.clicks = 1;
    // Targeting blocks (bot/geo/device/ip) are not duplicates but must still
    // be excluded from Unique — a blocked visitor was never actually
    // delivered to the offer.
    if (!data.isDuplicate && !data.isBlocked) update.$inc.uniqueClicks = 1;
    // Frequency-cap blocks are still duplicates and count in Dup. Clicks —
    // they must NOT also count in Invalid Clicks (reserved for bot/geo/
    // device/IP blocks), otherwise the same click would be counted twice.
    if (data.isBlocked && data.blockReason !== 'frequency_cap') update.$inc.blockedClicks = 1;
    if (data.isBot) update.$inc.botClicks = 1;
    if (data.isDuplicate) update.$inc.duplicateClicks = 1;

    // Breakdown-map keys. `source` and `subId1` come straight from the click
    // query string, and /click is mounted before mongoSanitize(), so they are
    // fully attacker-controlled. A '.' in a key makes Mongo treat it as a nested
    // path (writing an object into a Map-of-Number, which then fails to hydrate
    // and makes the WHOLE day's breakdown read back as undefined), and a leading
    // '$' makes Mongo reject the update outright — which also killed the
    // totalClicks increment sharing that Promise.all.
    const mapKey = (v) => String(v).replace(/[.$]/g, '_').slice(0, 64);

    if (data.country) update.$inc[`byCountry.${mapKey(data.country)}`] = 1;
    if (data.device) update.$inc[`byDevice.${mapKey(data.device)}`] = 1;
    if (data.browser) update.$inc[`byBrowser.${mapKey(data.browser)}`] = 1;
    if (data.os) update.$inc[`byOs.${mapKey(data.os)}`] = 1;
    if (data.source) update.$inc[`bySource.${mapKey(data.source)}`] = 1;
    if (data.subId1) update.$inc[`bySubId.${mapKey(data.subId1)}`] = 1;
  }

  if (data.conversion) {
    // conversionDelta is normally +1, but 0 for an amount-only update and -1
    // when a conversion is reversed. revenue/payout may be negative for those.
    update.$inc.conversions = data.conversionDelta === undefined ? 1 : data.conversionDelta;
    update.$inc.revenue = data.revenue || 0;
    update.$inc.payout = data.payout || 0;
    update.$inc.profit = (data.revenue || 0) - (data.payout || 0);
  }

  update.$setOnInsert = { offerName };

  const stat = await DailyStat.findOneAndUpdate(
    { date: today, offerId },
    update,
    { upsert: true, new: true }
  );

  // The derived cr/epc/rpc fields used to be recomputed here and written back
  // with a second, non-atomic stat.save(). That was a lost-update race (two
  // concurrent clicks would each compute from their own snapshot and the slower
  // one would overwrite the faster one's value, drifting permanently low) AND a
  // second DB round-trip on the click hot path. Nothing reads these fields —
  // every report computes its own rates from the raw sums — so the write is
  // dropped. Compute them on read if they are ever needed.

  return stat;
};

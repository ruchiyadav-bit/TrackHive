/**
 * Shared synchronous traffic filter chain, used by BOTH /click (clickController)
 * and /go/:slug (smartLinkController) so targeting rules behave identically on
 * both entry points. Previously /click didn't call any of this — Step 5
 * targeting (device/OS/browser, geo, IP blocklist) and bot detection only ran
 * on smart links, so every direct /click link ignored all of it.
 *
 * Order (cheapest checks first, no DB query at all — frequency cap is async
 * and stays out of this module, handled separately by the caller):
 *   1. Bot            → blockReason 'bot'
 *   2. IP blocklist   → blockReason 'ip_blocked'
 *   3. Geo targeting  → blockReason 'geo'
 *   4. Device/OS/Browser targeting → blockReason 'device'
 *
 * VPN is detected and returned as a flag only — it is NEVER used to block.
 * detectVpn() flags any request with a comma in x-forwarded-for or common
 * proxy headers, which are routinely present behind a CDN/reverse proxy
 * (Render), so using it to block would false-positive on legitimate traffic.
 */

const { detectBot, detectVpn, isIpBlocked, checkGeoTarget } = require('./clickHelpers');

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

/**
 * Browser FAMILY, so a targeting chip matches every variant UAParser reports.
 *
 * The offer wizard offers 'Safari' / 'Chrome' / 'Samsung Internet', but UAParser
 * names the phone builds differently: an iPhone is 'Mobile Safari', Android
 * Firefox is 'Mobile Firefox', an in-app Android browser is 'Chrome WebView',
 * Samsung's is 'Samsung Browser'. Comparing raw names blocked every iPhone on an
 * offer targeted "Mobile + Safari" with blockReason 'device'.
 */
function browserFamily(name) {
  let b = norm(name);
  b = b.replace(/^mobile\s+/, '').replace(/\s+(webview|mobile|mobi|mini|touch)$/, '');
  if (b === 'samsung browser') return 'samsung internet';
  if (b === 'edge chromium') return 'edge';
  return b;
}

/** OS family: UAParser says 'Mac OS' / 'Chromium OS', the wizard 'macOS' / 'Chrome OS'. */
function osFamily(name) {
  const o = norm(name);
  if (o === 'mac os' || o === 'macos' || o === 'mac os x') return 'macos';
  if (o === 'chromium os' || o === 'chrome os') return 'chrome os';
  return o;
}

exports.browserFamily = browserFamily;
exports.osFamily = osFamily;

/**
 * Device/OS/Browser targeting (Offer Step 5). Case-insensitive — UAParser
 * returns values like 'Android'/'Windows' while the wizard may store
 * lowercase strings. An empty array on any dimension means no restriction
 * on that dimension.
 */
exports.checkDeviceTarget = (offer, visitor) => {
  if (offer.deviceTypes?.length && !offer.deviceTypes.map(norm).includes(norm(visitor.device))) {
    return false;
  }
  if (offer.operatingSystems?.length && !offer.operatingSystems.map(osFamily).includes(osFamily(visitor.os))) {
    return false;
  }
  if (offer.browsers?.length && !offer.browsers.map(browserFamily).includes(browserFamily(visitor.browser))) {
    return false;
  }
  return true;
};

/**
 * Run the full sync filter chain.
 * @returns {{ isBot: boolean, isVpn: boolean, isBlocked: boolean, blockReason: string }}
 */
exports.applyFilters = (offer, visitor, req) => {
  const isVpn = detectVpn(req);
  const isBot = detectBot(visitor.userAgent);

  if (isBot) {
    return { isBot: true, isVpn, isBlocked: true, blockReason: 'bot' };
  }
  if (isIpBlocked(visitor.ip, offer.ipBlocklist)) {
    return { isBot: false, isVpn, isBlocked: true, blockReason: 'ip_blocked' };
  }
  if (!checkGeoTarget(offer, visitor.country)) {
    return { isBot: false, isVpn, isBlocked: true, blockReason: 'geo' };
  }
  if (!exports.checkDeviceTarget(offer, visitor)) {
    return { isBot: false, isVpn, isBlocked: true, blockReason: 'device' };
  }
  return { isBot: false, isVpn, isBlocked: false, blockReason: '' };
};

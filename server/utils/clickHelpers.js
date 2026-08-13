const { v4: uuidv4 } = require('uuid');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const crypto = require('crypto');
const { getRedis } = require('../config/redis');

/**
 * Generate a unique click ID
 */
exports.generateClickId = () => uuidv4().replace(/-/g, '');

/**
 * Parse visitor info from request
 */
exports.parseVisitorInfo = (req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || '0.0.0.0';

  const ua = new UAParser(req.headers['user-agent']);
  const geo = geoip.lookup(ip) || {};

  return {
    ip,
    userAgent: req.headers['user-agent'] || '',
    referer: req.headers['referer'] || req.query.ref || '',
    country: geo.country || 'XX',
    region: geo.region || '',
    city: geo.city || '',
    device: ua.getDevice().type || 'desktop',
    os: ua.getOS().name || 'Unknown',
    browser: ua.getBrowser().name || 'Unknown',
    isp: '', // would require a paid GeoIP DB
  };
};

/**
 * Generate a unique hash for dedup based on offer settings
 */
exports.generateUniqueHash = (offer, visitor) => {
  const parts = [visitor.ip];
  if (offer.uniqueIdentifier === 'ip_ua' || offer.uniqueIdentifier === 'ip_ua_ref') {
    parts.push(visitor.userAgent);
  }
  if (offer.uniqueIdentifier === 'ip_ua_ref') {
    parts.push(visitor.referer);
  }
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 32);
};

/**
 * Check if click is a duplicate using Redis
 */
exports.checkDuplicate = async (offer, uniqueHash) => {
  const redis = getRedis();
  if (!redis) return false;

  const key = `ip_cap:${offer._id}:${uniqueHash}`;
  const count = await redis.get(key);
  const cap = offer.ipCap || 1;

  if (count && parseInt(count) >= cap) return true;

  // Determine TTL based on cap window
  let ttl;
  switch (offer.ipCapWindow) {
    case '24h': ttl = 86400; break;
    case '48h': ttl = 172800; break;
    case '7d': ttl = 604800; break;
    case '30d': ttl = 2592000; break;
    case 'custom': ttl = (offer.ipCapWindowHours || 24) * 3600; break;
    case 'forever':
    default: ttl = 31536000; break; // 1 year
  }

  await redis.multi()
    .incr(key)
    .expire(key, ttl)
    .exec();

  return false;
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
  const indicators = [
    req.headers['x-forwarded-for']?.includes(','),
    req.headers['via'],
    req.headers['x-proxy-id'],
    req.headers['proxy-connection'],
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
  if (!offer.geoTargets || offer.geoTargets.length === 0) return true;
  const isInList = offer.geoTargets.includes(country);
  return offer.geoMode === 'blacklist' ? !isInList : isInList;
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
  const today = new Date().toISOString().split('T')[0];
  const update = { $inc: {} };

  if (data.click) {
    update.$inc.clicks = 1;
    if (!data.isDuplicate) update.$inc.uniqueClicks = 1;
    if (data.isBlocked) update.$inc.blockedClicks = 1;
    if (data.isBot) update.$inc.botClicks = 1;
    if (data.isDuplicate) update.$inc.duplicateClicks = 1;

    if (data.country) update.$inc[`byCountry.${data.country}`] = 1;
    if (data.device) update.$inc[`byDevice.${data.device}`] = 1;
    if (data.browser) update.$inc[`byBrowser.${data.browser}`] = 1;
    if (data.os) update.$inc[`byOs.${data.os}`] = 1;
    if (data.source) update.$inc[`bySource.${data.source}`] = 1;
    if (data.subId1) update.$inc[`bySubId.${data.subId1}`] = 1;
  }

  if (data.conversion) {
    update.$inc.conversions = 1;
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

  // Recalculate derived fields
  if (stat.clicks > 0) {
    stat.cr = stat.conversions / stat.clicks * 100;
    stat.epc = stat.revenue / stat.clicks;
    stat.rpc = stat.profit / stat.clicks;
    await stat.save();
  }

  return stat;
};

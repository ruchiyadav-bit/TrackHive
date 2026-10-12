/**
 * Google Ads click tracking: GET /gclick?offer_id=xxx&url=<final URL>
 *
 * A SEPARATE handler from /click. Nothing in /click changes; this exists so a
 * Google Ads tracking template can follow Google's third-party click tracker
 * guidelines (https://support.google.com/google-ads/answer/13707399):
 *
 *   - The next hop is a VISIBLE query parameter (`url`) and the tracker always
 *     sends the visitor exactly there. No backend-configured target, no
 *     fallback URL, no geo/device/duplicate re-routing.
 *   - Server-side validation of the target is allowed, so `url` must point at
 *     a domain this offer is allowed to send to (see allowedHosts below).
 *   - The normal public interface accepts exactly `offer_id` and `url`. For
 *     Google's exact HTTPS `www.google.com/asnc...` parallel callback only,
 *     Google may additionally send `gb=1`. No custom macros are expanded here.
 *
 * It only answers on the ONE Google tracking domain set in the dashboard
 * (Settings > Tracking > Google Ads Tracking Domain; GCLICK_HOST in .env as a
 * fallback), exact host match. The normal tracking domains keep working
 * exactly as before and can never serve this mode by accident.
 *
 * The click is still recorded in the same Click collection (with the bot / VPN
 * / duplicate flags), so it shows in reports and postbacks match it as usual.
 */
const Offer = require('../models/Offer');
const Click = require('../models/Click');
const DailyStat = require('../models/DailyStat');
const {
  generateClickId, parseVisitorInfo, checkDuplicate, updateDailyStats,
} = require('../utils/clickHelpers');
const { applyFilters } = require('../utils/trafficFilter');

const { getGoogleHost } = require('../utils/googleTracking');

// Extra destination domains allowed for every offer (comma separated), on top
// of the ones derived from the offer's own landing page URL.
const EXTRA_ALLOWED = (process.env.GCLICK_ALLOWED_DOMAINS || '')
  .split(',').map(h => h.trim().toLowerCase().replace(/^www\./, '')).filter(Boolean);

function requestHost(req) {
  const raw = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return raw.trim().toLowerCase().replace(/:\d+$/, '');
}

/** True when this request came in on the configured Google tracking domain. */
async function isGoogleHost(req) {
  const googleHost = await getGoogleHost();
  return Boolean(googleHost) && requestHost(req) === googleHost;
}

function hostMatches(host, base) {
  return host === base || host.endsWith('.' + base);
}

function parseUrl(value) {
  try {
    const u = new URL(String(value));
    return /^https?:$/.test(u.protocol) ? u : null;
  } catch {
    return null;
  }
}

const GCLICK_QUERY_PARAMETERS = new Set(['offer_id', 'url']);

/**
 * Google Ads replaces {lpurl} with this callback while testing/processing a
 * parallel-tracking request. Keep the exception deliberately narrow so the
 * tracker cannot become a general-purpose redirect to google.com.
 */
function isGoogleParallelCallback(target) {
  return target.protocol === 'https:'
    && target.hostname.toLowerCase() === 'www.google.com'
    && (target.pathname === '/asnc' || target.pathname.startsWith('/asnc/'));
}

/**
 * Keep the certification-facing interface exact and auditable. Parameters
 * used by the normal /click button URL (sub1-sub5, source, etc.) deliberately
 * do not belong to /gclick.
 */
function parseGclickQuery(query = {}) {
  const offerId = query.offer_id;
  if (Array.isArray(offerId) || !offerId || !/^[a-f\d]{24}$/i.test(String(offerId))) {
    return { error: 'offer_id is required' };
  }

  if (Array.isArray(query.url)) {
    return { error: 'url is required (http/https)' };
  }
  const target = parseUrl(query.url);
  if (!target) {
    return { error: 'url is required (http/https)' };
  }

  const googleParallelCallback = isGoogleParallelCallback(target);
  const supported = googleParallelCallback
    ? new Set([...GCLICK_QUERY_PARAMETERS, 'gb'])
    : GCLICK_QUERY_PARAMETERS;
  const unsupported = Object.keys(query).filter(key => !supported.has(key));
  if (unsupported.length) {
    return { error: `Unsupported parameter: ${unsupported[0]}` };
  }
  if (googleParallelCallback && query.gb !== undefined
    && (Array.isArray(query.gb) || String(query.gb) !== '1')) {
    return { error: 'Invalid Google parallel tracking parameter' };
  }

  return { offerId: String(offerId), target, googleParallelCallback };
}

/**
 * Destination domains this offer may send to: the landing page's own host,
 * plus any URL carried inside the landing page's query string (affiliate links
 * such as r.salegains.com?...&url=https://gundrymd.com/ name the merchant
 * there), plus GCLICK_ALLOWED_DOMAINS.
 */
function allowedHosts(landingUrl, googleLandingUrl) {
  const hosts = new Set(EXTRA_ALLOWED);
  // The offer's own Google Ads landing page (your site), set on the offer.
  const own = parseUrl(googleLandingUrl);
  if (own) hosts.add(own.hostname.toLowerCase().replace(/^www\./, ''));
  const lp = parseUrl(landingUrl);
  if (lp) {
    hosts.add(lp.hostname.toLowerCase().replace(/^www\./, ''));
    for (const v of lp.searchParams.values()) {
      const inner = parseUrl(v);
      if (inner) hosts.add(inner.hostname.toLowerCase().replace(/^www\./, ''));
    }
  }
  return [...hosts];
}

exports.handleGClick = async (req, res) => {
  const startTime = Date.now();
  try {
    if (!(await isGoogleHost(req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const parsed = parseGclickQuery(req.query);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { offerId, target, googleParallelCallback } = parsed;

    const offer = await Offer.findOne({ _id: offerId, status: 'active' }).lean();
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found or inactive' });
    }

    const targetHost = target.hostname.toLowerCase().replace(/^www\./, '');
    const allowed = allowedHosts(offer.landingPageUrl || offer.offerUrl, offer.googleLandingUrl);
    if (!googleParallelCallback && !allowed.some(base => hostMatches(targetHost, base))) {
      return res.status(400).json({ error: 'url domain is not allowed for this offer' });
    }

    const visitor = parseVisitorInfo(req);
    const clickId = generateClickId();
    const subIds = {
      subId1: '',
      subId2: '',
      subId3: '',
      subId4: '',
      subId5: '',
      source: '',
    };

    // Transparent means exact: send the visitor to the visible `url` value.
    const finalUrl = target.toString();

    // Flags are recorded for reporting only. They never change the destination.
    const filter = applyFilters(offer, visitor, req);
    const cap = Number(offer.ipCap) || 0;
    const isDup = cap > 0 ? await checkDuplicate(Click, offer, visitor) : false;

    res.redirect(302, finalUrl);

    setImmediate(async () => {
      try {
        await new Click({
          clickId,
          offerId: offer._id,
          offerName: offer.name,
          ...visitor,
          ...subIds,
          isBot: filter.isBot,
          isVpn: filter.isVpn,
          isDuplicate: isDup,
          isBlocked: false,
          redirectUrl: finalUrl,
          redirectType: 'gclick',
          responseTimeMs: Date.now() - startTime,
          clickedAt: new Date(),
        }).save();

        await Promise.all([
          updateDailyStats(DailyStat, offer._id, offer.name, {
            click: true,
            isDuplicate: isDup,
            isBlocked: false,
            isBot: filter.isBot,
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
        console.error('[GCLICK] background write error:', bgErr);
      }
    });
  } catch (err) {
    console.error('[GCLICK] handler error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

/** GET /gclick/health — answers ok only on the Google tracking domain. */
exports.health = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Read by the dashboard's "Test domain" button from another origin.
  res.set('Access-Control-Allow-Origin', '*');
  if (!(await isGoogleHost(req))) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, host: requestHost(req) });
};

// Exported only so the strict public contract can be covered by unit tests.
exports.parseGclickQuery = parseGclickQuery;
exports.isGoogleParallelCallback = isGoogleParallelCallback;

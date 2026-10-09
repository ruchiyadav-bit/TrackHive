/**
 * Build the postback URL that gets handed to a network.
 *
 * This is the ONLY place the client builds this string. Three pages
 * (Offers detail, Advertisers list, Advertiser detail) each assembled it by
 * hand, and all three silently dropped `txn_id` and the preset's
 * `extraParams`. That is how a Katalys URL went out without
 * {conversion_status} and {postback_operation} — so refunds, cancellations
 * and amount corrections never reached TrackHive and revenue stayed booked
 * on conversions the network had already reversed.
 *
 * Mirrors server/utils/postbackUrl.js — change both together.
 */

const FALLBACK_MACROS = {
  click_id: '{click_id}',
  revenue: '{revenue}',
  payout: '{payout}',
  event: '{event}',
};

/**
 * The click_id macro for THIS advertiser. The preset's macro echoes the
 * preset's default clickIdParam; when the advertiser's Click ID Param is
 * changed (e.g. MaxBounty s2 -> s1), the postback has to read back that same
 * param, in the preset's own syntax: #S2# -> #S1#, {sub1} -> {sub2}.
 */
export function clickIdMacro(preset, clickIdParam) {
  const macro = preset?.macros?.click_id || FALLBACK_MACROS.click_id;
  const param = String(clickIdParam || '').trim();
  if (!param) return macro;
  const presetParam = String(preset?.clickIdParam || '').trim();
  if (presetParam && presetParam.toLowerCase() === param.toLowerCase()) return macro;
  const m = macro.match(/^([{[#])(.+?)([}\]#])$/);
  if (!m) return `{${param}}`;
  const inner = m[2];
  const upper = /[A-Z]/.test(inner) && inner === inner.toUpperCase();
  return `${m[1]}${upper ? param.toUpperCase() : param}${m[3]}`;
}

export function buildPostbackUrl({ trackingDomain, preset, secret, clickIdParam }) {
  if (!trackingDomain) return '';

  const m = { ...FALLBACK_MACROS, ...(preset?.macros || {}) };
  m.click_id = clickIdMacro(preset, clickIdParam);
  const base = trackingDomain.startsWith('http') ? trackingDomain : `https://${trackingDomain}`;

  const parts = [
    `click_id=${m.click_id}`,
    `revenue=${m.revenue}`,
    `payout=${m.payout}`,
    `event=${m.event}`,
  ];

  // Optional macros are only emitted when the preset actually defines them,
  // so a network with no equivalent token doesn't receive a literal
  // placeholder it will never substitute.
  if (m.txn_id) parts.push(`txn_id=${m.txn_id}`);

  for (const [key, value] of Object.entries(preset?.extraParams || {})) {
    parts.push(`${key}=${value}`);
  }

  if (secret) parts.push(`secret=${secret}`);

  return `${base}/postback?${parts.join('&')}`;
}

/**
 * Which domain an advertiser's postback URL is built on.
 *
 * Order matters and is deliberate:
 *   1. the advertiser's own tracking domain — set once, never drifts
 *   2. the account default from Settings
 *   3. the first verified domain, only as a last resort
 *
 * Step 3 is why this had to become explicit: with one domain it is invisibly
 * correct, but with five it picks an arbitrary one, and the postback already
 * registered on the network would not match.
 *
 * Every page that renders a postback URL must call this — three pages each
 * resolved it differently, so the same advertiser showed different URLs.
 */
export function resolveAdvertiserDomain(advertiser, settings, verifiedDomains = []) {
  const own = typeof advertiser?.trackingDomain === 'object'
    ? advertiser?.trackingDomain?.domain
    : null;

  return own
    || settings?.trackingDomain
    || verifiedDomains[0]?.domain
    || '';
}

/** Prefix a bare host with https:// — domains are stored without a scheme. */
export function toBaseUrl(domain) {
  if (!domain) return '';
  return domain.startsWith('http') ? domain : `https://${domain}`;
}

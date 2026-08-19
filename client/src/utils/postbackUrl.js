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

export function buildPostbackUrl({ trackingDomain, preset, secret }) {
  if (!trackingDomain) return '';

  const m = { ...FALLBACK_MACROS, ...(preset?.macros || {}) };
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

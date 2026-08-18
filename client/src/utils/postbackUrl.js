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

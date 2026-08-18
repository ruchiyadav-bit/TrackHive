const presets = require('../config/networkPresets');

/**
 * Build a postback URL using the correct macros for the advertiser's network.
 *
 * @param {Object} opts
 * @param {string} opts.trackingDomain - e.g. "track.example.com"
 * @param {string} opts.network        - preset key, e.g. "impact", "custom"
 * @param {string} opts.secret         - advertiser postback secret
 * @returns {string} fully-formed postback URL
 */
function buildPostbackUrl({ trackingDomain, network, secret }) {
  const preset = presets[network] || presets.custom;
  const m = preset.macros;
  const base = trackingDomain.startsWith('http') ? trackingDomain : `https://${trackingDomain}`;
  // Some networks expose extra signals worth carrying (e.g. Katalys sends an
  // approval status and a create/update/delete operation). TrackHive ignores
  // unknown params today, but including them means the URL already pasted into
  // the network stays correct once they are handled.
  const extra = Object.entries(preset.extraParams || {})
    .map(([k, v]) => `&${k}=${v}`)
    .join('');

  // txn_id lives in `macros` rather than `extraParams` and was being dropped
  // here, so the network's own transaction id never reached us and conversions
  // could not be reconciled against the network's reporting.
  const txn = m.txn_id ? `&txn_id=${m.txn_id}` : '';

  return (
    `${base}/postback` +
    `?click_id=${m.click_id}` +
    `&revenue=${m.revenue}` +
    `&payout=${m.payout}` +
    `&event=${m.event}` +
    txn +
    extra +
    `${secret ? `&secret=${secret}` : ''}`
  );
}

module.exports = { buildPostbackUrl };

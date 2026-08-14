const presets = require('../config/networkPresets');

/**
 * Build a postback URL using the correct macros for the advertiser's network.
 *
 * @param {Object} opts
 * @param {string} opts.trackingDomain - e.g. "everflow.adslaunchigo.com"
 * @param {string} opts.network        - preset key, e.g. "impact", "custom"
 * @param {string} opts.secret         - advertiser postback secret
 * @returns {string} fully-formed postback URL
 */
function buildPostbackUrl({ trackingDomain, network, secret }) {
  const preset = presets[network] || presets.custom;
  const m = preset.macros;
  const base = trackingDomain.startsWith('http') ? trackingDomain : `https://${trackingDomain}`;
  return (
    `${base}/postback` +
    `?click_id=${m.click_id}` +
    `&revenue=${m.revenue}` +
    `&payout=${m.payout}` +
    `&event=${m.event}` +
    `${secret ? `&secret=${secret}` : ''}`
  );
}

module.exports = { buildPostbackUrl };

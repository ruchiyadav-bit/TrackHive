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
/** Same rule as clickIdMacro() in client/src/utils/postbackUrl.js. */
function clickIdMacro(preset, clickIdParam) {
  const macro = preset.macros.click_id;
  const param = String(clickIdParam || '').trim();
  if (!param) return macro;
  const presetParam = String(preset.clickIdParam || '').trim();
  if (presetParam && presetParam.toLowerCase() === param.toLowerCase()) return macro;
  const m = macro.match(/^([{[#])(.+?)([}\]#])$/);
  if (!m) return `{${param}}`;
  const inner = m[2];
  const upper = /[A-Z]/.test(inner) && inner === inner.toUpperCase();
  return `${m[1]}${upper ? param.toUpperCase() : param}${m[3]}`;
}

function buildPostbackUrl({ trackingDomain, network, secret, clickIdParam, usePostbackSecretVerification }) {
  const preset = presets[network] || presets.custom;
  const m = { ...preset.macros, click_id: clickIdMacro(preset, clickIdParam) };
  const base = trackingDomain.startsWith('http') ? trackingDomain : `https://${trackingDomain}`;
  const verifySecret = usePostbackSecretVerification !== false;

  // SaleGains keeps the saved base URL but drops static query parameters. Its
  // dynamic mapping UI appends click_id/revenue/etc. when it fires the call.
  if (preset.postbackPath === 'salegains') {
    return verifySecret
      ? `${base}/postback/salegains/${encodeURIComponent(secret || 'ADVERTISER_SECRET')}`
      : `${base}/postback`;
  }
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
    `${verifySecret && secret ? `&secret=${secret}` : ''}`
  );
}

module.exports = { buildPostbackUrl, clickIdMacro };

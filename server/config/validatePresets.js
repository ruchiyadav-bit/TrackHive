/**
 * Boot-time validation for networkPresets.
 *
 * Adding a network is the single easiest way to silently lose every conversion
 * from that network: the postback arrives, the click lookup fails, and nothing
 * surfaces until someone reconciles revenue weeks later. These checks turn that
 * class of mistake into a startup error instead.
 */

const REQUIRED_MACROS = ['click_id', 'revenue', 'payout', 'event'];

/** Strip macro syntax so '{SubId1}' / '[xid]' compare as 'subid1' / 'xid'. */
const bare = (token) => String(token || '').replace(/[{}[\]]/g, '').trim().toLowerCase();

/**
 * @param {Object} presets - the networkPresets map
 * @returns {{ errors: string[], warnings: string[] }}
 */
function checkPresets(presets) {
  const errors = [];
  const warnings = [];

  for (const [key, preset] of Object.entries(presets || {})) {
    const at = `networkPresets.${key}`;

    if (!preset || typeof preset !== 'object') {
      errors.push(`${at}: preset must be an object`);
      continue;
    }
    if (!preset.label) errors.push(`${at}: missing "label"`);
    if (!preset.clickIdParam) errors.push(`${at}: missing "clickIdParam"`);
    if (!preset.macros || typeof preset.macros !== 'object') {
      errors.push(`${at}: missing "macros"`);
      continue;
    }

    for (const name of REQUIRED_MACROS) {
      if (preset.macros[name] === undefined || preset.macros[name] === '') {
        errors.push(`${at}: macros.${name} is required`);
      }
    }

    // THE important check. A click_id macro that doesn't echo clickIdParam means
    // the network hands back its own identifier, which we cannot look up.
    // A literal (e.g. payout '0') is fine elsewhere but never for click_id.
    const clickMacro = preset.macros.click_id;
    if (clickMacro && preset.clickIdParam) {
      if (!/[{[]/.test(clickMacro)) {
        errors.push(
          `${at}: macros.click_id is the literal "${clickMacro}" — it must be a macro token`
        );
      } else if (bare(clickMacro) !== bare(preset.clickIdParam)) {
        errors.push(
          `${at}: macros.click_id "${clickMacro}" does not echo clickIdParam ` +
          `"${preset.clickIdParam}". We send our click id as ` +
          `?${preset.clickIdParam}=<id>, so the postback must return that same ` +
          `parameter or every conversion from this network is unattributable.`
        );
      }
    }

    // Mixing brace styles inside one preset means at least one is wrong.
    const styles = new Set(
      Object.values(preset.macros)
        .filter(v => /[{[]/.test(v))
        .map(v => (v.includes('[') ? 'square' : 'curly'))
    );
    if (styles.size > 1) {
      errors.push(`${at}: mixes {curly} and [square] macro syntax`);
    }

    for (const [k, v] of Object.entries(preset.extraParams || {})) {
      if (!v) errors.push(`${at}: extraParams.${k} is empty`);
    }

    if (preset.lifecycle) {
      for (const bucket of ['reversed', 'updated']) {
        const list = preset.lifecycle[bucket];
        if (list !== undefined && !Array.isArray(list)) {
          errors.push(`${at}: lifecycle.${bucket} must be an array`);
        }
      }
    }

    if (preset.verified !== true) {
      warnings.push(
        `${at}: macros are UNVERIFIED — confirm against ${preset.docsUrl || 'the network docs'} before live traffic`
      );
    }
  }

  return { errors, warnings };
}

/**
 * Validate and fail fast. Called from server/index.js at startup.
 * Warnings are logged; errors abort the boot.
 */
function validatePresets(presets) {
  const { errors, warnings } = checkPresets(presets);

  warnings.forEach(w => console.warn(`[PRESETS] ${w}`));

  if (errors.length) {
    const message =
      'Invalid network presets:\n' + errors.map(e => `  - ${e}`).join('\n');
    console.error(`[PRESETS] ${message}`);
    throw new Error(message);
  }

  console.log(`[PRESETS] ${Object.keys(presets).length} network presets validated`);
}

module.exports = { validatePresets, checkPresets };

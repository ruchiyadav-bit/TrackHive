const Setting = require('../models/Setting');
const { clearTimezoneCache } = require('../utils/appTime');
const { isManager, MANAGER_ONLY_SETTING_KEYS } = require('../config/roles');

const DEFAULTS = {
  siteName: 'TrackHive',
  timezone: 'UTC',
  currency: 'USD',
  defaultRedirectType: '302',
  defaultIpCap: 1,
  defaultIpCapWindow: 'forever',
  defaultBotDetection: false,
  defaultVpnDetection: false,
  globalPostbackUrl: '',
  clickIdParam: 'click_id',
  subIdParams: 'sub1,sub2,sub3,sub4,sub5',
  trackingDomain: '',
  emailNotifications: true,
  capAlertThreshold: 90,
  conversionSpikeMultiplier: 3,
};

// getAll stays open to both roles on purpose: partners need trackingDomain to
// render their own tracking links. Writing it is what is restricted.
exports.getAll = async (req, res, next) => {
  try {
    const settings = await Setting.find();
    const map = { ...DEFAULTS };
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json({ settings: map });
  } catch (err) {
    next(err);
  }
};

/** Keys a partner may not write. Hiding them in the UI is not a control. */
const refusedKeys = (user, keys) =>
  isManager(user) ? [] : keys.filter(k => MANAGER_ONLY_SETTING_KEYS.includes(k));

exports.update = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });

    if (refusedKeys(req.user, [key]).length) {
      return res.status(403).json({ error: `Only a manager can change "${key}"` });
    }

    const setting = await Setting.setValue(key, value);
    if (key === 'timezone') clearTimezoneCache();
    res.json({ setting });
  } catch (err) {
    next(err);
  }
};

exports.bulkUpdate = async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object is required' });
    }

    const refused = refusedKeys(req.user, Object.keys(settings));
    if (refused.length) {
      return res.status(403).json({
        error: `Only a manager can change: ${refused.join(', ')}`,
      });
    }

    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      const setting = await Setting.setValue(key, value);
      if (key === 'timezone') clearTimezoneCache();
      results.push(setting);
    }

    res.json({ settings: results });
  } catch (err) {
    next(err);
  }
};

const Setting = require('../models/Setting');
const { clearTimezoneCache } = require('../utils/appTime');
const { isManager, canWriteSetting, PARTNER_READABLE_SETTING_KEYS } = require('../config/roles');

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

// Public pages need the dashboard brand before a user signs in. Expose only
// the website name; all operational settings remain behind authentication.
exports.getPublic = async (req, res, next) => {
  try {
    const storedName = await Setting.getValue('siteName', DEFAULTS.siteName);
    const siteName = typeof storedName === 'string' && storedName.trim()
      ? storedName.trim()
      : DEFAULTS.siteName;
    res.json({ siteName });
  } catch (err) {
    next(err);
  }
};

// getAll stays open to both roles on purpose: partners need trackingDomain to
// render their own tracking links. Writing it is what is restricted.
exports.getAll = async (req, res, next) => {
  try {
    const settings = await Setting.find();
    const map = { ...DEFAULTS };
    settings.forEach((s) => { map[s.key] = s.value; });

    if (!isManager(req.user)) {
      const visible = {};
      for (const key of PARTNER_READABLE_SETTING_KEYS) {
        if (key in map) visible[key] = map[key];
      }
      return res.json({ settings: visible, readOnly: true });
    }

    res.json({ settings: map });
  } catch (err) {
    next(err);
  }
};

/** Keys this user may not write. Hiding them in the UI is not a control. */
const refusedKeys = (user, keys) => keys.filter(k => !canWriteSetting(user, k));

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

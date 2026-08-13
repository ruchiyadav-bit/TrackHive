const Setting = require('../models/Setting');

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

exports.update = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });

    const setting = await Setting.setValue(key, value);
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

    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      const setting = await Setting.setValue(key, value);
      results.push(setting);
    }

    res.json({ settings: results });
  } catch (err) {
    next(err);
  }
};

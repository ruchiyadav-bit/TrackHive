const Setting = require('../models/Setting');
const { getConfig, sendEmail, status } = require('../utils/email');

/**
 * Email alert settings. Mirrors telegramController so the two behave the same
 * way from the UI's point of view: read masks the secret, save ignores the
 * mask, test uses whatever is in the form and falls back to what is stored.
 */

const MASK = '••••••';

exports.getSettings = async (req, res, next) => {
  try {
    const [cfg, st, pass] = await Promise.all([
      getConfig(),
      status(),
      Setting.getValue('emailPass', ''),
    ]);

    res.json({
      settings: {
        enabled: cfg.enabled,
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: cfg.user,
        // Never send the password back. A masked value also tells the UI there
        // IS one, which an empty string would not.
        pass: (process.env.SMTP_PASS || pass) ? MASK : '',
        from: cfg.from,
        to: cfg.to,
        alertTypes: cfg.alertTypes,
        isConfigured: cfg.configured,
        available: st.available,
        // So the form can grey out what .env has already decided.
        fromEnv: cfg.fromEnv,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.saveSettings = async (req, res, next) => {
  try {
    const { enabled, host, port, secure, user, pass, from, to, alertTypes } = req.body || {};
    const updates = [];

    if (enabled !== undefined) updates.push(Setting.setValue('emailEnabled', !!enabled));
    if (host !== undefined) updates.push(Setting.setValue('emailHost', String(host).trim()));
    if (port !== undefined) updates.push(Setting.setValue('emailPort', Number(port) || 587));
    if (secure !== undefined) updates.push(Setting.setValue('emailSecure', !!secure));
    if (user !== undefined) updates.push(Setting.setValue('emailUser', String(user).trim()));
    // The mask coming back means "unchanged" — writing it would overwrite the
    // real password with six bullet characters.
    if (pass !== undefined && pass !== '' && !pass.startsWith('••')) {
      updates.push(Setting.setValue('emailPass', pass));
    }
    if (from !== undefined) updates.push(Setting.setValue('emailFrom', String(from).trim()));
    if (to !== undefined) updates.push(Setting.setValue('emailTo', String(to).trim()));
    if (alertTypes !== undefined) updates.push(Setting.setValue('emailAlertTypes', alertTypes));

    await Promise.all(updates);
    res.json({ success: true, message: 'Email settings saved' });
  } catch (err) {
    next(err);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    const { host, port, secure, user, pass, from, to } = req.body || {};
    const override = {};
    if (host) override.host = String(host).trim();
    if (port) override.port = Number(port);
    if (secure !== undefined) override.secure = !!secure;
    if (user) override.user = String(user).trim();
    if (pass && !String(pass).startsWith('••')) override.pass = pass;
    if (from) override.from = String(from).trim();
    if (to) override.to = String(to).trim();

    const result = await sendEmail({
      subject: '[TrackHive] Email alerts connected',
      text: [
        'TrackHive can send email to this address.',
        '',
        'Down, recovery and SSL-expiry alerts from the uptime monitors will arrive here,',
        'along with offer cap alerts.',
        '',
        `Sent ${new Date().toISOString()}`,
      ].join('\n'),
      override,
    });

    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Test email sent' });
  } catch (err) {
    next(err);
  }
};

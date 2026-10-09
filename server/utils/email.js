const Setting = require('../models/Setting');

/**
 * Email alerts over SMTP.
 *
 * Until now the Settings page had an "Email Notifications" toggle that wrote a
 * boolean nobody ever read — no mail library, no SMTP, no sending code. A
 * switch that says ON while nothing happens is worse than no switch at all,
 * because it buys the belief that someone will be told. This is the real
 * thing behind that switch.
 *
 * CONFIG comes from the environment first, then from Settings. Env wins on
 * purpose: an SMTP password belongs in .env next to JWT_SECRET, not in a
 * database row that every backup copies. The Settings form stays for whoever
 * would rather not touch the server, and it masks the password on the way out.
 *
 * nodemailer is required LAZILY. It is a new dependency, and a top-level
 * require would take the entire tracker down on boot on any server where
 * `npm install` had not been run yet — losing every click to add a feature
 * nobody had configured. Missing module = email quietly unavailable, and the
 * Settings page says so.
 */

let nodemailerCache;
function loadNodemailer() {
  if (nodemailerCache !== undefined) return nodemailerCache;
  try {
    nodemailerCache = require('nodemailer');
  } catch {
    nodemailerCache = null;
    console.warn('[EMAIL] nodemailer is not installed — run `npm install` in server/. Email alerts are disabled.');
  }
  return nodemailerCache;
}

const bool = (v, fallback = false) => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true' || String(v) === '1';
};

/** Effective config: env first, Settings second. */
async function getConfig() {
  const [host, port, secure, user, pass, from, to, enabled, alertTypes] = await Promise.all([
    Setting.getValue('emailHost', ''),
    Setting.getValue('emailPort', 587),
    Setting.getValue('emailSecure', false),
    Setting.getValue('emailUser', ''),
    Setting.getValue('emailPass', ''),
    Setting.getValue('emailFrom', ''),
    Setting.getValue('emailTo', ''),
    Setting.getValue('emailEnabled', false),
    Setting.getValue('emailAlertTypes', []),
  ]);

  const cfg = {
    host: process.env.SMTP_HOST || host || '',
    port: Number(process.env.SMTP_PORT || port || 587),
    secure: process.env.SMTP_SECURE !== undefined ? bool(process.env.SMTP_SECURE) : bool(secure),
    user: process.env.SMTP_USER || user || '',
    pass: process.env.SMTP_PASS || pass || '',
    from: process.env.EMAIL_FROM || from || '',
    to: process.env.EMAIL_TO || to || '',
    enabled: bool(enabled),
    alertTypes: Array.isArray(alertTypes) ? alertTypes : [],
    fromEnv: {
      host: !!process.env.SMTP_HOST,
      user: !!process.env.SMTP_USER,
      pass: !!process.env.SMTP_PASS,
    },
  };
  // A "from" nobody set falls back to the login address, which is what almost
  // every SMTP provider requires anyway.
  if (!cfg.from && cfg.user) cfg.from = cfg.user;
  cfg.configured = !!(cfg.host && cfg.from && cfg.to);
  return cfg;
}

/** Build a transporter for this config, or null when it cannot be built. */
function buildTransport(cfg) {
  const nodemailer = loadNodemailer();
  if (!nodemailer) return null;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    // Port 465 is implicit TLS; everything else upgrades with STARTTLS. Getting
    // this backwards is the single most common reason SMTP "just hangs".
    secure: cfg.secure || Number(cfg.port) === 465,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/**
 * Send one email. Never throws — returns { success, error } the same way
 * sendTelegramMessage does, because an alert path that can throw will
 * eventually take down the thing it was supposed to be watching.
 */
async function sendEmail({ subject, text, html, override } = {}) {
  try {
    const cfg = override ? { ...(await getConfig()), ...override } : await getConfig();
    if (!cfg.host || !cfg.from || !cfg.to) {
      return { success: false, error: 'SMTP host, from address and recipient are all required' };
    }
    const transport = buildTransport(cfg);
    if (!transport) {
      return { success: false, error: 'nodemailer is not installed on the server — run `npm install` in server/' };
    }

    await transport.sendMail({
      from: cfg.from,
      // Several recipients, comma separated.
      to: cfg.to.split(',').map(s => s.trim()).filter(Boolean),
      subject,
      text,
      html: html || undefined,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a notification as an email, subject to the same two gates Telegram
 * uses: the master switch, and the per-type list.
 */
async function sendNotificationEmail(notification) {
  const cfg = await getConfig();
  if (!cfg.enabled || !cfg.configured) return { success: false, error: 'Email alerts are off' };
  if (cfg.alertTypes.length > 0 && !cfg.alertTypes.includes(notification.type)) {
    return { success: false, error: 'Filtered by alert type' };
  }

  const severityLabel = {
    info: 'INFO', warning: 'WARNING', error: 'CRITICAL', success: 'RESOLVED',
  }[notification.severity] || 'ALERT';

  const lines = [
    notification.message,
    notification.offerName ? `Offer: ${notification.offerName}` : '',
    `Time: ${new Date().toISOString()}`,
  ].filter(Boolean);

  return sendEmail({
    subject: `[TrackHive ${severityLabel}] ${notification.title}`,
    text: lines.join('\n'),
  });
}

/** Whether email could be sent right now, and why not if it could not. */
async function status() {
  const cfg = await getConfig();
  return {
    available: !!loadNodemailer(),
    configured: cfg.configured,
    enabled: cfg.enabled,
  };
}

module.exports = { getConfig, sendEmail, sendNotificationEmail, status };

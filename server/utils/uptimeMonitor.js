const http = require('http');
const https = require('https');

const UptimeMonitor = require('../models/UptimeMonitor');
const UptimeCheck = require('../models/UptimeCheck');
const Notification = require('../models/Notification');
const { sendTelegramMessage } = require('./telegram');
const Setting = require('../models/Setting');

/**
 * Uptime monitoring, in-process.
 *
 * Every `intervalSec` it fetches each monitored URL and, when the result
 * CHANGES, sends a Telegram message. Two rules keep it from becoming noise
 * nobody reads:
 *
 *   1. It alerts on transitions only. A domain down for six hours sends one
 *      message, not seventy-two.
 *   2. It waits for `failureThreshold` consecutive failures before calling
 *      something down. One timed-out request is usually the route, not an
 *      outage.
 *
 * WHAT THIS CANNOT DO — and it matters: if the server itself dies, so does
 * this, and no alert is sent. It catches a tracking domain whose DNS was
 * changed, an expired certificate, nginx refusing connections, a domain now
 * answering from someone else's deployment — all the cases where the app is
 * alive but a domain is not. For "the whole box is gone", something OUTSIDE
 * the box has to be watching. Keep an external monitor alongside this one.
 */

const TICK_MS = 60_000;
const CERT_WARN_DAYS = 14;

const DEFAULT_MONITORS = [
  {
    label: 'Tracking domain',
    url: process.env.MONITOR_TRACKING_URL || 'https://growth.trackyoudomain.com/api/health',
    // Proves a TrackHive process answered, not just that nginx is listening.
    expectBody: '"status":"ok"',
  },
  {
    label: 'Dashboard',
    url: process.env.MONITOR_DASHBOARD_URL || 'https://trackgrouwth.adslaunchigo.com/api/health',
    expectBody: '"status":"ok"',
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const today = () => new Date().toISOString().slice(0, 10);

// ── Probe ───────────────────────────────────────────────────────────────────

/**
 * Fetch a URL once. Reads a little of the body (needed for `expectBody`) and
 * the TLS certificate, which is only reachable while the socket is open.
 */
function probe(url, { timeoutMs = 15000, expectBody = '' } = {}) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return resolve({ ok: false, status: 0, ms: 0, error: 'Invalid URL' });
    }
    const lib = target.protocol === 'https:' ? https : http;
    const started = Date.now();

    const request = lib.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}` || '/',
        method: 'GET',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'TrackHive-Uptime/1.0', Accept: '*/*' },
      },
      (response) => {
        const out = { status: response.statusCode || 0, certValidTo: null, certDaysLeft: null };

        try {
          const cert = response.socket?.getPeerCertificate?.();
          if (cert && cert.valid_to) {
            out.certValidTo = new Date(cert.valid_to);
            out.certDaysLeft = Math.floor((out.certValidTo.getTime() - Date.now()) / DAY_MS);
          }
        } catch { /* not fatal */ }

        let body = '';
        response.setEncoding('utf8');
        response.on('data', (c) => {
          if (body.length < 8192) body += c;
          else request.destroy();
        });
        response.on('end', () => {
          const ms = Date.now() - started;
          if (out.status >= 400 || out.status === 0) {
            return resolve({ ...out, ok: false, ms, error: `HTTP ${out.status}` });
          }
          if (expectBody && !body.includes(expectBody)) {
            return resolve({
              ...out, ok: false, ms,
              error: `Answered ${out.status}, but the response did not contain ${expectBody} — something else is serving this domain`,
            });
          }
          resolve({ ...out, ok: true, ms, error: '' });
        });
        response.on('error', (err) => resolve({
          ...out, ok: false, ms: Date.now() - started, error: err.code || err.message,
        }));
      }
    );

    request.on('error', (err) => resolve({
      ok: false, status: 0, ms: Date.now() - started, error: err.code || err.message,
    }));
    request.on('timeout', () => {
      request.destroy();
      resolve({ ok: false, status: 0, ms: timeoutMs, error: 'Timed out' });
    });
    request.end();
  });
}

// ── Alerting ────────────────────────────────────────────────────────────────

/** How long it has been in a state, in words. */
function forHowLong(since) {
  if (!since) return '';
  const mins = Math.round((Date.now() - new Date(since).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/**
 * Send one alert: Telegram, plus a Notification row so it is also in the app.
 *
 * Deliberately NOT routed through sendNotificationToTelegram(): that one is
 * filtered by the telegramAlertTypes list, and an uptime alert someone quietly
 * filtered out is worse than no monitoring at all — you would believe you were
 * covered. Only the master telegramEnabled switch applies here.
 */
async function alert({ emoji, title, lines, severity, monitor }) {
  const message = [`${emoji} *${title}*`, '', ...lines].join('\n');

  try {
    await Notification.create({
      type: 'system',
      title,
      message: lines.join(' · '),
      severity,
      createdBy: monitor.createdBy || null,
      data: { monitorId: monitor._id, url: monitor.url },
    });
  } catch (err) {
    console.error('[UPTIME] notification failed:', err.message);
  }

  try {
    const enabled = await Setting.getValue('telegramEnabled', false);
    if (!enabled) return;
    const res = await sendTelegramMessage(message);
    if (!res.success) console.error('[UPTIME] telegram failed:', res.error);
  } catch (err) {
    console.error('[UPTIME] telegram threw:', err.message);
  }
}

// ── One check ───────────────────────────────────────────────────────────────

async function checkOne(monitor) {
  const result = await probe(monitor.url, {
    timeoutMs: monitor.timeoutMs,
    expectBody: monitor.expectBody,
  });
  const now = new Date();

  UptimeCheck.create({
    monitor: monitor._id,
    at: now,
    ok: result.ok,
    status: result.status,
    ms: result.ms,
    error: result.error,
  }).catch(err => console.error('[UPTIME] check log failed:', err.message));

  const set = {
    lastCheckAt: now,
    lastStatus: result.status,
    lastMs: result.ms,
    lastError: result.error,
  };
  if (result.certValidTo) {
    set.certValidTo = result.certValidTo;
    set.certDaysLeft = result.certDaysLeft;
  }

  if (result.ok) {
    set.consecutiveFailures = 0;
    if (!monitor.up) {
      // Recovered.
      set.up = true;
      set.since = now;
      await alert({
        emoji: '✅',
        title: `${monitor.label} is back up`,
        lines: [
          `\`${monitor.url}\``,
          `Was down for ${forHowLong(monitor.since)}`,
          `Answered HTTP ${result.status} in ${result.ms} ms`,
        ],
        severity: 'success',
        monitor,
      });
    }
  } else {
    const failures = (monitor.consecutiveFailures || 0) + 1;
    set.consecutiveFailures = failures;
    if (monitor.up && failures >= monitor.failureThreshold) {
      // Newly down.
      set.up = false;
      set.since = now;
      await alert({
        emoji: '🔴',
        title: `${monitor.label} is DOWN`,
        lines: [
          `\`${monitor.url}\``,
          `${result.error || 'No response'}`,
          `Failed ${failures} checks in a row`,
        ],
        severity: 'error',
        monitor,
      });
    }
  }

  // Certificate expiry — once a day at most, and only while it is still up
  // (a down domain has a louder problem than its certificate).
  if (result.ok && result.certDaysLeft !== null && result.certDaysLeft <= CERT_WARN_DAYS) {
    if (monitor.certAlertedOn !== today()) {
      set.certAlertedOn = today();
      await alert({
        emoji: result.certDaysLeft <= 3 ? '🔴' : '⚠️',
        title: `${monitor.label}: SSL certificate expires in ${result.certDaysLeft} day(s)`,
        lines: [
          `\`${monitor.url}\``,
          `Expires ${result.certValidTo.toISOString().slice(0, 10)}`,
          'Once it lapses every click and postback on this domain fails.',
        ],
        severity: result.certDaysLeft <= 3 ? 'error' : 'warning',
        monitor,
      });
    }
  }

  await UptimeMonitor.updateOne({ _id: monitor._id }, { $set: set });
  return { ...result, monitorId: monitor._id };
}

/** Check one monitor now, by id, ignoring its schedule. */
async function checkNow(id) {
  const monitor = await UptimeMonitor.findById(id);
  if (!monitor) return null;
  return checkOne(monitor);
}

/** Check every enabled monitor now. */
async function checkAll() {
  const monitors = await UptimeMonitor.find({ enabled: true });
  return Promise.all(monitors.map(m => checkOne(m).catch(err => {
    console.error('[UPTIME]', m.url, err.message);
    return null;
  })));
}

// ── Seed + loop ─────────────────────────────────────────────────────────────

/**
 * Create the default monitors on first run. Only when the collection is
 * completely empty — otherwise deleting a monitor would just bring it back on
 * the next deploy, which is maddening.
 */
async function seed() {
  const count = await UptimeMonitor.estimatedDocumentCount();
  if (count > 0) return;

  const User = require('../models/User');
  const owner = await User.findOne({ role: 'manager' }).sort({ createdAt: 1 }).select('_id').lean();

  for (const m of DEFAULT_MONITORS) {
    try {
      await UptimeMonitor.create({ ...m, createdBy: owner?._id || null });
      console.log(`[UPTIME] monitoring ${m.url}`);
    } catch (err) {
      if (err.code !== 11000) console.error('[UPTIME] seed failed:', err.message);
    }
  }
}

let started = false;
let timer = null;

/**
 * Tick every minute and check whichever monitors are due. Per-monitor
 * intervals rather than one global one, so a cheap check can run often and an
 * expensive one rarely without two loops.
 */
async function tick() {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return;

  const monitors = await UptimeMonitor.find({ enabled: true });
  const now = Date.now();

  for (const m of monitors) {
    const due = !m.lastCheckAt || (now - new Date(m.lastCheckAt).getTime()) >= m.intervalSec * 1000;
    if (!due) continue;
    await checkOne(m).catch(err => console.error('[UPTIME]', m.url, err.message));
  }
}

function start() {
  if (started) return;
  started = true;

  seed()
    .then(() => tick())
    .catch(err => console.error('[UPTIME] start failed:', err.message));

  timer = setInterval(() => { tick().catch(err => console.error('[UPTIME]', err.message)); }, TICK_MS);
  timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

module.exports = { start, stop, checkNow, checkAll, probe, DEFAULT_MONITORS };

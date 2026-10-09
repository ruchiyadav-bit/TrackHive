const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { monitorEventLoopDelay } = require('perf_hooks');

/**
 * Server metrics: a live reading, a one-minute sampler, and a ring of the most
 * recent errors.
 *
 * Why a sampler at all — a live reading answers "is the CPU busy right now",
 * which is almost never the question. The question is "when was it pinned",
 * asked the morning after, and only a recorded history answers that. Samples
 * go to MongoDB rather than an array in memory, because memory is lost on
 * precisely the event worth looking back at: a restart or a crash.
 *
 * Everything here is defensive on purpose. Disk, swap and network come from
 * Linux-specific sources with a `df` fallback and then a null; a metric that
 * cannot be read is reported as null and the page prints "—" rather than the
 * process failing to boot on a machine that does not have /proc.
 */

const ServerMetric = require('../models/ServerMetric');

const SAMPLE_MS = 60_000;
const ERROR_RING = 50;
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

// ── CPU ─────────────────────────────────────────────────────────────────────

/** Cumulative busy/idle ticks per core. Meaningless alone — only deltas count. */
function cpuTicks() {
  return os.cpus().map((c) => {
    const t = c.times;
    return { total: t.user + t.nice + t.sys + t.idle + t.irq, idle: t.idle };
  });
}

/** Utilisation % overall and per core, between two cpuTicks() readings. */
function cpuBetween(prev, curr) {
  const perCore = [];
  let totalDelta = 0;
  let idleDelta = 0;
  for (let i = 0; i < curr.length; i++) {
    const p = prev[i];
    if (!p) { perCore.push(0); continue; }
    const dt = curr[i].total - p.total;
    const di = curr[i].idle - p.idle;
    totalDelta += dt;
    idleDelta += di;
    perCore.push(dt > 0 ? round(((dt - di) / dt) * 100) : 0);
  }
  return {
    overall: totalDelta > 0 ? round(((totalDelta - idleDelta) / totalDelta) * 100) : 0,
    perCore,
  };
}

/** A fresh CPU reading, measured over `ms`. Used by the live endpoint only. */
function measureCpu(ms = 250) {
  return new Promise((resolve) => {
    const before = cpuTicks();
    const beforeProc = process.cpuUsage();
    const t0 = Date.now();
    setTimeout(() => {
      const elapsedUs = (Date.now() - t0) * 1000;
      const proc = process.cpuUsage(beforeProc);
      const cores = os.cpus().length || 1;
      resolve({
        ...cpuBetween(before, cpuTicks()),
        procPct: elapsedUs > 0
          ? round(((proc.user + proc.system) / elapsedUs) * 100 / cores, 2)
          : 0,
      });
    }, ms);
  });
}

// ── Memory / swap ───────────────────────────────────────────────────────────

/** Swap and the kernel's own "available" figure. Linux only; null elsewhere. */
function meminfo() {
  try {
    const text = fs.readFileSync('/proc/meminfo', 'utf8');
    const field = (key) => {
      const m = text.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm'));
      return m ? Number(m[1]) * KB : null;
    };
    const swapTotal = field('SwapTotal');
    const swapFree = field('SwapFree');
    return {
      swapTotal,
      swapUsed: swapTotal !== null && swapFree !== null ? swapTotal - swapFree : null,
      available: field('MemAvailable'),
      cached: field('Cached'),
    };
  } catch {
    return { swapTotal: null, swapUsed: null, available: null, cached: null };
  }
}

// ── Disk ────────────────────────────────────────────────────────────────────

function run(cmd, args, timeout = 5000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, encoding: 'utf8' }, (err, stdout) => {
      resolve(err ? null : String(stdout));
    });
  });
}

function parseDf(stdout) {
  if (!stdout) return [];
  const rows = [];
  for (const line of stdout.trim().split('\n').slice(1)) {
    // Filesystem 1024-blocks Used Available Capacity Mounted-on
    const p = line.trim().split(/\s+/);
    if (p.length < 6) continue;
    const totalB = Number(p[1]) * KB;
    const usedB = Number(p[2]) * KB;
    const freeB = Number(p[3]) * KB;
    if (!Number.isFinite(totalB) || totalB <= 0) continue;
    rows.push({
      filesystem: p[0],
      mount: p.slice(5).join(' '),
      totalGB: round(totalB / GB, 2),
      usedGB: round(usedB / GB, 2),
      freeGB: round(freeB / GB, 2),
      usedPct: round((usedB / (usedB + freeB || totalB)) * 100),
    });
  }
  return rows;
}

/**
 * Usage of the filesystem holding `dir`.
 *
 * fs.statfs is the cheap path but only exists from Node 18.15, and this runs
 * on whatever the server happens to have — so `df` is a real fallback, not a
 * theoretical one.
 */
async function diskFor(dir) {
  if (typeof fs.promises.statfs === 'function') {
    try {
      const s = await fs.promises.statfs(dir);
      const totalB = s.blocks * s.bsize;
      const freeB = s.bavail * s.bsize;
      const usedB = totalB - s.bfree * s.bsize;
      return {
        mount: dir,
        totalGB: round(totalB / GB, 2),
        usedGB: round(usedB / GB, 2),
        freeGB: round(freeB / GB, 2),
        usedPct: round((usedB / (usedB + freeB || totalB)) * 100),
      };
    } catch { /* fall through to df */ }
  }
  const rows = parseDf(await run('df', ['-kP', dir]));
  return rows[0] || null;
}

/** Every real filesystem, so "which disk is filling up" is answerable. */
async function allDisks() {
  let out = await run('df', ['-kPT', '-x', 'tmpfs', '-x', 'devtmpfs', '-x', 'squashfs', '-x', 'overlay']);
  if (out) {
    // -T inserts a Type column; drop it so the positions match parseDf.
    const lines = out.trim().split('\n').map((l) => {
      const p = l.trim().split(/\s+/);
      return [p[0], ...p.slice(2)].join(' ');
    });
    return parseDf(lines.join('\n'));
  }
  out = await run('df', ['-kP']);
  return parseDf(out).filter(d => !/^(tmpfs|devtmpfs|overlay|udev)$/.test(d.filesystem));
}

// ── Network ─────────────────────────────────────────────────────────────────

/** Cumulative bytes across every interface except loopback. Linux only. */
function netBytes() {
  try {
    const text = fs.readFileSync('/proc/net/dev', 'utf8');
    let rx = 0;
    let tx = 0;
    for (const line of text.split('\n').slice(2)) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const iface = line.slice(0, idx).trim();
      if (iface === 'lo') continue;
      const f = line.slice(idx + 1).trim().split(/\s+/);
      rx += Number(f[0]) || 0;
      tx += Number(f[8]) || 0;
    }
    return { rx, tx };
  } catch {
    return null;
  }
}

// ── Event loop ──────────────────────────────────────────────────────────────

let loop = null;
try {
  loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
} catch {
  loop = null;
}

function readLoop(reset = true) {
  if (!loop) return { mean: null, max: null };
  const mean = round(loop.mean / 1e6, 2);
  const max = round(loop.max / 1e6, 2);
  if (reset) loop.reset();
  return { mean, max };
}

// ── HTTP counters ───────────────────────────────────────────────────────────

let http = { req: 0, c4: 0, c5: 0, totalMs: 0, maxMs: 0, click: 0, postback: 0 };
const resetHttp = () => { http = { req: 0, c4: 0, c5: 0, totalMs: 0, maxMs: 0, click: 0, postback: 0 }; };

/**
 * Counts every request and how long it took.
 *
 * Mounted first in index.js — ahead of the public tracking routes — because a
 * redirect that has become slow is the failure this is meant to catch, and
 * those routes are deliberately the ones with no other middleware on them.
 * Cost per request is one hrtime pair and one 'finish' listener.
 */
function httpMetrics() {
  return (req, res, next) => {
    const t0 = process.hrtime.bigint();
    res.once('finish', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      http.req += 1;
      http.totalMs += ms;
      if (ms > http.maxMs) http.maxMs = ms;
      const s = res.statusCode;
      if (s >= 500) http.c5 += 1;
      else if (s >= 400) http.c4 += 1;
      const p = req.originalUrl || req.url || '';
      if (p.startsWith('/click')) http.click += 1;
      else if (p.startsWith('/postback')) http.postback += 1;
    });
    next();
  };
}

// ── Recent errors ───────────────────────────────────────────────────────────

const errors = [];

/** Newest first, capped. Called from the error handler and on a fatal throw. */
function recordError(err, req) {
  try {
    errors.unshift({
      at: new Date(),
      name: err?.name || 'Error',
      message: String(err?.message || err || 'Unknown error').slice(0, 500),
      status: err?.status || err?.statusCode || 500,
      stack: String(err?.stack || '').split('\n').slice(0, 8).join('\n'),
      method: req?.method || '',
      path: (req?.originalUrl || '').split('?')[0],
      ip: req?.ip || '',
      fatal: !req,
    });
    if (errors.length > ERROR_RING) errors.length = ERROR_RING;
  } catch { /* never let error recording throw */ }
}

// 'uncaughtExceptionMonitor' observes the crash WITHOUT swallowing it — a
// plain 'uncaughtException' listener would stop the process from exiting, and
// PM2 restarting on a crash is the behaviour we want to keep.
try {
  process.on('uncaughtExceptionMonitor', (err) => recordError(err));
} catch { /* older runtimes */ }

const recentErrors = () => errors.slice();

// ── Sampler ─────────────────────────────────────────────────────────────────

let started = false;
let timer = null;
let prevCpu = cpuTicks();
let prevProc = process.cpuUsage();
let prevNet = netBytes();
let prevAt = Date.now();

async function sample(boot = false) {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return;

  const now = Date.now();
  const elapsedMs = Math.max(now - prevAt, 1);

  const currCpu = cpuTicks();
  const cpu = cpuBetween(prevCpu, currCpu);
  const proc = process.cpuUsage(prevProc);
  const cores = os.cpus().length || 1;
  const procPct = round(((proc.user + proc.system) / (elapsedMs * 1000)) * 100 / cores, 2);

  const currNet = netBytes();
  let netRxKBs = null;
  let netTxKBs = null;
  if (prevNet && currNet) {
    netRxKBs = round(((currNet.rx - prevNet.rx) / KB) / (elapsedMs / 1000), 2);
    netTxKBs = round(((currNet.tx - prevNet.tx) / KB) / (elapsedMs / 1000), 2);
  }

  prevCpu = currCpu;
  prevProc = process.cpuUsage();
  prevNet = currNet;
  const windowFrom = new Date(prevAt);
  prevAt = now;

  const mem = process.memoryUsage();
  const info = meminfo();
  const memTotal = os.totalmem();
  const memUsed = memTotal - os.freemem();
  const disk = await diskFor(path.resolve(__dirname, '..', '..')).catch(() => null);
  const lag = readLoop(true);

  const snapshotHttp = http;
  resetHttp();

  // Traffic in the same minute, so a CPU spike can be read against the load
  // that caused it. Two counts on indexed fields.
  let clicks = 0;
  let conversions = 0;
  try {
    const Click = require('../models/Click');
    const to = new Date(now);
    [clicks, conversions] = await Promise.all([
      Click.countDocuments({ clickedAt: { $gte: windowFrom, $lt: to } }),
      Click.countDocuments({ converted: true, conversionAt: { $gte: windowFrom, $lt: to } }),
    ]);
  } catch { /* counts are a nicety, not the point of the sample */ }

  await ServerMetric.create({
    at: new Date(now),
    boot,
    instance: global.__INSTANCE_ID || '',
    cpuPct: cpu.overall,
    cpuPerCore: cpu.perCore,
    loadAvg: os.loadavg().map(v => round(v, 2)),
    procCpuPct: procPct,
    memTotalMB: round(memTotal / MB),
    memUsedMB: round(memUsed / MB),
    memUsedPct: round((memUsed / memTotal) * 100),
    swapTotalMB: info.swapTotal !== null ? round(info.swapTotal / MB) : null,
    swapUsedMB: info.swapUsed !== null ? round(info.swapUsed / MB) : null,
    heapUsedMB: round(mem.heapUsed / MB),
    rssMB: round(mem.rss / MB),
    diskMount: disk?.mount || '',
    diskTotalGB: disk?.totalGB ?? null,
    diskUsedGB: disk?.usedGB ?? null,
    diskUsedPct: disk?.usedPct ?? null,
    netRxKBs,
    netTxKBs,
    loopLagMs: lag.mean,
    loopLagMaxMs: lag.max,
    httpReq: snapshotHttp.req,
    http4xx: snapshotHttp.c4,
    http5xx: snapshotHttp.c5,
    httpAvgMs: snapshotHttp.req ? round(snapshotHttp.totalMs / snapshotHttp.req, 1) : 0,
    httpMaxMs: round(snapshotHttp.maxMs, 1),
    clickReq: snapshotHttp.click,
    postbackReq: snapshotHttp.postback,
    clicks,
    conversions,
  });
}

/**
 * Begin sampling. Called once, after the database is connected.
 *
 * The first sample waits 5 seconds so its CPU and network figures are a real
 * delta rather than "everything since boot", and the interval is unref'd so it
 * can never be the reason the process refuses to exit.
 */
function start() {
  if (started) return;
  started = true;
  prevCpu = cpuTicks();
  prevProc = process.cpuUsage();
  prevNet = netBytes();
  prevAt = Date.now();

  setTimeout(() => { sample(true).catch(err => console.error('[METRICS]', err.message)); }, 5000).unref();
  timer = setInterval(() => { sample(false).catch(err => console.error('[METRICS]', err.message)); }, SAMPLE_MS);
  timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

/** Everything measurable right now, for the live half of the health page. */
async function live() {
  const cpu = await measureCpu(250);
  const mem = process.memoryUsage();
  const info = meminfo();
  const memTotal = os.totalmem();
  const memUsed = memTotal - os.freemem();
  const appDir = path.resolve(__dirname, '..', '..');
  const [appDisk, disks] = await Promise.all([
    diskFor(appDir).catch(() => null),
    allDisks().catch(() => []),
  ]);
  const lag = readLoop(false);

  return {
    cpu: {
      cores: os.cpus().length || 1,
      model: os.cpus()[0]?.model?.trim() || '',
      speedMHz: os.cpus()[0]?.speed || null,
      usedPct: cpu.overall,
      perCore: cpu.perCore,
      processPct: cpu.procPct,
      loadAvg: os.loadavg().map(v => round(v, 2)),
      loadSupported: os.loadavg().some(v => v > 0),
    },
    memory: {
      totalMB: round(memTotal / MB),
      usedMB: round(memUsed / MB),
      freeMB: round(os.freemem() / MB),
      usedPct: round((memUsed / memTotal) * 100),
      availableMB: info.available !== null ? round(info.available / MB) : null,
      cachedMB: info.cached !== null ? round(info.cached / MB) : null,
      swapTotalMB: info.swapTotal !== null ? round(info.swapTotal / MB) : null,
      swapUsedMB: info.swapUsed !== null ? round(info.swapUsed / MB) : null,
      heapUsedMB: round(mem.heapUsed / MB),
      heapTotalMB: round(mem.heapTotal / MB),
      rssMB: round(mem.rss / MB),
      externalMB: round(mem.external / MB),
    },
    disks,
    appDisk,
    appDir,
    eventLoop: { meanMs: lag.mean, maxMs: lag.max },
    network: netBytes() ? { supported: true } : { supported: false },
    host: {
      hostname: os.hostname(),
      osType: `${os.type()} ${os.release()}`,
      osUptimeSec: Math.round(os.uptime()),
      arch: os.arch(),
    },
  };
}

module.exports = {
  start,
  stop,
  live,
  httpMetrics,
  recordError,
  recentErrors,
  allDisks,
  SAMPLE_MS,
};

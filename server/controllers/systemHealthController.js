const os = require('os');
const dns = require('dns');
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');

const Click = require('../models/Click');
const Offer = require('../models/Offer');
const Advertiser = require('../models/Advertiser');
const TrackingDomain = require('../models/TrackingDomain');
const PostbackLog = require('../models/PostbackLog');
const ServerMetric = require('../models/ServerMetric');
const UptimeMonitor = require('../models/UptimeMonitor');
const UptimeCheck = require('../models/UptimeCheck');
const Setting = require('../models/Setting');
const serverMetrics = require('../utils/serverMetrics');
const uptime = require('../utils/uptimeMonitor');
const { visibleOfferIds, offerScopeMatch, ownerFilter, dataOwnerId } = require('../utils/scope');
const { getReportTimezone, todayInTz, zonedStartOfDayUtc } = require('../utils/appTime');

/**
 * System Health.
 *
 * One page that answers "is the tracker working right now?" without opening a
 * terminal. Split into four independent endpoints on purpose: the server and
 * database section is cheap and account-wide, the tracking and data sections
 * are per-operator aggregations, and the offer-URL probe makes real outbound
 * requests and can take ten seconds. Bundling them into one response would
 * make the fast sections wait for the slow one on every page load.
 *
 * Scoping follows utils/scope.js exactly — every click/offer aggregation here
 * runs through visibleOfferIds(), so a partner sees the health of THEIR book
 * and nobody else's. The one deliberate exception is a postback that could not
 * be placed at all (unknown click id): it has no owner, and hiding it would
 * hide precisely the failure an operator most needs to see.
 */

const MB = 1024 * 1024;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const round = (n, d = 1) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;
const mb = (bytes) => round((Number(bytes) || 0) / MB);
const minutesSince = (date) => (date ? Math.round((Date.now() - new Date(date).getTime()) / 60000) : null);

/**
 * Severity for one check. 'ok' | 'warn' | 'down'.
 * The page shows the worst level of a section as that section's colour, so a
 * check must only return 'down' for something that actually stops tracking.
 */
function issue(level, message, hint) {
  return { level, message, hint: hint || '' };
}

/** Rows this user may read from the postback log. */
function postbackScope(user) {
  return {
    $or: [
      { createdBy: dataOwnerId(user) },
      { createdBy: null },
      { createdBy: { $exists: false } },
    ],
  };
}

// ── Server + database ───────────────────────────────────────────────────────

/**
 * GET /api/system-health/server — manager only.
 *
 * Infrastructure, not data: uptime, memory, CPU and the Mongo connection. A
 * partner has no use for it and the collection counts are account-wide, so the
 * route guard keeps this one to managers.
 */
exports.getServer = async (req, res, next) => {
  try {
    const conn = mongoose.connection;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const state = states[conn.readyState] || 'unknown';

    let stats = null;
    let pingMs = null;
    if (conn.readyState === 1) {
      const t0 = Date.now();
      try {
        await conn.db.admin().ping();
        pingMs = Date.now() - t0;
      } catch { /* ping failed — reported through `state` below */ }
      try {
        stats = await conn.db.stats();
      } catch { /* stats needs no special role, but never fail the page over it */ }
    }

    const [clicks, conversions, offers, advertisers, postbackLogs] = conn.readyState === 1
      ? await Promise.all([
        Click.estimatedDocumentCount(),
        Click.countDocuments({ converted: true }),
        Offer.countDocuments({ status: { $ne: 'deleted' } }),
        Advertiser.countDocuments(),
        PostbackLog.estimatedDocumentCount(),
      ])
      : [0, 0, 0, 0, 0];

    // Live readings, Mongo's own view of itself, and the sampler's record of
    // restarts and recent HTTP volume. Each one degrades to null on its own —
    // serverStatus needs a privilege the connection string may not carry, and
    // a page that 500s because of a missing stat is worse than a blank tile.
    const [live, mongoStatus, restartDocs, lastSample, samples24h, http1h] = await Promise.all([
      serverMetrics.live().catch(() => null),
      conn.readyState === 1 ? conn.db.admin().serverStatus().catch(() => null) : Promise.resolve(null),
      ServerMetric.find({ boot: true, at: { $gte: new Date(Date.now() - 7 * DAY) } })
        .sort({ at: -1 }).limit(20).select('at instance').lean().catch(() => []),
      ServerMetric.findOne().sort({ at: -1 }).select('at').lean().catch(() => null),
      ServerMetric.countDocuments({ at: { $gte: new Date(Date.now() - DAY) } }).catch(() => 0),
      ServerMetric.aggregate([
        { $match: { at: { $gte: new Date(Date.now() - HOUR) } } },
        {
          $group: {
            _id: null,
            req: { $sum: '$httpReq' },
            e4: { $sum: '$http4xx' },
            e5: { $sum: '$http5xx' },
            avgMs: { $avg: '$httpAvgMs' },
            maxMs: { $max: '$httpMaxMs' },
            clickReq: { $sum: '$clickReq' },
            postbackReq: { $sum: '$postbackReq' },
          },
        },
      ]).then(r => r[0] || null).catch(() => null),
    ]);

    const mem = process.memoryUsage();
    const heapPct = round((mem.heapUsed / mem.heapTotal) * 100);
    const sysUsedPct = round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
    const cores = os.cpus()?.length || 1;
    const [load1, load5, load15] = os.loadavg();
    const loadPct = round((load1 / cores) * 100);

    const issues = [];
    if (state !== 'connected') {
      issues.push(issue('down', `MongoDB is ${state}`, 'Nothing is being recorded while this is down.'));
    }
    if (pingMs !== null && pingMs > 500) {
      issues.push(issue('warn', `MongoDB ping is ${pingMs}ms`, 'Clicks redirect slower than usual when the database is this far away.'));
    }
    // Heap percentage is NOT a health signal and was wrong to report as one:
    // V8 sizes the heap to fit, so a perfectly healthy process sits at 90%+ of
    // a 35 MB heap all day long. What matters is RSS against the ceiling PM2
    // restarts at (max_memory_restart, 500M in ecosystem.config.js) — crossing
    // that kills the process mid-redirect.
    const rssLimitMB = Number(process.env.PM2_MAX_MEMORY_MB || 500);
    const rssMB = mb(mem.rss);
    const rssPct = round((rssMB / rssLimitMB) * 100);
    if (rssPct >= 80) {
      issues.push(issue(rssPct >= 95 ? 'down' : 'warn',
        `Process memory is ${rssMB} MB — ${rssPct}% of the ${rssLimitMB} MB restart limit`,
        'PM2 restarts the app when it crosses that limit, dropping whatever is in flight.'));
    }
    if (sysUsedPct > 92) {
      issues.push(issue('warn', `Server memory is ${sysUsedPct}% used`));
    }
    // loadavg is 0 on Windows, so only judge it where it means something.
    if (load1 > 0 && loadPct > 150) {
      issues.push(issue('warn', `CPU load is ${loadPct}% of ${cores} core(s)`));
    }
    if (process.uptime() < 600) {
      issues.push(issue('warn', `Process restarted ${Math.round(process.uptime() / 60)} min ago`, 'Expected after a deploy. Unexpected otherwise — check the PM2 logs.'));
    }

    // Disk is the one that takes the whole tracker down without warning: Mongo
    // stops accepting writes on a full volume and every click stops recording.
    for (const d of live?.disks || []) {
      if (d.usedPct >= 95) {
        issues.push(issue('down', `${d.mount} is ${d.usedPct}% full — ${d.freeGB} GB left`,
          'MongoDB stops accepting writes on a full disk. Clear logs or old backups now.'));
      } else if (d.usedPct >= 85) {
        issues.push(issue('warn', `${d.mount} is ${d.usedPct}% full — ${d.freeGB} GB left`));
      }
    }
    if (live?.memory?.swapTotalMB > 0 && live.memory.swapUsedMB / live.memory.swapTotalMB > 0.5) {
      issues.push(issue('warn', `Swap is ${Math.round((live.memory.swapUsedMB / live.memory.swapTotalMB) * 100)}% used`,
        'The server has run out of real memory at some point and is paging to disk.'));
    }
    if (live?.eventLoop?.meanMs > 100) {
      issues.push(issue('warn', `Event loop delay is ${live.eventLoop.meanMs} ms`,
        'Node is blocked. Every redirect waits behind whatever is holding the loop.'));
    }
    if (live?.cpu?.usedPct >= 90) {
      issues.push(issue('warn', `CPU is at ${live.cpu.usedPct}% across ${live.cpu.cores} core(s)`));
    }
    if (http1h?.e5 > 0) {
      issues.push(issue(http1h.e5 > 20 ? 'down' : 'warn',
        `${http1h.e5} server error(s) in the last hour`, 'See the recent errors below.'));
    }
    // Two deploys in a week is normal. Ten is a crash loop.
    if (restartDocs.length >= 5) {
      issues.push(issue('warn', `${restartDocs.length} restarts in the last 7 days`,
        'If these were not deploys, the process is crashing and PM2 is bringing it back.'));
    }
    if (!lastSample) {
      issues.push(issue('warn', 'No metrics recorded yet',
        'History fills from the first minute after a restart.'));
    } else if (Date.now() - new Date(lastSample.at).getTime() > 5 * 60 * 1000) {
      issues.push(issue('warn', 'The metrics sampler has stopped',
        `Last sample was ${Math.round((Date.now() - new Date(lastSample.at).getTime()) / 60000)} min ago.`));
    }

    res.json({
      server: {
        status: 'ok',
        uptimeSec: Math.round(process.uptime()),
        startedAt: new Date(Date.now() - process.uptime() * 1000),
        serverTime: new Date(),
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        pid: process.pid,
        instanceId: global.__INSTANCE_ID || 'unknown',
        commit: process.env.RENDER_GIT_COMMIT || 'unknown',
        env: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT || 3050),
        reportTimezone: await getReportTimezone(),
      },
      memory: {
        rssMB: mb(mem.rss),
        heapUsedMB: mb(mem.heapUsed),
        heapTotalMB: mb(mem.heapTotal),
        heapPct,
        systemTotalMB: mb(os.totalmem()),
        systemFreeMB: mb(os.freemem()),
        systemUsedPct: sysUsedPct,
      },
      cpu: {
        cores,
        load1: round(load1, 2),
        load5: round(load5, 2),
        load15: round(load15, 2),
        loadPct,
        supported: load1 > 0 || load5 > 0 || load15 > 0,
      },
      database: {
        state,
        host: conn.host || '',
        name: conn.name || '',
        pingMs,
        collections: stats?.collections ?? null,
        dataSizeMB: stats ? mb(stats.dataSize) : null,
        storageSizeMB: stats ? mb(stats.storageSize) : null,
        indexSizeMB: stats ? mb(stats.indexSize) : null,
        counts: { clicks, conversions, offers, advertisers, postbackLogs },
        // Mongo's own numbers, when the connection is allowed to read them.
        mongo: mongoStatus ? {
          version: mongoStatus.version,
          uptimeSec: Math.round(mongoStatus.uptime || 0),
          connectionsCurrent: mongoStatus.connections?.current ?? null,
          connectionsAvailable: mongoStatus.connections?.available ?? null,
          residentMB: mongoStatus.mem?.resident ?? null,
          virtualMB: mongoStatus.mem?.virtual ?? null,
          opcounters: mongoStatus.opcounters || null,
        } : null,
      },
      // Live CPU / memory / disk / network / event loop.
      live,
      http1h: http1h ? {
        requests: http1h.req,
        clickRequests: http1h.clickReq,
        postbackRequests: http1h.postbackReq,
        errors4xx: http1h.e4,
        errors5xx: http1h.e5,
        avgMs: round(http1h.avgMs, 1),
        maxMs: round(http1h.maxMs, 1),
        perMin: round(http1h.req / 60, 1),
      } : null,
      restarts: {
        last7d: restartDocs.length,
        recent: restartDocs.map(d => ({ at: d.at, instance: d.instance })),
      },
      metrics: {
        sampling: !!lastSample && Date.now() - new Date(lastSample.at).getTime() < 5 * 60 * 1000,
        lastSampleAt: lastSample?.at || null,
        samples24h,
        intervalSec: Math.round(serverMetrics.SAMPLE_MS / 1000),
        retentionDays: 14,
      },
      issues,
    });
  } catch (error) {
    next(error);
  }
};

// ── Tracking + postback health ──────────────────────────────────────────────

/**
 * GET /api/system-health/tracking
 *
 * The section that earns the page: when the last click and the last conversion
 * arrived, per network, and what the postbacks that were refused in the last
 * 24 hours were refused for.
 */
exports.getTracking = async (req, res, next) => {
  try {
    const tz = await getReportTimezone();
    const offerIds = await visibleOfferIds(req.user);
    const scope = offerScopeMatch(offerIds);
    const now = Date.now();

    const [lastClick, lastConversion, clicks1h, clicks24h, conv24h, blocked24h] = await Promise.all([
      Click.findOne(scope).sort({ clickedAt: -1 }).select('clickedAt offerName offerId').lean(),
      Click.findOne({ ...scope, converted: true }).sort({ conversionAt: -1 }).select('conversionAt offerName offerId revenue').lean(),
      Click.countDocuments({ ...scope, clickedAt: { $gte: new Date(now - HOUR) } }),
      Click.countDocuments({ ...scope, clickedAt: { $gte: new Date(now - DAY) } }),
      Click.countDocuments({ ...scope, converted: true, conversionAt: { $gte: new Date(now - DAY) } }),
      Click.countDocuments({ ...scope, isBlocked: true, clickedAt: { $gte: new Date(now - DAY) } }),
    ]);

    // Per-network rollup. Built in JS from three small queries rather than a
    // $lookup chain: offers and advertisers are in the dozens, clicks are in
    // the millions, so the join belongs on the small side.
    const offers = await Offer.find({ _id: { $in: offerIds } })
      .select('name advertiser trackingDomain status')
      .lean();
    const advertisers = await Advertiser.find(ownerFilter(req.user)).select('name network').lean();
    const advById = new Map(advertisers.map(a => [String(a._id), a]));

    const perOffer = await Click.aggregate([
      { $match: { ...scope, clickedAt: { $gte: new Date(now - 30 * DAY) } } },
      {
        $group: {
          _id: '$offerId',
          lastClickAt: { $max: '$clickedAt' },
          lastConversionAt: { $max: { $cond: ['$converted', '$conversionAt', null] } },
          clicks24h: { $sum: { $cond: [{ $gte: ['$clickedAt', new Date(now - DAY)] }, 1, 0] } },
          conversions24h: {
            $sum: {
              $cond: [
                { $and: ['$converted', { $gte: ['$conversionAt', new Date(now - DAY)] }] }, 1, 0,
              ],
            },
          },
        },
      },
    ]);
    const statsByOffer = new Map(perOffer.map(r => [String(r._id), r]));

    const networks = {};
    for (const offer of offers) {
      const adv = offer.advertiser ? advById.get(String(offer.advertiser)) : null;
      const key = adv?.network || 'custom';
      const s = statsByOffer.get(String(offer._id));
      const n = networks[key] || (networks[key] = {
        network: key, offers: 0, activeOffers: 0, clicks24h: 0, conversions24h: 0,
        lastClickAt: null, lastConversionAt: null,
      });
      n.offers += 1;
      if (offer.status === 'active') n.activeOffers += 1;
      if (!s) continue;
      n.clicks24h += s.clicks24h || 0;
      n.conversions24h += s.conversions24h || 0;
      if (s.lastClickAt && (!n.lastClickAt || s.lastClickAt > n.lastClickAt)) n.lastClickAt = s.lastClickAt;
      if (s.lastConversionAt && (!n.lastConversionAt || s.lastConversionAt > n.lastConversionAt)) {
        n.lastConversionAt = s.lastConversionAt;
      }
    }

    // Tracking domains. `lastClickAt` is derived through the offers that use
    // the domain — a click does not record which hostname carried it.
    const domainDocs = await TrackingDomain.find().sort('-createdAt').lean();
    const domains = domainDocs.map(d => {
      const own = offers.filter(o => String(o.trackingDomain || '') === String(d._id));
      let lastClickAt = null;
      for (const o of own) {
        const s = statsByOffer.get(String(o._id));
        if (s?.lastClickAt && (!lastClickAt || s.lastClickAt > lastClickAt)) lastClickAt = s.lastClickAt;
      }
      return {
        id: d._id,
        domain: d.domain,
        status: d.status,
        sslActive: !!d.sslActive,
        pointsHere: !!d.pointsHere,
        verifiedAt: d.verifiedAt || null,
        daysSinceVerified: d.verifiedAt ? Math.floor((now - new Date(d.verifiedAt).getTime()) / DAY) : null,
        error: d.verificationError || '',
        offers: own.length,
        activeOffers: own.filter(o => o.status === 'active').length,
        lastClickAt,
      };
    });

    // Postback outcomes, last 24h.
    const pbRows = await PostbackLog.aggregate([
      { $match: { ...postbackScope(req.user), createdAt: { $gte: new Date(now - DAY) } } },
      { $group: { _id: { outcome: '$outcome', reason: '$reason' }, count: { $sum: 1 } } },
    ]);
    let accepted = 0;
    let rejected = 0;
    const reasons = [];
    for (const r of pbRows) {
      if (r._id.outcome === 'accepted') accepted += r.count;
      else {
        rejected += r.count;
        reasons.push({
          reason: r._id.reason,
          label: PostbackLog.REASON_LABELS[r._id.reason] || r._id.reason,
          count: r.count,
        });
      }
    }
    reasons.sort((a, b) => b.count - a.count);
    const pbTotal = accepted + rejected;

    // ── Judgements ──
    const issues = [];
    const clickAgeMin = minutesSince(lastClick?.clickedAt);
    const convAgeMin = minutesSince(lastConversion?.conversionAt);
    const hasActive = offers.some(o => o.status === 'active');

    if (!lastClick) {
      issues.push(issue('warn', 'No clicks recorded yet'));
    } else if (hasActive && clickAgeMin > 180) {
      issues.push(issue(clickAgeMin > 720 ? 'down' : 'warn',
        `No click for ${Math.floor(clickAgeMin / 60)}h`,
        'Check the tracking domain and that traffic is still pointed at it.'));
    }
    if (lastConversion && convAgeMin > 1440 && clicks24h > 50) {
      issues.push(issue('warn',
        `Clicks are arriving but no conversion for ${Math.floor(convAgeMin / 60)}h`,
        'Usually the postback URL, not the traffic. Check the rejected postbacks below.'));
    }
    // A percentage needs a denominator worth quoting. One stray request that
    // gets refused is not "100% rejected", and reporting it that way is how a
    // health page teaches people to ignore it.
    if (pbTotal >= 10 && rejected / pbTotal > 0.2) {
      issues.push(issue('warn',
        `${Math.round((rejected / pbTotal) * 100)}% of postbacks were rejected in the last 24h`,
        `${rejected} of ${pbTotal}. The reasons are listed on the page.`));
    }
    for (const d of domains) {
      if (d.status === 'failed') {
        issues.push(issue('down', `${d.domain} failed verification`, d.error));
      } else if (d.status === 'verified' && !d.pointsHere) {
        // "Reaches this server" is a STORED result from whenever someone last
        // pressed Verify — and the check did not exist when the older domains
        // were verified, so their flag simply defaults to false. When clicks
        // are still arriving through this domain's offers, a stale flag is far
        // more likely than a domain that has silently moved. Say which it is
        // rather than crying wolf; the live Domain check settles it.
        const clickedRecently = d.lastClickAt && (now - new Date(d.lastClickAt).getTime()) < DAY;
        issues.push(clickedRecently
          ? issue('warn', `${d.domain}: "reaches this server" has never been confirmed`,
            'Clicks are still arriving through its offers, so this is most likely a stale check. Run the live domain check below, or press Verify on the Tracking Domains page.')
          : issue('down', `${d.domain} does not reach this server`,
            'It resolves, but clicks on it land on a different deployment and are not tracked here.'));
      } else if (d.status === 'verified' && !d.sslActive) {
        issues.push(issue('warn', `${d.domain} has no working HTTPS`));
      } else if (d.status === 'pending') {
        issues.push(issue('warn', `${d.domain} has never been verified`));
      }
    }
    if (blocked24h > 0 && clicks24h > 0 && blocked24h / clicks24h > 0.5) {
      issues.push(issue('warn',
        `${Math.round((blocked24h / clicks24h) * 100)}% of clicks were blocked in the last 24h`,
        'Bot, geo, device or frequency-cap filters. Intended, or a targeting rule that is too tight.'));
    }

    res.json({
      timezone: tz,
      clicks: {
        last1h: clicks1h,
        last24h: clicks24h,
        blocked24h,
        lastAt: lastClick?.clickedAt || null,
        lastOfferName: lastClick?.offerName || '',
        minutesSinceLast: clickAgeMin,
      },
      conversions: {
        last24h: conv24h,
        lastAt: lastConversion?.conversionAt || null,
        lastOfferName: lastConversion?.offerName || '',
        minutesSinceLast: convAgeMin,
      },
      networks: Object.values(networks).sort((a, b) => b.clicks24h - a.clicks24h),
      domains,
      postback24h: {
        total: pbTotal,
        accepted,
        rejected,
        rejectRate: pbTotal ? round((rejected / pbTotal) * 100) : 0,
        reasons,
      },
      issues,
    });
  } catch (error) {
    next(error);
  }
};

// ── Data health ─────────────────────────────────────────────────────────────

/**
 * GET /api/system-health/data
 *
 * Today against the same slice of yesterday — not against the whole of
 * yesterday, which would report a 90% "drop" every morning.
 */
exports.getData = async (req, res, next) => {
  try {
    const tz = await getReportTimezone();
    const offerIds = await visibleOfferIds(req.user);
    const scope = offerScopeMatch(offerIds);

    const today = todayInTz(tz);
    const dayStart = zonedStartOfDayUtc(today, tz);
    const now = new Date();
    const prevStart = new Date(dayStart.getTime() - DAY);
    const prevNow = new Date(now.getTime() - DAY);

    const window = (from, to) => Click.aggregate([
      { $match: { ...scope, clickedAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          clicks: { $sum: 1 },
          blocked: { $sum: { $cond: ['$isBlocked', 1, 0] } },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
        },
      },
    ]).then(r => r[0] || { clicks: 0, blocked: 0, conversions: 0 });

    const [todayStats, yStats, perOffer7d, orphanCount, orphanRecent] = await Promise.all([
      window(dayStart, now),
      window(prevStart, prevNow),
      Click.aggregate([
        { $match: { ...scope, clickedAt: { $gte: new Date(Date.now() - 7 * DAY) } } },
        {
          $group: {
            _id: '$offerId',
            offerName: { $last: '$offerName' },
            clicks: { $sum: 1 },
            conversions: { $sum: { $cond: ['$converted', 1, 0] } },
            lastClickAt: { $max: '$clickedAt' },
          },
        },
        { $match: { conversions: 0, clicks: { $gte: 20 } } },
        { $sort: { clicks: -1 } },
        { $limit: 15 },
      ]),
      PostbackLog.countDocuments({
        ...postbackScope(req.user),
        reason: PostbackLog.REASONS.CLICK_NOT_FOUND,
        createdAt: { $gte: new Date(Date.now() - 7 * DAY) },
      }),
      PostbackLog.find({
        ...postbackScope(req.user),
        reason: PostbackLog.REASONS.CLICK_NOT_FOUND,
        createdAt: { $gte: new Date(Date.now() - 7 * DAY) },
      }).sort({ createdAt: -1 }).limit(10).select('clickId createdAt params ip').lean(),
    ]);

    const pct = (curr, prev) => (prev > 0 ? round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0));
    const clicksPct = pct(todayStats.clicks, yStats.clicks);
    const convPct = pct(todayStats.conversions, yStats.conversions);

    const issues = [];
    // Only call a drop a drop when yesterday had enough volume for the
    // comparison to mean anything — 12 clicks becoming 4 is noise.
    if (yStats.clicks >= 50 && clicksPct <= -50) {
      issues.push(issue('warn', `Clicks are down ${Math.abs(clicksPct)}% on the same time yesterday`));
    }
    if (yStats.conversions >= 5 && convPct <= -60) {
      issues.push(issue('warn', `Conversions are down ${Math.abs(convPct)}% on the same time yesterday`));
    }
    if (orphanCount > 0) {
      issues.push(issue('warn',
        `${orphanCount} postback(s) in 7 days carried a click id we have no record of`,
        'Either the click id macro is wrong on the network side, or the clicks were recorded on another deployment.'));
    }
    if (perOffer7d.length) {
      issues.push(issue('warn',
        `${perOffer7d.length} offer(s) took traffic but no conversion in 7 days`,
        'Check the postback URL is registered for each of them.'));
    }
    const blockedPct = todayStats.clicks ? round((todayStats.blocked / todayStats.clicks) * 100) : 0;

    res.json({
      timezone: tz,
      today: {
        date: today,
        clicks: todayStats.clicks,
        conversions: todayStats.conversions,
        blocked: todayStats.blocked,
        blockedPct,
        cvr: todayStats.clicks ? round((todayStats.conversions / todayStats.clicks) * 100, 2) : 0,
      },
      yesterdaySameTime: {
        clicks: yStats.clicks,
        conversions: yStats.conversions,
        blocked: yStats.blocked,
      },
      change: { clicksPct, conversionsPct: convPct },
      zeroConversionOffers: perOffer7d.map(o => ({
        offerId: o._id,
        name: o.offerName || '(unnamed offer)',
        clicks: o.clicks,
        lastClickAt: o.lastClickAt,
      })),
      orphanConversions: {
        count7d: orphanCount,
        recent: orphanRecent.map(r => ({
          clickId: r.clickId,
          at: r.createdAt,
          ip: r.ip,
        })),
      },
      issues,
    });
  } catch (error) {
    next(error);
  }
};

// ── Offer URL probe ─────────────────────────────────────────────────────────

/**
 * One outbound request. Redirects are NOT followed: an affiliate landing page
 * answering 302 is the normal case, and chasing the chain would turn a health
 * check into a crawler. Anything that answers at all is treated as alive; the
 * failure we are looking for is a dead host or a 404/5xx.
 */
function probe(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return resolve({ ok: false, status: 0, ms: 0, error: 'Invalid URL' });
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return resolve({ ok: false, status: 0, ms: 0, error: `Unsupported protocol ${target.protocol}` });
    }

    const lib = target.protocol === 'https:' ? https : http;
    const started = Date.now();
    const request = lib.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'TrackHive-HealthCheck/1.0',
          Accept: 'text/html,*/*',
        },
      },
      (response) => {
        const ms = Date.now() - started;
        const status = response.statusCode || 0;
        // Read nothing — the status line is the whole answer.
        response.destroy();
        resolve({
          ok: status > 0 && status < 400,
          status,
          ms,
          location: response.headers?.location || '',
          error: status >= 400 ? `HTTP ${status}` : '',
        });
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

/** Run `jobs` with at most `limit` in flight. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * GET /api/system-health/offer-urls
 *
 * Deliberately not part of getTracking: it makes up to 30 outbound requests
 * and is run from a button, not on every page load.
 */
exports.getOfferUrls = async (req, res, next) => {
  try {
    const offers = await Offer.find({
      ...ownerFilter(req.user),
      status: 'active',
      landingPageUrl: { $nin: [null, ''] },
    })
      .select('name landingPageUrl')
      .sort('-updatedAt')
      .limit(30)
      .lean();

    const results = await pool(offers, 5, async (offer) => {
      const r = await probe(offer.landingPageUrl);
      return {
        offerId: offer._id,
        name: offer.name,
        url: offer.landingPageUrl,
        ...r,
      };
    });

    const dead = results.filter(r => !r.ok);
    const slow = results.filter(r => r.ok && r.ms > 3000);
    const issues = [];
    if (dead.length) {
      issues.push(issue('down', `${dead.length} active offer URL(s) did not answer`,
        'Clicks sent to these redirect visitors to a dead page.'));
    }
    if (slow.length) {
      issues.push(issue('warn', `${slow.length} offer URL(s) took over 3s to answer`));
    }

    res.json({ checked: results.length, results, issues, checkedAt: new Date() });
  } catch (error) {
    next(error);
  }
};

// ── History ─────────────────────────────────────────────────────────────────

/**
 * Bucket width by window length, so a chart never tries to draw ten thousand
 * points: 6h of raw minutes is 360, and a fortnight of hourly buckets is 336.
 */
const BUCKETS = [
  { maxHours: 6, ms: 60 * 1000 },
  { maxHours: 24, ms: 5 * 60 * 1000 },
  { maxHours: 72, ms: 15 * 60 * 1000 },
  { maxHours: Infinity, ms: 60 * 60 * 1000 },
];

/**
 * GET /api/system-health/history?hours=24 — manager only.
 *
 * The answer to "when was the CPU high?". Returns the series for the charts
 * and, separately, the peak of each metric WITH the minute it happened —
 * which is the part someone actually reads.
 *
 * The peaks use `$max` over a `{ value, at }` sub-document: BSON compares
 * documents field by field in order, so this picks the highest `value` and
 * carries its timestamp along, in the same single pass as everything else.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 336);
    const from = new Date(Date.now() - hours * HOUR);
    const bucketMs = BUCKETS.find(b => hours <= b.maxHours).ms;
    const bucket = {
      $toDate: { $subtract: [{ $toLong: '$at' }, { $mod: [{ $toLong: '$at' }, bucketMs] }] },
    };

    const [rows, summary] = await Promise.all([
      ServerMetric.aggregate([
        { $match: { at: { $gte: from } } },
        {
          $group: {
            _id: bucket,
            cpu: { $avg: '$cpuPct' },
            cpuMax: { $max: '$cpuPct' },
            procCpu: { $avg: '$procCpuPct' },
            mem: { $avg: '$memUsedPct' },
            memMB: { $avg: '$memUsedMB' },
            rssMB: { $avg: '$rssMB' },
            heapMB: { $avg: '$heapUsedMB' },
            swapMB: { $avg: '$swapUsedMB' },
            disk: { $max: '$diskUsedPct' },
            load1: { $avg: { $arrayElemAt: ['$loadAvg', 0] } },
            loopLag: { $avg: '$loopLagMs' },
            loopLagMax: { $max: '$loopLagMaxMs' },
            req: { $sum: '$httpReq' },
            e4: { $sum: '$http4xx' },
            e5: { $sum: '$http5xx' },
            respMs: { $avg: '$httpAvgMs' },
            respMaxMs: { $max: '$httpMaxMs' },
            clicks: { $sum: '$clicks' },
            conversions: { $sum: '$conversions' },
            netRx: { $avg: '$netRxKBs' },
            netTx: { $avg: '$netTxKBs' },
            boots: { $sum: { $cond: ['$boot', 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ServerMetric.aggregate([
        { $match: { at: { $gte: from } } },
        {
          $group: {
            _id: null,
            samples: { $sum: 1 },
            peakCpu: { $max: { value: '$cpuPct', at: '$at' } },
            peakMem: { $max: { value: '$memUsedPct', at: '$at' } },
            peakDisk: { $max: { value: '$diskUsedPct', at: '$at' } },
            peakLoad: { $max: { value: { $arrayElemAt: ['$loadAvg', 0] }, at: '$at' } },
            peakLoopLag: { $max: { value: '$loopLagMaxMs', at: '$at' } },
            peakReq: { $max: { value: '$httpReq', at: '$at' } },
            peakRespMs: { $max: { value: '$httpMaxMs', at: '$at' } },
            peakClicks: { $max: { value: '$clicks', at: '$at' } },
            avgCpu: { $avg: '$cpuPct' },
            avgMem: { $avg: '$memUsedPct' },
            avgLoopLag: { $avg: '$loopLagMs' },
            totalReq: { $sum: '$httpReq' },
            total5xx: { $sum: '$http5xx' },
            totalClicks: { $sum: '$clicks' },
            totalConversions: { $sum: '$conversions' },
            restarts: { $sum: { $cond: ['$boot', 1, 0] } },
          },
        },
      ]).then(r => r[0] || null),
    ]);

    res.json({
      hours,
      bucketMinutes: bucketMs / 60000,
      timezone: await getReportTimezone(),
      points: rows.map(p => ({
        at: p._id,
        cpu: round(p.cpu),
        cpuMax: round(p.cpuMax),
        procCpu: round(p.procCpu, 2),
        mem: round(p.mem),
        memMB: round(p.memMB),
        rssMB: round(p.rssMB),
        heapMB: round(p.heapMB),
        swapMB: round(p.swapMB),
        disk: round(p.disk),
        load1: round(p.load1, 2),
        loopLag: round(p.loopLag, 2),
        loopLagMax: round(p.loopLagMax, 2),
        req: p.req,
        e4: p.e4,
        e5: p.e5,
        respMs: round(p.respMs, 1),
        respMaxMs: round(p.respMaxMs, 1),
        clicks: p.clicks,
        conversions: p.conversions,
        netRx: round(p.netRx, 1),
        netTx: round(p.netTx, 1),
        restart: p.boots > 0,
      })),
      summary: summary ? {
        samples: summary.samples,
        avgCpu: round(summary.avgCpu),
        avgMem: round(summary.avgMem),
        avgLoopLag: round(summary.avgLoopLag, 2),
        totalRequests: summary.totalReq,
        total5xx: summary.total5xx,
        totalClicks: summary.totalClicks,
        totalConversions: summary.totalConversions,
        restarts: summary.restarts,
        peaks: {
          cpu: summary.peakCpu,
          memory: summary.peakMem,
          disk: summary.peakDisk,
          load: summary.peakLoad,
          eventLoop: summary.peakLoopLag,
          requests: summary.peakReq,
          responseMs: summary.peakRespMs,
          clicks: summary.peakClicks,
        },
      } : null,
    });
  } catch (error) {
    next(error);
  }
};

// ── Recent errors ───────────────────────────────────────────────────────────

/**
 * GET /api/system-health/errors — manager only.
 *
 * The last 50 errors the process handled, newest first, held in memory. They
 * are gone after a restart on purpose: an error that predates the restart is
 * in the PM2 log, and persisting stack traces that may quote request data is
 * not something to do by default.
 */
exports.getErrors = async (req, res, next) => {
  try {
    res.json({ errors: serverMetrics.recentErrors(), capacity: 50 });
  } catch (error) {
    next(error);
  }
};

// ── Live tracking-domain check ──────────────────────────────────────────────

/** DNS + HTTPS + certificate expiry + "is this actually us" for one domain. */
function checkDomain(domain, timeoutMs = 10000) {
  const out = {
    domain, dnsOk: false, ips: [], cname: '', httpsOk: false,
    pointsHere: false, instance: '', certIssuer: '', certValidTo: null,
    certDaysLeft: null, ms: null, error: '',
  };

  const resolveDns = async () => {
    try {
      out.ips = await dns.promises.resolve4(domain);
      out.dnsOk = out.ips.length > 0;
    } catch {
      try {
        const c = await dns.promises.resolveCname(domain);
        out.cname = c[0] || '';
        out.dnsOk = !!out.cname;
      } catch { /* no records at all */ }
    }
  };

  return resolveDns().then(() => new Promise((resolve) => {
    if (!out.dnsOk) {
      out.error = 'DNS record not found';
      return resolve(out);
    }
    const started = Date.now();
    const request = https.request(
      { hostname: domain, port: 443, path: '/api/health', method: 'GET', timeout: timeoutMs },
      (response) => {
        // The certificate is on the socket, and only while it is still open.
        try {
          const cert = response.socket?.getPeerCertificate?.();
          if (cert && cert.valid_to) {
            out.certIssuer = cert.issuer?.O || cert.issuer?.CN || '';
            out.certValidTo = new Date(cert.valid_to);
            out.certDaysLeft = Math.floor((out.certValidTo.getTime() - Date.now()) / DAY);
          }
        } catch { /* not fatal */ }

        let body = '';
        response.on('data', (c) => { body += c; if (body.length > 4096) request.destroy(); });
        response.on('end', () => {
          out.ms = Date.now() - started;
          out.httpsOk = true;
          try {
            const parsed = JSON.parse(body);
            out.instance = parsed.instance || '';
            out.pointsHere = !!(parsed.instance && parsed.instance === global.__INSTANCE_ID);
          } catch {
            out.error = 'Answered, but not with this tracker’s health response';
          }
          resolve(out);
        });
      }
    );
    request.on('error', (err) => { out.error = err.code || err.message; resolve(out); });
    request.on('timeout', () => { request.destroy(); out.error = 'Timed out'; resolve(out); });
    request.end();
  }));
}

/**
 * GET /api/system-health/domain-checks
 *
 * Live, on demand — the stored status on the Tracking Domains page is only as
 * fresh as the last time someone pressed Verify, and a certificate that
 * expires in four days looks perfectly verified until the morning it doesn't.
 */
exports.getDomainChecks = async (req, res, next) => {
  try {
    const domains = await TrackingDomain.find().select('domain status').sort('-createdAt').lean();
    const results = await pool(domains, 4, d => checkDomain(d.domain));

    const issues = [];
    for (const r of results) {
      if (!r.dnsOk) issues.push(issue('down', `${r.domain}: DNS does not resolve`));
      else if (!r.httpsOk) issues.push(issue('down', `${r.domain}: HTTPS did not answer`, r.error));
      else if (!r.pointsHere) issues.push(issue('down', `${r.domain} answers, but it is not this server`,
        'Clicks on it are being recorded somewhere else.'));
      if (r.certDaysLeft !== null && r.certDaysLeft <= 14) {
        issues.push(issue(r.certDaysLeft <= 3 ? 'down' : 'warn',
          `${r.domain}: SSL certificate expires in ${r.certDaysLeft} day(s)`));
      }
    }

    res.json({ checkedAt: new Date(), results, issues });
  } catch (error) {
    next(error);
  }
};

// ── Uptime monitors ─────────────────────────────────────────────────────────

/** Uptime % over a window, per monitor. */
async function uptimePct(ids, since) {
  const rows = await UptimeCheck.aggregate([
    { $match: { monitor: { $in: ids }, at: { $gte: since } } },
    { $group: { _id: '$monitor', total: { $sum: 1 }, ok: { $sum: { $cond: ['$ok', 1, 0] } }, avgMs: { $avg: '$ms' } } },
  ]);
  return new Map(rows.map(r => [String(r._id), r]));
}

/**
 * GET /api/system-health/uptime — manager only.
 *
 * Also reports whether Telegram is actually switched on. A monitor whose
 * alerts go nowhere is worse than no monitor: it buys the belief that someone
 * will tell you, which is the belief that stops you checking.
 */
exports.getUptime = async (req, res, next) => {
  try {
    const monitors = await UptimeMonitor.find().sort({ createdAt: 1 }).lean();
    const ids = monitors.map(m => m._id);
    const now = Date.now();

    const [s24, s7, telegramEnabled, botToken, chatId] = await Promise.all([
      uptimePct(ids, new Date(now - DAY)),
      uptimePct(ids, new Date(now - 7 * DAY)),
      Setting.getValue('telegramEnabled', false),
      Setting.getValue('telegramBotToken'),
      Setting.getValue('telegramChatId'),
    ]);

    const recent = await Promise.all(
      monitors.map(m => UptimeCheck.find({ monitor: m._id })
        .sort({ at: -1 }).limit(60).select('at ok ms status').lean())
    );

    const pct = (s) => (s && s.total ? round((s.ok / s.total) * 100, 2) : null);

    res.json({
      telegram: {
        enabled: !!telegramEnabled,
        configured: !!(botToken && chatId),
      },
      monitors: monitors.map((m, i) => {
        const a = s24.get(String(m._id));
        const b = s7.get(String(m._id));
        return {
          id: m._id,
          label: m.label,
          url: m.url,
          enabled: m.enabled,
          up: m.up,
          since: m.since,
          sinceMinutes: minutesSince(m.since),
          lastCheckAt: m.lastCheckAt,
          minutesSinceCheck: minutesSince(m.lastCheckAt),
          lastStatus: m.lastStatus,
          lastMs: m.lastMs,
          lastError: m.lastError || '',
          consecutiveFailures: m.consecutiveFailures,
          intervalSec: m.intervalSec,
          failureThreshold: m.failureThreshold,
          expectBody: m.expectBody || '',
          certValidTo: m.certValidTo || null,
          certDaysLeft: m.certDaysLeft ?? null,
          uptime24h: pct(a),
          uptime7d: pct(b),
          avgMs24h: a ? round(a.avgMs) : null,
          checks24h: a ? a.total : 0,
          // Oldest first, so the strip reads left to right like time does.
          recent: (recent[i] || []).slice().reverse(),
        };
      }),
      issues: buildUptimeIssues(monitors, !!telegramEnabled, !!(botToken && chatId)),
    });
  } catch (error) {
    next(error);
  }
};

function buildUptimeIssues(monitors, telegramEnabled, telegramConfigured) {
  const issues = [];
  const active = monitors.filter(m => m.enabled);

  for (const m of active) {
    if (!m.up) {
      issues.push(issue('down', `${m.label} is down — ${m.url}`, m.lastError));
    }
    if (m.certDaysLeft !== null && m.certDaysLeft !== undefined && m.certDaysLeft <= 14) {
      issues.push(issue(m.certDaysLeft <= 3 ? 'down' : 'warn',
        `${m.label}: SSL certificate expires in ${m.certDaysLeft} day(s)`));
    }
    // A monitor that has stopped running is indistinguishable from "all fine"
    // on a dashboard, which is the worst way for monitoring to fail.
    const staleAfter = Math.max(m.intervalSec * 3, 900) * 1000;
    if (m.lastCheckAt && Date.now() - new Date(m.lastCheckAt).getTime() > staleAfter) {
      issues.push(issue('warn', `${m.label} has not been checked recently`,
        'The monitoring loop may have stopped. Check the server.'));
    }
  }

  if (active.length && !telegramConfigured) {
    issues.push(issue('warn', 'Telegram is not configured',
      'Monitors are running but nobody is being told. Settings → Telegram.'));
  } else if (active.length && !telegramEnabled) {
    issues.push(issue('warn', 'Telegram alerts are switched off',
      'Monitors are running but no message will be sent. Settings → Telegram.'));
  }
  if (!active.length) {
    issues.push(issue('warn', 'No uptime monitor is enabled'));
  }
  return issues;
}

/** POST /api/system-health/uptime — add a monitor. */
exports.addMonitor = async (req, res, next) => {
  try {
    const { label, url, expectBody, intervalSec, failureThreshold } = req.body || {};
    if (!label?.trim()) return res.status(400).json({ error: 'Label is required' });
    if (!url?.trim()) return res.status(400).json({ error: 'URL is required' });

    let parsed;
    try {
      parsed = new URL(url.trim());
    } catch {
      return res.status(400).json({ error: 'Enter a full URL, e.g. https://track.example.com/api/health' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only http and https URLs can be monitored' });
    }

    const exists = await UptimeMonitor.findOne({ url: parsed.toString() });
    if (exists) return res.status(400).json({ error: 'That URL is already being monitored' });

    const monitor = await UptimeMonitor.create({
      label: label.trim(),
      url: parsed.toString(),
      expectBody: (expectBody || '').trim(),
      intervalSec: Math.max(Number(intervalSec) || 300, 60),
      failureThreshold: Math.max(Number(failureThreshold) || 2, 1),
      createdBy: req.user._id,
    });

    // Check it straight away — an operator who just added a monitor wants to
    // know NOW whether the URL was right, not in five minutes.
    await uptime.checkNow(monitor._id).catch(() => null);

    res.status(201).json({ monitor: await UptimeMonitor.findById(monitor._id).lean() });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/system-health/uptime/:id — enable / disable / retune. */
exports.updateMonitor = async (req, res, next) => {
  try {
    const set = {};
    const { label, enabled, intervalSec, failureThreshold, expectBody } = req.body || {};
    if (label !== undefined) set.label = String(label).trim();
    if (enabled !== undefined) set.enabled = !!enabled;
    if (intervalSec !== undefined) set.intervalSec = Math.max(Number(intervalSec) || 300, 60);
    if (failureThreshold !== undefined) set.failureThreshold = Math.max(Number(failureThreshold) || 2, 1);
    if (expectBody !== undefined) set.expectBody = String(expectBody).trim();

    const monitor = await UptimeMonitor.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    res.json({ monitor });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/system-health/uptime/:id */
exports.deleteMonitor = async (req, res, next) => {
  try {
    const monitor = await UptimeMonitor.findByIdAndDelete(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    await UptimeCheck.deleteMany({ monitor: monitor._id });
    res.json({ message: 'Monitor removed' });
  } catch (error) {
    next(error);
  }
};

/** POST /api/system-health/uptime/check — run every monitor now. */
exports.runUptimeCheck = async (req, res, next) => {
  try {
    await uptime.checkAll();
    res.json({ message: 'Checked', checkedAt: new Date() });
  } catch (error) {
    next(error);
  }
};

// ── Rejected postbacks, in full ─────────────────────────────────────────────

/** GET /api/system-health/postback-errors?reason=&limit=&skip= */
exports.getPostbackErrors = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const days = Math.min(Number(req.query.days) || 7, 30);

    const filter = {
      ...postbackScope(req.user),
      outcome: 'rejected',
      createdAt: { $gte: new Date(Date.now() - days * DAY) },
    };
    if (req.query.reason) filter.reason = String(req.query.reason);

    const [rows, total] = await Promise.all([
      PostbackLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PostbackLog.countDocuments(filter),
    ]);

    res.json({
      total,
      rows: rows.map(r => ({
        id: r._id,
        at: r.createdAt,
        clickId: r.clickId,
        offerName: r.offerName || '',
        advertiserName: r.advertiserName || '',
        network: r.network || '',
        reason: r.reason,
        label: PostbackLog.REASON_LABELS[r.reason] || r.reason,
        status: r.status,
        message: r.message || '',
        method: r.method,
        ip: r.ip,
        params: r.params || {},
      })),
    });
  } catch (error) {
    next(error);
  }
};

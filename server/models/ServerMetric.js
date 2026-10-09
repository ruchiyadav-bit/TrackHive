const mongoose = require('mongoose');

/**
 * One sample of how the server was doing, taken every minute.
 *
 * A live reading answers "is the CPU busy right now?". It cannot answer "when
 * was the CPU pinned?", which is the question you actually have at 9am when
 * last night's clicks are missing. So each sample is written to the database
 * rather than kept in memory: in memory it would be lost on exactly the event
 * you most want to look back at — a restart or a crash.
 *
 * One document per minute is ~1,440 a day. The TTL below keeps 14 days and
 * then Mongo removes them itself; at that size the whole collection is a few
 * MB and a range query over it is served from the `at` index.
 *
 * `boot: true` marks the sample written at startup. Counting those is how the
 * health page reports restarts — PM2 does not expose its restart counter to
 * the process it restarted, and parsing ~/.pm2/dump.pm2 would break the first
 * time PM2 changed its format.
 */
const serverMetricSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true, index: true },
    boot: { type: Boolean, default: false },
    instance: String,

    // CPU — real utilisation, worked out from the delta between two
    // os.cpus() readings. Load average is kept alongside it because the two
    // say different things: utilisation is how busy the cores were, load is
    // how many processes were waiting for them.
    cpuPct: { type: Number, default: 0 },
    cpuPerCore: { type: [Number], default: [] },
    loadAvg: { type: [Number], default: [] },
    procCpuPct: { type: Number, default: 0 },

    // Memory, MB
    memTotalMB: Number,
    memUsedMB: Number,
    memUsedPct: Number,
    swapTotalMB: Number,
    swapUsedMB: Number,
    heapUsedMB: Number,
    rssMB: Number,

    // Disk — the filesystem the application is installed on.
    diskMount: String,
    diskTotalGB: Number,
    diskUsedGB: Number,
    diskUsedPct: Number,

    // Network, KB/s averaged over the sample interval
    netRxKBs: Number,
    netTxKBs: Number,

    /**
     * Event loop delay in ms. The one number that says whether Node itself is
     * struggling: CPU and memory can both look fine while every redirect
     * queues behind a blocking call, and this is what shows that.
     */
    loopLagMs: Number,
    loopLagMaxMs: Number,

    // HTTP, counted since the previous sample
    httpReq: { type: Number, default: 0 },
    http4xx: { type: Number, default: 0 },
    http5xx: { type: Number, default: 0 },
    httpAvgMs: { type: Number, default: 0 },
    httpMaxMs: { type: Number, default: 0 },
    clickReq: { type: Number, default: 0 },
    postbackReq: { type: Number, default: 0 },

    // Tracking throughput in the same minute, so a CPU spike can be read
    // against the traffic that caused it.
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
  },
  { versionKey: false }
);

// 14 days is enough to answer "what happened last weekend" and small enough
// that nobody has to think about the size of this collection.
serverMetricSchema.index({ at: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

module.exports = mongoose.model('ServerMetric', serverMetricSchema);

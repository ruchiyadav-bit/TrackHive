const mongoose = require('mongoose');

/**
 * One check result.
 *
 * Kept only so the page can show an uptime percentage and a recent history
 * strip — the alerting itself never reads this collection, it reads the state
 * on the monitor. Rows expire after 30 days; at one check every five minutes
 * that is about 8,600 rows per monitor, a few MB at most.
 */
const uptimeCheckSchema = new mongoose.Schema(
  {
    monitor: { type: mongoose.Schema.Types.ObjectId, ref: 'UptimeMonitor', required: true, index: true },
    at: { type: Date, required: true },
    ok: { type: Boolean, required: true },
    status: Number,
    ms: Number,
    error: { type: String, default: '' },
  },
  { versionKey: false }
);

uptimeCheckSchema.index({ monitor: 1, at: -1 });
uptimeCheckSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('UptimeCheck', uptimeCheckSchema);

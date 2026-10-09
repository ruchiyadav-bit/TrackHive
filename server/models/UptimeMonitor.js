const mongoose = require('mongoose');

/**
 * One thing being watched, plus its current state.
 *
 * The state lives on the monitor rather than being derived from the check log
 * because alerting is about TRANSITIONS, not about the latest result: a domain
 * that has been down for six hours must not send a Telegram message every five
 * minutes. `up` is what we last told the operator, so the checker can compare
 * against it and stay quiet until something actually changes.
 *
 * `failureThreshold` exists for the same reason in the other direction. A
 * single timed-out request at 3 AM is usually a blip somewhere on the route
 * between here and there, not an outage — two in a row is worth waking for.
 */
const uptimeMonitorSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },

    /** Seconds between checks. */
    intervalSec: { type: Number, default: 300, min: 60 },

    /** Consecutive failures before it is called DOWN and an alert is sent. */
    failureThreshold: { type: Number, default: 2, min: 1 },

    /** Request timeout in ms. */
    timeoutMs: { type: Number, default: 15000 },

    /**
     * Optional string that must appear in the response body. For a tracking
     * domain pointed at /api/health this is how you catch the case that hurts
     * most: the domain answers 200 from SOMEONE ELSE'S deployment. A 200 alone
     * would look perfectly healthy while every click went to the wrong
     * database.
     */
    expectBody: { type: String, default: '' },

    // ── Current state ────────────────────────────────────────────────
    up: { type: Boolean, default: true },
    /** Since when it has been in the current state. */
    since: { type: Date, default: Date.now },
    lastCheckAt: Date,
    lastStatus: Number,
    lastMs: Number,
    lastError: { type: String, default: '' },
    consecutiveFailures: { type: Number, default: 0 },

    // ── Certificate ──────────────────────────────────────────────────
    certValidTo: Date,
    certDaysLeft: Number,
    /** So the "certificate expires soon" warning goes out once a day, not every check. */
    certAlertedOn: String,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

uptimeMonitorSchema.index({ url: 1 }, { unique: true });

module.exports = mongoose.model('UptimeMonitor', uptimeMonitorSchema);

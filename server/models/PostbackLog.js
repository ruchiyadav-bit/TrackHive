const mongoose = require('mongoose');

/**
 * Every postback attempt, accepted or rejected.
 *
 * The tracker used to answer "is the postback working?" only indirectly: a
 * conversion either appeared or it didn't. Everything that went wrong on the
 * way — a secret that no longer matches, a click id the network invented, an
 * un-substituted {Amount} macro — left nothing behind but a line in the PM2
 * log, which nobody reads until revenue has already gone missing for a week.
 *
 * So each attempt is recorded here with a machine-readable `reason`, and the
 * System Health page reads this collection. Rows expire after 30 days (TTL
 * index below) — this is an operations signal, not an audit trail, and at
 * postback volume an unbounded collection would quietly become the largest
 * thing in the database.
 *
 * Writing to it must NEVER fail a postback: see logPostback() in
 * controllers/postbackController.js — the create() is fire-and-forget with a
 * catch, because a network that receives a 500 retries, and a retry storm
 * caused by a logging bug is far worse than a missing log row.
 */

/** Rejection reasons. Kept as codes so the UI can group and label them. */
const REASONS = {
  MISSING_CLICK_ID: 'missing_click_id',
  CLICK_NOT_FOUND: 'click_not_found',
  OFFER_NOT_FOUND: 'offer_not_found',
  INVALID_SECRET: 'invalid_secret',
  WINDOW_EXPIRED: 'window_expired',
  DUPLICATE: 'duplicate',
  BAD_AMOUNT: 'bad_amount',
  SERVER_ERROR: 'server_error',
  REJECTED: 'rejected',
  // Accepted outcomes
  ACCEPTED: 'accepted',
  REVERSED: 'reversed',
  UPDATED: 'updated',
  NOOP: 'noop',
};

/** Human labels for the health page. Unknown codes fall back to the code. */
const REASON_LABELS = {
  [REASONS.MISSING_CLICK_ID]: 'No click id in the postback',
  [REASONS.CLICK_NOT_FOUND]: 'Click id not found (orphan conversion)',
  [REASONS.OFFER_NOT_FOUND]: 'Offer no longer exists',
  [REASONS.INVALID_SECRET]: 'Postback secret does not match',
  [REASONS.WINDOW_EXPIRED]: 'Outside the click-to-conversion window',
  [REASONS.DUPLICATE]: 'Already converted (duplicate)',
  [REASONS.BAD_AMOUNT]: 'Amount is not a number (un-substituted macro)',
  [REASONS.SERVER_ERROR]: 'Server error',
  [REASONS.REJECTED]: 'Rejected',
  [REASONS.ACCEPTED]: 'Conversion recorded',
  [REASONS.REVERSED]: 'Conversion reversed by the network',
  [REASONS.UPDATED]: 'Conversion amount updated',
  [REASONS.NOOP]: 'Nothing to correct',
};

const postbackLogSchema = new mongoose.Schema(
  {
    clickId: { type: String, default: '', index: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', index: true },
    offerName: String,
    advertiserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertiser' },
    advertiserName: String,
    network: { type: String, default: '' },

    outcome: { type: String, enum: ['accepted', 'rejected'], required: true },
    reason: { type: String, default: '' },
    status: { type: Number, default: 0 },
    message: String,

    method: String,
    ip: String,
    durationMs: Number,

    /** Query + body as received, with `secret`/`token` masked. */
    params: mongoose.Schema.Types.Mixed,

    /**
     * The offer's owner, so the health page can scope rows the same way every
     * other list does. Null when the attempt never reached an offer (no click
     * id, unknown click id) — those failures belong to nobody in particular
     * and are shown to every operator, because "a postback arrived that we
     * could not place" is exactly what you want to see.
     */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

postbackLogSchema.index({ createdAt: -1 });
postbackLogSchema.index({ outcome: 1, createdAt: -1 });
postbackLogSchema.index({ reason: 1, createdAt: -1 });
// Operations signal, not an audit trail — drop rows after 30 days.
postbackLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const PostbackLog = mongoose.model('PostbackLog', postbackLogSchema);

PostbackLog.REASONS = REASONS;
PostbackLog.REASON_LABELS = REASON_LABELS;

module.exports = PostbackLog;

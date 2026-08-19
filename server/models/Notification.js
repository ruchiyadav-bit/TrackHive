const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['cap_alert', 'conversion_spike', 'offer_expired', 'offer_paused', 'system', 'anomaly'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'error', 'success'], default: 'info' },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    offerName: String,
    // Who this alert belongs to — copied from the offer's owner at creation.
    // Without it, an alert with no offerId (system / anomaly) was readable and
    // DELETABLE by everyone, which is the one hole left in owner isolation.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    data: mongoose.Schema.Types.Mixed,
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

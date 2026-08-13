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
    data: mongoose.Schema.Types.Mixed,
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

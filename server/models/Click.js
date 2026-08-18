const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema(
  {
    clickId: { type: String, required: true, unique: true, index: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true, index: true },
    offerName: String,

    // Visitor info
    ip: { type: String, index: true },
    userAgent: String,
    referer: String,
    country: String,
    region: String,
    city: String,
    device: String,
    os: String,
    browser: String,
    connectionType: String,
    isp: String,

    // Tracking params
    subId1: { type: String, index: true },
    subId2: String,
    subId3: String,
    subId4: String,
    subId5: String,
    source: String,

    // Smart link info
    isSmartLink: { type: Boolean, default: false },
    smartLinkSlug: String,
    uniqueHash: String,

    // Flags
    isBot: { type: Boolean, default: false },
    isVpn: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    blockReason: String,

    // Conversion tracking
    converted: { type: Boolean, default: false },
    conversionId: String,
    conversionAt: Date,
    revenue: { type: Number, default: 0 },
    payout: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    conversionEvent: String,
    // Approval status reported by the network (Katalys sends {conversion_status};
    // only 'approved' conversions are actually paid). 'reversed' means the
    // network later deleted/rejected it and we backed the amounts out.
    conversionStatus: { type: String, default: '' },
    reversedAt: Date,

    // Redirect info
    redirectUrl: String,
    redirectType: String,
    responseTimeMs: Number,

    clickedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

clickSchema.index({ offerId: 1, clickedAt: -1 });
clickSchema.index({ offerId: 1, ip: 1, clickedAt: -1 });
clickSchema.index({ clickedAt: -1 });
clickSchema.index({ converted: 1, conversionAt: -1 });

module.exports = mongoose.model('Click', clickSchema);

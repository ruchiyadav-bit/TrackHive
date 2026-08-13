const mongoose = require('mongoose');

const dailyStatSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
    offerName: String,

    clicks: { type: Number, default: 0 },
    uniqueClicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    payout: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },

    blockedClicks: { type: Number, default: 0 },
    botClicks: { type: Number, default: 0 },
    duplicateClicks: { type: Number, default: 0 },

    // Breakdowns
    byCountry: { type: Map, of: Number, default: {} },
    byDevice: { type: Map, of: Number, default: {} },
    byBrowser: { type: Map, of: Number, default: {} },
    byOs: { type: Map, of: Number, default: {} },
    bySource: { type: Map, of: Number, default: {} },
    bySubId: { type: Map, of: Number, default: {} },

    cr: { type: Number, default: 0 },
    epc: { type: Number, default: 0 },
    rpc: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dailyStatSchema.index({ date: 1, offerId: 1 }, { unique: true });
dailyStatSchema.index({ offerId: 1, date: -1 });
dailyStatSchema.index({ date: -1 });

module.exports = mongoose.model('DailyStat', dailyStatSchema);

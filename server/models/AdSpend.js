const mongoose = require('mongoose');

/**
 * Daily ad spend, typed in by a team member: one offer, one day, one amount.
 *
 * `createdBy` is the DATA OWNER (the manager whose book the offer belongs to),
 * so every existing ownerFilter()/dataOwnerId() rule applies unchanged.
 * `enteredBy` is the person who typed it.
 *
 * One entry per person per offer per day — saving again updates it. Two team
 * members running the same offer on the same day each keep their own entry,
 * and the offer's spend for that day is the sum of both.
 */
const adSpendSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
    offerName: String,
    date: { type: String, required: true }, // 'YYYY-MM-DD', account timezone
    amount: { type: Number, required: true, min: 0 }, // USD
  },
  { timestamps: true }
);

adSpendSchema.index({ enteredBy: 1, offerId: 1, date: 1 }, { unique: true });
adSpendSchema.index({ createdBy: 1, date: -1 });
adSpendSchema.index({ offerId: 1, date: 1 });

module.exports = mongoose.model('AdSpend', adSpendSchema);

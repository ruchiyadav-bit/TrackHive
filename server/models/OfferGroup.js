const mongoose = require('mongoose');

const offerGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    offers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Offer' }],
    color: { type: String, default: '#6366f1' },
    dailyCap: { type: Number, default: 0 },
    monthlyCap: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

offerGroupSchema.index({ name: 1 });

module.exports = mongoose.model('OfferGroup', offerGroupSchema);

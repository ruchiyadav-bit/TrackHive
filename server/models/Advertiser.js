const mongoose = require('mongoose');
const crypto = require('crypto');

const advertiserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    website: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    postbackSecret: {
      type: String,
      default: () => crypto.randomBytes(16).toString('hex'),
    },
    clickIdParam: { type: String, default: 'click_id', trim: true },
    contactName: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

advertiserSchema.index({ name: 1 });
advertiserSchema.index({ status: 1 });

module.exports = mongoose.model('Advertiser', advertiserSchema);

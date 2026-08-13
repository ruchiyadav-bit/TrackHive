const mongoose = require('mongoose');

const trackingDomainSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, trim: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending',
    },
    sslActive: { type: Boolean, default: false },
    verifiedAt: Date,
    verificationError: String,
    resolvedIP: String,
    resolvedCname: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrackingDomain', trackingDomainSchema);

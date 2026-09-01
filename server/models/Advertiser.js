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
    network: {
      type: String,
      enum: ['impact', 'everflow', 'affise', 'trackier', 'cellxpert', 'katalys', 'smartadv', 'custom'],
      default: 'custom',
    },
    clickIdParam: { type: String, default: 'click_id', trim: true },
    // The postback is registered ONCE per advertiser on the network's side, so
    // the domain in that URL has to be a deliberate property of the advertiser
    // — not an account default that silently changes, and not "whichever
    // verified domain happens to sort first" once there are several.
    // Empty = fall back to the account default (existing advertisers).
    trackingDomain: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackingDomain' },
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

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

    /**
     * The CNAME value the operator is told to point this domain at, snapshotted
     * when the domain is added. Stored rather than computed so the setup
     * instructions keep naming the same record even if the account default
     * changes later — otherwise a half-finished setup silently starts telling
     * the user to create a different record than the one they were given.
     */
    targetCname: { type: String, default: '' },

    /**
     * Whether the domain actually reaches THIS server. DNS resolving is not
     * enough: a domain left pointing at an old deployment resolves fine and
     * verifies fine, while every click it carries lands on the wrong database.
     * Confirmed by fetching /api/health over the domain and matching the
     * instance id this process reports.
     */
    pointsHere: { type: Boolean, default: false },

    verifiedAt: Date,
    verificationError: String,
    resolvedIP: String,
    resolvedCname: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrackingDomain', trackingDomainSchema);

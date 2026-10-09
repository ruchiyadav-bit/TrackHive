const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ALL_ROLES, DEFAULT_ROLE, TEAM_REPORT_FIELDS } = require('../config/roles');

/**
 * Per-field visibility for a team member's report view. Stored as one boolean
 * per field so a manager can switch columns off individually; `default: true`
 * means a freshly created team member sees the whole simplified view.
 */
const teamReportFieldsSchema = TEAM_REPORT_FIELDS.reduce(
  (acc, key) => ({ ...acc, [key]: { type: Boolean, default: true } }),
  {}
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    // Three roles — see config/roles.js. Everyone starts as a partner;
    // promotion (and the team role) happens from User Management, never from
    // signup.
    role: {
      type: String,
      enum: ALL_ROLES,
      default: DEFAULT_ROLE,
    },
    /**
     * TEAM ROLE ONLY — whose data this account looks at.
     *
     * Set to whoever CREATED the team account — a manager or a partner — and
     * never changeable afterwards, so a partner's team can only ever see that
     * partner's book.
     *
     * Every other role reads its own `createdBy` rows. A team member owns
     * nothing, so without this it would see an empty dashboard. utils/scope.js
     * substitutes this id for `_id` when scoping, which is the single point
     * where a team member's data window is decided.
     *
     * A team account with this unset must see NOTHING rather than everything —
     * scope.js enforces that, do not "fix" it by falling back to req.user._id.
     */
    teamOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /**
     * TEAM ROLE ONLY — which report fields this member may see. The server
     * strips the rest before serializing (utils/teamView.js); the client hides
     * the columns as a courtesy on top of that.
     */
    teamReportFields: teamReportFieldsSchema,
    /**
     * This account's OWN dashboard / report timezone (IANA id, e.g.
     * 'Asia/Kolkata'). null = use the account default (Settings → timezone).
     *
     * Per user, so one partner switching to New York never re-buckets another
     * partner's reports. A team member has no timezone of its own — it always
     * reads its owner's, so owner and team see the same days (utils/appTime.js).
     */
    timezone: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    offerAccess: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all',
    },
    allowedOffers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Offer' }],
    notificationPrefs: {
      emailOnNewReport: { type: Boolean, default: false },
      emailOnCapAlert: { type: Boolean, default: false },
      emailOnOfferChange: { type: Boolean, default: false },
    },
    lastLogin: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.index({ role: 1, status: 1 });
// Team lists (User Management for a partner, Ad Spend member filter).
userSchema.index({ teamOwner: 1 });

module.exports = mongoose.model('User', userSchema);

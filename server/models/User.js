const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ALL_ROLES, DEFAULT_ROLE } = require('../config/roles');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    // Two roles only — see config/roles.js. Everyone starts as a partner;
    // promotion happens from User Management, never from signup.
    role: {
      type: String,
      enum: ALL_ROLES,
      default: DEFAULT_ROLE,
    },
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

module.exports = mongoose.model('User', userSchema);

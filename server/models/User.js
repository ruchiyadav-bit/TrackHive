const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'manager', 'viewer'],
      default: 'viewer',
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

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: String,
  revenueType: String,
  revenueAmount: { type: Number, default: 0 },
  payoutType: String,
  payoutAmount: { type: Number, default: 0 },
}, { _id: true });

const offerSchema = new mongoose.Schema(
  {
    // Step 1: General
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'draft', 'expired', 'deleted'],
      default: 'draft',
    },
    advertiser: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertiser' },
    category: String,
    currency: { type: String, default: 'USD', enum: ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'BRL', 'NZD'] },
    thumbnail: String,
    offerGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'OfferGroup' },
    labels: [String],
    appIdentifier: String,
    previewUrl: String,
    internalNotes: String,
    channels: [String],
    hasExpiration: { type: Boolean, default: false },
    expirationDate: Date,
    description: String,

    // Step 2: Tracking
    landingPageUrl: String,
    // Optional: your own landing page for Google Ads traffic (Final URL). /gclick
    // only sends to this page's domain. Empty = offer not set up for Google.
    googleLandingUrl: { type: String, default: '' },
    trackingDomain: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackingDomain' },
    linkingType: { type: String, enum: ['redirect', 'direct'], default: 'redirect' },
    conversionTrackingMethod: {
      type: String,
      enum: ['server_postback', 'javascript_sdk', 'iframe_pixel'],
      default: 'server_postback',
    },
    supportDeepLinks: { type: Boolean, default: false },
    enableCaps: { type: Boolean, default: false },
    dailyClickCap: { type: Number, default: 0 },
    dailyConversionCap: { type: Number, default: 0 },
    monthlyConversionCap: { type: Number, default: 0 },
    totalCap: { type: Number, default: 0 },
    offerVisibility: { type: String, enum: ['public', 'requires_approval', 'private'], default: 'public' },
    enableTerms: { type: Boolean, default: false },
    termsContent: String,
    // Frequency cap (per-IP click cap)
    ipCap: { type: Number, default: 0, min: 0 },         // 0 = unlimited
    ipCapWindow: {
      type: String,
      enum: ['24h', '48h', '7d', '30d', 'custom', 'forever'],
      default: '24h',
    },
    ipCapWindowHours: { type: Number, default: 24 },       // used when ipCapWindow = 'custom'
    uniqueIdentifier: {
      type: String,
      enum: ['ip', 'ip_ua', 'ip_ua_ref'],
      default: 'ip_ua',
    },
    fallbackUrl: String,                                   // redirect here on duplicate (if set)
    onDuplicate: {
      // What happens on the (cap+1)th click from the same visitor:
      //   block    → no redirect, "Access Restricted" page (default for new offers)
      //   fallback → redirect to fallbackUrl (falls back to 'block' if fallbackUrl is empty)
      //   redirect → redirect to the normal offer URL, click marked isDuplicate only
      type: String,
      enum: ['block', 'fallback', 'redirect'],
      default: 'block',
    },
    redirectMode: {
      type: String,
      enum: ['302', '301', 'meta_refresh', 'javascript'],
      default: '302',
    },

    // Step 3: Revenue & Payout
    baseEventName: { type: String, default: 'Base' },
    firePartnerPostback: { type: Boolean, default: false },
    manualApproveConversions: { type: Boolean, default: false },
    allowDuplicateConversions: { type: Boolean, default: false },
    revenueAction: { type: String, enum: ['conversion', 'click', 'impression'], default: 'conversion' },
    revenueType: { type: String, enum: ['RPA', 'RPS', 'RPC', 'RPM'], default: 'RPA' },
    revenueAmount: { type: Number, default: 0 },
    revenuePricePerProduct: { type: Boolean, default: false },
    payoutAction: { type: String, enum: ['conversion', 'click', 'impression'], default: 'conversion' },
    payoutType: { type: String, enum: ['CPA', 'CPS', 'percent_revenue', 'CPC', 'CPM'], default: 'CPA' },
    payoutAmount: { type: Number, default: 0 },
    payoutPricePerProduct: { type: Boolean, default: false },
    events: [eventSchema],

    // Step 4: Attribution
    attributionMethod: { type: String, enum: ['last_click', 'first_click'], default: 'last_click' },
    enableThrottle: { type: Boolean, default: false },
    throttleRate: { type: Number, default: 0 },
    enableClickToConversionTime: { type: Boolean, default: false },
    clickToConversionValue: { type: Number, default: 24 },
    clickToConversionUnit: { type: String, enum: ['hours', 'days', 'months'], default: 'hours' },
    enableEmailOwnership: { type: Boolean, default: false },
    enableServerSideClick: { type: Boolean, default: false },

    // Step 5: Targeting
    deviceTypes: [String],
    operatingSystems: [String],
    osVersionMin: String,
    browsers: [String],
    deviceBrands: [String],
    connectionTypes: [String],
    carriers: [String],
    geoCountries: [String],
    geoMode: { type: String, enum: ['include', 'exclude'], default: 'include' },
    geoRegions: [String],
    geoCities: [String],
    geoISP: [String],
    enableIPBlock: { type: Boolean, default: false },
    ipBlocklist: String,

    // Legacy compat fields
    offerUrl: String,
    affiliateUrl: String,
    network: String,

    // Computed totals
    totalClicks: { type: Number, default: 0 },
    totalConversions: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },

    // Meta
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate slug from name
offerSchema.pre('save', function (next) {
  if (this.isNew && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

offerSchema.index({ status: 1 });
offerSchema.index({ category: 1, status: 1 });
offerSchema.index({ advertiser: 1 });
offerSchema.index({ geoCountries: 1 });
offerSchema.index({ labels: 1 });
offerSchema.index({ createdAt: -1 });
offerSchema.index(
  { name: 'text', description: 'text' },
  { name: 'offer_text_search' }
);

module.exports = mongoose.model('Offer', offerSchema);

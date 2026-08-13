export const NETWORKS = [
  'Impact', 'Trackier', 'Affise', 'Ringba', 'Rakuten',
  'WinningCommissions', 'WebPartners', 'HasOffers', 'CAKE', 'Tune',
  'Partnerize', 'CJ Affiliate', 'ShareASale', 'Awin', 'Direct', 'Other',
];

export const CATEGORIES = [
  'Casino', 'Sports Betting', 'Poker', 'Bingo', 'Lottery', 'eSports',
  'GLP-1/Health', 'Finance', 'Crypto', 'Insurance', 'Education',
  'Lead Gen', 'E-commerce', 'Dating', 'VPN/Software', 'Other',
];

export const VERTICALS = [
  'iGaming', 'Health & Wellness', 'Finance', 'Lead Gen',
  'E-commerce', 'SaaS', 'Other',
];

export const CHANNELS = [
  'SEO', 'PPC/Google Ads', 'Facebook/Meta', 'Native', 'Email',
  'Push', 'Display', 'Content/Blog', 'Social Media', 'TikTok',
  'YouTube', 'Influencer', 'SMS', 'Programmatic', 'Contextual',
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'BRL', 'NZD'];

export const STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'paused', label: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  { value: 'expired', label: 'Expired', color: 'bg-red-100 text-red-800' },
];

export const REVENUE_TYPES = ['CPA', 'RPS', 'CPC', 'CPM', 'Hybrid'];
export const PAYOUT_TYPES = ['CPA', 'CPS', 'CPL', 'CPI', 'RevShare', 'PRV', 'Hybrid'];
export const REVENUE_ACTIONS = ['conversion', 'click', 'impression'];

export const CONVERSION_TYPES = [
  'FTD', 'Registration', 'Sale', 'Lead', 'Install',
  'Call', 'Click', 'Signup', 'Trial', 'Subscription',
];

export const CONVERSION_FLOWS = ['SOI', 'DOI', 'CC Submit', 'Trial', 'Purchase', 'Deposit'];

export const DEVICE_OPTIONS = ['Desktop', 'Mobile', 'Tablet'];
export const OS_OPTIONS = ['iOS', 'Android', 'Windows', 'macOS', 'Linux'];
export const BROWSER_OPTIONS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Samsung Internet'];
export const CONNECTION_OPTIONS = ['WiFi', 'Cellular', 'Cable/DSL'];

export const CREATIVE_TYPES = [
  { value: 'banner', label: 'Banner Image' },
  { value: 'text_link', label: 'Text Link' },
  { value: 'video', label: 'Video' },
  { value: 'email', label: 'Email Creative' },
  { value: 'screenshot', label: 'Landing Page Screenshot' },
  { value: 'coupon', label: 'Coupon Code' },
  { value: 'qr_code', label: 'QR Code' },
];

export const REDIRECT_TYPES = [
  { value: '302', label: '302 Redirect' },
  { value: 'meta', label: 'Meta Refresh' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'direct', label: 'Direct Link' },
];

export const CAP_BEHAVIORS = [
  { value: 'soft', label: 'Soft Cap (alert only)' },
  { value: 'hard', label: 'Hard Cap (stop tracking)' },
];

export const IP_CAP_WINDOWS = [
  { value: 'forever', label: 'Forever (Lifetime)' },
  { value: '24h', label: '24 Hours' },
  { value: '48h', label: '48 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
];

export const UNIQUE_IDENTIFIERS = [
  { value: 'ip', label: 'IP Address Only' },
  { value: 'ip_ua', label: 'IP + User Agent' },
  { value: 'ip_ua_ref', label: 'IP + User Agent + Referrer' },
];

export const DUPLICATE_ACTIONS = [
  { value: 'fallback', label: 'Redirect to Fallback URL' },
  { value: 'blocked_page', label: 'Show Blocked Page' },
  { value: 'redirect_anyway', label: 'Redirect Anyway (log as duplicate)' },
];

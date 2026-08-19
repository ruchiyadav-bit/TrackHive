/**
 * Roles — single source of truth.
 *
 * TrackHive has exactly two roles:
 *
 *   manager  Full access, including User Management and Tracking Domains.
 *   partner  Everything else. Cannot see or touch users or tracking domains.
 *
 * Every account created through signup is a partner. Only a manager can
 * promote someone, and only from the User Management screen.
 *
 * The old four-role scheme (super_admin / admin / manager / viewer) is mapped
 * through LEGACY_ROLE_MAP. Keep that map even after migrating: a JWT issued
 * before the migration still carries the old role string, and normalizeRole()
 * is what stops such a token from silently falling through to no access.
 */

const MANAGER = 'manager';
const PARTNER = 'partner';

const ALL_ROLES = [MANAGER, PARTNER];
const DEFAULT_ROLE = PARTNER;

const LEGACY_ROLE_MAP = {
  super_admin: MANAGER,
  admin: MANAGER,
  manager: MANAGER,
  viewer: PARTNER,
};

/** Map any historical or unknown role onto one of the two current roles. */
function normalizeRole(role) {
  if (ALL_ROLES.includes(role)) return role;
  return LEGACY_ROLE_MAP[role] || DEFAULT_ROLE;
}

/** True when the user may manage users and tracking domains. */
function isManager(user) {
  return normalizeRole(user?.role) === MANAGER;
}

/**
 * Settings are ONE account-wide document, not per user. So the safe shape is an
 * allow-list: a partner may write only these keys, and everything else — now or
 * added later — is manager-only by default.
 *
 * A deny-list was the original design and it was wrong. It listed only
 * trackingDomain, which left a partner free to PUT `timezone` (re-buckets every
 * other tenant's reports), `globalPostbackUrl`, `clickIdParam`, or the
 * defaultIpCap / bot / VPN toggles that seed every new offer in the account.
 */
const PARTNER_WRITABLE_SETTING_KEYS = [];

/** True when this user may write this settings key. */
function canWriteSetting(user, key) {
  return isManager(user) || PARTNER_WRITABLE_SETTING_KEYS.includes(key);
}

/**
 * Settings values a partner is allowed to READ. trackingDomain is included
 * because tracking links cannot be rendered without it; globalPostbackUrl and
 * the rest stay manager-only.
 */
const PARTNER_READABLE_SETTING_KEYS = [
  'siteName',
  'currency',
  'timezone',
  'trackingDomain',
  'clickIdParam',
  'subIdParams',
];

module.exports = {
  MANAGER,
  PARTNER,
  ALL_ROLES,
  DEFAULT_ROLE,
  LEGACY_ROLE_MAP,
  normalizeRole,
  isManager,
  PARTNER_WRITABLE_SETTING_KEYS,
  PARTNER_READABLE_SETTING_KEYS,
  canWriteSetting,
};

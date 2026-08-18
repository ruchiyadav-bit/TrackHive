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
 * Settings keys only a manager may write.
 *
 * The Tracking Domain is hidden from partners in the UI, so it must also be
 * refused at the API — otherwise the restriction is decoration and a partner
 * can repoint every tracking link in the account with one PUT.
 */
const MANAGER_ONLY_SETTING_KEYS = ['trackingDomain'];

module.exports = {
  MANAGER,
  PARTNER,
  ALL_ROLES,
  DEFAULT_ROLE,
  LEGACY_ROLE_MAP,
  normalizeRole,
  isManager,
  MANAGER_ONLY_SETTING_KEYS,
};

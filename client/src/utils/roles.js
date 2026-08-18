/**
 * Roles, client side. Mirrors server/config/roles.js — change both together.
 *
 *   manager  Full access, including Users and Tracking Domains.
 *   partner  Everything else.
 *
 * Hiding a menu item is a courtesy, not a control: every restriction here has
 * a matching guard on the server, because anyone can type a URL or call the
 * API directly.
 */

export const MANAGER = 'manager';
export const PARTNER = 'partner';

export const ROLES = [
  { value: MANAGER, label: 'Manager', description: 'Full access, including users and tracking domains' },
  { value: PARTNER, label: 'Partner', description: 'Everything except users and tracking domains' },
];

export const DEFAULT_ROLE = PARTNER;

// Accounts created before the two-role migration may still present an old
// role until their next token refresh.
const LEGACY_ROLE_MAP = {
  super_admin: MANAGER,
  admin: MANAGER,
  manager: MANAGER,
  viewer: PARTNER,
};

export function normalizeRole(role) {
  if (role === MANAGER || role === PARTNER) return role;
  return LEGACY_ROLE_MAP[role] || DEFAULT_ROLE;
}

export function isManager(user) {
  return normalizeRole(user?.role) === MANAGER;
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLES.find(r => r.value === normalized)?.label || normalized;
}

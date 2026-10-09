/**
 * Roles, client side. Mirrors server/config/roles.js — change both together.
 *
 *   manager  Full access, including Users and Tracking Domains.
 *   partner  Everything else, on their own data.
 *   team     Read-only viewer of the data of the manager / partner who created it. No money, no writes.
 *
 * Hiding a menu item is a courtesy, not a control: every restriction here has
 * a matching guard on the server, because anyone can type a URL or call the
 * API directly. For the team role in particular the server also removes
 * revenue and payout from the response — the columns are not merely hidden.
 */

export const MANAGER = 'manager';
export const PARTNER = 'partner';
export const TEAM = 'team';

export const ROLES = [
  { value: MANAGER, label: 'Manager', description: 'Full access, including users and tracking domains' },
  { value: PARTNER, label: 'Partner', description: 'Everything on their own data; can run their own team' },
  { value: TEAM, label: 'Team Member', description: 'View-only reports without money. Enters daily ad spend; gets a performance badge' },
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
  if (role === MANAGER || role === PARTNER || role === TEAM) return role;
  return LEGACY_ROLE_MAP[role] || DEFAULT_ROLE;
}

export function isManager(user) {
  return normalizeRole(user?.role) === MANAGER;
}

export function isPartner(user) {
  return normalizeRole(user?.role) === PARTNER;
}

/**
 * Manager (whole account) or partner (its own team only). Mirrors
 * canManageTeam() on the server, which is what actually decides.
 */
export function canManageTeam(user) {
  const r = normalizeRole(user?.role);
  return r === MANAGER || r === PARTNER;
}

export function isTeam(user) {
  return normalizeRole(user?.role) === TEAM;
}

/**
 * True when this account may change anything at all. Ask this — not
 * `role === 'team'` — when deciding whether to render a Create / Edit /
 * Delete control, so a future read-only role is covered by the same check.
 */
export function isReadOnly(user) {
  return isTeam(user);
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLES.find(r => r.value === normalized)?.label || normalized;
}

/**
 * Report fields a manager can switch off per team member. Must stay in step
 * with TEAM_REPORT_FIELDS in server/config/roles.js — the server is what
 * actually enforces them.
 */
export const TEAM_REPORT_FIELDS = [
  { key: 'grossClicks', label: 'Gross Clicks' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'uniqueClicks', label: 'Unique' },
  { key: 'dupClicks', label: 'Duplicate' },
  { key: 'invalidClicks', label: 'Invalid' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'cvr', label: 'CVR' },
  { key: 'status', label: 'Performance badge (V. Good / Good / Avg / Breakeven / Loss)' },
  { key: 'country', label: 'Country' },
  { key: 'device', label: 'Device' },
  { key: 'source', label: 'Source' },
];

/** A complete on/off map, defaulting anything unset to on. */
export function normalizeTeamReportFields(fields) {
  const src = fields || {};
  return TEAM_REPORT_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f.key]: src[f.key] === undefined ? true : !!src[f.key] }),
    {}
  );
}

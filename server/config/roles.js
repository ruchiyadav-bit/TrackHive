/**
 * Roles — single source of truth.
 *
 * TrackHive has three roles:
 *
 *   manager  An operator who ALSO administers the account.
 *   partner  An operator.
 *   team     A read-only viewer of ONE manager's data (media buying team).
 *
 * manager and partner both see exactly the same thing of their OWN data —
 * their offers, their advertisers, their clicks and reports — and NOTHING of
 * anyone else's. A manager does not get a window into their team's offers;
 * see utils/scope.js.
 *
 * `manager` grants only administration:
 *   - User Management (create / edit / deactivate accounts)
 *   - Tracking Domains (add / verify / delete)
 *   - Account settings and Telegram configuration
 *
 * `team` is the one role that breaks the own-data rule, deliberately: a team
 * account is created BY a manager or a partner and looks at THAT creator's book through
 * `teamOwner`. To keep that safe it is read-only everywhere (middleware/auth.js
 * refuses every non-GET) and money never reaches it (utils/teamView.js strips
 * revenue and payout server-side and sends a profit/loss badge instead).
 *
 * Every account created through signup is a partner. Only a manager can change
 * someone's role, and only from the User Management screen.
 *
 * The old four-role scheme (super_admin / admin / manager / viewer) is mapped
 * through LEGACY_ROLE_MAP. Keep that map even after migrating: a JWT issued
 * before the migration still carries the old role string, and normalizeRole()
 * is what stops such a token from silently falling through to no access.
 */

const MANAGER = 'manager';
const PARTNER = 'partner';
const TEAM = 'team';

const ALL_ROLES = [MANAGER, PARTNER, TEAM];
const DEFAULT_ROLE = PARTNER;

const LEGACY_ROLE_MAP = {
  super_admin: MANAGER,
  admin: MANAGER,
  manager: MANAGER,
  viewer: PARTNER,
};

/** Map any historical or unknown role onto one of the three current roles. */
function normalizeRole(role) {
  if (ALL_ROLES.includes(role)) return role;
  return LEGACY_ROLE_MAP[role] || DEFAULT_ROLE;
}

/** True when the user may administer the account. Never a data permission. */
function isManager(user) {
  return normalizeRole(user?.role) === MANAGER;
}

/** True for a partner. */
function isPartner(user) {
  return normalizeRole(user?.role) === PARTNER;
}

/**
 * True when this user may run a team of their own: create, edit, deactivate
 * and delete `team` accounts that look at THEIR book. A manager can do that
 * (and more — see User Management); a partner can do it for its own team
 * only. A team member can never create anyone.
 */
function canManageTeam(user) {
  const r = normalizeRole(user?.role);
  return r === MANAGER || r === PARTNER;
}

/** True for a read-only team viewer. */
function isTeam(user) {
  return normalizeRole(user?.role) === TEAM;
}

/**
 * True when this user may change ANYTHING at all. Today only `team` is
 * read-only, but route guards should ask this question rather than test the
 * role string, so a future read-only role is covered by the same check.
 */
function isReadOnly(user) {
  return isTeam(user);
}

/**
 * Report fields a manager can switch off for one team member.
 *
 * The identity column of each report (offer name / date / hour / click id on
 * the log) is NOT in this list — hiding it would leave rows that cannot be
 * told apart. `status` is the profit/loss badge, which is the whole point of
 * the team view, but a manager may still want to withhold it.
 */
const TEAM_REPORT_FIELDS = [
  'grossClicks',
  'clicks',
  'uniqueClicks',
  'dupClicks',
  'invalidClicks',
  'conversions',
  'cvr',
  'status',
  'country',
  'device',
  'source',
];

/** Every field on by default — a new team member sees the full simplified view. */
function defaultTeamReportFields() {
  return TEAM_REPORT_FIELDS.reduce((acc, k) => ({ ...acc, [k]: true }), {});
}

/**
 * Normalize whatever is stored (or posted) into a complete boolean map.
 * A missing key means "on": that way adding a field to TEAM_REPORT_FIELDS
 * later does not silently hide it from every existing team member.
 */
function normalizeTeamReportFields(fields) {
  const src = fields && typeof fields === 'object' ? fields : {};
  return TEAM_REPORT_FIELDS.reduce(
    (acc, k) => ({ ...acc, [k]: src[k] === undefined ? true : !!src[k] }),
    {}
  );
}

/**
 * Settings are ONE account-wide document, not per user. So the safe shape is an
 * allow-list: a non-manager may write only these keys, and everything else —
 * now or added later — is manager-only by default.
 *
 * A deny-list was the original design and it was wrong. It listed only
 * trackingDomain, which left a partner free to PUT `timezone` (re-buckets every
 * other tenant's reports), `globalPostbackUrl`, `clickIdParam`, or the
 * defaultIpCap / bot / VPN toggles that seed every new offer in the account.
 */
const PARTNER_WRITABLE_SETTING_KEYS = [];

/** True when this user may write this settings key. */
function canWriteSetting(user, key) {
  if (isReadOnly(user)) return false;
  return isManager(user) || PARTNER_WRITABLE_SETTING_KEYS.includes(key);
}

/**
 * Settings values a non-manager is allowed to READ. trackingDomain is included
 * because tracking links cannot be rendered without it; globalPostbackUrl and
 * the rest stay manager-only. A team member sees this same list, which is
 * exactly the "General + Tracking Domain, as it is" view.
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
  TEAM,
  ALL_ROLES,
  DEFAULT_ROLE,
  LEGACY_ROLE_MAP,
  normalizeRole,
  isManager,
  isPartner,
  canManageTeam,
  isTeam,
  isReadOnly,
  TEAM_REPORT_FIELDS,
  defaultTeamReportFields,
  normalizeTeamReportFields,
  PARTNER_WRITABLE_SETTING_KEYS,
  PARTNER_READABLE_SETTING_KEYS,
  canWriteSetting,
};

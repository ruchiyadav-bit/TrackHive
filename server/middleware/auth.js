const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeRole, MANAGER, PARTNER, TEAM, isReadOnly, isTeam } = require('../config/roles');

/**
 * A team account is only as valid as the account that owns it.
 *
 * Returns the owner (name, role, status, timezone) when the team member may
 * work, or null when it must be refused: no owner recorded, owner deleted,
 * owner deactivated, or the owner has since been turned into a team account
 * itself (a team member cannot own a team). Refusing here — rather than
 * letting the request through to see an empty or wrong book — is what makes a
 * deactivated partner's whole team stop at the same moment the partner does,
 * and start again when the partner is reactivated.
 */
async function loadActiveTeamOwner(user) {
  if (!isTeam(user) || !user.teamOwner) return null;
  const owner = await User.findById(user.teamOwner).select('name email role status timezone').lean();
  if (!owner || owner.status !== 'active' || normalizeRole(owner.role) === TEAM) return null;
  return owner;
}

/** Request methods that cannot change anything. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Writes a read-only account may still make. The ONLY one is its daily ad
 * spend (add / update / delete its own entries). Everything else stays
 * view-only, including its own password — a manager resets that from User
 * Management.
 *
 * Kept as a path allow-list rather than a per-route flag so that a write route
 * added six months from now is refused by default, which is the direction we
 * want this to fail in.
 */
const READ_ONLY_WRITE_ALLOWLIST = [
  /^\/api\/ad-spend\/?$/,
  /^\/api\/ad-spend\/[a-f0-9]{24}\/?$/i,
];

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    if (isTeam(user)) {
      const owner = await loadActiveTeamOwner(user);
      if (!owner) {
        return res.status(403).json({ error: 'Your team owner\'s account is inactive. Contact your partner or manager.' });
      }
      req.teamOwner = owner;
    }

    // Read-only enforcement lives HERE rather than on each route, because a
    // route is easy to forget and this is not: every authenticated request in
    // the app passes through this function exactly once.
    if (isReadOnly(user) && !SAFE_METHODS.has(req.method)) {
      const path = req.originalUrl.split('?')[0];
      if (!READ_ONLY_WRITE_ALLOWLIST.some(rx => rx.test(path))) {
        return res.status(403).json({ error: 'Your account is view-only' });
      }
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based authorization.
// The stored role is normalized first, so an account (or a JWT) still carrying
// a pre-migration role such as 'super_admin' resolves to 'manager' rather than
// failing every check and locking the owner out of their own dashboard.
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

/** Guard for the two manager-only areas: users and tracking domains. */
const requireManager = authorize(MANAGER);

/** Guard for team administration: a manager, or a partner for its own team. */
const requireTeamManager = authorize(MANAGER, PARTNER);

module.exports = { auth, authorize, requireManager, requireTeamManager, loadActiveTeamOwner };

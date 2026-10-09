const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { z } = require('zod');
const { DEFAULT_ROLE, isTeam } = require('../config/roles');
const { loadActiveTeamOwner } = require('../middleware/auth');
const { isValidTimezone, userTimezone, getReportTimezone } = require('../utils/appTime');

const signupSchema = z.object({
  name: z.string().min(1).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = signupSchema.parse(req.body);

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Role is deliberately NOT read from req.body. The signup form has no role
    // field, and a hand-crafted request must not be able to grant itself one —
    // signupSchema drops unknown keys, and the role is pinned here as well.
    const user = new User({
      name,
      email,
      password,
      role: DEFAULT_ROLE,
      status: 'active',
      offerAccess: 'all',
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: { ...user.toJSON(), ...(await timezoneInfo({ user })) },
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // A team member cannot sign in while the partner / manager who owns it is
    // deactivated or deleted — same rule middleware/auth.js applies per request.
    let teamOwner = null;
    if (isTeam(user)) {
      teamOwner = await loadActiveTeamOwner(user);
      if (!teamOwner) {
        return res.status(403).json({ error: 'Your team owner\'s account is inactive. Contact your partner or manager.' });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '24h');
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const out = user.toJSON();
    Object.assign(out, await timezoneInfo({ user, teamOwner }));
    if (teamOwner) out.teamOwnerName = teamOwner.name;

    res.json({
      token,
      user: out,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * The signed-in user, plus the timezone the dashboard is actually running in:
 *   dashboardTimezone  what every report on this account uses right now
 *   ownTimezone        this user's own choice (null = account default);
 *                      always null for a team member, who follows its owner
 *   accountTimezone    the account default (Settings → timezone)
 */
async function timezoneInfo(req) {
  const accountTimezone = await getReportTimezone();
  const own = userTimezone(req);
  return {
    dashboardTimezone: own || accountTimezone,
    ownTimezone: isTeam(req.user) ? null : own,
    accountTimezone,
  };
}

exports.me = async (req, res, next) => {
  try {
    const user = typeof req.user.toJSON === 'function' ? req.user.toJSON() : { ...req.user };
    Object.assign(user, await timezoneInfo(req));
    // A team member sees whose team it is on — the name only.
    if (req.teamOwner) user.teamOwnerName = req.teamOwner.name;
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/me/timezone  { timezone }  — this user's own dashboard timezone.
 *
 * Stored on the user's OWN document, never in the account-wide Settings, so a
 * partner can pick any zone without touching the manager's or another
 * partner's reports. '' or null resets to the account default. A team member
 * is refused by middleware/auth.js (view-only) — it follows its owner.
 */
exports.updateMyTimezone = async (req, res, next) => {
  try {
    const raw = req.body?.timezone;
    const tz = raw === null || raw === undefined || raw === '' ? null : String(raw).trim();
    if (tz !== null && !isValidTimezone(tz)) {
      return res.status(400).json({ error: 'Unknown timezone' });
    }
    await User.updateOne({ _id: req.user._id }, { $set: { timezone: tz } });
    req.user.timezone = tz;
    res.json({ timezone: tz, ...(await timezoneInfo(req)) });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user._id);
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

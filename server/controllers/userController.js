const mongoose = require('mongoose');
const User = require('../models/User');
const Offer = require('../models/Offer');
const { z } = require('zod');
const {
  ALL_ROLES, DEFAULT_ROLE, MANAGER, PARTNER, TEAM, normalizeRole, normalizeTeamReportFields,
  isManager,
} = require('../config/roles');

/**
 * User Management — two audiences, one controller.
 *
 *   manager  Administers the whole account: every user, every role.
 *   partner  Runs ITS OWN team and nothing else. It can list, create, edit,
 *            (de)activate and delete `team` accounts whose teamOwner is the
 *            partner itself. It cannot see or touch managers, other partners,
 *            or any other partner's team members, and anything it creates is
 *            forced to role `team` owned by itself.
 *
 * The partner boundary is enforced in ONE place — manageableFilter() — and
 * that filter sits inside every query that loads a user, so a partner asking
 * for someone else's id gets the same 404 as for an id that does not exist.
 */

const objectId = z.string().refine(v => mongoose.isValidObjectId(v), 'Invalid id');

const createUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  role: z.enum(ALL_ROLES).optional().default(DEFAULT_ROLE),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  offerAccess: z.enum(['all', 'specific']).optional().default('all'),
  allowedOffers: z.array(objectId).optional().default([]),
  // Team members only — which report fields this person may see.
  teamReportFields: z.record(z.boolean()).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(ALL_ROLES).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  offerAccess: z.enum(['all', 'specific']).optional(),
  allowedOffers: z.array(objectId).optional(),
  teamReportFields: z.record(z.boolean()).optional(),
});

/**
 * Which user documents the acting user may see and change.
 *
 * Manager: everyone. Partner: only team accounts it owns. Anything else (a team
 * member never reaches this controller — see routes/users.js) gets a filter
 * that matches nothing, so a future route mistake fails closed.
 */
function manageableFilter(actor) {
  const role = normalizeRole(actor?.role);
  if (role === MANAGER) return {};
  if (role === PARTNER) return { role: TEAM, teamOwner: actor._id };
  return { _id: new mongoose.Types.ObjectId() };
}

/** Load one user the actor may manage, or null. */
function findManageable(actor, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return User.findOne({ _id: id, ...manageableFilter(actor) });
}

/**
 * True when `excludeId` is the only ACTIVE manager left. Every path that could
 * remove a manager checks this — demote, delete, deactivate — because User
 * Management for the whole account is manager-only, so losing the last one is
 * unrecoverable from inside the app.
 */
async function isLastManager(excludeId) {
  const others = await User.countDocuments({
    _id: { $ne: excludeId },
    role: MANAGER,
    status: 'active',
  });
  return others === 0;
}

/**
 * Keep a user document consistent with its role.
 *
 * A team account is defined by TWO things beyond the role string: whose book
 * it reads (`teamOwner`) and which fields it may see. `teamOwner` is set to the
 * manager or partner doing the creating and is never taken from the request —
 * making it selectable would let anyone hand out a window into someone else's
 * data from a dropdown.
 *
 * Demoting a team account back to partner clears both, so a later re-promotion
 * cannot silently resurrect an old owner the current manager never chose.
 */
function applyTeamShape(user, actor, postedFields) {
  if (normalizeRole(user.role) === TEAM) {
    if (!user.teamOwner) user.teamOwner = actor._id;
    if (postedFields || !user.teamReportFields) {
      user.teamReportFields = normalizeTeamReportFields(
        postedFields || (user.teamReportFields?.toObject?.() ?? user.teamReportFields)
      );
    }
    // A team member always follows its owner's dashboard timezone.
    user.timezone = null;
  } else {
    user.teamOwner = null;
  }
  return user;
}

/**
 * A team member limited to specific offers may only be limited to offers its
 * OWNER actually has. Ids that belong to anyone else are dropped silently —
 * scope.js would ignore them anyway, but they should not even be stored.
 */
async function sanitizeAllowedOffers(user) {
  if (normalizeRole(user.role) !== TEAM) return user;
  const ids = (user.allowedOffers || []).map(String);
  if (!ids.length) return user;
  const own = await Offer.find({ _id: { $in: ids }, createdBy: user.teamOwner }).select('_id').lean();
  user.allowedOffers = own.map(o => o._id);
  return user;
}

/** Friendlier than the generic 409 "Duplicate value for email". */
async function emailTaken(email, excludeId) {
  if (!email) return false;
  const q = { email };
  if (excludeId) q._id = { $ne: excludeId };
  return !!(await User.exists(q));
}

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find(manageableFilter(req.user))
      .select('-password')
      .populate('teamOwner', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    // A partner only ever sees its own team, so "whose team" is redundant for
    // it; a manager gets the owner's name to tell teams apart. Returned as
    // teamOwnerName + the bare id, so the id stays in the same shape it
    // always had.
    const out = users.map(u => {
      const owner = u.teamOwner && typeof u.teamOwner === 'object' ? u.teamOwner : null;
      return {
        ...u,
        teamOwner: owner ? owner._id : u.teamOwner,
        teamOwnerName: owner ? (owner.name || owner.email) : (u.teamOwner ? '(deleted user)' : null),
      };
    });
    res.json({ users: out });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);

    // A partner can only ever create a member of its own team, whatever the
    // request says.
    if (!isManager(req.user)) data.role = TEAM;

    if (await emailTaken(data.email)) {
      return res.status(409).json({ error: 'This email is already in use' });
    }

    const user = new User({ ...data, createdBy: req.user._id });
    user.teamOwner = null; // never from the request — applyTeamShape decides
    applyTeamShape(user, req.user, data.teamReportFields);
    await sanitizeAllowedOffers(user);
    await user.save();

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await findManageable(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await findManageable(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // A partner manages team accounts only; the role is not its to change.
    if (!isManager(req.user)) delete data.role;

    if (data.email && await emailTaken(data.email, user._id)) {
      return res.status(409).json({ error: 'This email is already in use' });
    }

    const self = req.user._id.toString() === user._id.toString();

    if (data.role && normalizeRole(data.role) !== normalizeRole(user.role)) {
      // You cannot change your own role — otherwise the only manager could
      // demote themselves and leave User Management permanently unreachable.
      if (self) {
        return res.status(403).json({ error: 'You cannot change your own role' });
      }
      if (normalizeRole(user.role) === MANAGER && await isLastManager(user._id)) {
        return res.status(403).json({ error: 'Cannot demote the last manager' });
      }
      // Someone who owns a team cannot become a team member: their team would
      // be left pointing at a viewer. Remove or reassign the team first.
      if (normalizeRole(data.role) === TEAM) {
        const owned = await User.countDocuments({ teamOwner: user._id });
        if (owned > 0) {
          return res.status(409).json({
            error: `${user.name} has ${owned} team member${owned === 1 ? '' : 's'}. Delete them first, then change the role.`,
          });
        }
      }
    }

    if (data.status === 'inactive') {
      if (self) return res.status(403).json({ error: 'You cannot deactivate your own account' });
      if (normalizeRole(user.role) === MANAGER && await isLastManager(user._id)) {
        return res.status(403).json({ error: 'Cannot deactivate the last manager' });
      }
    }

    Object.assign(user, data);
    applyTeamShape(user, req.user, data.teamReportFields);
    await sanitizeAllowedOffers(user);
    await user.save();

    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await findManageable(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.user._id.toString() === user._id.toString()) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }
    if (normalizeRole(user.role) === MANAGER && await isLastManager(user._id)) {
      return res.status(403).json({ error: 'Cannot delete the last manager' });
    }

    // Deleting a partner does not delete its team, but middleware/auth.js
    // refuses a team member whose owner no longer exists, so that team stops
    // working immediately. The manager sees them listed as "(deleted user)".
    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['active', 'inactive']) }).parse(req.body);
    const user = await findManageable(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (status === 'inactive') {
      if (req.user._id.toString() === user._id.toString()) {
        return res.status(403).json({ error: 'You cannot deactivate your own account' });
      }
      if (normalizeRole(user.role) === MANAGER && await isLastManager(user._id)) {
        return res.status(403).json({ error: 'Cannot deactivate the last manager' });
      }
    }
    user.status = status;
    await user.save();
    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

// Exported for tests.
exports._manageableFilter = manageableFilter;

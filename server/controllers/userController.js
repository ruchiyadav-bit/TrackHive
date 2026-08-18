const User = require('../models/User');
const { z } = require('zod');
const { ALL_ROLES, DEFAULT_ROLE, MANAGER, normalizeRole } = require('../config/roles');

const createUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  role: z.enum(ALL_ROLES).optional().default(DEFAULT_ROLE),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  offerAccess: z.enum(['all', 'specific']).optional().default('all'),
  allowedOffers: z.array(z.string()).optional().default([]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(ALL_ROLES).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  offerAccess: z.enum(['all', 'specific']).optional(),
  allowedOffers: z.array(z.string()).optional(),
});

/**
 * True when `excludeId` is the only ACTIVE manager left. Every path that could
 * remove a manager checks this — demote, delete, deactivate — because User
 * Management is manager-only, so losing the last one is unrecoverable from
 * inside the app.
 */
async function isLastManager(excludeId) {
  const others = await User.countDocuments({
    _id: { $ne: excludeId },
    role: MANAGER,
    status: 'active',
  });
  return others === 0;
}

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Only a manager reaches this handler (requireManager on the route), and a
    // manager may create either role, so there is nothing further to gate here.
    const user = new User({ ...data, createdBy: req.user._id });
    await user.save();

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // You cannot change your own role — otherwise the only manager could
    // demote themselves and leave User Management permanently unreachable.
    if (data.role && normalizeRole(data.role) !== normalizeRole(user.role)) {
      if (req.user._id.toString() === user._id.toString()) {
        return res.status(403).json({ error: 'You cannot change your own role' });
      }
      if (normalizeRole(user.role) === MANAGER && await isLastManager(user._id)) {
        return res.status(403).json({ error: 'Cannot demote the last manager' });
      }
    }

    Object.assign(user, data);
    await user.save();

    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.user._id.toString() === user._id.toString()) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }
    if (normalizeRole(user.role) === MANAGER && await isLastManager(user._id)) {
      return res.status(403).json({ error: 'Cannot delete the last manager' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['active', 'inactive']) }).parse(req.body);
    const user = await User.findById(req.params.id);
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

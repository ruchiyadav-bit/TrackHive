const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeRole, MANAGER } = require('../config/roles');

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

module.exports = { auth, authorize, requireManager };

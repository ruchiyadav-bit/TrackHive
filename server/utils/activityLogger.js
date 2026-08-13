const ActivityLog = require('../models/ActivityLog');

/**
 * Log an activity. Call from controllers after actions.
 * @param {Object} opts
 * @param {Object} opts.user - req.user (or { _id, name } for login events)
 * @param {string} opts.action - e.g. 'offer_created'
 * @param {string} opts.entityType - 'offer', 'user', 'report', etc.
 * @param {string} [opts.entityId]
 * @param {string} [opts.entityName]
 * @param {Object} [opts.details] - extra info
 * @param {Array}  [opts.changes] - [{field, from, to}]
 * @param {string} [opts.ip]
 */
async function logActivity(opts) {
  try {
    await ActivityLog.create({
      userId: opts.user?._id,
      userName: opts.user?.name || opts.user?.email || 'System',
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityName: opts.entityName,
      details: opts.details,
      changes: opts.changes,
      ip: opts.ip,
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

/**
 * Compute field-level changes between old and new objects
 */
function diffChanges(oldObj, newObj, fields) {
  const changes = [];
  for (const field of fields) {
    const from = oldObj[field];
    const to = newObj[field];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field, from, to });
    }
  }
  return changes;
}

module.exports = { logActivity, diffChanges };

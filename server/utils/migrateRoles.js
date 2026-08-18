const User = require('../models/User');
const { ALL_ROLES, LEGACY_ROLE_MAP, DEFAULT_ROLE, MANAGER } = require('../config/roles');

/**
 * Collapse the old four-role scheme onto manager/partner.
 *
 *   super_admin, admin, manager  →  manager
 *   viewer                       →  partner
 *
 * Runs on every boot and is a no-op once clean, because it has to happen
 * BEFORE anyone logs in: login writes `lastLogin` via save(), which revalidates
 * the whole document, and a leftover role like 'super_admin' now fails the
 * enum — locking the owner out of their own account with a validation error.
 *
 * updateOne with a raw filter is used on purpose: Model.updateOne bypasses the
 * enum validator, which is exactly what is needed to fix documents that no
 * longer satisfy it.
 */
async function migrateRoles() {
  try {
    const stale = await User.find({ role: { $nin: ALL_ROLES } })
      .select('_id email role')
      .lean();

    if (stale.length) {
      for (const user of stale) {
        const mapped = LEGACY_ROLE_MAP[user.role] || DEFAULT_ROLE;
        await User.updateOne({ _id: user._id }, { $set: { role: mapped } });
        console.log(`[ROLES] ${user.email}: ${user.role} → ${mapped}`);
      }
      console.log(`[ROLES] migrated ${stale.length} account(s)`);
    }

    // A dashboard with no manager cannot create one — User Management is itself
    // manager-only. Promote the oldest account rather than leave it unreachable.
    const managerCount = await User.countDocuments({ role: MANAGER });
    if (managerCount === 0) {
      const oldest = await User.findOne().sort({ createdAt: 1 }).select('_id email');
      if (oldest) {
        await User.updateOne({ _id: oldest._id }, { $set: { role: MANAGER } });
        console.warn(`[ROLES] no manager existed — promoted ${oldest.email}`);
      }
    }
  } catch (error) {
    // Never block boot on this; a failure here leaves roles as they were.
    console.error('[ROLES] migration failed:', error.message);
  }
}

module.exports = { migrateRoles };

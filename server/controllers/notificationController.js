const Notification = require('../models/Notification');
const { visibleOfferIds, offerScopeMatch } = require('../utils/scope');

/**
 * Which notifications this user may touch: their own offers' alerts, plus
 * account-level notices that carry no offerId. Used by the read AND the write
 * handlers — marking or deleting is a mutation of someone else's data if the
 * same filter is not in the write query itself.
 */
async function notificationScope(user) {
  const scopeIds = await visibleOfferIds(user);
  if (scopeIds === null) return {};
  return {
    $or: [
      offerScopeMatch(scopeIds),
      { offerId: { $exists: false } },
      { offerId: null },
    ],
  };
}

exports.listNotifications = async (req, res, next) => {
  try {
    const { type, unread, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (unread === 'true') filter.readBy = { $ne: req.user._id };

    // Cap alerts and spike alerts carry offerId/offerName, so an unscoped feed
    // would tell a partner the names and traffic levels of other partners'
    // offers. Account-level notices (no offerId) stay visible to everyone.
    Object.assign(filter, await notificationScope(req.user));

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, readBy: { $ne: req.user._id } }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await Notification.updateOne(
      { _id: id, ...(await notificationScope(req.user)) },
      { $addToSet: { readBy: req.user._id } }
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    // Without the scope this walked every document in the collection.
    await Notification.updateMany(
      { readBy: { $ne: req.user._id }, ...(await notificationScope(req.user)) },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    // The filter has to be in the delete itself. Checking first and deleting
    // after leaves a race, and the old code did not even check.
    const result = await Notification.deleteOne({
      _id: req.params.id,
      ...(await notificationScope(req.user)),
    });
    if (!result.deletedCount) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    // Same scope as the list, otherwise the badge counts notifications the
    // user can never open.
    const filter = { readBy: { $ne: req.user._id }, ...(await notificationScope(req.user)) };
    const count = await Notification.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

const Notification = require('../models/Notification');

exports.listNotifications = async (req, res, next) => {
  try {
    const { type, unread, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (unread === 'true') filter.readBy = { $ne: req.user._id };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ readBy: { $ne: req.user._id } }),
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
    await Notification.updateOne(
      { _id: id },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await Notification.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ readBy: { $ne: req.user._id } });
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

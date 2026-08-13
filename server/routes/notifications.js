const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  listNotifications, markRead, markAllRead, deleteNotification, getUnreadCount,
} = require('../controllers/notificationController');

router.get('/', auth, listNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.put('/read-all', auth, markAllRead);
router.put('/:id/read', auth, markRead);
router.delete('/:id', auth, deleteNotification);

module.exports = router;

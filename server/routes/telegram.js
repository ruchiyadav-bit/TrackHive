const express = require('express');
const router = express.Router();
const { auth, requireManager } = require('../middleware/auth');
const { getSettings, saveSettings, testConnection } = require('../controllers/telegramController');

// Telegram config is ONE account-wide record (bot token + chat id), and the
// Telegram tab is hidden from partners anyway. Manager-only on the API too, so
// a partner cannot read the chat id or repoint every alert in the account.
router.get('/', auth, requireManager, getSettings);
router.put('/', auth, requireManager, saveSettings);
router.post('/test', auth, requireManager, testConnection);

module.exports = router;

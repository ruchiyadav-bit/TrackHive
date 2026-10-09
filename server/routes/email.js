const express = require('express');

const router = express.Router();
const { auth, requireManager } = require('../middleware/auth');
const { getSettings, saveSettings, testConnection } = require('../controllers/emailController');

// One account-wide SMTP record, exactly like Telegram: manager-only, so a
// partner can neither read the credentials nor repoint every alert in the
// account at an address of their own.
router.get('/', auth, requireManager, getSettings);
router.put('/', auth, requireManager, saveSettings);
router.post('/test', auth, requireManager, testConnection);

module.exports = router;

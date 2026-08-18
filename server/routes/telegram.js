const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getSettings, saveSettings, testConnection } = require('../controllers/telegramController');

router.get('/', auth, getSettings);
router.put('/', auth, saveSettings);
router.post('/test', auth, testConnection);

module.exports = router;

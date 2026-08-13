const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { getSettings, saveSettings, testConnection } = require('../controllers/telegramController');

router.get('/', auth, authorize('super_admin', 'admin'), getSettings);
router.put('/', auth, authorize('super_admin', 'admin'), saveSettings);
router.post('/test', auth, authorize('super_admin', 'admin'), testConnection);

module.exports = router;

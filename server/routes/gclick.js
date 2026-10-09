const express = require('express');
const router = express.Router();
const { handleGClick, health } = require('../controllers/gclickController');

// GET /gclick?offer_id=xxx&url=<final URL> — Google Ads tracking template.
// Separate from /click; only answers on the GCLICK_HOSTS domains.
router.get('/health', health);
router.get('/', handleGClick);

module.exports = router;

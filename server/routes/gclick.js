const express = require('express');
const router = express.Router();
const { handleGClick, health } = require('../controllers/gclickController');

// GET /gclick?offer_id=xxx&url=<final URL> — Google Ads tracking template.
// Separate from /click; only answers on the GCLICK_HOSTS domains.
router.get('/health', health);
router.get('/', handleGClick);

// Never let an unknown /gclick/* request fall through to the frontend SPA.
router.all('*', (req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = router;

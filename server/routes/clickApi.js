const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getClick, listClicks } = require('../controllers/clickController');

// Mounted at /click after mongoSanitize + rate limiting, so `?offer_id[$ne]=`
// style operator injection is stripped and enumeration is throttled. Paths are
// unchanged (/click/api/list, /click/api/:clickId) so the client is unaffected.
router.get('/api/list', auth, listClicks);
router.get('/api/:clickId', auth, getClick);

module.exports = router;

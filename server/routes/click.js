const express = require('express');
const router = express.Router();
const { handleClick, getClick, listClicks } = require('../controllers/clickController');
const { auth } = require('../middleware/auth');

// GET /click?offer_id=xxx — public click redirect
router.get('/', handleClick);

// API routes (authenticated)
router.get('/api/list', auth, listClicks);
router.get('/api/:clickId', auth, getClick);

module.exports = router;

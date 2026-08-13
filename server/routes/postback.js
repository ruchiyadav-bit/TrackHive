const express = require('express');
const router = express.Router();
const { handlePostback } = require('../controllers/postbackController');

// GET /postback?click_id=xxx&payout=1.50 — public S2S postback
router.get('/', handlePostback);

module.exports = router;

const express = require('express');
const router = express.Router();
const { handlePostback } = require('../controllers/postbackController');

// GET /postback?click_id=xxx&payout=1.50 — public S2S postback
router.get('/', handlePostback);

// POST /postback — some networks (Impact, etc.) send POST postbacks
// Local express.json() so it works even though tracking routes are
// mounted before the global body parser.
router.post('/', express.json(), handlePostback);

module.exports = router;

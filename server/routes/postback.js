const express = require('express');
const router = express.Router();
const { handlePostback, handleSaleGainsPostback } = require('../controllers/postbackController');

// SaleGains does not preserve static query-string parameters from the saved
// URL, so its advertiser secret is carried in the path. Dynamic values still
// arrive as query parameters selected in SaleGains' mapping interface.
router.get('/salegains/:secret', handleSaleGainsPostback);
router.post('/salegains/:secret', express.json(), handleSaleGainsPostback);

// GET /postback?click_id=xxx&payout=1.50 — public S2S postback
router.get('/', handlePostback);

// POST /postback — some networks (Impact, etc.) send POST postbacks
// Local express.json() so it works even though tracking routes are
// mounted before the global body parser.
router.post('/', express.json(), handlePostback);

module.exports = router;

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getSummary, getChart, getTopOffers, getRecentClicks, getGeoBreakdown,
} = require('../controllers/dashboardController');

router.get('/summary', auth, getSummary);
router.get('/chart', auth, getChart);
router.get('/top-offers', auth, getTopOffers);
router.get('/recent-clicks', auth, getRecentClicks);
router.get('/geo', auth, getGeoBreakdown);

module.exports = router;

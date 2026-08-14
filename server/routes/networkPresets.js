const express = require('express');
const router = express.Router();
const presets = require('../config/networkPresets');

// GET /api/network-presets — public (needed before advertiser is created)
router.get('/', (req, res) => {
  res.json({ presets });
});

module.exports = router;

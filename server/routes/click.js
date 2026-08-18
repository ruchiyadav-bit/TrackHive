const express = require('express');
const router = express.Router();
const { handleClick, getClick, listClicks } = require('../controllers/clickController');
const { auth } = require('../middleware/auth');

// GET /click/whoami — public diagnostic. Echoes exactly what the tracker sees
// for THIS visitor (IP, resolved country, device, OS, browser) so geo/device
// targeting can be verified from a VPN without guessing. It only reveals the
// caller's own details, nothing about offers or other traffic.
router.get('/whoami', (req, res) => {
  const { parseVisitorInfo } = require('../utils/clickHelpers');
  const v = parseVisitorInfo(req);
  res.set('Cache-Control', 'no-store');
  res.json({
    ip: v.ip,
    country: v.country,
    region: v.region || null,
    city: v.city || null,
    device: v.device,
    os: v.os,
    browser: v.browser,
    note: v.country === 'XX'
      ? 'This IP is not in the local GeoIP database, so no country could be resolved. An include-list geo rule will block it.'
      : undefined,
  });
});

// GET /click?offer_id=xxx — public click redirect
router.get('/', handleClick);

// API routes (authenticated)
router.get('/api/list', auth, listClicks);
router.get('/api/:clickId', auth, getClick);

module.exports = router;

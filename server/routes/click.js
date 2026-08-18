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
    // How the IP was arrived at — makes a wrong TRUST_PROXY / extra proxy hop
    // obvious instead of silently producing country 'XX'.
    ipSource: {
      reqIp: req.ip,
      xForwardedFor: req.headers['x-forwarded-for'] || null,
      xRealIp: req.headers['x-real-ip'] || null,
      trustProxy: Number(process.env.TRUST_PROXY || 1),
    },
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

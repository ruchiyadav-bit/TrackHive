const express = require('express');
const router = express.Router();
const { auth, requireManager } = require('../middleware/auth');
const { isTeam } = require('../config/roles');
const { getGoogleHost, setGoogleHost, normalizeHost, isValidHost } = require('../utils/googleTracking');

// GET /api/google-tracking — the Google Ads tracking domain (for the offer page).
router.get('/', auth, async (req, res, next) => {
  try {
    if (isTeam(req.user)) return res.status(404).json({ error: 'Not found' });
    res.json({ domain: await getGoogleHost() });
  } catch (err) { next(err); }
});

// PUT /api/google-tracking { domain } — manager only. '' turns /gclick off.
router.put('/', auth, requireManager, async (req, res, next) => {
  try {
    const host = normalizeHost(req.body?.domain);
    if (host && !isValidHost(host)) {
      return res.status(400).json({ error: 'Enter a valid domain, e.g. go.trackscales.com' });
    }
    res.json({ domain: await setGoogleHost(host) });
  } catch (err) { next(err); }
});

module.exports = router;

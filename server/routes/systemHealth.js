const express = require('express');

const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { MANAGER, PARTNER } = require('../config/roles');
const {
  getServer, getTracking, getData, getOfferUrls, getPostbackErrors,
  getHistory, getErrors, getDomainChecks,
  getUptime, addMonitor, updateMonitor, deleteMonitor, runUptimeCheck,
} = require('../controllers/systemHealthController');

/**
 * System Health.
 *
 * Mounted at /api/system-health — NOT /api/health, which is the public probe
 * the tracking-domain verifier fetches to confirm a domain reaches this exact
 * process. Putting these behind the same prefix would either expose the
 * account's internals or break that verification.
 *
 * Managers see infrastructure and administration. Partners see only the
 * tracking/data/offer health endpoints below, which are scoped by the
 * controller to their own offers and postbacks. Team members remain excluded.
 */
const operator = authorize(MANAGER, PARTNER);

// Infrastructure is account-wide, so it stays with the role that administers
// the account. So is its history, and so are stack traces.
router.get('/server', auth, authorize(MANAGER), getServer);
router.get('/history', auth, authorize(MANAGER), getHistory);
router.get('/errors', auth, authorize(MANAGER), getErrors);
router.get('/domain-checks', auth, authorize(MANAGER), getDomainChecks);

// Uptime monitors. Manager-only throughout: these decide who gets woken up at
// 3 AM, which is an administration question, not a reporting one.
router.get('/uptime', auth, authorize(MANAGER), getUptime);
router.post('/uptime', auth, authorize(MANAGER), addMonitor);
router.post('/uptime/check', auth, authorize(MANAGER), runUptimeCheck);
router.put('/uptime/:id', auth, authorize(MANAGER), updateMonitor);
router.delete('/uptime/:id', auth, authorize(MANAGER), deleteMonitor);

router.get('/tracking', auth, operator, getTracking);
router.get('/data', auth, operator, getData);
router.get('/offer-urls', auth, operator, getOfferUrls);
router.get('/postback-errors', auth, operator, getPostbackErrors);

module.exports = router;

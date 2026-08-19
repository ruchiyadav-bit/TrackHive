const express = require('express');
const router = express.Router();
const { auth, requireManager } = require('../middleware/auth');
const ctrl = require('../controllers/trackingDomainController');

// Reading the list is open to both roles: a partner needs to SELECT a domain
// the manager added when setting up an advertiser or offer. Everything that
// changes the list stays manager-only — partners get a read-only dropdown.
router.get('/', auth, ctrl.list);

router.post('/', auth, requireManager, ctrl.add);
router.post('/:id/verify', auth, requireManager, ctrl.verify);
router.delete('/:id', auth, requireManager, ctrl.remove);

module.exports = router;

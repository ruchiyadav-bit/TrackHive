const express = require('express');
const router = express.Router();
const { auth, requireManager } = require('../middleware/auth');
const ctrl = require('../controllers/trackingDomainController');

// Manager-only in full, including the list. The tracking domain decides where
// every click in the account is served from; partners neither see nor set it.
router.get('/', auth, requireManager, ctrl.list);
router.post('/', auth, requireManager, ctrl.add);
router.post('/:id/verify', auth, requireManager, ctrl.verify);
router.delete('/:id', auth, requireManager, ctrl.remove);

module.exports = router;

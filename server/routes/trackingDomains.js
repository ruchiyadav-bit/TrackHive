const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/trackingDomainController');

router.get('/', auth, ctrl.list);
router.post('/', auth, authorize('super_admin', 'admin'), ctrl.add);
router.post('/:id/verify', auth, authorize('super_admin', 'admin'), ctrl.verify);
router.delete('/:id', auth, authorize('super_admin', 'admin'), ctrl.remove);

module.exports = router;

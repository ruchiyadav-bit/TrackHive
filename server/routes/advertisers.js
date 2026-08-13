const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/advertiserController');

router.get('/', auth, ctrl.list);
router.get('/:id', auth, ctrl.get);
router.post('/', auth, authorize('super_admin', 'admin', 'manager'), ctrl.create);
router.put('/:id', auth, authorize('super_admin', 'admin', 'manager'), ctrl.update);
router.delete('/:id', auth, authorize('super_admin', 'admin'), ctrl.remove);
router.post('/:id/regenerate-secret', auth, authorize('super_admin', 'admin'), ctrl.regenerateSecret);

module.exports = router;

const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { getAll, update, bulkUpdate } = require('../controllers/settingsController');

router.get('/', auth, getAll);
router.put('/bulk', auth, authorize('super_admin', 'admin'), bulkUpdate);
router.put('/:key', auth, authorize('super_admin', 'admin'), update);

module.exports = router;

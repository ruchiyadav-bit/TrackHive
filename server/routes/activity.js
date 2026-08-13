const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { list } = require('../controllers/activityController');

router.get('/', auth, authorize('super_admin', 'admin'), list);

module.exports = router;

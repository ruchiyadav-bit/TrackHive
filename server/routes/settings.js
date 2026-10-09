const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getAll, getPublic, update, bulkUpdate } = require('../controllers/settingsController');

// Both roles reach Settings; the controller refuses the manager-only keys
// (tracking domain) for partners rather than blocking the whole route.
router.get('/public', getPublic);
router.get('/', auth, getAll);
router.put('/bulk', auth, bulkUpdate);
router.put('/:key', auth, update);

module.exports = router;

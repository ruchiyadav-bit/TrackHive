const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { list } = require('../controllers/activityController');

router.get('/', auth, list);

module.exports = router;

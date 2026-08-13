const express = require('express');
const router = express.Router();
const { handleSmartLink } = require('../controllers/smartLinkController');

// GET /go/:slug — public smart link redirect
router.get('/:slug', handleSmartLink);

module.exports = router;

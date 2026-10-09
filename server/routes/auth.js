const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/me', auth, authController.me);
router.put('/change-password', auth, authController.changePassword);
router.put('/me/timezone', auth, authController.updateMyTimezone);

module.exports = router;

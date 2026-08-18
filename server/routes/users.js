const express = require('express');
const router = express.Router();
const { auth, requireManager } = require('../middleware/auth');
const userController = require('../controllers/userController');

// Manager-only in full. Partners must not be able to read the user list either
// — it exposes every colleague's email address.
router.get('/', auth, requireManager, userController.listUsers);
router.post('/', auth, requireManager, userController.createUser);
router.get('/:id', auth, requireManager, userController.getUser);
router.put('/:id', auth, requireManager, userController.updateUser);
router.delete('/:id', auth, requireManager, userController.deleteUser);
router.put('/:id/status', auth, requireManager, userController.updateUserStatus);

module.exports = router;

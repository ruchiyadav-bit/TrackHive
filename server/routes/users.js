const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get('/', auth, authorize('super_admin', 'admin'), userController.listUsers);
router.post('/', auth, authorize('super_admin', 'admin'), userController.createUser);
router.get('/:id', auth, authorize('super_admin', 'admin'), userController.getUser);
router.put('/:id', auth, authorize('super_admin', 'admin'), userController.updateUser);
router.delete('/:id', auth, authorize('super_admin', 'admin'), userController.deleteUser);
router.put('/:id/status', auth, authorize('super_admin', 'admin'), userController.updateUserStatus);

module.exports = router;

const express = require('express');
const router = express.Router();
const { auth, requireTeamManager } = require('../middleware/auth');
const userController = require('../controllers/userController');

// Manager: the whole account. Partner: its OWN team only — the controller puts
// manageableFilter() inside every query, so a partner never sees a manager,
// another partner, or anyone else's team (not even their email addresses).
// Team members are refused here outright.
router.get('/', auth, requireTeamManager, userController.listUsers);
router.post('/', auth, requireTeamManager, userController.createUser);
router.get('/:id', auth, requireTeamManager, userController.getUser);
router.put('/:id', auth, requireTeamManager, userController.updateUser);
router.delete('/:id', auth, requireTeamManager, userController.deleteUser);
router.put('/:id/status', auth, requireTeamManager, userController.updateUserStatus);

module.exports = router;

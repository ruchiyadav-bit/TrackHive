const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { list, create, get, update, remove, report } = require('../controllers/offerGroupController');

router.get('/', auth, list);
router.post('/', auth, create);
router.get('/:id', auth, get);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);
router.get('/:id/report', auth, report);

module.exports = router;

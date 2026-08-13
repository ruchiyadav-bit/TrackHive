const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { list, create, get, update, remove } = require('../controllers/templateController');

router.get('/', auth, list);
router.post('/', auth, authorize('super_admin', 'admin', 'manager'), create);
router.get('/:id', auth, get);
router.put('/:id', auth, authorize('super_admin', 'admin', 'manager'), update);
router.delete('/:id', auth, authorize('super_admin', 'admin'), remove);

module.exports = router;

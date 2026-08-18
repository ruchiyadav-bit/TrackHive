const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { list, create, get, update, remove } = require('../controllers/templateController');

router.get('/', auth, list);
router.post('/', auth, create);
router.get('/:id', auth, get);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

module.exports = router;

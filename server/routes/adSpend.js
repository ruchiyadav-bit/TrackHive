const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { listOffers, list, upsert, remove } = require('../controllers/adSpendController');

router.get('/offers', auth, listOffers);
router.get('/', auth, list);
router.post('/', auth, upsert);
router.delete('/:id', auth, remove);

module.exports = router;

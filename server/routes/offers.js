const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const offerController = require('../controllers/offerController');

router.get('/', auth, offerController.listOffers);
router.post('/', auth, offerController.createOffer);
router.get('/autocomplete/:field', auth, offerController.autocomplete);
router.get('/:id', auth, offerController.getOffer);
router.put('/:id', auth, offerController.updateOffer);
router.delete('/:id', auth, offerController.deleteOffer);
router.post('/:id/duplicate', auth, offerController.duplicateOffer);

module.exports = router;

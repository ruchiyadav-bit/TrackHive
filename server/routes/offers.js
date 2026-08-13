const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const offerController = require('../controllers/offerController');

router.get('/', auth, offerController.listOffers);
router.post('/', auth, authorize('super_admin', 'admin', 'manager'), offerController.createOffer);
router.get('/autocomplete/:field', auth, offerController.autocomplete);
router.get('/:id', auth, offerController.getOffer);
router.put('/:id', auth, authorize('super_admin', 'admin', 'manager'), offerController.updateOffer);
router.delete('/:id', auth, authorize('super_admin', 'admin'), offerController.deleteOffer);
router.post('/:id/duplicate', auth, authorize('super_admin', 'admin', 'manager'), offerController.duplicateOffer);

module.exports = router;

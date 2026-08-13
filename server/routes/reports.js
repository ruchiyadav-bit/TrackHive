const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  offerReport, dailyReport, subIdReport, geoReport, deviceReport, exportCsv,
} = require('../controllers/reportController');
const {
  bulkImport, bulkConfirm, importTemplate,
} = require('../controllers/bulkImportController');

router.get('/offer-report', auth, offerReport);
router.get('/daily-report', auth, dailyReport);
router.get('/subid-report', auth, subIdReport);
router.get('/geo-report', auth, geoReport);
router.get('/device-report', auth, deviceReport);
router.get('/export', auth, exportCsv);

// Bulk Import
router.post('/bulk-import', auth, authorize('super_admin', 'admin', 'manager'), bulkImport);
router.post('/bulk-confirm', auth, authorize('super_admin', 'admin', 'manager'), bulkConfirm);
router.get('/import-template', auth, importTemplate);

module.exports = router;

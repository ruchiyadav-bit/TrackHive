const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  conversionReport, offerReport, dailyReport, hourlyReport, logReport, exportCsv,
} = require('../controllers/reportController');
const {
  bulkImport, bulkConfirm, importTemplate,
} = require('../controllers/bulkImportController');

// Reports
router.get('/conversion', auth, conversionReport);
router.get('/offer', auth, offerReport);
router.get('/daily', auth, dailyReport);
router.get('/hourly', auth, hourlyReport);
router.get('/log', auth, logReport);
router.get('/export', auth, exportCsv);

// Bulk Import
router.post('/bulk-import', auth, authorize('super_admin', 'admin', 'manager'), bulkImport);
router.post('/bulk-confirm', auth, authorize('super_admin', 'admin', 'manager'), bulkConfirm);
router.get('/import-template', auth, importTemplate);

module.exports = router;

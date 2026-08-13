const Offer = require('../models/Offer');
const DailyStat = require('../models/DailyStat');
const { logActivity } = require('../utils/activityLogger');

/**
 * Parse CSV text and return parsed rows + errors
 */
function parseCsv(text, columnMapping) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: [{ row: 0, message: 'File is empty or has no data rows' }] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};

    for (const [csvCol, targetField] of Object.entries(columnMapping)) {
      const idx = headers.findIndex(h => h.toLowerCase() === csvCol.toLowerCase());
      if (idx >= 0 && idx < values.length) {
        row[targetField] = values[idx]?.trim();
      }
    }

    // Validate required fields
    if (!row.offerName) {
      errors.push({ row: i + 1, message: 'Missing offer name' });
      continue;
    }
    if (!row.date) {
      errors.push({ row: i + 1, message: 'Missing date' });
      continue;
    }

    // Parse numerics
    const numFields = ['clicks', 'uniqueClicks', 'conversions', 'revenue', 'payout'];
    for (const f of numFields) {
      if (row[f]) {
        const n = parseFloat(row[f]);
        if (isNaN(n)) {
          errors.push({ row: i + 1, message: `Invalid number in ${f}: "${row[f]}"` });
        } else {
          row[f] = n;
        }
      } else {
        row[f] = 0;
      }
    }

    rows.push({ ...row, _row: i + 1 });
  }

  return { rows, errors, headers };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Auto-detect column mapping from headers
 */
function autoDetectMapping(headers) {
  const mapping = {};
  const patterns = {
    offer_name: 'offerName', offer: 'offerName', name: 'offerName',
    date: 'date', report_date: 'date',
    clicks: 'clicks', click: 'clicks',
    unique_clicks: 'uniqueClicks', unique: 'uniqueClicks',
    conversions: 'conversions', conv: 'conversions', conversion: 'conversions',
    revenue: 'revenue', rev: 'revenue',
    payout: 'payout', cost: 'payout',
    source: 'source', source_id: 'source',
    sub1: 'subId1', sub_id_1: 'subId1', subid1: 'subId1',
    sub2: 'subId2', sub_id_2: 'subId2', subid2: 'subId2',
    sub3: 'subId3', sub_id_3: 'subId3', subid3: 'subId3',
    sub4: 'subId4', sub5: 'subId5',
    notes: 'notes',
  };

  for (const header of headers) {
    const key = header.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (patterns[key]) {
      mapping[header] = patterns[key];
    }
  }
  return mapping;
}

/**
 * POST /api/reports/bulk-import — upload CSV text, return parsed preview
 */
exports.bulkImport = async (req, res, next) => {
  try {
    const { csvText, columnMapping: userMapping } = req.body;
    if (!csvText) return res.status(400).json({ error: 'csvText is required' });

    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) || [];

    // Auto-detect or use provided mapping
    const mapping = userMapping || autoDetectMapping(headers);
    const { rows, errors } = parseCsv(csvText, mapping);

    // Match offer names to IDs
    const offerNames = [...new Set(rows.map(r => r.offerName).filter(Boolean))];
    const offers = await Offer.find({ name: { $in: offerNames }, status: { $ne: 'deleted' } }).select('name _id');
    const offerMap = {};
    offers.forEach(o => { offerMap[o.name.toLowerCase()] = o; });

    // Check for unmatched offers
    const preview = rows.map(r => {
      const matched = offerMap[r.offerName?.toLowerCase()];
      return {
        ...r,
        offerId: matched?._id,
        offerMatched: !!matched,
        matchedName: matched?.name,
      };
    });

    const unmatched = preview.filter(r => !r.offerMatched);
    if (unmatched.length > 0) {
      unmatched.forEach(r => {
        errors.push({ row: r._row, message: `Offer not found: "${r.offerName}"` });
      });
    }

    res.json({
      headers,
      mapping,
      parsed: preview.length,
      matched: preview.filter(r => r.offerMatched).length,
      errors,
      preview: preview.slice(0, 20),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reports/bulk-confirm — confirm and insert the data
 */
exports.bulkConfirm = async (req, res, next) => {
  try {
    const { csvText, columnMapping } = req.body;
    if (!csvText || !columnMapping) return res.status(400).json({ error: 'csvText and columnMapping required' });

    const { rows, errors } = parseCsv(csvText, columnMapping);

    // Match offers
    const offerNames = [...new Set(rows.map(r => r.offerName).filter(Boolean))];
    const offers = await Offer.find({ name: { $in: offerNames }, status: { $ne: 'deleted' } }).select('name _id');
    const offerMap = {};
    offers.forEach(o => { offerMap[o.name.toLowerCase()] = o; });

    let imported = 0;
    let skipped = 0;
    const skippedRows = [];

    for (const row of rows) {
      const offer = offerMap[row.offerName?.toLowerCase()];
      if (!offer) {
        skipped++;
        skippedRows.push({ row: row._row, reason: `Offer not found: "${row.offerName}"` });
        continue;
      }

      try {
        await DailyStat.findOneAndUpdate(
          { date: row.date, offerId: offer._id },
          {
            $inc: {
              clicks: row.clicks || 0,
              uniqueClicks: row.uniqueClicks || 0,
              conversions: row.conversions || 0,
              revenue: row.revenue || 0,
              payout: row.payout || 0,
              profit: (row.revenue || 0) - (row.payout || 0),
            },
            $setOnInsert: { offerName: offer.name },
          },
          { upsert: true }
        );

        // Update offer totals
        await Offer.updateOne({ _id: offer._id }, {
          $inc: {
            totalClicks: row.clicks || 0,
            totalConversions: row.conversions || 0,
            totalRevenue: row.revenue || 0,
            totalPayout: row.payout || 0,
            totalProfit: (row.revenue || 0) - (row.payout || 0),
          },
        });

        imported++;
      } catch (err) {
        skipped++;
        skippedRows.push({ row: row._row, reason: err.message });
      }
    }

    await logActivity({
      user: req.user, action: 'bulk_import', entityType: 'report',
      details: { imported, skipped, total: rows.length },
    });

    res.json({ imported, skipped, total: rows.length, errors: skippedRows });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/import-template — download CSV template
 */
exports.importTemplate = (req, res) => {
  const headers = 'offer_name,date,clicks,unique_clicks,conversions,revenue,payout,source,sub1,sub2,sub3,sub4,sub5,notes';
  const example = 'Example Offer,2026-01-15,150,120,10,250.00,150.00,google,camp1,ad1,,,';
  const csv = `${headers}\n${example}\n`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="import_template.csv"');
  res.send(csv);
};

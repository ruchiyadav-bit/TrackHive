const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const QRCode = require('qrcode');
const Offer = require('../models/Offer');
const Setting = require('../models/Setting');
const { ownsDoc, denyNotFound } = require('../utils/scope');

// GET /api/smart-links/:offerId/qr - Generate QR code
router.get('/:offerId/qr', auth, async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (!ownsDoc(offer, req.user)) return denyNotFound(res, 'Offer not found');
    if (!offer.smartLinkEnabled || !offer.smartLinkSlug) {
      return res.status(400).json({ error: 'Smart link not enabled for this offer' });
    }

    const trackingDomain = await Setting.getValue('trackingDomain', '');
    const baseUrl = trackingDomain
      ? `https://${trackingDomain}`
      : `${req.protocol}://${req.get('host')}`;
    const smartLinkUrl = `${baseUrl}/go/${offer.smartLinkSlug}`;

    const format = req.query.format || 'png';

    if (format === 'svg') {
      const svg = await QRCode.toString(smartLinkUrl, {
        type: 'svg',
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      res.set('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    // Default: PNG
    const pngBuffer = await QRCode.toBuffer(smartLinkUrl, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${offer.smartLinkSlug}-qr.png"`);
    res.send(pngBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/smart-links/:offerId/qr/dataurl - Get QR as data URL (for frontend)
router.get('/:offerId/qr/dataurl', auth, async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (!ownsDoc(offer, req.user)) return denyNotFound(res, 'Offer not found');
    if (!offer.smartLinkEnabled || !offer.smartLinkSlug) {
      return res.status(400).json({ error: 'Smart link not enabled for this offer' });
    }

    const trackingDomain = await Setting.getValue('trackingDomain', '');
    const baseUrl = trackingDomain
      ? `https://${trackingDomain}`
      : `${req.protocol}://${req.get('host')}`;
    const smartLinkUrl = `${baseUrl}/go/${offer.smartLinkSlug}`;

    const dataUrl = await QRCode.toDataURL(smartLinkUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.json({ dataUrl, url: smartLinkUrl, slug: offer.smartLinkSlug });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

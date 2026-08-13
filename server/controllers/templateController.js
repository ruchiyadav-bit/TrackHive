const OfferTemplate = require('../models/OfferTemplate');
const { logActivity } = require('../utils/activityLogger');

exports.list = async (req, res, next) => {
  try {
    const templates = await OfferTemplate.find().sort({ createdAt: -1 });
    res.json({ templates });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description, templateData } = req.body;
    if (!name || !templateData) {
      return res.status(400).json({ error: 'name and templateData are required' });
    }

    // Strip fields that shouldn't be templated
    const clean = { ...templateData };
    delete clean.name;
    delete clean.status;
    delete clean.networkOfferId;
    delete clean.creatives;
    delete clean.slug;
    delete clean.smartLinkSlug;
    delete clean.totalClicks;
    delete clean.totalConversions;
    delete clean.totalRevenue;
    delete clean.totalPayout;
    delete clean.totalProfit;

    const template = await OfferTemplate.create({
      name,
      description,
      templateData: clean,
      createdBy: req.user._id,
    });

    await logActivity({
      user: req.user, action: 'template_created', entityType: 'template',
      entityId: template._id, entityName: name,
    });

    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const template = await OfferTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description, templateData } = req.body;
    const update = {};
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (templateData) update.templateData = templateData;

    const template = await OfferTemplate.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const template = await OfferTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    await logActivity({
      user: req.user, action: 'template_deleted', entityType: 'template',
      entityId: template._id, entityName: template.name,
    });

    res.json({ message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
};

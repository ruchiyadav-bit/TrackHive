const Advertiser = require('../models/Advertiser');
const crypto = require('crypto');

exports.list = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }
    const advertisers = await Advertiser.find(filter).sort('-createdAt');
    res.json({ advertisers });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const advertiser = await Advertiser.findById(req.params.id);
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    res.json({ advertiser });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, company, website, status, network, clickIdParam, contactName, contactEmail, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const advertiser = new Advertiser({
      name: name.trim(),
      company, website, status,
      network: network || 'custom',
      clickIdParam: clickIdParam || 'click_id',
      contactName, contactEmail, notes,
      postbackSecret: crypto.randomBytes(16).toString('hex'),
      createdBy: req.user._id,
    });
    await advertiser.save();
    res.status(201).json({ advertiser });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const advertiser = await Advertiser.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    res.json({ advertiser });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const advertiser = await Advertiser.findByIdAndDelete(req.params.id);
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    res.json({ message: 'Advertiser deleted' });
  } catch (error) {
    next(error);
  }
};

exports.regenerateSecret = async (req, res, next) => {
  try {
    const advertiser = await Advertiser.findByIdAndUpdate(
      req.params.id,
      { postbackSecret: crypto.randomBytes(16).toString('hex') },
      { new: true }
    );
    if (!advertiser) return res.status(404).json({ error: 'Advertiser not found' });
    res.json({ advertiser });
  } catch (error) {
    next(error);
  }
};

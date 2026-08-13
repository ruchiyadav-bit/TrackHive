const mongoose = require('mongoose');

const offerTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    templateData: { type: mongoose.Schema.Types.Mixed, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

offerTemplateSchema.index({ name: 1 });

module.exports = mongoose.model('OfferTemplate', offerTemplateSchema);

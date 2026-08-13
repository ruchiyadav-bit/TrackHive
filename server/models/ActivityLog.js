const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    action: {
      type: String,
      required: true,
      enum: [
        'user_login', 'user_login_failed', 'user_created', 'user_edited', 'user_deleted',
        'offer_created', 'offer_edited', 'offer_deleted', 'offer_status_changed', 'offer_duplicated',
        'report_added', 'report_edited', 'report_deleted',
        'bulk_import', 'settings_changed',
        'template_created', 'template_deleted',
        'group_created', 'group_edited', 'group_deleted',
      ],
    },
    entityType: { type: String, enum: ['user', 'offer', 'report', 'settings', 'template', 'group', 'system'] },
    entityId: mongoose.Schema.Types.ObjectId,
    entityName: String,
    details: mongoose.Schema.Types.Mixed,
    changes: [{
      field: String,
      from: mongoose.Schema.Types.Mixed,
      to: mongoose.Schema.Types.Mixed,
    }],
    ip: String,
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  actor: {
    type: String, // email, username, or system ID
    required: true
  },
  actorType: {
    type: String,
    enum: ['user', 'admin', 'system'],
    default: 'system'
  },
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
  module: {
    type: String,
    default: 'general'
  }
}, {
  timestamps: true
});

// Performance Indexes for Audit Trail
systemLogSchema.index({ createdAt: 1 });
systemLogSchema.index({ action: 1 });
systemLogSchema.index({ actor: 1 });

const SystemLog = mongoose.model('SystemLog', systemLogSchema);
export default SystemLog;

const mongoose = require('mongoose');

const conflictSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['overlapping_time', 'multiple_duties_same_day', 'availability_mismatch'],
    required: true
  },
  severity: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  allocations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Allocation'
  }],
  description: {
    type: String,
    required: true
  },
  resolution: {
    suggestedActions: [String],
    autoResolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  status: {
    type: String,
    enum: ['detected', 'resolving', 'resolved', 'ignored'],
    default: 'detected'
  }
}, {
  timestamps: true
});

// Index for efficient conflict queries
conflictSchema.index({ faculty: 1, status: 1 });
conflictSchema.index({ severity: 1, status: 1 });

module.exports = mongoose.model('Conflict', conflictSchema);


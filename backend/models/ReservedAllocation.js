const mongoose = require('mongoose');

/**
 * Reserved Allocation Model
 * Tracks reserved faculty assigned as backups for each exam allocation
 */
const reservedAllocationSchema = new mongoose.Schema({
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  primaryAllocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Allocation',
    required: true
  },
  reservedFaculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  priority: {
    type: Number,
    default: 1, // 1 = highest priority
    min: 1
  },
  status: {
    type: String,
    enum: ['available', 'suggested', 'activated', 'used'],
    default: 'available'
  },
  suggestedAt: Date,
  activatedAt: Date,
  replacedAllocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Allocation'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes for efficient queries
reservedAllocationSchema.index({ exam: 1, status: 1 });
reservedAllocationSchema.index({ primaryAllocation: 1 });
reservedAllocationSchema.index({ reservedFaculty: 1, status: 1 });
reservedAllocationSchema.index({ status: 1 });

module.exports = mongoose.model('ReservedAllocation', reservedAllocationSchema);


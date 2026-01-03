const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: false // Optional - for room-based allocations
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  campus: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['assigned', 'confirmed', 'replaced', 'cancelled'],
    default: 'assigned'
  },
  notified: {
    type: Boolean,
    default: false
  },
  notifiedAt: Date,
  // Stage 1: Pre-Exam Acknowledgement (1-2 days before)
  preExamAcknowledgment: {
    status: {
      type: String,
      enum: ['pending', 'acknowledged', 'unavailable'],
      default: 'pending'
    },
    acknowledgedAt: Date,
    unavailableReason: String,
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    }
  },
  acknowledgmentDeadline: Date, // 1-2 days before exam
  acknowledgmentReminderSent: {
    type: Boolean,
    default: false
  },
  // Stage 2: Live Status (30 minutes before exam)
  liveStatus: {
    status: {
      type: String,
      enum: [null, 'present', 'on_the_way', 'unable_to_reach'],
      default: null
    },
    updatedAt: Date,
    eta: String, // For "on_the_way" - estimated arrival time
    emergencyReason: String // For "unable_to_reach"
  },
  liveStatusWindow: {
    opensAt: Date, // 30 minutes before exam
    closesAt: Date // Exam start time
  },
  // Reserved Faculty Pool
  reservedFaculty: [{
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    priority: {
      type: Number,
      default: 1 // 1 = highest priority
    },
    status: {
      type: String,
      enum: ['available', 'suggested', 'activated'],
      default: 'available'
    },
    suggestedAt: Date,
    activatedAt: Date
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
allocationSchema.index({ faculty: 1, date: 1 });
allocationSchema.index({ exam: 1 });
allocationSchema.index({ date: 1, campus: 1 });
allocationSchema.index({ status: 1 });

module.exports = mongoose.model('Allocation', allocationSchema);


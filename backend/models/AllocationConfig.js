const mongoose = require('mongoose');

const allocationConfigSchema = new mongoose.Schema({
  // Max invigilation hours per day per faculty
  maxHoursPerDay: {
    type: Number,
    default: 6,
    min: 1,
    max: 12
  },
  
  // Max duties per faculty (total)
  maxDutiesPerFaculty: {
    type: Number,
    default: null, // null means no limit
    min: 1
  },
  
  // Allow same-day repetition (multiple duties on same day)
  allowSameDayRepetition: {
    type: Boolean,
    default: true
  },
  
  // Minimum time gap between duties (in minutes)
  timeGapBetweenDuties: {
    type: Number,
    default: 30, // 30 minutes minimum gap
    min: 0
  },
  
  // Department preference weight (0-100, higher = prefer same department)
  departmentPreferenceWeight: {
    type: Number,
    default: 15,
    min: 0,
    max: 100
  },
  
  // Campus preference weight
  campusPreferenceWeight: {
    type: Number,
    default: 20,
    min: 0,
    max: 100
  },
  
  // Is this the active configuration
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one active configuration exists
allocationConfigSchema.pre('save', async function(next) {
  if (this.isActive) {
    await mongoose.model('AllocationConfig').updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { isActive: false }
    );
  }
  next();
});

module.exports = mongoose.model('AllocationConfig', allocationConfigSchema);


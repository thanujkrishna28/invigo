const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true
  },
  block: {
    type: String,
    required: true,
    trim: true
  },
  floor: {
    type: Number,
    required: true
  },
  building: {
    type: String,
    required: true
  },
  campus: {
    type: String,
    required: true,
    default: 'Vignan University'
  },
  department: {
    type: String,
    trim: true
  },
  departments: [{
    type: String // Multiple departments can use this room
  }],
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  facilities: [{
    type: String // e.g., "projector", "AC", "whiteboard"
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isExamOnly: {
    type: Boolean,
    default: false // For rooms like O-block that are only used during exams
  }
}, {
  timestamps: true
});

// Compound index for unique room identification
classroomSchema.index({ roomNumber: 1, block: 1, floor: 1, campus: 1 }, { unique: true });
classroomSchema.index({ block: 1, floor: 1 });
classroomSchema.index({ department: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);


const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  examId: {
    type: String,
    required: true,
    unique: true
  },
  examName: {
    type: String,
    required: true
  },
  courseCode: {
    type: String,
    required: true
  },
  courseName: {
    type: String,
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
  duration: {
    type: Number, // in minutes
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
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: false // Optional - exams can be created without room assignment
  },
  totalStudents: {
    type: Number,
    required: false,
    default: 30,
    min: 1
  },
  requiredInvigilators: {
    type: Number,
    required: true,
    default: 2,
    min: 1
  },
  examType: {
    type: String,
    enum: ['mid-term', 'semester', 'labs'],
    default: 'semester'
  },
  status: {
    type: String,
    enum: ['scheduled', 'allocated', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  allocatedInvigilators: [{
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    allocatedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
examSchema.index({ date: 1, campus: 1, department: 1 });
examSchema.index({ status: 1 });

module.exports = mongoose.model('Exam', examSchema);


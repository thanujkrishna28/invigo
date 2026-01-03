const mongoose = require('mongoose');

const examTimetableSchema = new mongoose.Schema({
  examId: {
    type: String,
    required: false,
    sparse: true
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
    required: false
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
    required: false
  },
  campus: {
    type: String,
    default: 'Vignan University'
  },
  department: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    default: ''
  },
  academicYear: {
    type: String,
    default: ''
  },
  batch: {
    type: String,
    default: ''
  },
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom'
  },
  totalStudents: {
    type: Number,
    default: 50,
    min: 1
  },
  requiredInvigilators: {
    type: Number,
    default: 1,
    min: 1
  },
  examType: {
    type: String,
    enum: ['mid-term', 'semester', 'labs'],
    default: 'semester'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'converted'],
    default: 'draft'
  },
  convertedToExam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    default: null
  },
  convertedAt: {
    type: Date
  },
  publishedAt: {
    type: Date
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Index for efficient queries
examTimetableSchema.index({ date: 1, campus: 1, department: 1 });
examTimetableSchema.index({ status: 1 });
// Note: examId index removed since it's optional and not unique

module.exports = mongoose.model('ExamTimetable', examTimetableSchema);


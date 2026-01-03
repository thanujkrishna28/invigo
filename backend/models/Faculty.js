const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const facultySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    default: 'faculty',
    enum: ['faculty']
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true
  },
  department: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  subjects: [{
    type: String,
    trim: true
  }],
  campus: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    timeSlots: [{
      start: String,
      end: String
    }]
  }],
  maxHoursPerDay: {
    type: Number,
    default: 6
  },
  isActive: {
    type: Boolean,
    default: true
  },
  uploadedViaExcel: {
    type: Boolean,
    default: false
  },
  uploadedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'faculties' // Separate collection for faculty
});

// Hash password before saving
facultySchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
facultySchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Faculty', facultySchema);


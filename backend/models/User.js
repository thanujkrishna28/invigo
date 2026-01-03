const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
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
    enum: ['admin', 'hod', 'faculty'],
    default: 'faculty'
  },
  isHOD: {
    type: Boolean,
    default: false
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
  // ⚠️ DEPRECATED MODEL - DO NOT USE
  // This model is completely deprecated. All user creation must use:
  // - Admin model (for admins) → 'admins' collection
  // - Hod model (for HODs) → 'hods' collection  
  // - Faculty model (for faculty) → 'faculties' collection
  // 
  // This model exists ONLY for migration scripts and should NOT be used in application code.
  // If you need to create users, use createUser() from utils/userHelper.js
  collection: 'users' // Keep original name for migration compatibility
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);


/**
 * Send a single test invigilation-duty email to a faculty member.
 * Usage:
 *   node scripts/sendTestAllocationEmail.js faculty_email@example.com
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Exam = require('../models/Exam');
const Classroom = require('../models/Classroom');
const emailService = require('../services/emailService');

const run = async () => {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Please provide a faculty email.\n   Example: node scripts/sendTestAllocationEmail.js 231fa04e50@gmail.com');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    const faculty = await User.findOne({ email: email.toLowerCase().trim() });
    if (!faculty) {
      console.error(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    console.log(`👤 Using faculty: ${faculty.name} (${faculty.email})`);

    // Pick any scheduled exam (or any exam if none scheduled)
    let exam = await Exam.findOne({ status: 'scheduled' }).populate('classroom');
    if (!exam) {
      exam = await Exam.findOne({}).populate('classroom');
    }

    if (!exam) {
      console.error('❌ No exams found in database to use for test email.');
      process.exit(1);
    }

    console.log(`📝 Using exam: ${exam.examName} (${exam.courseCode}) on ${exam.date.toISOString().slice(0, 10)}`);

    // Ensure classroom is populated
    let classroom = exam.classroom;
    if (classroom && !classroom.block) {
      classroom = await Classroom.findById(classroom);
    }

    // Build a lightweight "allocation-like" object expected by emailService
    const allocationLike = {
      date: exam.date,
      startTime: exam.startTime,
      endTime: exam.endTime,
      campus: exam.campus,
      department: exam.department
    };

    console.log('📧 Sending test allocation email...');
    const result = await emailService.sendAllocationNotification(faculty, allocationLike, exam, classroom || null);

    if (result.success) {
      console.log(`✅ Test email sent successfully to ${faculty.email} (Message ID: ${result.messageId})`);
    } else {
      console.error(`❌ Failed to send test email: ${result.message}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error while sending test email:', err.message);
    process.exit(1);
  }
};

run();



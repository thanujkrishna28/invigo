/**
 * Test allocation notification email with realistic data
 * Usage: node scripts/testAllocationEmail.js <email_address> <faculty_name>
 */

// Load environment variables FIRST before requiring emailService
require('dotenv').config();
const emailService = require('../services/emailService');

const testAllocationEmail = async (emailAddress, facultyName = 'Dr. Nani') => {
  try {
    console.log('\n📧 Testing Allocation Notification Email');
    console.log('='.repeat(60));
    console.log(`   To: ${emailAddress}`);
    console.log(`   Faculty: ${facultyName}\n`);

    // Create mock faculty object
    const faculty = {
      _id: '507f1f77bcf86cd799439011',
      name: facultyName,
      email: emailAddress,
      employeeId: 'EMP001',
      department: 'CSE',
      campus: 'Vignan University'
    };

    // Create mock allocation object
    const allocation = {
      exam: {
        _id: '507f1f77bcf86cd799439012',
        examName: 'Computer Networks Mid-Term',
        courseCode: 'CS304',
        courseName: 'Computer Networks',
        date: new Date('2024-12-15'),
        startTime: '14:00',
        endTime: '17:00',
        examType: 'mid-term'
      },
      date: new Date('2024-12-15'),
      startTime: '14:00',
      endTime: '17:00',
      campus: 'Vignan University',
      department: 'CSE'
    };

    // Create mock exam object
    const exam = {
      _id: '507f1f77bcf86cd799439012',
      examName: 'Computer Networks Mid-Term',
      courseCode: 'CS304',
      courseName: 'Computer Networks',
      date: new Date('2024-12-15'),
      startTime: '14:00',
      endTime: '17:00',
      examType: 'mid-term'
    };

    // Create mock classroom object
    const classroom = {
      _id: '507f1f77bcf86cd799439013',
      roomNumber: '101',
      block: 'A-block',
      floor: 1,
      building: 'A-block',
      campus: 'Vignan University'
    };

    console.log('📤 Sending allocation notification email...\n');

    const result = await emailService.sendAllocationNotification(
      faculty,
      allocation,
      exam,
      classroom
    );

    if (result.success) {
      console.log('✅ Allocation notification email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log('\n📬 Please check the inbox (and spam folder) of the recipient email address.');
      console.log('   The email should contain:');
      console.log('   - Duty Details (Examination, Date, Time, Room, Campus)');
      console.log('   - Professional formatting');
      console.log('   - No "Course / Subject" field');
      console.log('   - Correct room information (not TBA)\n');
    } else {
      console.error('❌ Failed to send email:');
      console.error(`   ${result.message}\n`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error sending allocation notification email:');
    console.error(`   ${error.message}\n`);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Get email address and faculty name from command line arguments
const emailAddress = process.argv[2];
const facultyName = process.argv[3] || 'Dr. Nani';

if (!emailAddress) {
  console.error('❌ Please provide an email address');
  console.error('Usage: node scripts/testAllocationEmail.js <email_address> [faculty_name]');
  console.error('Example: node scripts/testAllocationEmail.js test@example.com "Dr. Nani"\n');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(emailAddress)) {
  console.error(`❌ Invalid email address: ${emailAddress}`);
  console.error('Please provide a valid email address\n');
  process.exit(1);
}

testAllocationEmail(emailAddress, facultyName);


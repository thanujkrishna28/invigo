/**
 * Script to count all users in the database by role
 * Run: npm run count-users
 * Or: node scripts/countUsers.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const countUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  USER COUNT REPORT');
    console.log('='.repeat(60));
    console.log('');

    // Count by role
    const [totalUsers, adminCount, hodCount, facultyCount, activeUsers, inactiveUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'hod' }),
      User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false })
    ]);

    console.log('📊 USER STATISTICS:\n');
    console.log(`   Total Users:        ${totalUsers}`);
    console.log(`   ──────────────────────────────`);
    console.log(`   Admin Users:        ${adminCount}`);
    console.log(`   HOD Users:          ${hodCount}`);
    console.log(`   Faculty Users:      ${facultyCount}`);
    console.log(`   ──────────────────────────────`);
    console.log(`   Active Users:       ${activeUsers}`);
    console.log(`   Inactive Users:     ${inactiveUsers}`);
    console.log('');

    // Count by campus if exists
    const usersWithCampus = await User.find({ campus: { $exists: true, $ne: null, $ne: '' } });
    if (usersWithCampus.length > 0) {
      const campusGroups = {};
      usersWithCampus.forEach(user => {
        const campus = user.campus || 'Unknown';
        campusGroups[campus] = (campusGroups[campus] || 0) + 1;
      });

      console.log('🏫 USERS BY CAMPUS:\n');
      Object.entries(campusGroups).forEach(([campus, count]) => {
        console.log(`   ${campus}: ${count}`);
      });
      console.log('');
    }

    // Count by department if exists
    const usersWithDept = await User.find({ department: { $exists: true, $ne: null, $ne: '' } });
    if (usersWithDept.length > 0) {
      const deptGroups = {};
      usersWithDept.forEach(user => {
        const dept = user.department || 'Unknown';
        deptGroups[dept] = (deptGroups[dept] || 0) + 1;
      });

      console.log('🏛️  USERS BY DEPARTMENT:\n');
      Object.entries(deptGroups)
        .sort((a, b) => b[1] - a[1])
        .forEach(([dept, count]) => {
          console.log(`   ${dept}: ${count}`);
        });
      console.log('');
    }

    // List all admin users
    if (adminCount > 0) {
      const admins = await User.find({ role: 'admin' }).select('name email employeeId');
      console.log('👤 ADMIN USERS:\n');
      admins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.name} (${admin.email})`);
        if (admin.employeeId) console.log(`      Employee ID: ${admin.employeeId}`);
      });
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 MongoDB is not running!');
      console.error('   Please start MongoDB and try again.');
    }
    process.exit(1);
  }
};

countUsers();


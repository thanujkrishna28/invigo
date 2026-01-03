/**
 * Script to check if users exist in database
 * Run: node scripts/checkUsers.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const checkUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB\n');

    // Check for admin users
    const adminUsers = await User.find({ 
      $or: [
        { email: 'admin@vignan.edu' },
        { email: 'admin@example.com' },
        { role: 'admin' }
      ]
    });

    console.log('📋 Admin Users:');
    if (adminUsers.length === 0) {
      console.log('   ❌ No admin users found!');
      console.log('   Run: npm run create-admin\n');
    } else {
      adminUsers.forEach(user => {
        console.log(`   ✅ ${user.email} (${user.role})`);
      });
      console.log('');
    }

    // Check for faculty users
    const facultyUsers = await User.find({ 
      $or: [
        { email: 'faculty@vignan.edu' },
        { email: 'faculty@example.com' }
      ]
    });

    console.log('📋 Demo Faculty Users:');
    if (facultyUsers.length === 0) {
      console.log('   ❌ No demo faculty users found!');
      console.log('   Run: npm run create-admin\n');
    } else {
      facultyUsers.forEach(user => {
        console.log(`   ✅ ${user.email} (${user.role})`);
      });
      console.log('');
    }

    // Test password
    if (adminUsers.length > 0) {
      const admin = adminUsers[0];
      console.log('🔐 Testing password for:', admin.email);
      const isMatch = await admin.comparePassword('admin123');
      if (isMatch) {
        console.log('   ✅ Password "admin123" is correct\n');
      } else {
        console.log('   ❌ Password "admin123" does not match');
        console.log('   The password might have been changed or user was created differently\n');
      }
    }

    // Total users
    const totalUsers = await User.countDocuments();
    console.log(`📊 Total users in database: ${totalUsers}`);

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

checkUsers();


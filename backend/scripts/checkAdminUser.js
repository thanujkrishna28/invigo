/**
 * Script to check where admin user exists
 * Run: node scripts/checkAdminUser.js
 */

const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Hod = require('../models/Hod');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
require('dotenv').config();

const checkAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Check Admin User Location');
    console.log('='.repeat(60));
    console.log('');

    const identifier = '741852';
    const normalizedEmail = identifier.toLowerCase();

    console.log(`🔍 Searching for user with identifier: ${identifier}\n`);

    // Check admins collection
    console.log('📋 Checking "admins" collection...');
    const adminUsers = await Admin.find({});
    console.log(`   Found ${adminUsers.length} admin(s)`);
    adminUsers.forEach(u => {
      console.log(`   - ${u.email} (employeeId: ${u.employeeId || 'N/A'})`);
    });

    // Check if identifier matches any admin
    let found = await Admin.findOne({ 
      $or: [
        { employeeId: identifier },
        { email: normalizedEmail }
      ]
    });
    if (found) {
      console.log(`\n✅ Found in "admins" collection: ${found.email}`);
    } else {
      console.log(`\n❌ Not found in "admins" collection`);
    }

    // Check old users collection
    console.log('\n📋 Checking old "users" collection...');
    const allUsers = await User.find({ role: 'admin' });
    console.log(`   Found ${allUsers.length} admin(s) in users collection`);
    allUsers.forEach(u => {
      console.log(`   - ${u.email} (employeeId: ${u.employeeId || 'N/A'})`);
    });

    found = await User.findOne({ 
      $or: [
        { employeeId: identifier },
        { email: normalizedEmail }
      ]
    });
    if (found) {
      console.log(`\n✅ Found in old "users" collection: ${found.email} (role: ${found.role})`);
      console.log(`\n⚠️  This user needs to be migrated to "admins" collection!`);
      console.log(`   Run: node scripts/migrateUsersToCollections.js`);
    } else {
      console.log(`\n❌ Not found in old "users" collection`);
    }

    // Check all collections for any match
    console.log('\n📋 Checking all collections for identifier:', identifier);
    found = await Hod.findOne({ employeeId: identifier });
    if (found) console.log(`   Found in "hods": ${found.email}`);
    
    found = await Faculty.findOne({ employeeId: identifier });
    if (found) console.log(`   Found in "faculties": ${found.email}`);

    console.log('\n' + '='.repeat(60));
    console.log('  Summary');
    console.log('='.repeat(60));
    console.log('If admin user is in old "users" collection, run migration:');
    console.log('  node scripts/migrateUsersToCollections.js\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkAdminUser();


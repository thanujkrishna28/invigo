/**
 * Interactive script to create admin users (supports batch creation)
 * Run: npm run create-admin
 * 
 * This script allows you to create one or multiple admin users
 */

const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Hod = require('../models/Hod');
const Faculty = require('../models/Faculty');
const { findUserByEmail } = require('../utils/userHelper');
const readline = require('readline');
require('dotenv').config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function to ask for password
function askPassword(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

const createAdminUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Create Admin Users');
    console.log('='.repeat(60));
    console.log('');

    const createdUsers = [];
    let continueCreating = true;

    while (continueCreating) {
      console.log('\n📋 ADMIN USER SETUP');
      console.log('-'.repeat(60));
      
      const adminEmail = await askQuestion('Enter admin email: ');
      if (!adminEmail || !adminEmail.includes('@')) {
        console.log('❌ Invalid email address');
        const retry = await askQuestion('Do you want to try again? (yes/no): ');
        if (retry.toLowerCase() !== 'yes' && retry.toLowerCase() !== 'y') {
          break;
        }
        continue;
      }

      const adminEmployeeId = await askQuestion('Enter Employee ID (required for login): ');
      if (!adminEmployeeId || !adminEmployeeId.trim()) {
        console.log('❌ Employee ID is required');
        const retry = await askQuestion('Do you want to try again? (yes/no): ');
        if (retry.toLowerCase() !== 'yes' && retry.toLowerCase() !== 'y') {
          break;
        }
        continue;
      }

      // Check if admin already exists (check both email and employeeId)
      let shouldCreateAdmin = true;
      const normalizedEmail = adminEmail.toLowerCase().trim();
      const normalizedEmployeeId = adminEmployeeId.trim();
      
      // Check new admins collection by email
      let existingAdmin = await Admin.findOne({ email: normalizedEmail });
      
      // Check by employeeId
      if (!existingAdmin) {
        existingAdmin = await Admin.findOne({ employeeId: normalizedEmployeeId });
      }
      
      // Also check old users collection for backward compatibility
      if (!existingAdmin) {
        try {
          const User = require('../models/User');
          existingAdmin = await User.findOne({ 
            $or: [
              { email: normalizedEmail, role: 'admin' },
              { employeeId: normalizedEmployeeId, role: 'admin' }
            ]
          });
        } catch (error) {
          // User model might not exist, ignore
        }
      }
      
      if (existingAdmin) {
        console.log(`⚠️  Admin user with email ${adminEmail} or Employee ID ${normalizedEmployeeId} already exists.`);
        const overwrite = await askQuestion('Do you want to delete and recreate? (yes/no): ');
        if (overwrite.toLowerCase() === 'yes' || overwrite.toLowerCase() === 'y') {
          // Delete from new collection
          await Admin.deleteMany({ 
            $or: [
              { email: normalizedEmail },
              { employeeId: normalizedEmployeeId }
            ]
          });
          // Delete from old collection if exists
          try {
            const User = require('../models/User');
            await User.deleteMany({ 
              $or: [
                { email: normalizedEmail, role: 'admin' },
                { employeeId: normalizedEmployeeId, role: 'admin' }
              ]
            });
          } catch (error) {
            // Ignore
          }
          console.log('✅ Existing admin user deleted');
          shouldCreateAdmin = true;
        } else {
          console.log('⏭️  Skipping this admin creation');
          shouldCreateAdmin = false;
        }
      }

      if (shouldCreateAdmin) {
        const adminPassword = await askPassword('Enter admin password (min 6 characters): ');
        if (adminPassword.length < 6) {
          console.log('❌ Password must be at least 6 characters');
          const retry = await askQuestion('Do you want to try again? (yes/no): ');
          if (retry.toLowerCase() !== 'yes' && retry.toLowerCase() !== 'y') {
            break;
          }
          continue;
        }

        const adminName = await askQuestion('Enter admin name (or press Enter for default): ') || 'System Administrator';
        const adminCampus = await askQuestion('Enter campus name (or press Enter for default): ') || 'Vignan University';

        try {
          // Create admin in the new 'admins' collection
          const admin = await Admin.create({
            name: adminName,
            email: normalizedEmail,
            employeeId: normalizedEmployeeId,
            password: adminPassword,
            role: 'admin',
            campus: adminCampus,
            isActive: true
          });

          console.log('\n✅ Admin user created successfully in "admins" collection!');
          console.log(`   👤 Name: ${admin.name}`);
          console.log(`   🆔 Employee ID: ${admin.employeeId} (Use this to login)`);
          console.log(`   📧 Email: ${admin.email}`);
          console.log(`   🔑 Password: ${adminPassword}`);
          
          createdUsers.push({
            email: admin.email,
            employeeId: admin.employeeId,
            password: adminPassword,
            name: admin.name
          });
        } catch (error) {
          console.log(`❌ Error creating admin: ${error.message}`);
        }
      }

      // Ask if user wants to create another admin
      const createAnother = await askQuestion('\nDo you want to create another admin user? (yes/no): ');
      if (createAnother.toLowerCase() !== 'yes' && createAnother.toLowerCase() !== 'y') {
        continueCreating = false;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (createdUsers.length > 0) {
      console.log(`✅ Successfully created ${createdUsers.length} admin user(s):`);
      createdUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name}`);
        console.log(`   🆔 Employee ID: ${user.employeeId} (Use this to login)`);
        console.log(`   🔑 Password: ${user.password}`);
        console.log(`   📧 Email: ${user.email}`);
      });
    } else {
      console.log('⏭️  No admin users were created.');
    }
    console.log('='.repeat(60));
    console.log('');

    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    await mongoose.connection.close();
    process.exit(1);
  }
};

createAdminUsers();

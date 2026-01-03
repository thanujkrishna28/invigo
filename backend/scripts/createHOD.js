/**
 * Interactive script to create HOD (Head of Department) users
 * Run: npm run create-hod
 * 
 * This script allows you to create one or multiple HOD users
 */

const mongoose = require('mongoose');
const User = require('../models/User');
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

const createHODUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Create HOD (Head of Department) Users');
    console.log('='.repeat(60));
    console.log('');

    const createdUsers = [];
    let continueCreating = true;

    while (continueCreating) {
      console.log('\n📋 HOD USER SETUP');
      console.log('-'.repeat(60));
      
      const hodEmail = await askQuestion('Enter HOD email: ');
      if (!hodEmail || !hodEmail.includes('@')) {
        console.log('❌ Invalid email address');
        const retry = await askQuestion('Do you want to try again? (yes/no): ');
        if (retry.toLowerCase() !== 'yes' && retry.toLowerCase() !== 'y') {
          break;
        }
        continue;
      }

      // Check if HOD already exists
      let shouldCreateHOD = true;
      const existingHOD = await User.findOne({ email: hodEmail.toLowerCase().trim() });
      if (existingHOD) {
        console.log(`⚠️  User with email ${hodEmail} already exists.`);
        const overwrite = await askQuestion('Do you want to delete and recreate? (yes/no): ');
        if (overwrite.toLowerCase() === 'yes' || overwrite.toLowerCase() === 'y') {
          await User.deleteOne({ email: hodEmail.toLowerCase().trim() });
          console.log('✅ Existing user deleted');
          shouldCreateHOD = true;
        } else {
          console.log('⏭️  Skipping this HOD creation');
          shouldCreateHOD = false;
        }
      }

      if (shouldCreateHOD) {
        const hodPassword = await askPassword('Enter HOD password (min 6 characters): ');
        if (hodPassword.length < 6) {
          console.log('❌ Password must be at least 6 characters');
          const retry = await askQuestion('Do you want to try again? (yes/no): ');
          if (retry.toLowerCase() !== 'yes' && retry.toLowerCase() !== 'y') {
            break;
          }
          continue;
        }

        const hodName = await askQuestion('Enter HOD name (or press Enter for default): ') || 'HOD';
        const hodEmployeeId = await askQuestion('Enter employee ID (or press Enter for default): ') || `HOD${Date.now().toString().slice(-6)}`;
        
        // Department is REQUIRED for HOD
        let hodDepartment = '';
        while (!hodDepartment) {
          hodDepartment = await askQuestion('Enter department name (REQUIRED for HOD): ');
          if (!hodDepartment) {
            console.log('❌ Department name cannot be empty for HOD users.');
          }
        }
        
        const hodCampus = await askQuestion('Enter campus name (or press Enter for default): ') || 'Vignan University';

        try {
          const hod = await User.create({
            name: hodName,
            email: hodEmail.toLowerCase().trim(),
            password: hodPassword,
            role: 'hod',
            isHOD: true,
            employeeId: hodEmployeeId,
            department: hodDepartment,
            campus: hodCampus,
            isActive: true
          });

          createdUsers.push(hod);
          console.log(`\n✅ HOD user created successfully!`);
          console.log(`   📧 Email: ${hod.email}`);
          console.log(`   🔑 Password: ${hodPassword}`);
          console.log(`   👤 Name: ${hod.name}`);
          console.log(`   🆔 Employee ID: ${hod.employeeId}`);
          console.log(`   🏛️  Department: ${hod.department}`);
          console.log(`   🏫 Campus: ${hod.campus}`);
          console.log(`   👔 Role: HOD (Head of Department)`);

        } catch (error) {
          if (error.code === 11000) {
            console.log(`❌ Error: User with email ${hodEmail} or employee ID ${hodEmployeeId} already exists`);
          } else {
            console.log(`❌ Error creating HOD user: ${error.message}`);
          }
        }
      }

      const createMore = await askQuestion('\nDo you want to create another HOD user? (yes/no): ');
      if (createMore.toLowerCase() !== 'yes' && createMore.toLowerCase() !== 'y') {
        continueCreating = false;
      }
    }

    rl.close();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('  SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n✅ Successfully created ${createdUsers.length} HOD user(s):\n`);
    
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🏛️  Department: ${user.department}`);
      console.log(`   🏫 Campus: ${user.campus}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 MongoDB is not running!');
      console.error('   Please start MongoDB and try again.');
    }
    rl.close();
    process.exit(1);
  }
};

createHODUsers();


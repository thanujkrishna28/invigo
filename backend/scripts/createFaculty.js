/**
 * Interactive script to create faculty users (supports batch creation)
 * Run: npm run create-faculty
 * 
 * This script allows you to create one or multiple faculty users
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

const createFacultyUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Create Faculty Users');
    console.log('='.repeat(60));
    console.log('');

    const createdUsers = [];
    let continueCreating = true;

    while (continueCreating) {
      console.log('\n📋 FACULTY USER SETUP');
      console.log('-'.repeat(60));
      
      const facultyEmail = await askQuestion('Enter faculty email: ');
      if (!facultyEmail || !facultyEmail.includes('@')) {
        console.log('❌ Invalid email address');
        const retry = await askQuestion('Do you want to try again? (yes/no): ');
        if (retry.toLowerCase() !== 'yes' && retry.toLowerCase() !== 'y') {
          break;
        }
        continue;
      }

      // Check if faculty already exists
      let shouldCreateFaculty = true;
      const existingFaculty = await User.findOne({ email: facultyEmail.toLowerCase().trim() });
      if (existingFaculty) {
        console.log(`⚠️  Faculty user with email ${facultyEmail} already exists.`);
        const overwrite = await askQuestion('Do you want to delete and recreate? (yes/no): ');
        if (overwrite.toLowerCase() === 'yes' || overwrite.toLowerCase() === 'y') {
          await User.deleteOne({ email: facultyEmail.toLowerCase().trim() });
          console.log('✅ Existing faculty user deleted');
          shouldCreateFaculty = true;
        } else {
          console.log('⏭️  Skipping this faculty creation');
          shouldCreateFaculty = false;
        }
      }

      if (shouldCreateFaculty) {
        const facultyPassword = await askPassword('Enter faculty password (min 6 characters): ');
        if (facultyPassword.length < 6) {
          console.log('❌ Password must be at least 6 characters');
          const retry = await askQuestion('Do you want to try again? (yes/no): ');
          if (retry.toLowerCase() !== 'yes' && retry.toLowerCase() !== 'y') {
            break;
          }
          continue;
        }

        const facultyName = await askQuestion('Enter faculty name (or press Enter for default): ') || 'Faculty Member';
        const facultyEmployeeId = await askQuestion('Enter faculty employee ID (or press Enter for default): ') || `FAC${Date.now().toString().slice(-6)}`;
        const facultyDepartment = await askQuestion('Enter department (or press Enter for default): ') || 'CSE';
        
        // Subject is required - keep asking until provided
        let facultySubject = '';
        while (!facultySubject || !facultySubject.trim()) {
          facultySubject = await askQuestion('Enter subject name (e.g., Data Structures, Operating Systems) - REQUIRED for lab exam allocation: ');
          if (!facultySubject || !facultySubject.trim()) {
            console.log('❌ Subject name is required. Please enter a subject name.');
          }
        }
        
        const facultyCampus = await askQuestion('Enter campus name (or press Enter for default): ') || 'Vignan University';

        // Handle subjects - support comma-separated subjects
        const subjectsArray = facultySubject.split(',').map(s => s.trim()).filter(s => s);

        try {
          const faculty = await User.create({
            name: facultyName,
            email: facultyEmail.toLowerCase().trim(),
            password: facultyPassword,
            role: 'faculty',
            employeeId: facultyEmployeeId,
            department: facultyDepartment,
            subject: subjectsArray[0] || facultySubject.trim(), // First subject or the entered subject
            subjects: subjectsArray,
            campus: facultyCampus,
            isActive: true
          });

          console.log('\n✅ Faculty user created successfully!');
          console.log(`   📧 Email: ${faculty.email}`);
          console.log(`   🔑 Password: ${facultyPassword}`);
          console.log(`   👤 Name: ${faculty.name}`);
          console.log(`   🆔 Employee ID: ${faculty.employeeId}`);
          console.log(`   🏫 Department: ${faculty.department}`);
          console.log(`   📚 Subject: ${faculty.subject || (faculty.subjects && faculty.subjects.length > 0 ? faculty.subjects.join(', ') : 'N/A')}`);
          
          createdUsers.push({
            email: faculty.email,
            password: facultyPassword,
            name: faculty.name,
            department: faculty.department,
            subject: faculty.subject || (faculty.subjects && faculty.subjects.length > 0 ? faculty.subjects.join(', ') : 'N/A')
          });
        } catch (error) {
          console.log(`❌ Error creating faculty: ${error.message}`);
        }
      }

      // Ask if user wants to create another faculty
      const createAnother = await askQuestion('\nDo you want to create another faculty user? (yes/no): ');
      if (createAnother.toLowerCase() !== 'yes' && createAnother.toLowerCase() !== 'y') {
        continueCreating = false;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (createdUsers.length > 0) {
      console.log(`✅ Successfully created ${createdUsers.length} faculty user(s):`);
      createdUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🔑 Password: ${user.password}`);
        console.log(`   🏫 Department: ${user.department}`);
        console.log(`   📚 Subject: ${user.subject}`);
      });
    } else {
      console.log('⏭️  No faculty users were created.');
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

createFacultyUsers();


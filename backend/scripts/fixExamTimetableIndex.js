/**
 * Script to fix ExamTimetable indexes
 * Removes unique constraint on examId since it's now optional
 * Run: node scripts/fixExamTimetableIndex.js
 */

const mongoose = require('mongoose');
const ExamTimetable = require('../models/ExamTimetable');
require('dotenv').config();

const fixIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Fix ExamTimetable Indexes');
    console.log('='.repeat(60));
    console.log('');

    const db = mongoose.connection.db;
    const collection = db.collection('examtimetables');

    // List all existing indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} (unique: ${index.unique || false})`);
    });
    console.log('');

    // Drop unique examId index if it exists
    try {
      await collection.dropIndex('examId_1');
      console.log('✅ Dropped unique index: examId_1');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('ℹ️  Index examId_1 does not exist (already removed)');
      } else {
        console.log(`⚠️  Error dropping index: ${error.message}`);
      }
    }

    // List indexes after fix
    console.log('\n📋 Updated indexes:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} (unique: ${index.unique || false})`);
    });

    console.log('\n✅ Index fix completed!\n');
    console.log('You can now upload exam timetables without examId.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

fixIndexes();


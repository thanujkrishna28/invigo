/**
 * Script to fix classroom indexes
 * Removes incorrect campus_1_roomNumber_1 index and ensures correct compound index
 * Run: node scripts/fixClassroomIndexes.js
 */

const mongoose = require('mongoose');
const Classroom = require('../models/Classroom');
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
    console.log('  Fix Classroom Indexes');
    console.log('='.repeat(60));
    console.log('');

    const db = mongoose.connection.db;
    const collection = db.collection('classrooms');

    // List all existing indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    console.log('');

    // Drop incorrect index if it exists
    try {
      await collection.dropIndex('campus_1_roomNumber_1');
      console.log('✅ Dropped incorrect index: campus_1_roomNumber_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index campus_1_roomNumber_1 does not exist (already removed)');
      } else {
        console.log(`⚠️  Error dropping index: ${error.message}`);
      }
    }

    // Ensure correct compound unique index exists
    try {
      await collection.createIndex(
        { roomNumber: 1, block: 1, floor: 1, campus: 1 },
        { unique: true, name: 'roomNumber_block_floor_campus_unique' }
      );
      console.log('✅ Created correct compound unique index: roomNumber_block_floor_campus_unique');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Compound index already exists');
      } else {
        console.log(`⚠️  Error creating index: ${error.message}`);
      }
    }

    // List indexes after fix
    console.log('\n📋 Updated indexes:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
    });

    console.log('\n✅ Index fix completed!');
    console.log('   You can now upload classrooms with same room numbers in different blocks.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixIndexes();


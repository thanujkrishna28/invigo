/**
 * Script to update existing allocations with classroom data
 * This assigns classrooms to allocations that don't have them
 * 
 * Run: node backend/scripts/updateAllocationsWithClassrooms.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Allocation = require('../models/Allocation');
const Classroom = require('../models/Classroom');

const updateAllocations = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Update Allocations with Classroom Data');
    console.log('='.repeat(60));
    console.log('');

    // Find all allocations without classroom
    const allocationsWithoutClassroom = await Allocation.find({
      $or: [
        { classroom: { $exists: false } },
        { classroom: null }
      ]
    }).populate('exam');

    console.log(`📋 Found ${allocationsWithoutClassroom.length} allocations without classroom data\n`);

    if (allocationsWithoutClassroom.length === 0) {
      console.log('✅ All allocations already have classroom data!');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Get all active classrooms
    const allRooms = await Classroom.find({ isActive: true });
    console.log(`🏫 Found ${allRooms.length} active classrooms\n`);

    if (allRooms.length === 0) {
      console.log('❌ No classrooms found. Please upload classrooms first.');
      await mongoose.connection.close();
      process.exit(1);
    }

    // Group allocations by date and time
    const groupedByTime = {};
    allocationsWithoutClassroom.forEach(alloc => {
      const dateKey = new Date(alloc.date).toISOString().split('T')[0];
      const timeKey = `${alloc.startTime}-${alloc.endTime}`;
      const key = `${dateKey}_${timeKey}`;
      
      if (!groupedByTime[key]) {
        groupedByTime[key] = [];
      }
      groupedByTime[key].push(alloc);
    });

    console.log(`⏰ Found ${Object.keys(groupedByTime).length} unique time slots\n`);

    let updated = 0;
    let roomIndex = 0;

    // For each time slot, assign rooms to allocations
    for (const [timeKey, allocs] of Object.entries(groupedByTime)) {
      console.log(`Processing time slot: ${timeKey} (${allocs.length} allocations)`);
      
      // Distribute allocations across all rooms
      for (const alloc of allocs) {
        if (roomIndex >= allRooms.length) {
          roomIndex = 0; // Wrap around
        }
        
        const room = allRooms[roomIndex];
        alloc.classroom = room._id;
        await alloc.save();
        
        updated++;
        roomIndex++;
      }
      
      console.log(`   ✅ Updated ${allocs.length} allocations\n`);
    }

    console.log('='.repeat(60));
    console.log(`✅ Successfully updated ${updated} allocations with classroom data`);
    console.log('='.repeat(60));
    console.log('');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

updateAllocations();




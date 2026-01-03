/**
 * Script to check allocation data structure
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Allocation = require('../models/Allocation');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const Exam = require('../models/Exam');

const checkAllocations = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB\n');

    // Get a few allocations with populated data
    const allocations = await Allocation.find({})
      .populate('classroom', 'roomNumber block floor')
      .populate('faculty', 'name')
      .populate('exam', 'examName')
      .limit(5);

    console.log(`Found ${allocations.length} allocations (showing first 5):\n`);

    allocations.forEach((alloc, idx) => {
      console.log(`Allocation ${idx + 1}:`);
      console.log(`  - ID: ${alloc._id}`);
      console.log(`  - Classroom: ${alloc.classroom ? (alloc.classroom.roomNumber || alloc.classroom._id) : 'NULL'}`);
      console.log(`  - Classroom type: ${typeof alloc.classroom}`);
      console.log(`  - Faculty: ${alloc.faculty?.name || 'N/A'}`);
      console.log(`  - Exam: ${alloc.exam?.examName || 'N/A'}`);
      console.log(`  - Date: ${alloc.date}`);
      console.log(`  - Time: ${alloc.startTime}-${alloc.endTime}`);
      console.log('');
    });

    // Count allocations with and without classroom
    const withClassroom = await Allocation.countDocuments({ classroom: { $exists: true, $ne: null } });
    const withoutClassroom = await Allocation.countDocuments({ 
      $or: [
        { classroom: { $exists: false } },
        { classroom: null }
      ]
    });

    console.log(`Total allocations: ${await Allocation.countDocuments({})}`);
    console.log(`With classroom: ${withClassroom}`);
    console.log(`Without classroom: ${withoutClassroom}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

checkAllocations();


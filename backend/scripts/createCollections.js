/**
 * Script to force create the separate collections
 * Run: node backend/scripts/createCollections.js
 */

const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Hod = require('../models/Hod');
const Faculty = require('../models/Faculty');
require('dotenv').config();

const createCollections = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Create Separate Collections');
    console.log('='.repeat(60));
    console.log('');

    const db = mongoose.connection.db;

    // Force create collections by creating and deleting a dummy document
    console.log('📦 Creating collections...\n');

    // Create admins collection
    try {
      const adminCount = await Admin.countDocuments();
      if (adminCount === 0) {
        // Create a temporary admin to force collection creation
        const tempAdmin = await Admin.create({
          name: 'TEMP_DELETE_ME',
          email: 'temp_' + Date.now() + '@temp.com',
          password: 'temp123456',
          role: 'admin'
        });
        await Admin.deleteOne({ _id: tempAdmin._id });
        console.log('✅ Created "admins" collection');
      } else {
        console.log(`✅ "admins" collection exists (${adminCount} documents)`);
      }
    } catch (error) {
      console.log('❌ Error creating "admins" collection:', error.message);
    }

    // Create hods collection
    try {
      const hodCount = await Hod.countDocuments();
      if (hodCount === 0) {
        const tempHod = await Hod.create({
          name: 'TEMP_DELETE_ME',
          email: 'temp_' + Date.now() + '@temp.com',
          password: 'temp123456',
          role: 'hod',
          department: 'TEMP'
        });
        await Hod.deleteOne({ _id: tempHod._id });
        console.log('✅ Created "hods" collection');
      } else {
        console.log(`✅ "hods" collection exists (${hodCount} documents)`);
      }
    } catch (error) {
      console.log('❌ Error creating "hods" collection:', error.message);
    }

    // Create faculties collection
    try {
      const facultyCount = await Faculty.countDocuments();
      if (facultyCount === 0) {
        const tempFaculty = await Faculty.create({
          name: 'TEMP_DELETE_ME',
          email: 'temp_' + Date.now() + '@temp.com',
          password: 'temp123456',
          role: 'faculty',
          subject: 'TEMP'
        });
        await Faculty.deleteOne({ _id: tempFaculty._id });
        console.log('✅ Created "faculties" collection');
      } else {
        console.log(`✅ "faculties" collection exists (${facultyCount} documents)`);
      }
    } catch (error) {
      console.log('❌ Error creating "faculties" collection:', error.message);
    }

    // List all collections
    console.log('\n📊 All collections in database:');
    const collections = await db.listCollections().toArray();
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });

    console.log('\n✅ Collections ready!');
    console.log('   You should now see: admins, hods, faculties\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createCollections();


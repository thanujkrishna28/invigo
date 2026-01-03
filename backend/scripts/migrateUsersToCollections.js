/**
 * Migration script to move users from 'users' collection to separate collections
 * Run: node backend/scripts/migrateUsersToCollections.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Hod = require('../models/Hod');
const Faculty = require('../models/Faculty');
require('dotenv').config();

const migrateUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('  Migrate Users to Separate Collections');
    console.log('='.repeat(60));
    console.log('');

    // Force create collections by checking if they exist
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('📊 Existing collections:', collectionNames.join(', '));
    console.log('');

    // Get all users from old collection
    const allUsers = await User.find({});
    console.log(`📋 Found ${allUsers.length} users to migrate\n`);
    
    if (allUsers.length === 0) {
      console.log('⚠️  No users found in "users" collection.');
      console.log('   Collections will be created when you upload users via CSV.\n');
      process.exit(0);
    }

    let migrated = { admin: 0, hod: 0, faculty: 0 };
    let errors = [];

    for (const user of allUsers) {
      try {
        const userObj = user.toObject();
        const { _id, __v, ...userData } = userObj;

        // Check if user already exists in new collection
        let exists = false;
        switch (user.role) {
          case 'admin':
            exists = await Admin.findOne({ email: user.email });
            break;
          case 'hod':
            exists = await Hod.findOne({ email: user.email });
            break;
          case 'faculty':
            exists = await Faculty.findOne({ email: user.email });
            break;
        }

        if (exists) {
          console.log(`⏭️  Skipping ${user.email} - already exists in ${user.role} collection`);
          continue;
        }

        // Create user in appropriate collection
        switch (user.role) {
          case 'admin':
            await Admin.create(userData);
            migrated.admin++;
            console.log(`✅ Migrated admin: ${user.email}`);
            break;
          case 'hod':
            await Hod.create(userData);
            migrated.hod++;
            console.log(`✅ Migrated HOD: ${user.email}`);
            break;
          case 'faculty':
          default:
            await Faculty.create(userData);
            migrated.faculty++;
            console.log(`✅ Migrated faculty: ${user.email}`);
            break;
        }
      } catch (error) {
        errors.push({ email: user.email, error: error.message });
        console.log(`❌ Error migrating ${user.email}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('  Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Admins migrated: ${migrated.admin}`);
    console.log(`✅ HODs migrated: ${migrated.hod}`);
    console.log(`✅ Faculty migrated: ${migrated.faculty}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.email}: ${err.error}`);
      });
    }

    console.log('\n⚠️  Note: Old "users" collection still exists.');
    console.log('   You can delete it manually after verifying migration.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateUsers();


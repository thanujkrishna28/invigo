const Admin = require('../models/Admin');
const Hod = require('../models/Hod');
const Faculty = require('../models/Faculty');

/**
 * Find user by ID across all collections
 */
async function findUserById(userId) {
  if (!userId) {
    console.log('⚠️  findUserById called with null/undefined userId');
    return null;
  }
  
  try {
    // Try each collection
    let user = await Admin.findById(userId).select('-password').lean();
    if (user) {
      console.log(`✅ Found Admin user by ID: ${userId}`);
      return { ...user, role: 'admin' };
    }
    
    user = await Hod.findById(userId).select('-password').lean();
    if (user) {
      console.log(`✅ Found HOD user by ID: ${userId}`);
      return { ...user, role: 'hod' };
    }
    
    user = await Faculty.findById(userId).select('-password').lean();
    if (user) {
      console.log(`✅ Found Faculty user by ID: ${userId}`);
      return { ...user, role: 'faculty' };
    }
    
  // No fallback to old User collection - users must be in their respective collections
    
    console.log(`❌ User not found by ID: ${userId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error in findUserById for userId ${userId}:`, error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Find user by email across all collections
 */
async function findUserByEmail(email) {
  if (!email) return null;
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Try each collection
  let user = await Admin.findOne({ email: normalizedEmail });
  if (user) return { user, model: Admin, role: 'admin' };
  
  user = await Hod.findOne({ email: normalizedEmail });
  if (user) return { user, model: Hod, role: 'hod' };
  
  user = await Faculty.findOne({ email: normalizedEmail });
  if (user) return { user, model: Faculty, role: 'faculty' };
  
  return null;
}

/**
 * Find user by employeeId across all collections
 */
async function findUserByEmployeeId(employeeId) {
  if (!employeeId) return null;
  
  const normalizedId = employeeId.trim();
  
  // Try each collection (hod and faculty have employeeId, admin might use email as employeeId)
  let user = await Hod.findOne({ employeeId: normalizedId });
  if (user) return { user, model: Hod, role: 'hod' };
  
  user = await Faculty.findOne({ employeeId: normalizedId });
  if (user) return { user, model: Faculty, role: 'faculty' };
  
  // For admin, try email match (since they might not have employeeId)
  user = await Admin.findOne({ email: normalizedId.toLowerCase() });
  if (user) return { user, model: Admin, role: 'admin' };
  
  return null;
}

/**
 * Find user by employeeId ONLY (for login - Employee ID required)
 */
async function findUserForLogin(employeeId) {
  if (!employeeId) return null;
  
  const normalized = employeeId.trim();
  
  console.log(`🔍 Searching for user with Employee ID: ${normalized}`);
  
  // Try employeeId for HOD
  let user = await Hod.findOne({ employeeId: normalized });
  if (user) {
    console.log(`✅ Found HOD by employeeId: ${normalized}`);
    return { user, model: Hod, role: 'hod' };
  }
  
  // Try employeeId for Faculty
  user = await Faculty.findOne({ employeeId: normalized });
  if (user) {
    console.log(`✅ Found Faculty by employeeId: ${normalized}`);
    return { user, model: Faculty, role: 'faculty' };
  }
  
  // For Admin: Check if they have employeeId field (if added)
  // Note: Admins typically don't have employeeId, so this might return null
  user = await Admin.findOne({ employeeId: normalized });
  if (user) {
    console.log(`✅ Found Admin by employeeId: ${normalized}`);
    return { user, model: Admin, role: 'admin' };
  }
  
  // No fallback to old User collection - users must be in their respective collections
  
  console.log(`❌ User not found with Employee ID: ${normalized}`);
  return null;
}

/**
 * Create user in appropriate collection based on role
 */
async function createUser(userData) {
  const { role, ...data } = userData;
  
  console.log(`🔧 Creating user with role: ${role || 'faculty'}`);
  console.log(`   Email: ${data.email}`);
  console.log(`   Employee ID: ${data.employeeId}`);
  
  let createdUser;
  switch (role) {
    case 'admin':
      console.log('   📝 Using Admin model (collection: admins)');
      createdUser = await Admin.create({ ...data, role: 'admin' });
      console.log(`   ✅ Created admin in 'admins' collection: ${createdUser._id}`);
      return createdUser;
    case 'hod':
      console.log('   📝 Using Hod model (collection: hods)');
      createdUser = await Hod.create({ ...data, role: 'hod' });
      console.log(`   ✅ Created HOD in 'hods' collection: ${createdUser._id}`);
      return createdUser;
    case 'faculty':
    default:
      console.log('   📝 Using Faculty model (collection: faculties)');
      createdUser = await Faculty.create({ ...data, role: 'faculty' });
      console.log(`   ✅ Created faculty in 'faculties' collection: ${createdUser._id}`);
      return createdUser;
  }
}

/**
 * Get appropriate model based on role
 */
function getModelByRole(role) {
  switch (role) {
    case 'admin':
      return Admin;
    case 'hod':
      return Hod;
    case 'faculty':
    default:
      return Faculty;
  }
}

module.exports = {
  findUserById,
  findUserByEmail,
  findUserByEmployeeId,
  findUserForLogin,
  createUser,
  getModelByRole,
  Admin,
  Hod,
  Faculty
};


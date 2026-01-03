const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { findUserForLogin, findUserByEmail, findUserById, createUser, getModelByRole } = require('../utils/userHelper');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register a new user (Admin only)
// @access  Private/Admin
router.post('/register', protect, async (req, res) => {
  try {
    // Only admin can register users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can register users'
      });
    }

    const { name, email, password, role, employeeId, department, campus, phone, isHOD, subject, subjects } = req.body;

    // Validate employeeId is required for all roles
    if (!employeeId || !employeeId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required for all users'
      });
    }

    // Check if user exists across all collections (by email or employeeId)
    const existingUserResult = await findUserByEmail(email);
    if (existingUserResult && existingUserResult.user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Check if employeeId already exists
    const existingEmployeeIdResult = await findUserByEmployeeId(employeeId);
    if (existingEmployeeIdResult && existingEmployeeIdResult.user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this Employee ID'
      });
    }

    // Handle subjects array (if provided as comma-separated string or array)
    let subjectsArray = [];
    if (subjects) {
      if (Array.isArray(subjects)) {
        subjectsArray = subjects.map(s => s.toString().trim()).filter(s => s);
      } else {
        subjectsArray = subjects.toString().split(',').map(s => s.trim()).filter(s => s);
      }
    } else if (subject) {
      subjectsArray = [subject.toString().trim()];
    }

    // Create user
    const userRole = role || 'faculty';
    
    // Validate subject name is required for faculty role
    if (userRole === 'faculty' && !subject && (!subjects || subjectsArray.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Subject name is required for faculty users'
      });
    }
    const userData = {
      name,
      email,
      password,
      role: userRole,
      employeeId,
      department,
      campus,
      phone
    };
    
    // Add role-specific fields
    if (userRole === 'faculty') {
      userData.subject = subject;
      userData.subjects = subjectsArray;
    }
    
    const user = await createUser(userData);

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        department: user.department,
        campus: user.campus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login',
  [
    body('employeeId').notEmpty().withMessage('Employee ID is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { employeeId, password } = req.body;

      // Validate that employeeId is provided and not empty
      if (!employeeId || !employeeId.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID is required'
        });
      }

      // Check if user exists by employeeId ONLY (no email fallback)
      const userResult = await findUserForLogin(employeeId.trim());
      if (!userResult || !userResult.user) {
        console.log(`❌ Login attempt failed: User not found - Employee ID: ${employeeId}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials - Employee ID not found. Please check your Employee ID or contact administrator.'
        });
      }

      const { user } = userResult;

      // Check if user is active
      if (!user.isActive) {
        console.log(`❌ Login attempt failed: User account deactivated - Identifier: ${employeeId}`);
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log(`❌ Login attempt failed: Incorrect password - Identifier: ${employeeId}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials - Incorrect password'
        });
      }

      const identifier = user.employeeId || user.email;
      console.log(`✅ Login successful: ${identifier} (${userResult.role})`);

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        token,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: userResult.role || user.role,
          employeeId: user.employeeId || null,
          department: user.department || null,
          campus: user.campus || null
        }
      });
    } catch (error) {
      console.error('❌ Error in /api/auth/login:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error during login'
      });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    // req.user is already set by protect middleware using findUserById
    // findUserById returns a plain object with role property (password already excluded via .select('-password'))
    if (!req.user) {
      console.error('❌ req.user is null/undefined in /api/auth/me');
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create a clean user object
    const userData = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      employeeId: req.user.employeeId || null,
      department: req.user.department || null,
      campus: req.user.campus || null,
      phone: req.user.phone || null,
      isActive: req.user.isActive !== undefined ? req.user.isActive : true
    };

    // Add role-specific fields
    if (req.user.role === 'faculty') {
      userData.subject = req.user.subject || null;
      userData.subjects = req.user.subjects || [];
    }

    console.log(`✅ /api/auth/me: Returning user data for ${userData.email} (${userData.role})`);

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('❌ Error in /api/auth/me:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;


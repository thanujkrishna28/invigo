const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { Faculty } = require('../utils/userHelper');
const Allocation = require('../models/Allocation');
const Exam = require('../models/Exam');

// All routes require authentication
router.use(protect);

// @route   GET /api/allocations
// @desc    Get allocations (filtered by user role)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const filter = {};

    // Faculty can only see their own allocations
    if (req.user.role === 'faculty') {
      filter.faculty = req.user._id;
    }

    // Admin can filter
    if (req.user.role === 'admin') {
      const { campus, department, startDate, endDate, facultyId } = req.query;
      if (campus) filter.campus = campus;
      if (department) filter.department = department;
      if (facultyId) filter.faculty = facultyId;
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }
    }

    // Fetch allocations without populating faculty (will do manually)
    const allocations = await Allocation.find(filter)
      .populate('exam', 'examName courseCode')
      .populate('classroom', 'roomNumber block floor building campus')
      .sort({ date: 1, startTime: 1 });

    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(allocations.map(a => a.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();
    
    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId');
      facultyMembers.forEach(f => {
        facultyMap.set(f._id.toString(), f);
      });
    }
    
    // Attach faculty data to allocations
    const allocationsWithFaculty = allocations.map(allocation => {
      const allocationObj = allocation.toObject ? allocation.toObject() : allocation;
      const facultyId = allocation.faculty?.toString();
      if (facultyId && facultyMap.has(facultyId)) {
        allocationObj.faculty = facultyMap.get(facultyId);
      } else {
        allocationObj.faculty = null;
      }
      return allocationObj;
    });

    res.json({
      success: true,
      count: allocationsWithFaculty.length,
      data: allocationsWithFaculty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/allocations/:id
// @desc    Get single allocation
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id)
      .populate('exam', 'examName courseCode date startTime endTime')
      .populate('classroom', 'roomNumber block floor building campus')
      .populate('exam.classroom', 'roomNumber building');
    
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }
    
    // Manually populate faculty from Faculty collection
    let allocationObj = allocation.toObject ? allocation.toObject() : allocation;
    if (allocation.faculty) {
      const faculty = await Faculty.findById(allocation.faculty)
        .select('name email employeeId department campus');
      if (faculty) {
        allocationObj.faculty = faculty;
      } else {
        allocationObj.faculty = null;
      }
    }

    // Faculty can only see their own allocations
    if (req.user.role === 'faculty' && allocationObj.faculty && allocationObj.faculty._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this allocation'
      });
    }

    res.json({
      success: true,
      data: allocationObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Conflict = require('../models/Conflict');
const Allocation = require('../models/Allocation');
const allocationService = require('../services/allocationService');

// All routes require authentication
router.use(protect);

// @route   GET /api/conflicts
// @desc    Get all conflicts
// @access  Private/Admin
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const { status, severity, facultyId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (facultyId) filter.faculty = facultyId;

    // Get conflicts without populating faculty (will do manually)
    const conflicts = await Conflict.find(filter)
      .populate('allocations')
      .sort({ severity: 1, createdAt: -1 });

    // Manually populate faculty from Faculty collection
    const { Faculty } = require('../utils/userHelper');
    const facultyIds = [...new Set(conflicts.map(c => c.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();
    
    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId');
      facultyMembers.forEach(f => {
        facultyMap.set(f._id.toString(), f);
      });
    }
    
    // Attach faculty data to conflicts
    const conflictsWithFaculty = conflicts.map(conflict => {
      const conflictObj = conflict.toObject ? conflict.toObject() : conflict;
      const facultyId = conflict.faculty?.toString();
      if (facultyId && facultyMap.has(facultyId)) {
        conflictObj.faculty = facultyMap.get(facultyId);
      } else {
        conflictObj.faculty = null;
      }
      return conflictObj;
    });

    res.json({
      success: true,
      count: conflictsWithFaculty.length,
      data: conflictsWithFaculty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/conflicts/detect
// @desc    Manually trigger conflict detection
// @access  Private/Admin
router.post('/detect', authorize('admin'), async (req, res) => {
  try {
    const conflicts = await allocationService.detectConflicts();

    res.json({
      success: true,
      message: `Detected ${conflicts.length} conflicts`,
      count: conflicts.length,
      data: conflicts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PATCH /api/conflicts/:id/resolve
// @desc    Mark conflict as resolved
// @access  Private/Admin
router.patch('/:id/resolve', authorize('admin'), async (req, res) => {
  try {
    const conflict = await Conflict.findById(req.params.id);

    if (!conflict) {
      return res.status(404).json({
        success: false,
        message: 'Conflict not found'
      });
    }

    conflict.status = 'resolved';
    conflict.resolution.resolvedAt = new Date();
    conflict.resolution.resolvedBy = req.user._id;

    await conflict.save();

    res.json({
      success: true,
      message: 'Conflict marked as resolved',
      data: conflict
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { Hod, Faculty, findUserById } = require('../utils/userHelper');
const Exam = require('../models/Exam');
const Allocation = require('../models/Allocation');
const Classroom = require('../models/Classroom');
const allocationService = require('../services/allocationService');
const moment = require('moment');

// All routes require HOD access
router.use(protect);
router.use(authorize('hod'));

// @route   GET /api/hod/dashboard
// @desc    Get HOD dashboard statistics for their department
// @access  Private/HOD
router.get('/dashboard', async (req, res) => {
  try {
    // req.user is already populated by protect middleware from the correct collection
    const hod = req.user;
    const department = hod.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'HOD must be assigned to a department'
      });
    }

    // Get statistics for HOD's department
    const [
      totalExams,
      scheduledExams,
      allocatedExams,
      totalFaculty,
      totalAllocations,
      activeConflicts
    ] = await Promise.all([
      Exam.countDocuments({ department }),
      Exam.countDocuments({ department, status: 'scheduled' }),
      Exam.countDocuments({ department, status: 'allocated' }),
      Faculty.countDocuments({ department, isActive: true }),
      Allocation.countDocuments({ department, status: { $ne: 'cancelled' } }),
      // Conflicts for department faculty
      Allocation.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'faculty',
            foreignField: '_id',
            as: 'facultyData'
          }
        },
        {
          $match: {
            'facultyData.department': department,
            status: { $ne: 'cancelled' }
          }
        }
      ]).then(result => result.length)
    ]);

    // Get recent allocations for department without populating faculty (will do manually)
    const recentAllocations = await Allocation.find({ department })
      .populate('exam', 'examName courseCode')
      .sort({ createdAt: -1 })
      .limit(10);

    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(recentAllocations.map(a => a.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();
    
    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId');
      facultyMembers.forEach(f => {
        facultyMap.set(f._id.toString(), f);
      });
    }
    
    // Attach faculty data to allocations
    const recentAllocationsWithFaculty = recentAllocations.map(allocation => {
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
      data: {
        department,
        statistics: {
          totalExams,
          scheduledExams,
          allocatedExams,
          totalFaculty,
          totalAllocations,
          activeConflicts
        },
        recentAllocations
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/hod/allocate
// @desc    Trigger allocation for HOD's department only
// @access  Private/HOD
router.post('/allocate', async (req, res) => {
  try {
    // req.user is already populated by protect middleware from the correct collection
    const hod = req.user;
    const department = hod.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'HOD must be assigned to a department'
      });
    }

    const { examIds } = req.body;

    // Only allocate for HOD's department
    const result = await allocationService.allocateInvigilators(
      examIds,
      null, // campus - can be filtered later
      department
    );

    // Emit socket events
    const io = req.app.get('io');
    
    // Emit general notification
    io.emit('allocation-complete', {
      message: `New allocations generated for ${department}`,
      department,
      timestamp: new Date()
    });
    
    // Emit specific notifications to allocated faculty members
    if (result.results && Array.isArray(result.results)) {
      const Allocation = require('../models/Allocation');
      
      // Get all allocations that were just created (in the last 10 seconds)
      const tenSecondsAgo = new Date(Date.now() - 10000);
      const newAllocations = await Allocation.find({
        createdAt: { $gte: tenSecondsAgo },
        status: 'assigned',
        department: department
      })
        .populate('faculty', 'name email')
        .populate('exam', 'examName courseCode date startTime endTime');
      
      // Group by faculty and emit notifications
      const facultyNotifications = new Map();
      
      newAllocations.forEach(allocation => {
        if (allocation.faculty && allocation.faculty._id) {
          const facultyId = allocation.faculty._id.toString();
          if (!facultyNotifications.has(facultyId)) {
            facultyNotifications.set(facultyId, []);
          }
          facultyNotifications.get(facultyId).push({
            allocationId: allocation._id,
            examName: allocation.exam?.examName || 'Exam',
            examId: allocation.exam?._id,
            date: allocation.date
          });
        }
      });
      
      // Send notifications to each faculty member
      facultyNotifications.forEach((allocations, facultyId) => {
        const examNames = allocations.map(a => a.examName).join(', ');
        io.to(`user-${facultyId}`).emit('new-allocation', {
          message: `You have been assigned ${allocations.length} new invigilation duty${allocations.length > 1 ? 'ies' : ''}`,
          allocations: allocations,
          examNames,
          timestamp: new Date()
        });
      });
    }

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/hod/exams
// @desc    Get exams for HOD's department
// @access  Private/HOD
router.get('/exams', async (req, res) => {
  try {
    // req.user is already populated by protect middleware from the correct collection
    const hod = req.user;
    const department = hod.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'HOD must be assigned to a department'
      });
    }

    const { status, startDate, endDate } = req.query;
    const filter = { department };

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Get exams without populating allocatedInvigilators.faculty (will do manually)
    const exams = await Exam.find(filter)
      .populate('classroom')
      .sort({ date: 1, startTime: 1 });

    // Manually populate faculty in allocatedInvigilators
    const facultyIds = [...new Set(exams.flatMap(exam => 
      (exam.allocatedInvigilators || []).map(ai => ai.faculty?.toString()).filter(Boolean)
    ))];
    const facultyMap = new Map();
    
    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId');
      facultyMembers.forEach(f => {
        facultyMap.set(f._id.toString(), f);
      });
    }
    
    // Attach faculty data to exams
    const examsWithFaculty = exams.map(exam => {
      const examObj = exam.toObject ? exam.toObject() : exam;
      if (examObj.allocatedInvigilators && Array.isArray(examObj.allocatedInvigilators)) {
        examObj.allocatedInvigilators = examObj.allocatedInvigilators.map(ai => {
          const facultyId = ai.faculty?.toString();
          if (facultyId && facultyMap.has(facultyId)) {
            return { ...ai, faculty: facultyMap.get(facultyId) };
          }
          return ai;
        });
      }
      return examObj;
    });

    res.json({
      success: true,
      count: exams.length,
      data: exams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/hod/faculty
// @desc    Get faculty in HOD's department
// @access  Private/HOD
router.get('/faculty', async (req, res) => {
  try {
    // req.user is already populated by protect middleware from the correct collection
    const hod = req.user;
    const department = hod.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'HOD must be assigned to a department'
      });
    }

    const faculty = await Faculty.find({
      role: 'faculty',
      department,
      isActive: true
    }).select('-password').sort({ name: 1 });

    // Get workload for each faculty
    const facultyWithWorkload = await Promise.all(
      faculty.map(async (f) => {
        const allocations = await Allocation.find({
          faculty: f._id,
          status: { $ne: 'cancelled' }
        });
        return {
          ...f.toObject(),
          workload: {
            totalDuties: allocations.length,
            totalHours: allocations.reduce((sum, a) => {
              const start = moment(a.startTime, 'HH:mm');
              const end = moment(a.endTime, 'HH:mm');
              return sum + end.diff(start, 'hours', true);
            }, 0)
          }
        };
      })
    );

    res.json({
      success: true,
      count: facultyWithWorkload.length,
      data: facultyWithWorkload
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/hod/allocations
// @desc    Get allocations for HOD's department
// @access  Private/HOD
router.get('/allocations', async (req, res) => {
  try {
    // req.user is already populated by protect middleware from the correct collection
    const hod = req.user;
    const department = hod.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'HOD must be assigned to a department'
      });
    }

    const { startDate, endDate, status, facultyId } = req.query;
    const filter = { department };

    if (status) filter.status = status;
    if (facultyId) filter.faculty = facultyId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Get allocations without populating faculty (will do manually)
    const allocations = await Allocation.find(filter)
      .populate('exam', 'examName courseCode date startTime endTime')
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

// @route   GET /api/hod/blocks
// @desc    Get blocks and floors for HOD's department
// @access  Private/HOD
router.get('/blocks', async (req, res) => {
  try {
    // req.user is already populated by protect middleware from the correct collection
    const hod = req.user;
    const department = hod.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'HOD must be assigned to a department'
      });
    }

    // Get classrooms for this department
    const classrooms = await Classroom.find({
      $or: [
        { department: department },
        { departments: department }
      ],
      isActive: true
    });

    // Group by block and floor
    const blockStructure = {};
    classrooms.forEach(classroom => {
      if (!blockStructure[classroom.block]) {
        blockStructure[classroom.block] = {};
      }
      if (!blockStructure[classroom.block][classroom.floor]) {
        blockStructure[classroom.block][classroom.floor] = [];
      }
      blockStructure[classroom.block][classroom.floor].push({
        roomNumber: classroom.roomNumber,
        capacity: classroom.capacity,
        facilities: classroom.facilities
      });
    });

    res.json({
      success: true,
      data: blockStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


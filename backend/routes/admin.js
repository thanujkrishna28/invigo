const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { Admin, Hod, Faculty, findUserById } = require('../utils/userHelper');
const Exam = require('../models/Exam');
const Classroom = require('../models/Classroom');
const Allocation = require('../models/Allocation');
const Conflict = require('../models/Conflict');
const AllocationConfig = require('../models/AllocationConfig');
const allocationService = require('../services/allocationService');
const calendarService = require('../services/calendarService');
const analyticsService = require('../services/analyticsService');
const moment = require('moment');
const reportService = require('../services/reportService');

// All routes require admin access
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/dashboard', async (req, res) => {
  try {
    const { campus, department, startDate, endDate } = req.query;

    // Build query filters
    const examFilter = {};
    const allocationFilter = {};
    const facultyFilter = { isActive: true };

    if (campus) {
      examFilter.campus = campus;
      allocationFilter.campus = campus;
      facultyFilter.campus = campus;
    }
    if (department) {
      examFilter.department = department;
      allocationFilter.department = department;
      facultyFilter.department = department;
    }
    if (startDate || endDate) {
      examFilter.date = {};
      allocationFilter.date = {};
      if (startDate) {
        examFilter.date.$gte = new Date(startDate);
        allocationFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        examFilter.date.$lte = new Date(endDate);
        allocationFilter.date.$lte = new Date(endDate);
      }
    }

    // Get statistics
    const [
      totalExams,
      scheduledExams,
      allocatedExams,
      totalFaculty,
      totalAllocations,
      activeConflicts,
      totalClassrooms
    ] = await Promise.all([
      Exam.countDocuments(examFilter),
      Exam.countDocuments({ ...examFilter, status: 'scheduled' }),
      Exam.countDocuments({ ...examFilter, status: 'allocated' }),
      Faculty.countDocuments(facultyFilter), // Get from 'faculties' collection
      Allocation.countDocuments({ ...allocationFilter, status: { $ne: 'cancelled' } }),
      Conflict.countDocuments({ status: 'detected' }),
      Classroom.countDocuments({ isActive: true, ...(campus && { campus }) })
    ]);

    // Get recent allocations without populating faculty (will do manually)
    const recentAllocations = await Allocation.find(allocationFilter)
      .populate('exam', 'examName courseCode')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(recentAllocations.map(a => a.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId department campus')
        .lean();
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
        statistics: {
          totalExams,
          scheduledExams,
          allocatedExams,
          totalFaculty,
          totalAllocations,
          activeConflicts,
          totalClassrooms
        },
        recentAllocations: recentAllocationsWithFaculty
      }
    });
  } catch (error) {
    console.error('❌ Error in /api/admin/dashboard:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// @route   POST /api/admin/allocate
// @desc    Trigger AI-based allocation
// @access  Private/Admin
router.post('/allocate', async (req, res) => {
  try {
    const { examIds, campus, department } = req.body;

    console.log('📋 Starting allocation with params:', { examIds, campus, department });

    let result;
    try {
      result = await allocationService.allocateInvigilators(examIds, campus, department);
      console.log('✅ Allocation service completed:', {
        success: result.success,
        message: result.message,
        summary: result.summary
      });
    } catch (allocationError) {
      console.error('❌ Error in allocation service:', allocationError);
      throw allocationError;
    }

    // Emit socket events for real-time updates
    try {
      const io = req.app.get('io');
      if (io) {
        // Emit general notification to all users
        io.emit('allocation-complete', {
          message: 'New allocations have been generated',
          timestamp: new Date()
        });
      }
    } catch (socketError) {
      console.error('Socket.io error (non-critical):', socketError);
    }

    // Emit specific notifications to allocated faculty members
    if (result && result.success) {
      try {
        const io = req.app.get('io');
        if (io) {
          const Allocation = require('../models/Allocation');

          // Get all allocations created in the last 10 seconds
          const tenSecondsAgo = new Date(Date.now() - 10000);
          const newAllocations = await Allocation.find({
            createdAt: { $gte: tenSecondsAgo },
            status: 'assigned'
          })
            .populate('exam', 'examName courseCode date startTime endTime');

          // Manually populate faculty from Faculty collection
          const facultyIds = [...new Set(newAllocations.map(a => a.faculty?.toString()).filter(Boolean))];
          const facultyMap = new Map();

          if (facultyIds.length > 0) {
            const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } }).select('name email');
            facultyMembers.forEach(f => {
              facultyMap.set(f._id.toString(), f);
            });
          }

          // Group by faculty and emit notifications
          const facultyNotifications = new Map();

          newAllocations.forEach(allocation => {
            const facultyId = allocation.faculty?.toString();
            if (facultyId && facultyMap.has(facultyId)) {
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
      } catch (notificationError) {
        // Don't fail the whole request if notifications fail
        console.error('Error sending notifications:', notificationError);
      }
    }

    // Ensure response is properly serialized (avoid circular references or Mongoose documents)
    const responseData = {
      success: result.success || false,
      message: result.message || 'Allocation completed'
    };

    // Add summary if available (ensure it's plain object)
    if (result.summary) {
      responseData.summary = {
        sessionsProcessed: result.summary.sessionsProcessed || 0,
        successfulSessions: result.summary.successfulSessions || 0,
        totalRooms: result.summary.totalRooms || 0,
        totalAllocations: result.summary.totalAllocations || 0
      };
    }

    // Send response
    res.json(responseData);
  } catch (error) {
    console.error('Error in /api/admin/allocate:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during allocation'
    });
  }
});

// @route   GET /api/admin/exams
// @desc    Get all exams with filters
// @access  Private/Admin
router.get('/exams', async (req, res) => {
  try {
    const { campus, department, startDate, endDate, status } = req.query;
    const filter = {};

    if (campus) filter.campus = campus;
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Get exams without populating allocatedInvigilators.faculty (will do manually)
    const exams = await Exam.find(filter)
      .populate('classroom')
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Manually populate faculty in allocatedInvigilators
    const facultyIds = [...new Set(exams.flatMap(exam =>
      (exam.allocatedInvigilators || []).map(ai => ai.faculty?.toString()).filter(Boolean)
    ))];
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId')
        .lean();
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
      count: examsWithFaculty.length,
      data: examsWithFaculty
    });
  } catch (error) {
    console.error('❌ Error in /api/admin/exams:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// @route   GET /api/admin/faculty
// @desc    Get all faculty with filters
// @access  Private/Admin
router.get('/faculty', async (req, res) => {
  try {
    const { campus, department, search } = req.query;
    const filter = {};

    if (campus) filter.campus = campus;
    if (department) filter.department = department;

    // Search by employee ID or name
    if (search) {
      const searchRegex = new RegExp(search, 'i'); // Case-insensitive
      filter.$or = [
        { employeeId: searchRegex },
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    // Get faculty from the 'faculties' collection
    const faculty = await Faculty.find(filter).select('-password').sort({ name: 1 });

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

// @route   GET /api/admin/faculty/search
// @desc    Search faculty by employee ID or name (for adding to allocations)
// @access  Private/Admin
router.get('/faculty/search', async (req, res) => {
  try {
    const { q, campus, department } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const filter = { isActive: true };

    // Search by employee ID or name (case-insensitive)
    const searchRegex = new RegExp(q.trim(), 'i');
    filter.$or = [
      { employeeId: searchRegex },
      { name: searchRegex },
      { email: searchRegex }
    ];

    if (campus) filter.campus = campus;
    if (department) filter.department = department;

    // Get faculty from the 'faculties' collection
    const faculty = await Faculty.find(filter)
      .select('name email employeeId department campus phone isActive')
      .sort({ name: 1 })
      .limit(50); // Limit results to 50

    // Get current workload for each faculty
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

// @route   GET /api/admin/allocations
// @desc    Get all allocations with filters
// @access  Private/Admin
router.get('/allocations', async (req, res) => {
  try {
    const { campus, department, startDate, endDate, status, facultyId } = req.query;
    const filter = {};

    if (campus) filter.campus = campus;
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (facultyId) filter.faculty = facultyId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Fetch allocations without populating faculty (will do manually)
    const allocations = await Allocation.find(filter)
      .populate({
        path: 'classroom',
        select: 'roomNumber block floor building campus isActive',
        // Don't filter - populate all classrooms even if inactive
      })
      .populate({
        path: 'exam',
        select: 'examName courseCode date startTime endTime classroom examType',
        populate: {
          path: 'classroom',
          select: 'roomNumber block floor building campus isActive'
        }
      })
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(allocations.map(a => a.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId department campus')
        .lean();
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
        // If faculty not found, set to null or keep the ID
        allocationObj.faculty = null;
      }
      return allocationObj;
    });

    // Log allocations by block for debugging
    const allocationsByBlock = {};
    allocationsWithFaculty.forEach(alloc => {
      const block = alloc.classroom?.block || alloc.exam?.classroom?.block || 'No Block';
      allocationsByBlock[block] = (allocationsByBlock[block] || 0) + 1;
    });
    console.log('📊 API: Allocations by block:', allocationsByBlock);
    console.log('📊 API: Total allocations:', allocationsWithFaculty.length);
    console.log('👥 API: Faculty populated:', facultyMap.size, 'out of', facultyIds.length);

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

// @route   POST /api/admin/allocations/notify-all
// @desc    Send allocation notifications to all faculty
// @access  Private/Admin
router.post('/allocations/notify-all', async (req, res) => {
  try {
    const { campus, department } = req.query;
    const filter = { status: { $ne: 'cancelled' } };

    if (campus) filter.campus = campus;
    if (department) filter.department = department;

    // Get all allocations without populating faculty (will do manually)
    const allocations = await Allocation.find(filter)
      .populate({
        path: 'exam',
        select: 'examName courseCode date startTime endTime classroom',
        populate: {
          path: 'classroom',
          select: 'roomNumber block floor building campus'
        }
      })
      .sort({ date: 1, startTime: 1 });

    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(allocations.map(a => a.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId department campus');
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

    if (allocationsWithFaculty.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No allocations found to notify'
      });
    }

    const emailService = require('../services/emailService');
    const Classroom = require('../models/Classroom');

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // Group allocations by faculty to send one email per faculty with all their allocations
    const facultyAllocationsMap = {};

    allocationsWithFaculty.forEach(allocation => {
      if (!allocation.faculty || !allocation.faculty._id) {
        console.warn(`⚠️  Skipping allocation ${allocation._id} - no faculty assigned`);
        return;
      }

      const facultyId = allocation.faculty._id.toString();
      if (!facultyAllocationsMap[facultyId]) {
        facultyAllocationsMap[facultyId] = {
          faculty: allocation.faculty,
          allocations: []
        };
      }
      facultyAllocationsMap[facultyId].allocations.push(allocation);
    });

    // Send email to each faculty member
    for (const [facultyId, data] of Object.entries(facultyAllocationsMap)) {
      const { faculty, allocations: facultyAllocations } = data;

      // Send notification for each allocation
      for (const allocation of facultyAllocations) {
        try {
          // Get classroom - priority: allocation.classroom > allocation.exam.classroom
          let classroom = null;

          // First try: allocation.classroom (direct reference)
          if (allocation.classroom) {
            if (allocation.classroom.roomNumber || allocation.classroom._id) {
              // Already populated
              classroom = allocation.classroom;
            } else if (typeof allocation.classroom === 'string' || allocation.classroom._id) {
              // Need to populate
              classroom = await Classroom.findById(allocation.classroom._id || allocation.classroom);
            }
          }

          // Fallback: allocation.exam.classroom
          if (!classroom && allocation.exam && allocation.exam.classroom) {
            if (allocation.exam.classroom._id || allocation.exam.classroom.roomNumber) {
              // Already populated
              classroom = allocation.exam.classroom;
            } else if (typeof allocation.exam.classroom === 'string' || allocation.exam.classroom._id) {
              // Need to populate
              classroom = await Classroom.findById(allocation.exam.classroom._id || allocation.exam.classroom);
            }
          }

          console.log(`📧 Attempting to send email to ${faculty.email} for allocation ${allocation._id}...`);
          console.log(`   📍 Classroom: ${classroom ? `${classroom.block}-${classroom.roomNumber}` : 'Not found'}`);

          const emailResult = await emailService.sendAllocationNotification(
            faculty,
            {
              exam: allocation.exam,
              date: allocation.date,
              startTime: allocation.startTime,
              endTime: allocation.endTime,
              campus: allocation.campus,
              department: allocation.department,
              classroom: allocation.classroom // Pass allocation.classroom to email service
            },
            allocation.exam,
            classroom
          );

          if (emailResult.success) {
            // Mark as notified
            allocation.notified = true;
            allocation.notifiedAt = new Date();
            await allocation.save();
            successCount++;
            console.log(`✅ Email sent successfully to ${faculty.email} (Message ID: ${emailResult.messageId})`);
          } else {
            failCount++;
            errors.push(`${faculty.email}: ${emailResult.message}`);
            console.error(`❌ Email service returned error for ${faculty.email}: ${emailResult.message}`);
          }
        } catch (emailError) {
          failCount++;
          errors.push(`${faculty.email}: ${emailError.message}`);
          console.error(`❌ Exception while sending email to ${faculty.email}:`, emailError.message);
        }
      }
    }

    res.json({
      success: true,
      message: `Notifications sent: ${successCount} successful${failCount > 0 ? `, ${failCount} failed` : ''}`,
      data: {
        totalAllocations: allocations.length,
        successCount,
        failCount,
        errors: errors.length > 0 ? errors.slice(0, 10) : [] // Limit errors in response
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/admin/allocations/:id
// @desc    Delete an allocation
// @access  Private/Admin
router.delete('/allocations/:id', async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    await Allocation.findByIdAndDelete(req.params.id);

    // Emit socket event
    const io = req.app.get('io');
    io.to(`user-${allocation.faculty}`).emit('allocation-updated', {
      type: 'deleted',
      allocationId: allocation._id
    });

    res.json({
      success: true,
      message: 'Allocation deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/campuses
// @desc    Get list of all campuses from ExamTimetable
// @access  Private/Admin
router.get('/campuses', async (req, res) => {
  try {
    // Get campuses from both Allocation and Exam models
    const allocationCampuses = await Allocation.distinct('campus');
    const examCampuses = await Exam.distinct('campus');

    // Combine and deduplicate
    const allCampuses = [...new Set([...allocationCampuses, ...examCampuses])];

    res.json({
      success: true,
      data: allCampuses.filter(c => c) // Filter out null/undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/departments
// @desc    Get list of all departments from ExamTimetable
// @access  Private/Admin
router.get('/departments', async (req, res) => {
  try {
    const { campus } = req.query;

    // Get departments from both Allocation and Exam models
    const allocationFilter = {};
    const examFilter = {};

    if (campus) {
      allocationFilter.campus = campus;
      examFilter.campus = campus;
    }

    const allocationDepartments = await Allocation.distinct('department', allocationFilter);
    const examDepartments = await Exam.distinct('department', examFilter);

    // Combine and deduplicate
    const allDepartments = [...new Set([...allocationDepartments, ...examDepartments])];

    res.json({
      success: true,
      data: allDepartments.filter(d => d) // Filter out null/undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/timetable/pdf
// @desc    Generate Exam Timetable PDF
// @access  Private/Admin
router.get('/timetable/pdf', async (req, res) => {
  try {
    const { campus, department } = req.query;
    const filter = {};
    if (campus) filter.campus = campus;
    if (department) filter.department = department;

    const ExamTimetable = require('../models/ExamTimetable');
    const exams = await ExamTimetable.find(filter)
      .populate('classroom')
      .sort({ date: 1, department: 1 });

    const pdfBuffer = await reportService.generateTimetablePDF(exams, {
      universityName: process.env.UNIVERSITY_NAME || 'Vignan University',
      semester: 'All Semesters',
      period: moment().format('MMMM-YYYY'),
      releaseDate: moment().format('DD.MM.YYYY'),
      examTime: '09:00 A.M. to 11:30 A.M.'
    });

    // Ensure buffer is valid
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      console.error('Invalid PDF buffer generated');
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF - invalid buffer'
      });
    }

    console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`);
    console.log(`PDF first 20 bytes (hex): ${pdfBuffer.slice(0, 20).toString('hex')}`);
    console.log(`PDF header: "${pdfBuffer.slice(0, 4).toString('utf8')}"`);

    // Set headers before sending - CRITICAL: Don't let Express add JSON headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="exam-timetable.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // CRITICAL: Use res.end() for binary data, not res.send()
    // res.send() might try to JSON.stringify or add unwanted headers
    res.end(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/timetable/image
// @desc    Generate Exam Timetable as JPG/Image
// @access  Private/Admin
router.get('/timetable/image', async (req, res) => {
  try {
    const { campus, department, examType } = req.query;
    const filter = {};
    if (campus) filter.campus = campus;
    if (department) filter.department = department;
    if (examType) filter.examType = examType;

    const ExamTimetable = require('../models/ExamTimetable');
    const exams = await ExamTimetable.find(filter)
      .populate('classroom')
      .sort({ date: 1, department: 1 });

    const imageBuffer = await reportService.generateTimetableImage(exams);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'attachment; filename=exam-timetable.jpg');
    res.send(imageBuffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/timetable
// @desc    Get exam timetable entries
// @access  Private/Admin
router.get('/timetable', async (req, res) => {
  try {
    const { campus, department, examType } = req.query;
    const filter = {};
    if (campus) filter.campus = campus;
    if (department) filter.department = department;
    if (examType) filter.examType = examType; // Filter by exam type

    const ExamTimetable = require('../models/ExamTimetable');
    const timetableEntries = await ExamTimetable.find(filter)
      .populate('classroom')
      .sort({ date: 1, department: 1 });

    res.json({
      success: true,
      count: timetableEntries.length,
      data: timetableEntries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/timetable/notify
// @desc    Send timetable notification to all faculty
// @access  Private/Admin
router.post('/timetable/notify', async (req, res) => {
  try {
    const { campus, department } = req.query;
    const filter = {};
    if (campus) filter.campus = campus;
    if (department) filter.department = department;

    const ExamTimetable = require('../models/ExamTimetable');
    const exams = await ExamTimetable.find(filter)
      .populate('classroom')
      .sort({ date: 1, department: 1 });

    // Removed User model - using Faculty model instead
    const emailService = require('../services/emailService');
    const reportService = require('../services/reportService');

    // Get all active faculty - more permissive query
    // Get faculty from the 'faculties' collection
    let facultyFilter = {};

    if (campus) facultyFilter.campus = campus;
    if (department) facultyFilter.department = department;

    // Get faculty from 'faculties' collection
    let faculty = await Faculty.find(facultyFilter);

    console.log(`📋 Found ${faculty.length} faculty member(s) from 'faculties' collection`);

    // Don't filter by isActive - use all faculty regardless of isActive status
    console.log(`✅ Using all ${faculty.length} faculty members (not filtering by isActive)`);

    if (faculty.length === 0) {
      // Debug: Check what users exist in all collections
      const adminCount = await Admin.countDocuments();
      const hodCount = await Hod.countDocuments();
      const facultyCount = await Faculty.countDocuments();
      console.log(`🔍 Debug: Total users by collection - Admins: ${adminCount}, HODs: ${hodCount}, Faculty: ${facultyCount}`);

      return res.status(400).json({
        success: false,
        message: `No faculty found to notify. Found ${facultyCount} faculty in 'faculties' collection. Please ensure faculty are uploaded via CSV.`
      });
    }

    // Generate timetable HTML table
    const timetableHTML = reportService.generateTimetableHTML(exams, {
      universityName: process.env.UNIVERSITY_NAME || 'Vignan University',
      semester: 'All Semesters',
      period: moment().format('MMMM-YYYY'),
      releaseDate: moment().format('DD.MM.YYYY'),
      examTime: '09:00 A.M. to 11:30 A.M.'
    });

    // Send email to each faculty
    let successCount = 0;
    let failCount = 0;

    for (const facultyMember of faculty) {
      try {
        const subject = `Exam Timetable - ${moment().format('MMMM YYYY')}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 100%; margin: 0 auto; padding: 20px; background: #f9fafb;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #4F46E5; margin-top: 0;">Exam Timetable Notification</h2>
              <p>Dear ${facultyMember.name},</p>
              <p>The exam timetable has been prepared and is now available. Please find the timetable below.</p>
              <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Total Exams:</strong> ${exams.length}</p>
                <p style="margin: 5px 0;"><strong>Period:</strong> ${moment().format('MMMM YYYY')}</p>
              </div>
            </div>
            
            ${timetableHTML}
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
              <p>Please review the timetable and ensure you are available for your assigned invigilation duties.</p>
              <p>Thank you.</p>
              <p style="margin-top: 20px; color: #6B7280; font-size: 12px;">
                This is an automated notification from Schedulo System.
              </p>
            </div>
          </div>
        `;

        await emailService.sendEmail(
          facultyMember.email,
          subject,
          html,
          `Exam Timetable Notification\n\nDear ${facultyMember.name},\n\nThe exam timetable has been prepared. Please check the email for the complete timetable.\n\nTotal Exams: ${exams.length}\nPeriod: ${moment().format('MMMM YYYY')}`
        );

        successCount++;
      } catch (error) {
        console.error(`Failed to send email to ${facultyMember.email}:`, error.message);
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Timetable sent to ${successCount} faculty member(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
      data: {
        totalFaculty: faculty.length,
        successCount,
        failCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/allocation-config
// @desc    Get allocation configuration
// @access  Private/Admin
router.get('/allocation-config', async (req, res) => {
  try {
    let config = await AllocationConfig.findOne({ isActive: true });

    // If no config exists, create default one
    if (!config) {
      config = await AllocationConfig.create({});
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/admin/allocation-config
// @desc    Update allocation configuration
// @access  Private/Admin
router.put('/allocation-config', async (req, res) => {
  try {
    const {
      maxHoursPerDay,
      maxDutiesPerFaculty,
      allowSameDayRepetition,
      timeGapBetweenDuties,
      departmentPreferenceWeight,
      campusPreferenceWeight
    } = req.body;

    let config = await AllocationConfig.findOne({ isActive: true });

    if (!config) {
      config = await AllocationConfig.create({
        maxHoursPerDay,
        maxDutiesPerFaculty,
        allowSameDayRepetition,
        timeGapBetweenDuties,
        departmentPreferenceWeight,
        campusPreferenceWeight
      });
    } else {
      if (maxHoursPerDay !== undefined) config.maxHoursPerDay = maxHoursPerDay;
      if (maxDutiesPerFaculty !== undefined) config.maxDutiesPerFaculty = maxDutiesPerFaculty;
      if (allowSameDayRepetition !== undefined) config.allowSameDayRepetition = allowSameDayRepetition;
      if (timeGapBetweenDuties !== undefined) config.timeGapBetweenDuties = timeGapBetweenDuties;
      if (departmentPreferenceWeight !== undefined) config.departmentPreferenceWeight = departmentPreferenceWeight;
      if (campusPreferenceWeight !== undefined) config.campusPreferenceWeight = campusPreferenceWeight;

      await config.save();
    }

    res.json({
      success: true,
      message: 'Allocation configuration updated successfully',
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/preview-allocation
// @desc    Preview allocation without saving (shows who will be assigned and conflicts)
// @access  Private/Admin
router.post('/preview-allocation', async (req, res) => {
  try {
    const { examIds, campus, department } = req.body;

    // Get preview allocation (doesn't save to database)
    const preview = await allocationService.previewAllocation(examIds, campus, department);

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/calendar
// @desc    Get calendar events for admin (entire university)
// @access  Private/Admin
router.get('/calendar', async (req, res) => {
  try {
    const { campus, department, examType, startDate, endDate } = req.query;

    console.log('📅 Fetching admin calendar with filters:', { campus, department, examType, startDate, endDate });

    const result = await calendarService.getAdminCalendar({
      campus,
      department,
      examType,
      startDate,
      endDate
    });

    console.log('✅ Calendar events generated:', result.totalEvents || 0);
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /api/admin/calendar:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get admin analytics (entire university)
// @access  Private/Admin
router.get('/analytics', async (req, res) => {
  try {
    const { campus, department, startDate, endDate } = req.query;

    console.log('📊 Fetching admin analytics with filters:', { campus, department, startDate, endDate });

    const result = await analyticsService.getAdminAnalytics({
      campus,
      department,
      startDate,
      endDate
    });

    console.log('✅ Analytics generated successfully');
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /api/admin/analytics:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// @route   GET /api/admin/acknowledgments
// @desc    Get all pending acknowledgments
// @access  Private/Admin
router.get('/acknowledgments', async (req, res) => {
  try {
    const { campus, department } = req.query;
    const filter = {
      status: { $ne: 'cancelled' }
    };

    if (campus) filter.campus = campus;
    if (department) filter.department = department;

    // Get all allocations without populating faculty (will do manually)
    const allocations = await Allocation.find(filter)
      .populate('exam', 'examName courseCode date startTime endTime examType')
      .sort({ date: 1, 'acknowledgmentDeadline': 1 })
      .lean();

    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(allocations.flatMap(a => [
      a.faculty?.toString(),
      ...(a.reservedFaculty || []).map(rf => rf.faculty?.toString())
    ].filter(Boolean)))];
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId department campus')
        .lean();
      facultyMembers.forEach(f => {
        facultyMap.set(f._id.toString(), f);
      });
    }

    // Attach faculty data to allocations
    const allocationsWithFaculty = allocations.map(allocation => {
      const allocationObj = allocation;
      const facultyId = allocation.faculty?.toString();
      if (facultyId && facultyMap.has(facultyId)) {
        allocationObj.faculty = facultyMap.get(facultyId);
      } else {
        allocationObj.faculty = null;
      }

      // Populate reservedFaculty
      if (allocationObj.reservedFaculty && Array.isArray(allocationObj.reservedFaculty)) {
        allocationObj.reservedFaculty = allocationObj.reservedFaculty.map(rf => {
          const rfId = rf.faculty?.toString();
          if (rfId && facultyMap.has(rfId)) {
            return { ...rf, faculty: facultyMap.get(rfId) };
          }
          return rf;
        });
      }

      return allocationObj;
    });

    // Filter by status and deadline (using allocationsWithFaculty)
    const now = new Date();
    const today = moment().startOf('day');

    // Helper function to check if exam date has passed
    const isExamDatePassed = (allocation) => {
      if (!allocation.exam || !allocation.exam.date) return false;
      const examDate = moment(allocation.exam.date).startOf('day');
      return examDate.isBefore(today);
    };

    const pending = allocationsWithFaculty.filter(a => {
      const isPending = a.preExamAcknowledgment?.status === 'pending' &&
        (!a.acknowledgmentDeadline || a.acknowledgmentDeadline > now);
      // Keep pending items even if exam date passed (they still need attention)
      return isPending;
    });

    const overdue = allocationsWithFaculty.filter(a => {
      const isOverdue = a.preExamAcknowledgment?.status === 'pending' &&
        a.acknowledgmentDeadline && a.acknowledgmentDeadline <= now;
      // Remove overdue items after exam date passes
      return isOverdue && !isExamDatePassed(a);
    });

    const acknowledged = allocationsWithFaculty.filter(a => {
      const isAcknowledged = a.preExamAcknowledgment?.status === 'acknowledged';
      // Remove acknowledged items after exam date passes
      return isAcknowledged && !isExamDatePassed(a);
    });

    res.json({
      success: true,
      data: {
        pending: pending,
        overdue: overdue,
        acknowledged: acknowledged,
        total: allocationsWithFaculty.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/live-status
// @desc    Get all live status updates (for exams happening today)
// @access  Private/Admin
router.get('/live-status', async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    const tomorrow = moment().endOf('day').toDate();

    // Get allocations without populating faculty (will do manually)
    const allocations = await Allocation.find({
      date: { $gte: today, $lte: tomorrow },
      status: { $ne: 'cancelled' }
    })
      .populate('exam', 'examName courseCode date startTime endTime')
      .sort({ date: 1, startTime: 1 });

    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(allocations.flatMap(a => [
      a.faculty?.toString(),
      ...(a.reservedFaculty || []).map(rf => rf.faculty?.toString())
    ].filter(Boolean)))];
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId phone department campus');
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

      // Populate reservedFaculty
      if (allocationObj.reservedFaculty && Array.isArray(allocationObj.reservedFaculty)) {
        allocationObj.reservedFaculty = allocationObj.reservedFaculty.map(rf => {
          const rfId = rf.faculty?.toString();
          if (rfId && facultyMap.has(rfId)) {
            return { ...rf, faculty: facultyMap.get(rfId) };
          }
          return rf;
        });
      }

      return allocationObj;
    });

    // Helper function to check if exam has ended (date + endTime passed)
    const isExamEnded = (allocation) => {
      if (!allocation.exam || !allocation.exam.date || !allocation.exam.endTime) return false;
      const examDate = moment(allocation.exam.date).format('YYYY-MM-DD');
      const examEndDateTime = moment(`${examDate} ${allocation.exam.endTime}`, 'YYYY-MM-DD HH:mm');
      return moment().isAfter(examEndDateTime);
    };

    // Group by status (using allocationsWithFaculty)
    // Remove "Present" items after exam ends
    const present = allocationsWithFaculty.filter(a => {
      const isPresent = a.liveStatus?.status === 'present';
      return isPresent && !isExamEnded(a);
    });

    // Remove "On the Way" after exam ends (if they become "Present", status changes automatically)
    const onTheWay = allocationsWithFaculty.filter(a => {
      const isOnTheWay = a.liveStatus?.status === 'on_the_way';
      // Remove after exam ends
      return isOnTheWay && !isExamEnded(a);
    });

    // Keep "Unable to Reach" visible (require action) - remove only after exam ends
    const unableToReach = allocationsWithFaculty.filter(a => {
      const isUnableToReach = a.liveStatus?.status === 'unable_to_reach';
      // Remove only after exam ends (keep visible until then for admin action)
      return isUnableToReach && !isExamEnded(a);
    });

    // Keep "No Status" visible (require action) - remove only after exam ends
    const noStatus = allocationsWithFaculty.filter(a => {
      const hasNoStatus = !a.liveStatus || !a.liveStatus.status;
      // Remove only after exam ends (keep visible until then for admin action)
      return hasNoStatus && !isExamEnded(a);
    });

    res.json({
      success: true,
      data: {
        present,
        onTheWay,
        unableToReach,
        noStatus,
        total: allocationsWithFaculty.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/allocations/:allocationId/add-faculty
// @desc    Manually add faculty to an allocation (after allocation)
// @access  Private/Admin
router.post('/allocations/:allocationId/add-faculty', async (req, res) => {
  try {
    const { facultyId } = req.body;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'Faculty ID is required'
      });
    }

    // Get allocation
    const allocation = await Allocation.findById(req.params.allocationId)
      .populate('exam', 'examName courseCode date startTime endTime');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Check if faculty exists
    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Check if faculty is already assigned to this allocation
    if (allocation.faculty.toString() === facultyId) {
      return res.status(400).json({
        success: false,
        message: 'Faculty is already assigned to this allocation'
      });
    }

    // Check if faculty has a conflict (already assigned to another allocation at same time)
    const conflictingAllocation = await Allocation.findOne({
      faculty: facultyId,
      date: allocation.date,
      startTime: allocation.startTime,
      endTime: allocation.endTime,
      status: { $ne: 'cancelled' },
      _id: { $ne: allocation._id }
    });

    if (conflictingAllocation) {
      return res.status(400).json({
        success: false,
        message: `Faculty is already assigned to another allocation at the same time (${conflictingAllocation.exam?.examName || 'Unknown'})`
      });
    }

    // Update allocation with new faculty
    allocation.faculty = facultyId;
    allocation.status = 'assigned';

    // Reset acknowledgment status since it's a new assignment
    allocation.preExamAcknowledgment = {
      status: 'pending',
      acknowledgedAt: null,
      unavailableReason: null,
      acknowledgedBy: null
    };
    allocation.notified = false;
    allocation.notifiedAt = null;

    await allocation.save();

    // Manually populate faculty for response
    const facultyData = {
      _id: faculty._id,
      name: faculty.name,
      email: faculty.email,
      employeeId: faculty.employeeId,
      department: faculty.department,
      campus: faculty.campus
    };

    res.json({
      success: true,
      message: 'Faculty added to allocation successfully',
      data: {
        ...allocation.toObject(),
        faculty: facultyData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/replace-faculty/:allocationId
// @desc    Replace faculty with reserved faculty (admin confirms)
// @access  Private/Admin
router.post('/replace-faculty/:allocationId', async (req, res) => {
  try {
    const { reservedFacultyId } = req.body;
    // Get allocation without populating faculty (will do manually)
    const allocation = await Allocation.findById(req.params.allocationId)
      .populate('exam', 'examName courseCode date startTime endTime');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Manually populate faculty from Faculty collection
    const facultyIds = [
      allocation.faculty?.toString(),
      ...(allocation.reservedFaculty || []).map(rf => rf.faculty?.toString())
    ].filter(Boolean);
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email employeeId');
      facultyMembers.forEach(f => {
        facultyMap.set(f._id.toString(), f);
      });
    }

    // Attach faculty data to allocation
    const allocationObj = allocation.toObject ? allocation.toObject() : allocation;
    const facultyId = allocation.faculty?.toString();
    if (facultyId && facultyMap.has(facultyId)) {
      allocationObj.faculty = facultyMap.get(facultyId);
    } else {
      allocationObj.faculty = null;
    }

    // Populate reservedFaculty
    if (allocationObj.reservedFaculty && Array.isArray(allocationObj.reservedFaculty)) {
      allocationObj.reservedFaculty = allocationObj.reservedFaculty.map(rf => {
        const rfId = rf.faculty?.toString();
        if (rfId && facultyMap.has(rfId)) {
          return { ...rf, faculty: facultyMap.get(rfId) };
        }
        return rf;
      });
    }

    const allocationWithFaculty = allocationObj;

    // Find the reserved faculty in the allocation
    const reserved = allocationWithFaculty.reservedFaculty.find(
      rf => rf.faculty?._id?.toString() === reservedFacultyId || rf.faculty?.toString() === reservedFacultyId
    );

    if (!reserved) {
      return res.status(404).json({
        success: false,
        message: 'Reserved faculty not found for this allocation'
      });
    }

    // Get the reserved faculty user (could be in any collection)
    const reservedFacultyUserResult = await findUserById(reservedFacultyId);
    if (!reservedFacultyUserResult) {
      return res.status(404).json({
        success: false,
        message: 'Reserved faculty user not found'
      });
    }
    const reservedFacultyUser = reservedFacultyUserResult;

    // Create new allocation for reserved faculty
    const newAllocation = await Allocation.create({
      exam: allocationWithFaculty.exam._id,
      classroom: allocationWithFaculty.classroom,
      faculty: reservedFacultyId,
      date: allocationWithFaculty.date,
      startTime: allocationWithFaculty.startTime,
      endTime: allocationWithFaculty.endTime,
      campus: allocationWithFaculty.campus,
      department: allocationWithFaculty.department,
      status: 'assigned',
      // Copy acknowledgment and live status settings
      acknowledgmentDeadline: allocationWithFaculty.acknowledgmentDeadline,
      preExamAcknowledgment: {
        status: 'pending'
      },
      liveStatusWindow: allocation.liveStatusWindow
    });

    // Update old allocation status
    allocation.status = 'replaced';
    allocation.liveStatus = {
      status: 'unable_to_reach',
      updatedAt: new Date(),
      emergencyReason: 'Replaced by reserved faculty'
    };
    await allocation.save();

    // Update reserved allocation status
    const ReservedAllocation = require('../models/ReservedAllocation');
    await ReservedAllocation.updateMany(
      {
        primaryAllocation: allocation._id,
        reservedFaculty: reservedFacultyId
      },
      {
        status: 'activated',
        activatedAt: new Date(),
        replacedAllocation: allocation._id
      }
    );

    // Update reserved faculty status in allocation
    reserved.status = 'activated';
    reserved.activatedAt = new Date();
    await allocation.save();

    // Emit socket event
    const io = req.app.get('io');
    io.emit('faculty-replaced', {
      oldAllocationId: allocation._id,
      newAllocationId: newAllocation._id,
      oldFaculty: allocation.faculty,
      newFaculty: reservedFacultyUser,
      exam: allocation.exam
    });

    // Send notification to new faculty
    const emailService = require('../services/emailService');
    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findById(allocation.classroom);
    await emailService.sendAllocationNotification(
      reservedFacultyUser,
      newAllocation,
      allocation.exam,
      classroom
    );

    res.json({
      success: true,
      message: 'Faculty replaced successfully',
      data: {
        oldAllocation: allocation,
        newAllocation: newAllocation
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/classrooms/check
// @desc    Check classroom distribution by block (diagnostic)
// @access  Private/Admin
router.get('/classrooms/check', async (req, res) => {
  try {
    const { campus } = req.query;
    const query = { isActive: true };
    if (campus) query.campus = campus;

    const allRooms = await Classroom.find(query).sort({ block: 1, floor: 1, roomNumber: 1 });

    const blocksDistribution = {};
    const floorsByBlock = {};
    const totalRooms = allRooms.length;

    allRooms.forEach(room => {
      const block = room.block || 'Unknown';
      blocksDistribution[block] = (blocksDistribution[block] || 0) + 1;

      if (!floorsByBlock[block]) {
        floorsByBlock[block] = {};
      }
      const floor = room.floor || 0;
      floorsByBlock[block][floor] = (floorsByBlock[block][floor] || 0) + 1;
    });

    res.json({
      success: true,
      totalClassrooms: totalRooms,
      blocksDistribution,
      floorsByBlock,
      rooms: allRooms.map(room => ({
        roomNumber: room.roomNumber,
        block: room.block,
        floor: room.floor,
        isActive: room.isActive,
        campus: room.campus
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/admin/timetable/cleanup
// @desc    Manually clean up old converted ExamTimetable records (auto cleanup runs automatically)
// @access  Private/Admin
router.delete('/timetable/cleanup', async (req, res) => {
  try {
    const { daysOld = 30, dryRun = false } = req.query;
    const cleanupService = require('../services/cleanupService');

    if (dryRun === 'true') {
      const ExamTimetable = require('../models/ExamTimetable');
      const cutoffDate = moment().subtract(parseInt(daysOld), 'days').toDate();
      const oldRecords = await ExamTimetable.find({
        status: 'converted',
        convertedAt: { $lt: cutoffDate }
      });

      return res.json({
        success: true,
        message: `Dry run: Found ${oldRecords.length} converted ExamTimetable record(s) older than ${daysOld} days`,
        count: oldRecords.length,
        cutoffDate: cutoffDate,
        records: oldRecords.map(r => ({
          _id: r._id,
          examName: r.examName,
          courseCode: r.courseCode,
          convertedAt: r.convertedAt
        }))
      });
    }

    // Use cleanup service
    const result = await cleanupService.cleanupOldConvertedRecords(parseInt(daysOld));

    res.json({
      success: result.success,
      message: result.message || 'Cleanup completed',
      deletedCount: result.deletedCount || 0,
      cutoffDate: result.cutoffDate,
      note: 'Note: Auto cleanup runs automatically every 24 hours. This is a manual cleanup.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/timetable/cleanup/stats
// @desc    Get cleanup statistics
// @access  Private/Admin
router.get('/timetable/cleanup/stats', async (req, res) => {
  try {
    const cleanupService = require('../services/cleanupService');
    const stats = await cleanupService.getCleanupStats();

    res.json({
      success: true,
      ...stats,
      autoCleanupEnabled: true,
      note: 'Auto cleanup runs automatically every 24 hours to delete converted records older than 30 days'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


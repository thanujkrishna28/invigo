const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { Faculty, findUserById } = require('../utils/userHelper');
const Allocation = require('../models/Allocation');
const Exam = require('../models/Exam');
const calendarService = require('../services/calendarService');
const analyticsService = require('../services/analyticsService');
const moment = require('moment');

// All routes require authentication
router.use(protect);

// @route   GET /api/faculty/dashboard
// @desc    Get faculty dashboard data
// @access  Private/Faculty
router.get('/dashboard', async (req, res) => {
  try {
    const facultyId = req.user._id;

    // Get allocations
    const allocations = await Allocation.find({
      faculty: facultyId,
      status: { $ne: 'cancelled' }
    })
      .populate('exam', 'examName courseCode date startTime endTime classroom')
      .sort({ date: 1, startTime: 1 });

    // Calculate statistics
    const totalDuties = allocations.length;
    const totalHours = allocations.reduce((sum, a) => {
      const start = moment(a.startTime, 'HH:mm');
      const end = moment(a.endTime, 'HH:mm');
      return sum + end.diff(start, 'hours', true);
    }, 0);

    // Upcoming duties (next 7 days)
    const sevenDaysFromNow = moment().add(7, 'days').toDate();
    const upcomingDuties = allocations.filter(a => 
      moment(a.date).isAfter(moment()) && moment(a.date).isBefore(sevenDaysFromNow)
    );

    // Today's duties
    const today = moment().format('YYYY-MM-DD');
    const todayDuties = allocations.filter(a => 
      moment(a.date).format('YYYY-MM-DD') === today
    );

    // Pending notifications (notified but not acknowledged)
    const pendingNotifications = allocations.filter(a => 
      a.notified === true && 
      a.preExamAcknowledgment && 
      a.preExamAcknowledgment.status === 'pending'
    );

    res.json({
      success: true,
      data: {
        statistics: {
          totalDuties,
          totalHours: Math.round(totalHours * 10) / 10,
          upcomingDuties: upcomingDuties.length,
          todayDuties: todayDuties.length,
          pendingNotifications: pendingNotifications.length
        },
        todayDuties,
        upcomingDuties: upcomingDuties.slice(0, 5),
        pendingNotifications: pendingNotifications.slice(0, 5), // Show top 5 pending
        allAllocations: allocations
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/faculty/duties
// @desc    Get faculty duties with filters
// @access  Private/Faculty
router.get('/duties', async (req, res) => {
  try {
    const { view, startDate, endDate, showNotifications } = req.query;
    const facultyId = req.user._id;

    let dateFilter = {};
    const now = moment();

    // Apply view filter
    if (view === 'today') {
      const today = moment().format('YYYY-MM-DD');
      dateFilter = {
        $gte: moment(today).startOf('day').toDate(),
        $lte: moment(today).endOf('day').toDate()
      };
    } else if (view === 'week') {
      dateFilter = {
        $gte: now.startOf('week').toDate(),
        $lte: now.endOf('week').toDate()
      };
    } else if (view === 'month') {
      dateFilter = {
        $gte: now.startOf('month').toDate(),
        $lte: now.endOf('month').toDate()
      };
    } else if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
    } else {
      // Default: upcoming duties
      dateFilter.$gte = now.toDate();
    }

    const filter = {
      faculty: facultyId,
      status: { $ne: 'cancelled' }
    };

    if (Object.keys(dateFilter).length > 0) {
      filter.date = dateFilter;
    }

    // If showNotifications=true, only show pending acknowledgments (notifications)
    // If false or not set, show all duties including acknowledged ones
    if (showNotifications === 'true') {
      filter['preExamAcknowledgment.status'] = 'pending';
      filter.notified = true; // Only show notified allocations
    }

    const allocations = await Allocation.find(filter)
      .populate('exam', 'examName courseCode date startTime endTime classroom')
      .populate('exam.classroom', 'roomNumber building')
      .sort({ date: 1, startTime: 1 });

    res.json({
      success: true,
      count: allocations.length,
      data: allocations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// @route   POST /api/faculty/acknowledge/:allocationId
// @desc    Acknowledge or mark unavailable for pre-exam duty
// @access  Private/Faculty
router.post('/acknowledge/:allocationId', async (req, res) => {
  try {
    const { action, reason } = req.body; // action: 'acknowledge' or 'unavailable'
    const allocation = await Allocation.findById(req.params.allocationId)
      .populate('exam', 'examName courseCode date startTime endTime');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Check if faculty owns this allocation
    if (allocation.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to acknowledge this allocation'
      });
    }

    // Check if deadline has passed
    if (allocation.acknowledgmentDeadline && new Date() > allocation.acknowledgmentDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Acknowledgement deadline has passed. Please contact admin.'
      });
    }

    // Update acknowledgment
    if (action === 'acknowledge') {
      allocation.preExamAcknowledgment = {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user._id
      };
      allocation.status = 'confirmed';
    } else if (action === 'unavailable') {
      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Reason is required when marking unavailable'
        });
      }
      allocation.preExamAcknowledgment = {
        status: 'unavailable',
        acknowledgedAt: new Date(),
        unavailableReason: reason.trim(),
        acknowledgedBy: req.user._id
      };
      // Alert admin - don't auto-replace, just notify
      const io = req.app.get('io');
      io.emit('faculty-unavailable', {
        allocationId: allocation._id,
        facultyId: req.user._id,
        reason: reason.trim(),
        exam: allocation.exam
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "acknowledge" or "unavailable"'
      });
    }

    await allocation.save();

    res.json({
      success: true,
      message: action === 'acknowledge' 
        ? 'Duty acknowledged successfully' 
        : 'Unavailability noted. Admin will be notified.',
      data: allocation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/faculty/live-status/:allocationId
// @desc    Update live status (Present, On the Way, Unable to Reach)
// @access  Private/Faculty
router.post('/live-status/:allocationId', async (req, res) => {
  try {
    const { status, eta, emergencyReason } = req.body;
    const allocation = await Allocation.findById(req.params.allocationId)
      .populate('exam', 'examName courseCode date startTime endTime');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Check if faculty owns this allocation
    if (allocation.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this allocation'
      });
    }

    // Check if live status window is open (30 minutes before exam)
    const now = new Date();
    if (!allocation.liveStatusWindow || 
        now < allocation.liveStatusWindow.opensAt || 
        now > allocation.liveStatusWindow.closesAt) {
      return res.status(400).json({
        success: false,
        message: 'Live status can only be updated 30 minutes before exam start time'
      });
    }

    // Validate status
    const validStatuses = ['present', 'on_the_way', 'unable_to_reach'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Update live status
    allocation.liveStatus = {
      status: status,
      updatedAt: new Date(),
      eta: status === 'on_the_way' ? eta : null,
      emergencyReason: status === 'unable_to_reach' ? emergencyReason : null
    };

    await allocation.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('live-status-updated', {
      allocationId: allocation._id,
      status: status,
      facultyId: req.user._id,
      exam: allocation.exam
    });

    // If unable to reach, alert admin and suggest reserved faculty
    if (status === 'unable_to_reach') {
      // Get reserved faculty suggestions
      const reservedFaculty = allocation.reservedFaculty || [];
      const suggestions = reservedFaculty
        .filter(rf => rf.status === 'available')
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 2); // Top 2 suggestions

      io.emit('faculty-unable-to-reach', {
        allocationId: allocation._id,
        facultyId: req.user._id,
        exam: allocation.exam,
        emergencyReason: emergencyReason,
        suggestedReservedFaculty: suggestions,
        timestamp: new Date()
      });

      // Send email alert to admin
      try {
        const { Admin } = require('../utils/userHelper');
        const Classroom = require('../models/Classroom');
        const adminUsers = await Admin.find({ isActive: true });
        const classroom = await Classroom.findById(allocation.classroom);
        const emailService = require('../services/emailService');
        
        for (const admin of adminUsers) {
          await emailService.sendEmergencyAlert(
            admin.email,
            req.user,
            allocation,
            allocation.exam,
            emergencyReason,
            suggestions
          );
        }
      } catch (emailError) {
        console.error('Error sending emergency email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: 'Live status updated successfully',
      data: allocation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/faculty/exams
// @desc    Get exam timetables for faculty (filtered by campus and department)
// @access  Private/Faculty
router.get('/exams', async (req, res) => {
  try {
    // req.user is already populated by protect middleware from the correct collection
    const faculty = req.user;
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    const { campus, department, startDate, endDate, status } = req.query;
    const filter = {};

    // Filter by faculty's campus and department if not specified
    if (campus) {
      filter.campus = campus;
    } else if (faculty.campus) {
      filter.campus = faculty.campus;
    }

    if (department) {
      filter.department = department;
    } else if (faculty.department) {
      filter.department = faculty.department;
    }

    if (status) filter.status = status;

    // Date filters
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    } else {
      // Default: show upcoming exams
      filter.date = { $gte: new Date() };
    }

    // Get exams without populating allocatedInvigilators.faculty (will do manually)
    const exams = await Exam.find(filter)
      .populate('classroom', 'roomNumber block floor building')
      .sort({ date: 1, startTime: 1 });

    // Manually populate faculty in allocatedInvigilators
    const facultyIds = [...new Set(exams.flatMap(exam => 
      (exam.allocatedInvigilators || []).map(ai => ai.faculty?.toString()).filter(Boolean)
    ))];
    const facultyMap = new Map();
    
    if (facultyIds.length > 0) {
      const { Faculty } = require('../utils/userHelper');
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
      count: examsWithFaculty.length,
      data: examsWithFaculty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/faculty/calendar
// @desc    Get calendar events for faculty (their own duties only)
// @access  Private/Faculty
router.get('/calendar', async (req, res) => {
  try {
    const facultyId = req.user._id;
    const { startDate, endDate } = req.query;
    
    const result = await calendarService.getFacultyCalendar(facultyId, {
      startDate,
      endDate
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/faculty/analytics
// @desc    Get faculty personal analytics
// @access  Private/Faculty
router.get('/analytics', async (req, res) => {
  try {
    const facultyId = req.user._id;
    const { startDate, endDate } = req.query;
    
    const result = await analyticsService.getFacultyAnalytics(facultyId, {
      startDate,
      endDate
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


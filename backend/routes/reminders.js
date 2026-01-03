const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Allocation = require('../models/Allocation');
const emailService = require('../services/emailService');
const moment = require('moment');

// All routes require admin access
router.use(protect);
router.use(authorize('admin'));

/**
 * Send acknowledgment reminders for pending acknowledgments
 * This should be run as a scheduled job (cron) daily
 */
router.post('/send-acknowledgment-reminders', async (req, res) => {
  try {
    const now = new Date();
    const tomorrow = moment().add(1, 'days').toDate();
    
    // Find allocations with pending acknowledgments that are due in 1-2 days
    // Get allocations without populating faculty (will do manually)
    const allocations = await Allocation.find({
      'preExamAcknowledgment.status': 'pending',
      date: { $gte: now, $lte: tomorrow },
      acknowledgmentReminderSent: false,
      status: { $ne: 'cancelled' }
    })
      .populate('exam', 'examName courseCode')
      .populate('classroom', 'roomNumber block floor');

    // Manually populate faculty from Faculty collection
    const { Faculty } = require('../utils/userHelper');
    const facultyIds = [...new Set(allocations.map(a => a.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();
    
    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
        .select('name email');
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

    let sentCount = 0;
    let errorCount = 0;

    for (const allocation of allocations) {
      try {
        await emailService.sendAcknowledgmentReminder(
          allocation.faculty,
          allocation,
          allocation.exam,
          allocation.classroom
        );
        allocation.acknowledgmentReminderSent = true;
        await allocation.save();
        sentCount++;
      } catch (error) {
        console.error(`Error sending reminder to ${allocation.faculty?.email}:`, error);
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Reminders sent: ${sentCount}, Errors: ${errorCount}`,
      data: {
        sent: sentCount,
        errors: errorCount,
        total: allocations.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


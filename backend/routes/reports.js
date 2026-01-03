const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Allocation = require('../models/Allocation');
const reportService = require('../services/reportService');

// All routes require authentication
router.use(protect);

// @route   GET /api/reports/pdf
// @desc    Generate PDF report
// @access  Private
router.get('/pdf', async (req, res) => {
  try {
    const { campus, department, startDate, endDate, facultyId } = req.query;

    // Build filter
    const filter = {};
    if (req.user.role === 'faculty') {
      filter.faculty = req.user._id;
    } else {
      if (campus) filter.campus = campus;
      if (department) filter.department = department;
      if (facultyId) filter.faculty = facultyId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Fetch allocations without populating faculty (will do manually)
    const allocations = await Allocation.find(filter)
      .populate({
        path: 'classroom',
        select: 'roomNumber block floor building campus isActive'
      })
      .populate('exam', 'examName courseCode')
      .sort({ date: 1, startTime: 1 });

    // Manually populate faculty from Faculty collection
    const { Faculty } = require('../utils/userHelper');
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

    const pdfBuffer = await reportService.generatePDFReport(allocationsWithFaculty, {
      title: 'Invigilation Allocation Report',
      startDate,
      endDate
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
    res.setHeader('Content-Disposition', 'attachment; filename="allocations-report.pdf"');
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

// @route   GET /api/reports/excel
// @desc    Generate Excel report
// @access  Private
router.get('/excel', async (req, res) => {
  try {
    const { campus, department, startDate, endDate, facultyId } = req.query;

    const filter = {};
    if (req.user.role === 'faculty') {
      filter.faculty = req.user._id;
    } else {
      if (campus) filter.campus = campus;
      if (department) filter.department = department;
      if (facultyId) filter.faculty = facultyId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Fetch allocations without populating faculty (will do manually)
    const allocations = await Allocation.find(filter)
      .populate({
        path: 'classroom',
        select: 'roomNumber block floor building campus isActive'
      })
      .populate('exam', 'examName courseCode')
      .sort({ date: 1, startTime: 1 });

    // Manually populate faculty from Faculty collection
    const { Faculty } = require('../utils/userHelper');
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

    const excelBuffer = await reportService.generateExcelReport(allocationsWithFaculty);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=allocations-report.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/reports/duty-letter/:allocationId
// @desc    Generate individual duty letter (PDF)
// @access  Private/Faculty
router.get('/duty-letter/:allocationId', async (req, res) => {
  try {
    // Get allocation without populating faculty (will do manually)
    const allocation = await Allocation.findById(req.params.allocationId)
      .populate({
        path: 'exam',
        select: 'examName courseCode classroom',
        populate: {
          path: 'classroom',
          select: 'roomNumber block floor'
        }
      });

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Manually populate faculty from Faculty collection
    const { Faculty } = require('../utils/userHelper');
    const facultyId = allocation.faculty?.toString();
    let faculty = null;
    if (facultyId) {
      faculty = await Faculty.findById(facultyId).select('name email employeeId');
    }
    
    const allocationObj = allocation.toObject ? allocation.toObject() : allocation;
    allocationObj.faculty = faculty;

    // Faculty can only download their own duty letters
    if (req.user.role === 'faculty' && allocationObj.faculty && allocationObj.faculty._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to download this duty letter'
      });
    }

    const pdfBuffer = await reportService.generateDutyLetter(allocationObj);

    // Ensure buffer is valid
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      console.error('Invalid PDF buffer generated');
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF - invalid buffer'
      });
    }

    console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=duty-letter-${allocation._id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Use res.end with binary encoding for PDF
    res.end(pdfBuffer, 'binary');
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/reports/ical/:allocationId
// @desc    Generate iCal file for Google Calendar
// @access  Private/Faculty
router.get('/ical/:allocationId', async (req, res) => {
  try {
    // Get allocation without populating faculty (will do manually)
    const allocation = await Allocation.findById(req.params.allocationId)
      .populate('exam', 'examName courseCode');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Manually populate faculty from Faculty collection
    const { Faculty } = require('../utils/userHelper');
    const facultyId = allocation.faculty?.toString();
    let faculty = null;
    if (facultyId) {
      faculty = await Faculty.findById(facultyId).select('name email');
    }
    
    const allocationObj = allocation.toObject ? allocation.toObject() : allocation;
    allocationObj.faculty = faculty;

    if (req.user.role === 'faculty' && allocationObj.faculty && allocationObj.faculty._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const ical = reportService.generateICal(allocationObj);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename=duty-${allocation._id}.ics`);
    res.send(ical);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


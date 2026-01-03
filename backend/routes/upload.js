const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');
const fileUploadService = require('../services/fileUploadService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed.'));
    }
  }
});

// @route   POST /api/upload/exam-timetable/preview
// @desc    Preview exam timetable (parse and validate without saving)
// @access  Private/Admin
router.post('/exam-timetable/preview', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'excel';
    const examType = req.body.examType || req.query.examType || 'semester';
    const result = await fileUploadService.previewExamTimetable(req.file.path, fileType, examType);

    // Keep file for potential save operation
    // Don't delete here - let the save endpoint handle it

    res.json({
      success: true,
      message: `Preview completed: ${result.validRows} valid, ${result.invalidRows} invalid rows`,
      data: result
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/upload/exam-timetable
// @desc    Upload exam timetable (CSV/Excel) - saves to database
// @access  Private/Admin
router.post('/exam-timetable', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'excel';
    const examType = req.body.examType || 'semester'; // mid-term, semester, labs
    const result = await fileUploadService.uploadExamTimetable(req.file.path, fileType, examType);

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️  Upload completed with errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      return res.status(200).json({
        success: true,
        message: `Uploaded with ${result.errors.length} errors`,
        data: result,
        warnings: result.errors
      });
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${result.examsCreated || 0} exam(s)`,
      data: result
    });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/upload/classrooms/preview
// @desc    Preview classroom details (parse and validate without saving)
// @access  Private/Admin
router.post('/classrooms/preview', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'excel';
    const result = await fileUploadService.previewClassrooms(req.file.path, fileType);

    res.json({
      success: true,
      message: `Preview completed: ${result.validRows} valid, ${result.invalidRows} invalid rows`,
      data: result
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/upload/classrooms
// @desc    Upload classroom details (CSV/Excel) - saves to database
// @access  Private/Admin
router.post('/classrooms', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'excel';
    const result = await fileUploadService.uploadClassrooms(req.file.path, fileType);

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️  Upload completed with errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      return res.status(200).json({
        success: true,
        message: `Uploaded with ${result.errors.length} errors`,
        data: result,
        warnings: result.errors
      });
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${result.classroomsCreated} classrooms`,
      data: result
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/upload/faculty/preview
// @desc    Preview faculty details (parse and validate without saving)
// @access  Private/Admin
router.post('/faculty/preview', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'excel';
    const result = await fileUploadService.previewFaculty(req.file.path, fileType);

    res.json({
      success: true,
      message: `Preview completed: ${result.validRows} valid, ${result.invalidRows} invalid rows`,
      data: result
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/upload/faculty
// @desc    Upload faculty details (CSV/Excel) - saves to database
// @access  Private/Admin
router.post('/faculty', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'excel';
    const result = await fileUploadService.uploadFaculty(req.file.path, fileType);

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️  Upload completed with errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      return res.status(200).json({
        success: true,
        message: `Uploaded with ${result.errors.length} errors`,
        data: result,
        warnings: result.errors
      });
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${result.facultyCreated} faculty members`,
      data: result
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/upload/exam-timetable-prep
// @desc    Upload exam timetable for timetable preparation (separate from regular exams)
// @access  Private/Admin
router.post('/exam-timetable-prep', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'excel';
    const examType = req.body.examType || 'semester'; // mid-term, semester, labs
    const result = await fileUploadService.uploadExamTimetablePrep(req.file.path, fileType, examType);

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️  Upload completed with errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      return res.status(200).json({
        success: true,
        message: `Uploaded with ${result.errors.length} errors`,
        data: result,
        warnings: result.errors
      });
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${result.examsCreated || 0} exam(s)`,
      data: result
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;


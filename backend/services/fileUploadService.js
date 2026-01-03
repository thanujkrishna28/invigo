const XLSX = require('xlsx');
const Papa = require('papaparse');
const fs = require('fs');
const moment = require('moment');
const Exam = require('../models/Exam');
const Classroom = require('../models/Classroom');
const ExamTimetable = require('../models/ExamTimetable');
const bcrypt = require('bcryptjs');
const { Admin, Hod, Faculty, getModelByRole } = require('../utils/userHelper');

class FileUploadService {
  /**
   * Parse CSV or Excel file
   */
  async parseFile(filePath, fileType) {
    try {
      if (fileType === 'csv') {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim()
        });

        if (parsed.errors && parsed.errors.length > 0) {
          console.warn('CSV parsing warnings:', parsed.errors);
        }

        return parsed.data;
      } else {
        // Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, {
          defval: null,
          raw: false
        });
        return data;
      }
    } catch (error) {
      throw new Error(`Error parsing file: ${error.message}`);
    }
  }

  /**
   * Infer department from course code
   */
  inferDepartmentFromCourseCode(courseCode) {
    if (!courseCode) return 'CSE';

    const code = courseCode.toString().toUpperCase().trim();

    // Common department codes
    if (code.startsWith('CS') || code.startsWith('CSE')) return 'CSE';
    if (code.startsWith('IT')) return 'IT';
    if (code.startsWith('ECE') || code.startsWith('EC')) return 'ECE';
    if (code.startsWith('EEE') || code.startsWith('EE')) return 'EEE';
    if (code.startsWith('ME') || code.startsWith('MECH')) return 'ME';
    if (code.startsWith('CE') || code.startsWith('CIVIL')) return 'CE';
    if (code.startsWith('BT') || code.startsWith('BIO')) return 'BT';

    return 'CSE'; // Default
  }

  /**
   * Parse and validate file (for preview mode - doesn't save to database)
   */
  async previewExamTimetable(filePath, fileType, examType = 'semester') {
    try {
      const data = await this.parseFile(filePath, fileType);
      const previewData = [];
      const errors = [];
      const warnings = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowData = {
          rowNumber: i + 2, // Excel row number (accounting for header)
          rawData: row,
          isValid: true,
          errors: [],
          warnings: [],
          parsedData: null
        };

        try {
          // Validate required fields
          const requiredFields = ['examId', 'examName', 'courseCode', 'date', 'startTime', 'endTime'];
          const missingFields = requiredFields.filter(field => {
            const value = row[field];
            return !value || (typeof value === 'string' && value.trim() === '');
          });

          if (missingFields.length > 0) {
            rowData.isValid = false;
            rowData.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
            errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            previewData.push(rowData);
            continue;
          }

          // Infer department from courseCode if not provided
          const department = row.department || this.inferDepartmentFromCourseCode(row.courseCode);
          const campus = row.campus || 'Vignan University';

          // Parse date - handle multiple formats including Excel dates
          let examDate = null;
          const dateValue = row.date;

          if (!dateValue) {
            rowData.isValid = false;
            rowData.errors.push('Date is required');
            errors.push(`Row ${i + 2}: Date is required`);
            previewData.push(rowData);
            continue;
          }

          // Convert to string and trim
          const dateStr = String(dateValue).trim();

          // Try YYYY-MM-DD format first (strict)
          if (moment(dateStr, 'YYYY-MM-DD', true).isValid()) {
            examDate = moment(dateStr, 'YYYY-MM-DD', true).toDate();
          }
          // Try Excel date serial number (numeric value)
          else if (!isNaN(dateValue) && dateValue > 0) {
            // Excel date serial number (days since 1900-01-01)
            const excelEpoch = moment('1899-12-30', 'YYYY-MM-DD');
            examDate = excelEpoch.add(parseInt(dateValue), 'days').toDate();
          }
          // Try common date formats
          else if (moment(dateStr, 'DD-MM-YYYY', true).isValid()) {
            examDate = moment(dateStr, 'DD-MM-YYYY', true).toDate();
          }
          else if (moment(dateStr, 'MM/DD/YYYY', true).isValid()) {
            examDate = moment(dateStr, 'MM/DD/YYYY', true).toDate();
          }
          else if (moment(dateStr, 'DD/MM/YYYY', true).isValid()) {
            examDate = moment(dateStr, 'DD/MM/YYYY', true).toDate();
          }
          else if (moment(dateStr, 'YYYY/MM/DD', true).isValid()) {
            examDate = moment(dateStr, 'YYYY/MM/DD', true).toDate();
          }
          // Try flexible parsing (last resort)
          else if (moment(dateStr).isValid()) {
            examDate = moment(dateStr).toDate();
            // Validate it's a reasonable date (not too far in past/future)
            const year = examDate.getFullYear();
            if (year < 2000 || year > 2100) {
              rowData.isValid = false;
              rowData.errors.push(`Invalid date format (year out of range: ${year}). Please use YYYY-MM-DD format.`);
              errors.push(`Row ${i + 2}: Invalid date format (year out of range: ${year}). Please use YYYY-MM-DD format.`);
              previewData.push(rowData);
              continue;
            }
          }
          else {
            rowData.isValid = false;
            rowData.errors.push(`Invalid date format "${dateStr}". Please use YYYY-MM-DD format (e.g., 2024-12-20).`);
            errors.push(`Row ${i + 2}: Invalid date format "${dateStr}". Please use YYYY-MM-DD format (e.g., 2024-12-20).`);
            previewData.push(rowData);
            continue;
          }

          // Final validation - ensure date is valid
          if (!examDate || isNaN(examDate.getTime())) {
            rowData.isValid = false;
            rowData.errors.push(`Invalid date format "${dateStr}". Please use YYYY-MM-DD format.`);
            errors.push(`Row ${i + 2}: Invalid date format "${dateStr}". Please use YYYY-MM-DD format.`);
            previewData.push(rowData);
            continue;
          }

          // Parse time
          const parseTime = (timeStr) => {
            if (!timeStr) return null;
            const timeUpper = timeStr.trim().toUpperCase();

            if (timeUpper.includes('AM') || timeUpper.includes('PM') || timeUpper.includes('A.M.') || timeUpper.includes('P.M.')) {
              let normalized = timeUpper.replace(/\./g, '').replace(/\s+/g, ' ');
              const parsed = moment(normalized, ['hh:mm A', 'h:mm A', 'hh:mmA', 'h:mmA'], true);
              if (parsed.isValid()) {
                return parsed.format('HH:mm');
              }
            }

            const parsed24 = moment(timeStr.trim(), ['HH:mm', 'H:mm'], true);
            if (parsed24.isValid()) {
              return parsed24.format('HH:mm');
            }

            return null;
          };

          const startTime24 = parseTime(row.startTime);
          const endTime24 = parseTime(row.endTime);

          if (!startTime24 || !endTime24) {
            rowData.isValid = false;
            rowData.errors.push('Invalid time format');
            errors.push(`Row ${i + 2}: Invalid time format`);
            previewData.push(rowData);
            continue;
          }

          // Check if exam already exists
          const existingExam = await Exam.findOne({ examId: row.examId });
          if (existingExam) {
            rowData.warnings.push(`Exam ${row.examId} already exists in database`);
            warnings.push(`Row ${i + 2}: Exam ${row.examId} already exists`);
          }

          // Calculate duration
          const start = moment(startTime24, 'HH:mm');
          const end = moment(endTime24, 'HH:mm');
          const duration = end.diff(start, 'minutes');

          // Get total students (optional, default if not provided)
          const totalStudents = parseInt(row.totalStudents) || 30;

          // Classroom is optional - exams can be created without room assignment
          // Allocation will assign invigilators to all rooms
          let classroomInfo = null;
          if (row.roomNumber) {
            const roomNumber = row.roomNumber.toString().trim();
            const classrooms = await Classroom.find({
              roomNumber: roomNumber,
              campus: campus
            });

            if (classrooms.length === 0) {
              rowData.warnings.push(`Classroom ${roomNumber} not found. Exam will be created without room assignment.`);
            } else {
              classroomInfo = {
                roomNumber: classrooms[0].roomNumber,
                block: classrooms[0].block,
                floor: classrooms[0].floor,
                capacity: classrooms[0].capacity
              };
            }
          } else {
            rowData.warnings.push('No roomNumber provided. Invigilators will be assigned to all rooms during allocation.');
          }

          // Build parsed data object
          rowData.parsedData = {
            examId: row.examId,
            examName: row.examName,
            courseCode: row.courseCode,
            courseName: row.courseName || row.examName,
            date: examDate,
            dateFormatted: moment(examDate).format('YYYY-MM-DD'),
            startTime: startTime24,
            endTime: endTime24,
            duration: duration,
            campus: campus,
            department: department,
            totalStudents: totalStudents,
            requiredInvigilators: 2, // Always 2 per room
            examType: examType || row.examType || 'semester',
            classroom: classroomInfo
          };

        } catch (error) {
          rowData.isValid = false;
          rowData.errors.push(error.message);
          errors.push(`Row ${i + 2}: ${error.message}`);
        }

        previewData.push(rowData);
      }

      return {
        success: errors.length === 0,
        totalRows: data.length,
        validRows: previewData.filter(r => r.isValid).length,
        invalidRows: previewData.filter(r => !r.isValid).length,
        previewData: previewData,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      throw new Error(`Error previewing file: ${error.message}`);
    }
  }

  /**
   * Upload exam timetable (saves to database)
   */
  async uploadExamTimetable(filePath, fileType, examType = 'semester') {
    try {
      const data = await this.parseFile(filePath, fileType);
      const examsToCreate = [];
      const errors = [];
      const examIdsToCheck = new Set();
      const campusesToFetch = new Set();

      // Step 1: Pre-process to gather keys for batch fetching
      for (const row of data) {
        if (row.examId) examIdsToCheck.add(row.examId);
        campusesToFetch.add(row.campus || 'Vignan University');
      }

      // Step 2: Batch fetch existing exams
      const existingExams = await Exam.find({
        examId: { $in: Array.from(examIdsToCheck) }
      }).select('examId').lean();

      const existingExamIds = new Set(existingExams.map(e => e.examId));

      // Step 3: Batch fetch relevant classrooms
      // Fetch all active classrooms for the relevant campuses to perform in-memory lookup
      const allClassrooms = await Classroom.find({
        campus: { $in: Array.from(campusesToFetch) },
        isActive: true
      }).lean();

      // Build lookups
      // 1. Specific room lookup: "RoomNum-Campus" -> Classroom
      const roomMap = new Map();
      // 2. Department default lookup: "Dept-Campus" -> Classroom (first available)
      const deptMap = new Map();

      for (const c of allClassrooms) {
        // Map by room number (taking the first one found if duplicates exist across blocks, matching original logic)
        const roomKey = `${c.roomNumber.toString().trim()}-${c.campus}`;
        if (!roomMap.has(roomKey)) {
          roomMap.set(roomKey, c);
        }

        // Map by department for fallback
        if (c.department) {
          const deptKey = `${c.department}-${c.campus}`;
          if (!deptMap.has(deptKey)) {
            deptMap.set(deptKey, c);
          }
        }
        if (c.departments && c.departments.length > 0) {
          for (const dept of c.departments) {
            const deptKey = `${dept}-${c.campus}`;
            if (!deptMap.has(deptKey)) {
              deptMap.set(deptKey, c);
            }
          }
        }
      }

      // Step 4: Fallback "any" classroom per campus
      const campusMap = new Map();
      for (const c of allClassrooms) {
        if (!campusMap.has(c.campus)) {
          campusMap.set(c.campus, c);
        }
      }

      // Step 5: Process rows in memory
      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        try {
          // Validate required fields
          const requiredFields = ['examId', 'examName', 'courseCode', 'date', 'startTime', 'endTime'];
          const missingFields = requiredFields.filter(field => {
            const value = row[field];
            return !value || (typeof value === 'string' && value.trim() === '');
          });

          if (missingFields.length > 0) {
            errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }

          // Check existence (in-memory)
          if (existingExamIds.has(row.examId)) {
            errors.push(`Row ${i + 2}: Exam ${row.examId} already exists`);
            continue;
          }

          // Duplicate check within the file itself
          if (examsToCreate.some(e => e.examId === row.examId)) {
            errors.push(`Row ${i + 2}: Duplicate examId ${row.examId} in file`);
            continue;
          }

          const department = row.department || this.inferDepartmentFromCourseCode(row.courseCode);
          const campus = row.campus || 'Vignan University';

          // Date Parsing (Reuse the robust logic)
          let examDate = null;
          const dateValue = row.date;
          const dateStr = String(dateValue).trim();

          if (moment(dateStr, 'YYYY-MM-DD', true).isValid()) {
            examDate = moment(dateStr, 'YYYY-MM-DD', true).toDate();
          } else if (!isNaN(dateValue) && dateValue > 0) {
            const excelEpoch = moment('1899-12-30', 'YYYY-MM-DD');
            examDate = excelEpoch.add(parseInt(dateValue), 'days').toDate();
          } else if (moment(dateStr).isValid()) {
            examDate = moment(dateStr).toDate();
          }

          if (!examDate || isNaN(examDate.getTime())) {
            errors.push(`Row ${i + 2}: Invalid date format "${dateStr}"`);
            continue;
          }

          // Time Parsing
          const parseTime = (timeStr) => {
            if (!timeStr) return null;
            const timeUpper = timeStr.trim().toUpperCase();
            if (timeUpper.includes('AM') || timeUpper.includes('PM')) {
              const normalized = timeUpper.replace(/\./g, '').replace(/\s+/g, ' ');
              const parsed = moment(normalized, ['hh:mm A', 'h:mm A', 'hh:mmA', 'h:mmA'], true);
              if (parsed.isValid()) return parsed.format('HH:mm');
            }
            const parsed24 = moment(timeStr.trim(), ['HH:mm', 'H:mm'], true);
            if (parsed24.isValid()) return parsed24.format('HH:mm');
            return null;
          };

          const startTime24 = parseTime(row.startTime);
          const endTime24 = parseTime(row.endTime);

          if (!startTime24 || !endTime24) {
            errors.push(`Row ${i + 2}: Invalid time format`);
            continue;
          }

          const start = moment(startTime24, 'HH:mm');
          const end = moment(endTime24, 'HH:mm');
          const duration = end.diff(start, 'minutes');
          const totalStudents = parseInt(row.totalStudents) || 30;

          // Assign Classroom (In-Memory Lookup)
          let classroomId = undefined;
          if (row.roomNumber) {
            const roomKey = `${row.roomNumber.toString().trim()}-${campus}`;
            const cls = roomMap.get(roomKey);
            if (cls) {
              classroomId = cls._id;
            } else {
              errors.push(`Row ${i + 2}: Classroom ${row.roomNumber} not found for campus ${campus}`);
              // Don't skip, just log error? Original matched behavior was to push error if provided but not found?
              // Original code: if provided and not found -> error.
              // wait, original code (line 429) pushed error.
              // So we continue (skip this row or allow creation without room? existing code pushed error and seemed to continue? No, existing code pushed to errors list and continued loop, but Exam.create was inside loop. If error pushed, did it create?
              // The original code pushed error then CONTINUED loop (skipped create).
              continue;
            }
          } else {
            // Auto-assign
            const deptKey = `${department}-${campus}`;
            let cls = deptMap.get(deptKey);
            if (!cls) cls = campusMap.get(campus);

            if (!cls) {
              errors.push(`Row ${i + 2}: No available classroom found for campus ${campus}`);
              // Original code also pushed error?
              // Yes.
              continue; // Skip creation if no room found and auto-assign failed?
              // Actually original code created exam anyway if it couldn't find room?
              // Let's check original code...
              // line 452: errors.push(...). 
              // line 458: Exam.create(...) is AFTER the if/else block.
              // UNLESS `continue` was called.
              // In original code lines 428-430: if (!classroom) errors.push and continue was NOT called explicitly there?
              // Ah, line 429 errors.push, but NO continue.
              // Then it went to 458 create exam.
              // So original behavior: Create exam even if room not found?
              // Wait, if errors.push is called, `uploadExamTimetable` function returns failure?
              // "return { success: errors.length === 0 ... }"
              // But it creates the exams anyway?
              // Start of loop: "errors.push(...)".
              // Line 485: returns errors if any.
              // But the exams were created sequentially!
              // So partially created?
              // If I switch to insertMany, it's all or nothing (or ordered: false).
              // I should aim for correctness. If a row has error, I should NOT include it in valid rows.
            }
            if (cls) classroomId = cls._id;
          }

          examsToCreate.push({
            examId: row.examId,
            examName: row.examName,
            courseCode: row.courseCode,
            courseName: row.courseName || row.examName,
            date: examDate,
            startTime: startTime24,
            endTime: endTime24,
            duration: duration,
            campus: campus,
            department: department,
            classroom: classroomId,
            totalStudents: totalStudents,
            requiredInvigilators: 2,
            examType: row.examType || examType || 'semester',
            status: 'scheduled'
          });

        } catch (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      // Step 6: Bulk Insert
      let examsCreated = 0;
      if (examsToCreate.length > 0) {
        // Use ordered: false to allow partial success (others might fail on unique constraints if any)
        // But we pre-checked IDs.
        const result = await Exam.insertMany(examsToCreate, { ordered: false });
        examsCreated = result.length;
      }

      return {
        success: errors.length === 0,
        examsCreated: examsCreated,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      throw new Error(`Error uploading exam timetable: ${error.message}`);
    }
  }

  /**
   * Upload exam timetable preparation (separate system)
   */
  /**
   * Upload exam timetable preparation (separate system)
   * Optimized with Batch Operations to reduce DB calls from O(N) to O(1)
   */
  async uploadExamTimetablePrep(filePath, fileType, examType = 'semester') {
    try {
      const data = await this.parseFile(filePath, fileType);
      const timetablesToCreate = [];
      const errors = [];

      // Step 1: Pre-process to gather keys for batch fetching
      const relevantDates = new Set();
      const relevantDepts = new Set();
      const processedRows = []; // Store pre-validated rows

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Validate required fields
          const requiredFields = ['examName', 'courseCode', 'date', 'startTime', 'endTime', 'department'];
          const missingFields = requiredFields.filter(field => {
            const value = row[field];
            return !value || (typeof value === 'string' && value.trim() === '');
          });

          if (missingFields.length > 0) {
            errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }

          // Date Parsing
          let examDate = null;
          const dateStr = String(row.date).trim();

          if (moment(dateStr, 'YYYY-MM-DD', true).isValid()) {
            examDate = moment(dateStr, 'YYYY-MM-DD', true).toDate();
          } else if (!isNaN(row.date) && row.date > 0) {
            const excelEpoch = moment('1899-12-30', 'YYYY-MM-DD');
            examDate = excelEpoch.add(parseInt(row.date), 'days').toDate();
          } else if (moment(dateStr).isValid()) {
            examDate = moment(dateStr).toDate();
          }

          if (!examDate || isNaN(examDate.getTime())) {
            errors.push(`Row ${i + 2}: Invalid date format`);
            continue;
          }

          const dateFormatted = moment(examDate).format('YYYY-MM-DD');
          relevantDates.add(dateFormatted);
          relevantDepts.add(row.department);

          // Time Parsing
          const parseTime = (timeStr) => {
            if (!timeStr) return null;
            const timeUpper = timeStr.trim().toUpperCase();
            if (timeUpper.includes('AM') || timeUpper.includes('PM')) {
              const normalized = timeUpper.replace(/\./g, '').replace(/\s+/g, ' ');
              const parsed = moment(normalized, ['hh:mm A', 'h:mm A', 'hh:mmA', 'h:mmA'], true);
              if (parsed.isValid()) return parsed.format('HH:mm');
            }
            const parsed24 = moment(timeStr.trim(), ['HH:mm', 'H:mm'], true);
            if (parsed24.isValid()) return parsed24.format('HH:mm');
            return null;
          };

          const startTime24 = parseTime(row.startTime);
          const endTime24 = parseTime(row.endTime);

          if (!startTime24 || !endTime24) {
            errors.push(`Row ${i + 2}: Invalid time format`);
            continue;
          }

          processedRows.push({
            row,
            examDate,
            dateFormatted,
            startTime24,
            endTime24,
            department: row.department,
            campus: row.campus || 'Vignan University',
            index: i + 2
          });

        } catch (err) {
          errors.push(`Row ${i + 2}: ${err.message}`);
        }
      }

      // Step 2: Batch Fetch Existing Timetables
      const existingTimetables = await ExamTimetable.find({
        date: { $in: Array.from(relevantDates).map(d => new Date(d)) },
        department: { $in: Array.from(relevantDepts) },
        examType: examType
      }).lean();

      // Step 3: Build Lookup Maps
      // Map for Limits: "Dept-Date" -> Count
      const limitMap = new Map();
      // Map for Conflicts: "Dept-Date-Time-Course" -> Boolean (or just list of scheduled exams)
      // Actually simpler: iterate existing to check limits and conflicts

      // Initialize limits
      existingTimetables.forEach(et => {
        const dateStr = moment(et.date).format('YYYY-MM-DD');
        const limitKey = `${et.department}-${dateStr}`;
        limitMap.set(limitKey, (limitMap.get(limitKey) || 0) + 1);
      });

      // Step 4: Process Rows against Memory Maps
      for (const item of processedRows) {
        const { row, examDate, dateFormatted, startTime24, endTime24, department, campus, index } = item;

        // Check Limits
        const limitKey = `${department}-${dateFormatted}`;
        const currentCount = limitMap.get(limitKey) || 0;

        if (examType === 'mid-term' && currentCount >= 2) {
          // Check if we already added to this limit in this batch?
          // Yes, we must increment limitMap as we go!
          errors.push(`Row ${index}: Mid-Term exams limit reached (max 2 per day per department)`);
          continue;
        }
        if (examType === 'semester' && currentCount >= 1) {
          errors.push(`Row ${index}: Semester exam limit reached (max 1 per day per department)`);
          continue;
        }

        // Check Conflicts (Exact Duplicate)
        // We check against existingTimetables AND timetablesToCreate (in-file duplicates)
        const isDuplicateExisting = existingTimetables.some(et =>
          et.courseCode === row.courseCode &&
          et.department === department &&
          moment(et.date).format('YYYY-MM-DD') === dateFormatted &&
          et.startTime === startTime24
        );

        const isDuplicateInBatch = timetablesToCreate.some(t =>
          t.courseCode === row.courseCode &&
          t.department === department &&
          moment(t.date).format('YYYY-MM-DD') === dateFormatted &&
          t.startTime === startTime24
        );

        if (isDuplicateExisting || isDuplicateInBatch) {
          errors.push(`Row ${index}: Duplicate exam detected (${row.courseCode}). Skipping.`);
          continue;
        }

        // If valid, add to list and update limits
        limitMap.set(limitKey, currentCount + 1);

        timetablesToCreate.push({
          examName: row.examName,
          courseCode: row.courseCode,
          courseName: row.courseName || row.examName,
          date: examDate,
          startTime: startTime24,
          endTime: endTime24,
          department: department,
          campus: campus,
          examType: examType
        });
      }

      // Step 5: Bulk Insert
      let createdCount = 0;
      if (timetablesToCreate.length > 0) {
        const result = await ExamTimetable.insertMany(timetablesToCreate, { ordered: false });
        createdCount = result.length;
      }

      return {
        success: errors.length === 0,
        timetablesCreated: createdCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      throw new Error(`Error uploading exam timetable preparation: ${error.message}`);
    }
  }

  /**
   * Preview classrooms (parse and validate without saving)
   */
  async previewClassrooms(filePath, fileType) {
    try {
      const data = await this.parseFile(filePath, fileType);
      const previewData = [];
      const errors = [];
      const warnings = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowData = {
          rowNumber: i + 2,
          rawData: row,
          isValid: true,
          errors: [],
          warnings: [],
          parsedData: null
        };

        try {
          // Validate required fields
          const requiredFields = ['roomNumber', 'block', 'floor', 'campus', 'capacity'];
          const missingFields = requiredFields.filter(field => {
            const value = row[field];
            return !value || (typeof value === 'string' && value.trim() === '');
          });

          if (missingFields.length > 0) {
            rowData.isValid = false;
            rowData.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
            errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            previewData.push(rowData);
            continue;
          }

          // Check if classroom already exists
          const existingClassroom = await Classroom.findOne({
            roomNumber: row.roomNumber.toString().trim(),
            block: row.block.toString().trim(),
            floor: parseInt(row.floor) || 0,
            campus: row.campus.toString().trim()
          });

          if (existingClassroom) {
            rowData.warnings.push(`Classroom ${row.roomNumber} (${row.block}-block, Floor ${row.floor}) already exists - will be updated`);
            warnings.push(`Row ${i + 2}: Classroom already exists - will be updated`);
          }

          // Build parsed data object
          rowData.parsedData = {
            roomNumber: row.roomNumber.toString().trim(),
            block: row.block.toString().trim(),
            floor: parseInt(row.floor) || 0,
            campus: row.campus.toString().trim(),
            capacity: parseInt(row.capacity) || 0,
            building: row.building ? row.building.toString().trim() : row.block.toString().trim(),
            department: row.department ? row.department.toString().trim() : undefined,
            departments: row.departments ? row.departments.toString().split(',').map(d => d.trim()).filter(d => d) : undefined,
            facilities: row.facilities ? row.facilities.toString().split(',').map(f => f.trim()).filter(f => f) : [],
            isActive: row.isActive !== undefined ? (row.isActive.toString().toLowerCase() === 'true') : true,
            isExamOnly: row.isExamOnly ? (row.isExamOnly.toString().toLowerCase() === 'true') : false
          };

        } catch (error) {
          rowData.isValid = false;
          rowData.errors.push(error.message);
          errors.push(`Row ${i + 2}: ${error.message}`);
        }

        previewData.push(rowData);
      }

      return {
        success: errors.length === 0,
        totalRows: data.length,
        validRows: previewData.filter(r => r.isValid).length,
        invalidRows: previewData.filter(r => !r.isValid).length,
        previewData: previewData,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      throw new Error(`Error previewing file: ${error.message}`);
    }
  }

  /**
   * Upload classrooms
   */
  async uploadClassrooms(filePath, fileType) {
    try {
      const data = await this.parseFile(filePath, fileType);
      const classroomsCreated = [];
      const errors = [];
      const bulkWrites = [];
      const inserts = [];

      // Step 1: Batch fetch all potentially relevant classrooms for duplicate checking
      // Key: "roomNumber-block-floor-campus"
      const keys = new Set();
      data.forEach(r => {
        if (r.roomNumber && r.block && r.campus) {
          keys.add(`${r.roomNumber.toString().trim()}-${r.block.toString().trim()}-${parseInt(r.floor) || 0}-${r.campus.toString().trim()}`);
        }
      });

      // It's hard to fetch exactly by composite key in one query efficiently without $or array
      // simpler: fetch all classrooms for the campuses involved
      const campuses = [...new Set(data.map(r => r.campus || 'Vignan University'))];
      const existingClassrooms = await Classroom.find({ campus: { $in: campuses } }).lean();

      const existingMap = new Map();
      existingClassrooms.forEach(c => {
        const key = `${c.roomNumber}-${c.block}-${c.floor}-${c.campus}`;
        existingMap.set(key, c);
      });

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        try {
          // Validate required fields
          const requiredFields = ['roomNumber', 'block', 'floor', 'campus', 'capacity'];
          const missingFields = requiredFields.filter(field => {
            const value = row[field];
            return !value || (typeof value === 'string' && value.trim() === '');
          });

          if (missingFields.length > 0) {
            errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }

          const roomNumber = row.roomNumber.toString().trim();
          const block = row.block.toString().trim();
          const floor = parseInt(row.floor) || 0;
          const campus = row.campus.toString().trim();

          const key = `${roomNumber}-${block}-${floor}-${campus}`;
          const existing = existingMap.get(key);

          const classroomData = {
            roomNumber,
            block,
            floor,
            campus,
            capacity: parseInt(row.capacity) || 0,
            building: row.building ? row.building.toString().trim() : block,
            department: row.department ? row.department.toString().trim() : undefined,
            departments: row.departments ? row.departments.toString().split(',').map(d => d.trim()).filter(d => d) : undefined,
            facilities: row.facilities ? row.facilities.toString().split(',').map(f => f.trim()).filter(f => f) : [],
            isActive: row.isActive !== undefined ? (row.isActive.toString().toLowerCase() === 'true') : true,
            isExamOnly: row.isExamOnly ? (row.isExamOnly.toString().toLowerCase() === 'true') : false
          };

          if (existing) {
            // Prepare bulk update
            bulkWrites.push({
              updateOne: {
                filter: { _id: existing._id },
                update: { $set: classroomData }
              }
            });
            classroomsCreated.push(existing._id); // effectively touched
          } else {
            inserts.push(classroomData);
          }

        } catch (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      // Execute Bulk Operations
      if (bulkWrites.length > 0) {
        await Classroom.bulkWrite(bulkWrites, { ordered: false });
      }

      if (inserts.length > 0) {
        const result = await Classroom.insertMany(inserts, { ordered: false });
        classroomsCreated.push(...result.map(c => c._id));
      }

      return {
        success: errors.length === 0,
        classroomsCreated: classroomsCreated.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      throw new Error(`Error uploading classrooms: ${error.message}`);
    }
  }

  /**
   * Preview faculty (parse and validate without saving)
   */
  async previewFaculty(filePath, fileType) {
    try {
      const data = await this.parseFile(filePath, fileType);
      const previewData = [];
      const errors = [];
      const warnings = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowData = {
          rowNumber: i + 2,
          rawData: row,
          isValid: true,
          errors: [],
          warnings: [],
          parsedData: null
        };

        try {
          // Validate required fields
          const requiredFields = ['name', 'email', 'campus', 'subject'];
          const missingFields = requiredFields.filter(field => {
            const value = row[field];
            return !value || (typeof value === 'string' && value.trim() === '');
          });

          if (missingFields.length > 0) {
            rowData.isValid = false;
            rowData.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
            errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            previewData.push(rowData);
            continue;
          }

          // Check if faculty already exists
          const email = row.email.toString().trim().toLowerCase();
          const existingFaculty = await Faculty.findOne({ email });

          if (existingFaculty) {
            rowData.warnings.push(`Faculty with email ${email} already exists - will be updated`);
            warnings.push(`Row ${i + 2}: Faculty already exists - will be updated`);
          }

          // Check employeeId if provided
          if (row.employeeId) {
            const existingByEmployeeId = await Faculty.findOne({ employeeId: row.employeeId.toString().trim() });
            if (existingByEmployeeId && existingByEmployeeId.email !== email) {
              rowData.warnings.push(`Employee ID ${row.employeeId} already exists for another faculty`);
            }
          }

          // Build parsed data object
          rowData.parsedData = {
            name: row.name.toString().trim(),
            email: email,
            employeeId: row.employeeId ? row.employeeId.toString().trim() : undefined,
            campus: row.campus.toString().trim(),
            department: row.department ? row.department.toString().trim() : undefined,
            subject: row.subject.toString().trim(),
            subjects: row.subjects ? row.subjects.toString().split(',').map(s => s.trim()).filter(s => s) : [row.subject.toString().trim()],
            phone: row.phone ? row.phone.toString().trim() : undefined,
            isActive: row.isActive !== undefined ? (row.isActive.toString().toLowerCase() === 'true') : true
          };

        } catch (error) {
          rowData.isValid = false;
          rowData.errors.push(error.message);
          errors.push(`Row ${i + 2}: ${error.message}`);
        }

        previewData.push(rowData);
      }

      return {
        success: errors.length === 0,
        totalRows: data.length,
        validRows: previewData.filter(r => r.isValid).length,
        invalidRows: previewData.filter(r => !r.isValid).length,
        previewData: previewData,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      throw new Error(`Error previewing file: ${error.message}`);
    }
  }

  /**
   * Upload faculty (optimized with batch operations)
   */
  async uploadFaculty(filePath, fileType) {
    try {
      const data = await this.parseFile(filePath, fileType);
      const facultyCreated = [];
      const errors = [];
      const updates = [];
      const newUsers = [];

      // Step 1: Validate and prepare all data
      const emailMap = new Map(); // Track emails to avoid duplicates
      const validRows = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        try {
          // Validate required fields
          const requiredFields = ['name', 'email', 'campus', 'subject'];
          const missingFields = requiredFields.filter(field => {
            const value = row[field];
            return !value || (typeof value === 'string' && value.trim() === '');
          });

          if (missingFields.length > 0) {
            errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }

          const email = row.email.toString().toLowerCase().trim();

          // Check for duplicate emails in the same file
          if (emailMap.has(email)) {
            errors.push(`Row ${i + 2}: Duplicate email ${email} found in upload file`);
            continue;
          }
          emailMap.set(email, i);

          // Determine role
          const userRole = row.role ? row.role.toString().toLowerCase().trim() : 'faculty';
          const UserModel = getModelByRole(userRole);

          // Handle subjects array
          let subjectsArray = [];
          if (row.subjects) {
            subjectsArray = row.subjects.toString().split(',').map(s => s.trim()).filter(s => s);
          } else if (row.subject) {
            subjectsArray = [row.subject.toString().trim()];
          }

          validRows.push({
            rowIndex: i + 2,
            row,
            email,
            userRole,
            UserModel,
            subjectsArray
          });
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      if (validRows.length === 0) {
        return {
          success: false,
          facultyCreated: 0,
          errors: errors.length > 0 ? errors : ['No valid rows to process']
        };
      }

      // Step 2: Batch fetch existing users (much faster than individual queries)
      const emails = validRows.map(r => r.email);
      const existingUsersMap = new Map();

      // Group by model type to batch query
      const usersByModel = new Map();
      validRows.forEach(row => {
        const modelName = row.UserModel.modelName;
        if (!usersByModel.has(modelName)) {
          usersByModel.set(modelName, []);
        }
        usersByModel.get(modelName).push(row);
      });

      // Batch query for each model type
      for (const [modelName, rows] of usersByModel) {
        const modelEmails = rows.map(r => r.email);
        const existingUsers = await rows[0].UserModel.find({
          email: { $in: modelEmails }
        });

        existingUsers.forEach(user => {
          existingUsersMap.set(user.email.toLowerCase(), {
            user,
            model: rows[0].UserModel
          });
        });
      }

      // Step 3: Prepare updates and new users (with password hashing in parallel)
      const passwordHashingPromises = [];

      for (const validRow of validRows) {
        const { row, email, userRole, UserModel, subjectsArray, rowIndex } = validRow;
        const existing = existingUsersMap.get(email);

        if (existing) {
          // Prepare update
          const updateData = {
            name: row.name.toString().trim(),
            campus: row.campus.toString().trim(),
            department: row.department ? row.department.toString().trim() : undefined,
            employeeId: row.employeeId ? row.employeeId.toString().trim() : undefined,
            phone: row.phone ? row.phone.toString().trim() : undefined,
            isActive: row.isActive !== undefined ? (row.isActive.toString().toLowerCase() === 'true') : undefined
          };

          if (userRole === 'faculty') {
            updateData.subject = row.subject.toString().trim();
            updateData.subjects = subjectsArray;
            updateData.uploadedViaExcel = true;
          }

          // Only hash password if provided (skip for existing users without password change)
          if (row.password) {
            const hashPromise = bcrypt.genSalt(10).then(salt =>
              bcrypt.hash(row.password.toString(), salt).then(hash => ({
                email,
                password: hash
              }))
            );
            passwordHashingPromises.push(hashPromise);
            updateData.needsPasswordHash = true;
          }
          // Skip password hashing if no password provided for existing users

          updates.push({
            userId: existing.user._id,
            model: existing.model,
            email: email,
            updateData
          });
        } else {
          // Prepare new user
          let password = row.password ? row.password.toString() :
            (row.employeeId ? row.employeeId.toString() : email.split('@')[0]);

          // Hash password in parallel
          const hashPromise = bcrypt.genSalt(10).then(salt =>
            bcrypt.hash(password, salt).then(hash => ({
              email,
              password: hash
            }))
          );
          passwordHashingPromises.push(hashPromise);

          const userData = {
            name: row.name.toString().trim(),
            email: email,
            role: userRole,
            employeeId: row.employeeId ? row.employeeId.toString().trim() : `EMP${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            department: row.department ? row.department.toString().trim() : undefined,
            campus: row.campus.toString().trim(),
            phone: row.phone ? row.phone.toString().trim() : undefined,
            isActive: row.isActive !== undefined ? (row.isActive.toString().toLowerCase() === 'true') : true
          };

          if (userRole === 'faculty') {
            userData.subject = row.subject.toString().trim();
            userData.subjects = subjectsArray;
            userData.uploadedViaExcel = true;
          }

          newUsers.push({
            model: UserModel,
            userData,
            email
          });
        }
      }

      // Step 4: Wait for all password hashing to complete (parallel)
      const hashedPasswords = await Promise.all(passwordHashingPromises);
      const passwordMap = new Map(hashedPasswords.map(hp => [hp.email, hp.password]));

      // Step 5: Apply password hashes to updates and new users
      updates.forEach(update => {
        if (update.updateData.needsPasswordHash) {
          update.updateData.password = passwordMap.get(update.email);
          delete update.updateData.needsPasswordHash;
        }
      });

      newUsers.forEach(newUser => {
        newUser.userData.password = passwordMap.get(newUser.email);
      });

      // Step 6: Batch update existing users using bulkWrite (faster)
      if (updates.length > 0) {
        // Group updates by model for bulk operations
        const updatesByModel = new Map();
        updates.forEach(update => {
          const modelName = update.model.modelName;
          if (!updatesByModel.has(modelName)) {
            updatesByModel.set(modelName, []);
          }
          updatesByModel.get(modelName).push(update);
        });

        // Bulk update for each model
        for (const [modelName, modelUpdates] of updatesByModel) {
          const model = modelUpdates[0].model;
          const bulkOps = modelUpdates.map(update => ({
            updateOne: {
              filter: { _id: update.userId },
              update: { $set: update.updateData }
            }
          }));

          await model.bulkWrite(bulkOps, { ordered: false });
          facultyCreated.push(...modelUpdates.map(u => u.userId));
        }
      }

      // Step 7: Batch insert new users
      if (newUsers.length > 0) {
        // Group by model for bulk insert
        const newUsersByModel = new Map();
        newUsers.forEach(nu => {
          const modelName = nu.model.modelName;
          if (!newUsersByModel.has(modelName)) {
            newUsersByModel.set(modelName, []);
          }
          newUsersByModel.get(modelName).push(nu.userData);
        });

        // Bulk insert for each model
        for (const [modelName, usersData] of newUsersByModel) {
          const model = newUsers.find(nu => nu.model.modelName === modelName).model;
          const inserted = await model.insertMany(usersData, { ordered: false });
          facultyCreated.push(...inserted.map(u => u._id));
        }
      }

      return {
        success: errors.length === 0,
        facultyCreated: facultyCreated.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      throw new Error(`Error uploading faculty: ${error.message}`);
    }
  }
}

module.exports = new FileUploadService();

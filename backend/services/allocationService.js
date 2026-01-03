const Exam = require('../models/Exam');
const { Faculty } = require('../utils/userHelper');
const Allocation = require('../models/Allocation');
const Conflict = require('../models/Conflict');
const AllocationConfig = require('../models/AllocationConfig');
const emailService = require('./emailService');
const moment = require('moment');

/**
 * AI-Based Auto Allocation Engine
 * Uses heuristic scoring algorithm for fair workload distribution
 */
class AllocationService {
  /**
   * Get allocation configuration (with defaults)
   */
  async getConfig() {
    let config = await AllocationConfig.findOne({ isActive: true });
    if (!config) {
      config = await AllocationConfig.create({});
    }
    return config;
  }

  /**
   * Preview allocation without saving (for admin review)
   */
  async previewAllocation(examIds = null, campus = null, department = null) {
    try {
      const query = { status: 'scheduled' };
      if (examIds && Array.isArray(examIds) && examIds.length > 0) {
        query._id = { $in: examIds };
      }
      if (campus) query.campus = campus;
      if (department) query.department = department;

      const exams = await Exam.find(query)
        .populate('classroom')
        .sort({ date: 1, startTime: 1 });

      if (exams.length === 0) {
        return { success: false, message: 'No exams found to allocate' };
      }

      const baseFacultyQuery = { isActive: true };
      const excelFacultyQuery = { ...baseFacultyQuery, uploadedViaExcel: true };
      if (campus) {
        baseFacultyQuery.campus = campus;
        excelFacultyQuery.campus = campus;
      }
      if (department) {
        baseFacultyQuery.department = department;
        excelFacultyQuery.department = department;
      }

      // Get faculty from 'faculties' collection
      let faculty = await Faculty.find(excelFacultyQuery);
      if (faculty.length === 0) {
        faculty = await Faculty.find(baseFacultyQuery);
      }

      // Get existing allocations for workload calculation
      const existingAllocations = await Allocation.find({
        status: { $ne: 'cancelled' }
      });
      let workloadMap = this.calculateWorkload(existingAllocations, faculty);

      // Get config
      const config = await this.getConfig();

      // Process each exam individually - simulate allocations (don't save)
      const previewResults = [];
      const previewAllocations = [];

      for (const exam of exams) {
        if (!exam.classroom) {
          continue;
        }

        const examDate = moment(exam.date).format('YYYY-MM-DD');
        const examStart = moment(exam.startTime, 'HH:mm');
        const examEnd = moment(exam.endTime, 'HH:mm');

        let result;
        if (exam.examType === 'labs') {
          result = await this.previewLabsExam(exam, faculty, workloadMap, examDate, examStart, examEnd, config);
        } else {
          result = await this.previewRegularExam(exam, faculty, workloadMap, examDate, examStart, examEnd, config);
        }

        if (result.success && result.allocations) {
          previewAllocations.push(...result.allocations);
          // Update workload map for next exam
          result.allocations.forEach(alloc => {
            const facultyId = alloc.faculty._id.toString();
            if (!workloadMap[facultyId]) {
              workloadMap[facultyId] = { count: 0, hours: 0, dates: new Set() };
            }
            workloadMap[facultyId].count++;
            const hours = this.calculateHours(alloc.startTime, alloc.endTime);
            workloadMap[facultyId].hours += hours;
            workloadMap[facultyId].dates.add(examDate);
          });
        }

        previewResults.push(result);
      }

      // Detect conflicts in preview allocations
      const conflicts = this.detectConflictsInPreview(previewAllocations);
      
      return {
        success: true,
        examsProcessed: exams.length,
        results: previewResults,
        conflicts: conflicts,
        summary: {
          totalAllocations: previewAllocations.length,
          totalConflicts: conflicts.length,
          facultyWorkload: Object.keys(workloadMap).map(id => {
            const f = faculty.find(f => f._id.toString() === id);
            return {
              facultyId: id,
              facultyName: f ? f.name : 'Unknown',
              totalDuties: workloadMap[id].count,
              totalHours: Math.round(workloadMap[id].hours * 10) / 10
            };
          })
        }
      };
    } catch (error) {
      throw new Error(`Preview allocation failed: ${error.message}`);
    }
  }

  /**
   * Preview allocation for a classroom-time slot (without saving)
   */
  async previewClassroomTimeSlot(slotData, faculty, workloadMap, config) {
    try {
      const { classroom, date, startTime, endTime, campus, exams, maxRequiredInvigilators, examTypes } = slotData;
      const examDate = moment(date).format('YYYY-MM-DD');
      const requiredCount = maxRequiredInvigilators || 2;

      // Filter faculty by campus
      let facultyToUse = faculty.filter(f => {
        return !campus || f.campus === campus;
      });
      
      if (facultyToUse.length === 0) {
        facultyToUse = faculty;
      }

      // Check if any exam is labs type
      const hasLabs = examTypes.has('labs');
      
      let selectedFaculty = [];
      
      if (hasLabs) {
        // For labs: Need 1 same subject teacher + 1 any faculty
        const labsExams = exams.filter(e => e.examType === 'labs');
        const courseNames = [...new Set(labsExams.map(e => e.courseName).filter(Boolean))];
        
        if (courseNames.length > 0) {
          const subjectFaculty = facultyToUse.filter(f => {
            return courseNames.some(courseName => {
              return (f.subject && f.subject.toLowerCase().trim() === courseName.toLowerCase().trim()) ||
                     (f.subjects && Array.isArray(f.subjects) && f.subjects.some(sub => 
                       sub.toLowerCase().trim() === courseName.toLowerCase().trim()
                     ));
            });
          });
          
          if (subjectFaculty.length > 0) {
            const scoredSubjectFaculty = [];
            for (const f of subjectFaculty) {
              const score = await this.calculateFacultyScore(
                f, labsExams[0], examDate, startTime, endTime, workloadMap, config
              );
              scoredSubjectFaculty.push({ faculty: f, score });
            }
            scoredSubjectFaculty.sort((a, b) => b.score - a.score);
            
            for (const { faculty: f } of scoredSubjectFaculty) {
              if (await this.isFacultyAvailable(f, examDate, startTime, endTime, workloadMap, config)) {
                selectedFaculty.push(f);
                break;
              }
            }
          }
        }
      }
      
      // Select remaining faculty
      if (selectedFaculty.length < requiredCount) {
        const remainingFaculty = facultyToUse.filter(f => 
          !selectedFaculty.some(sf => sf._id.toString() === f._id.toString())
        );
        
        const examForScoring = exams[0];
        const scoredFaculty = [];
        for (const f of remainingFaculty) {
          const score = await this.calculateFacultyScore(
            f, examForScoring, examDate, startTime, endTime, workloadMap, config
          );
          scoredFaculty.push({ faculty: f, score });
        }
        
        scoredFaculty.sort((a, b) => b.score - a.score);
        
        for (const { faculty: f } of scoredFaculty) {
          if (selectedFaculty.length >= requiredCount) break;
          if (await this.isFacultyAvailable(f, examDate, startTime, endTime, workloadMap, config)) {
            selectedFaculty.push(f);
          }
        }
      }

      if (selectedFaculty.length < requiredCount) {
        return {
          success: false,
          classroomId: classroom._id || classroom,
          classroomName: classroom.roomNumber || 'N/A',
          message: `Insufficient available faculty. Required: ${requiredCount}, Found: ${selectedFaculty.length}`
        };
      }

      // Create preview allocations (not saved)
      const allocations = selectedFaculty.map(f => ({
        classroom: {
          _id: classroom._id || classroom,
          roomNumber: classroom.roomNumber || 'N/A'
        },
        exam: {
          _id: exams[0]._id,
          examName: exams[0].examName,
          courseCode: exams[0].courseCode
        },
        faculty: {
          _id: f._id,
          name: f.name,
          email: f.email,
          employeeId: f.employeeId,
          department: f.department,
          campus: f.campus
        },
        date: date,
        startTime: startTime,
        endTime: endTime,
        campus: campus,
        department: exams[0].department,
        examsCount: exams.length
      }));

      return {
        success: true,
        classroomId: classroom._id || classroom,
        classroomName: classroom.roomNumber || 'N/A',
        examsCount: exams.length,
        allocations: allocations
      };
    } catch (error) {
      return {
        success: false,
        classroomId: slotData.classroom._id || slotData.classroom,
        message: error.message
      };
    }
  }

  /**
   * Preview regular exam allocation
   */
  async previewRegularExam(exam, faculty, workloadMap, examDate, examStart, examEnd, config) {
    const requiredCount = exam.requiredInvigilators || 2;
    
    const scoredFaculty = [];
    for (const f of faculty) {
      const score = await this.calculateFacultyScore(f, exam, examDate, examStart, examEnd, workloadMap, config);
      scoredFaculty.push({ faculty: f, score });
    }

    scoredFaculty.sort((a, b) => b.score - a.score);

    const selectedFaculty = [];
    for (const { faculty: f } of scoredFaculty) {
      if (selectedFaculty.length >= requiredCount) break;
      if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
        selectedFaculty.push(f);
      }
    }

    if (selectedFaculty.length < requiredCount) {
      return {
        success: false,
        examId: exam._id,
        examName: exam.examName,
        message: `Insufficient available faculty. Required: ${requiredCount}, Found: ${selectedFaculty.length}`
      };
    }

    const classroomId = exam.classroom._id ? exam.classroom._id : exam.classroom;
    
    const allocations = selectedFaculty.map(f => ({
      exam: {
        _id: exam._id,
        examName: exam.examName,
        courseCode: exam.courseCode,
        date: exam.date,
        startTime: exam.startTime,
        endTime: exam.endTime
      },
      classroom: {
        _id: classroomId,
        roomNumber: exam.classroom.roomNumber || 'N/A'
      },
      faculty: {
        _id: f._id,
        name: f.name,
        email: f.email,
        employeeId: f.employeeId,
        department: f.department,
        campus: f.campus
      },
      date: exam.date,
      startTime: exam.startTime,
      endTime: exam.endTime,
      campus: exam.campus,
      department: exam.department
    }));

    return {
      success: true,
      examId: exam._id,
      examName: exam.examName,
      allocations: allocations
    };
  }

  /**
   * Preview labs exam allocation
   */
  async previewLabsExam(exam, faculty, workloadMap, examDate, examStart, examEnd, config) {
    const requiredCount = exam.requiredInvigilators || 2;

    // Filter faculty matching exam's courseName (same subject)
    const subjectFaculty = faculty.filter(f => {
      const campusMatch = !exam.campus || f.campus === exam.campus;
      const subjectMatch = exam.courseName && (
        (f.subject && f.subject.toLowerCase().trim() === exam.courseName.toLowerCase().trim()) ||
        (f.subjects && Array.isArray(f.subjects) && f.subjects.some(sub => 
          sub.toLowerCase().trim() === exam.courseName.toLowerCase().trim()
        ))
      );
      return campusMatch && subjectMatch;
    });

    const otherFaculty = faculty.filter(f => {
      const campusMatch = !exam.campus || f.campus === exam.campus;
      const notSubjectFaculty = !subjectFaculty.some(sf => sf._id.toString() === f._id.toString());
      return campusMatch && notSubjectFaculty;
    });

    const selectedFaculty = [];
    
    // Select 1 same-subject teacher
    if (subjectFaculty.length > 0) {
      const scoredSubjectFaculty = [];
      for (const f of subjectFaculty) {
        const score = await this.calculateFacultyScore(f, exam, examDate, examStart, examEnd, workloadMap, config);
        scoredSubjectFaculty.push({ faculty: f, score });
      }
      scoredSubjectFaculty.sort((a, b) => b.score - a.score);
      
      for (const { faculty: f } of scoredSubjectFaculty) {
        if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
          selectedFaculty.push(f);
          break;
        }
      }
    }

    // Select remaining from any faculty
    if (selectedFaculty.length < requiredCount) {
      const scoredOtherFaculty = [];
      for (const f of otherFaculty) {
        const score = await this.calculateFacultyScore(f, exam, examDate, examStart, examEnd, workloadMap, config);
        scoredOtherFaculty.push({ faculty: f, score });
      }
      scoredOtherFaculty.sort((a, b) => b.score - a.score);
      
      for (const { faculty: f } of scoredOtherFaculty) {
        if (selectedFaculty.length >= requiredCount) break;
        if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
          selectedFaculty.push(f);
        }
      }
    }

    if (selectedFaculty.length < requiredCount) {
      return {
        success: false,
        examId: exam._id,
        examName: exam.examName,
        message: `Insufficient available faculty. Required: ${requiredCount}, Found: ${selectedFaculty.length}`
      };
    }

    const classroomId = exam.classroom._id ? exam.classroom._id : exam.classroom;
    
    const allocations = selectedFaculty.map(f => ({
      exam: {
        _id: exam._id,
        examName: exam.examName,
        courseCode: exam.courseCode,
        date: exam.date,
        startTime: exam.startTime,
        endTime: exam.endTime
      },
      classroom: {
        _id: classroomId,
        roomNumber: exam.classroom.roomNumber || 'N/A'
      },
      faculty: {
        _id: f._id,
        name: f.name,
        email: f.email,
        employeeId: f.employeeId,
        department: f.department,
        campus: f.campus
      },
      date: exam.date,
      startTime: exam.startTime,
      endTime: exam.endTime,
      campus: exam.campus,
      department: exam.department
    }));

    return {
      success: true,
      examId: exam._id,
      examName: exam.examName,
      allocations: allocations
    };
  }

  /**
   * Detect conflicts in preview allocations
   */
  detectConflictsInPreview(allocations) {
    const conflicts = [];
    const facultyDateMap = {};

    allocations.forEach(allocation => {
      const facultyId = allocation.faculty._id.toString();
      const date = moment(allocation.date).format('YYYY-MM-DD');
      const key = `${facultyId}-${date}`;

      if (!facultyDateMap[key]) {
        facultyDateMap[key] = [];
      }
      facultyDateMap[key].push(allocation);
    });

    for (const [key, allocs] of Object.entries(facultyDateMap)) {
      if (allocs.length > 1) {
        for (let i = 0; i < allocs.length; i++) {
          for (let j = i + 1; j < allocs.length; j++) {
            if (this.isTimeOverlapping(allocs[i], allocs[j])) {
              conflicts.push({
                type: 'overlapping_time',
                severity: 'high',
                facultyId: allocs[i].faculty._id,
                facultyName: allocs[i].faculty.name,
                date: allocs[i].date,
                allocations: [
                  {
                    exam: allocs[i].exam.examName,
                    time: `${allocs[i].startTime} - ${allocs[i].endTime}`
                  },
                  {
                    exam: allocs[j].exam.examName,
                    time: `${allocs[j].startTime} - ${allocs[j].endTime}`
                  }
                ],
                description: `${allocs[i].faculty.name} has overlapping time slots on ${moment(allocs[i].date).format('YYYY-MM-DD')}`
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Main allocation function
   * Allocates faculty to ALL uploaded classrooms grouped by sessions (morning/afternoon)
   * Each room gets exactly 2 faculties, no faculty allocated twice in same session
   * Note: All exam types happen on different dates and don't mix
   */
  async allocateInvigilators(examIds = null, campus = null, department = null) {
    try {
      // Get exams to allocate - only scheduled exams (from uploaded Excel)
      const query = { status: 'scheduled' };
      if (examIds && Array.isArray(examIds) && examIds.length > 0) {
        query._id = { $in: examIds };
      }
      if (campus) query.campus = campus;
      if (department) query.department = department;

      let exams = await Exam.find(query)
        .populate('classroom')
        .sort({ date: 1, startTime: 1 });
      
      console.log(`📋 Found ${exams.length} exam(s) to allocate`);

      // If no Exam records found, check ExamTimetable and convert them
      if (exams.length === 0) {
        console.log('📋 No Exam records found. Checking ExamTimetable...');
        const ExamTimetable = require('../models/ExamTimetable');
        
        // First, check total count without any filters
        const totalCount = await ExamTimetable.countDocuments({});
        console.log(`📊 Total ExamTimetable records in database: ${totalCount}`);
        
        // Check only unconverted ExamTimetable entries (skip already converted ones)
        const timetableQuery = { 
          status: { $ne: 'converted' } // Only process unconverted entries
        };
        if (campus) timetableQuery.campus = campus;
        if (department) timetableQuery.department = department;

        console.log(`🔍 Query filter:`, JSON.stringify(timetableQuery));

        const timetableEntries = await ExamTimetable.find(timetableQuery)
          .populate('classroom')
          .sort({ date: 1, startTime: 1 });

        console.log(`📋 Found ${timetableEntries.length} ExamTimetable entry(ies) matching query. Converting to Exam records...`);
        
        if (timetableEntries.length > 0) {
          console.log(`   Sample entries:`, timetableEntries.slice(0, 3).map(t => ({
            examName: t.examName,
            courseCode: t.courseCode,
            date: t.date,
            examType: t.examType,
            status: t.status,
            campus: t.campus,
            department: t.department
          })));
        } else if (totalCount > 0) {
          // If we have records but query returned 0, show sample of all records
          const allEntries = await ExamTimetable.find({}).limit(3);
          console.log(`   ⚠️  Query returned 0 but ${totalCount} records exist. Sample records:`, allEntries.map(t => ({
            examName: t.examName,
            courseCode: t.courseCode,
            campus: t.campus,
            department: t.department,
            examType: t.examType,
            status: t.status
          })));
        }

        if (timetableEntries.length === 0) {
          return { success: false, message: 'No exams found to allocate. Please upload exam timetable first.' };
        }

        // Convert ExamTimetable entries to Exam records
        const convertedExams = [];
        for (const timetable of timetableEntries) {
          // Calculate duration if not provided
          let duration = timetable.duration;
          if (!duration) {
            const start = moment(timetable.startTime, 'HH:mm');
            const end = moment(timetable.endTime, 'HH:mm');
            duration = end.diff(start, 'minutes');
          }

          // Ensure date is a Date object
          let examDate = timetable.date;
          if (typeof examDate === 'string') {
            examDate = moment(examDate, 'YYYY-MM-DD').toDate();
          } else if (!(examDate instanceof Date)) {
            examDate = new Date(examDate);
          }

          // Generate unique examId if not provided
          let examId = timetable.examId;
          if (!examId) {
            examId = `${timetable.courseCode}-${moment(examDate).format('YYYYMMDD')}-${timetable.startTime.replace(':', '')}`;
          }

          // Check if Exam already exists with this examId
          let exam = await Exam.findOne({ examId });
          if (!exam) {
            // Create Exam from ExamTimetable
            exam = await Exam.create({
              examId: examId,
              examName: timetable.examName,
              courseCode: timetable.courseCode,
              courseName: timetable.courseName || timetable.examName,
              date: examDate,
              startTime: timetable.startTime,
              endTime: timetable.endTime,
              duration: duration,
              campus: timetable.campus || 'Vignan University',
              department: timetable.department,
              classroom: timetable.classroom,
              totalStudents: timetable.totalStudents || 50,
              requiredInvigilators: timetable.requiredInvigilators || 2,
              examType: timetable.examType || 'semester',
              status: 'scheduled'
            });
            console.log(`   ✅ Created Exam: ${exam.examName} (${exam.examId})`);
          } else {
            console.log(`   ℹ️  Exam already exists: ${exam.examName} (${exam.examId})`);
          }
          
          // Mark ExamTimetable as converted (to prevent re-processing and enable cleanup)
          if (timetable.status !== 'converted') {
            timetable.status = 'converted';
            timetable.convertedToExam = exam._id;
            timetable.convertedAt = new Date();
            await timetable.save();
            console.log(`   📝 Marked ExamTimetable as converted: ${timetable.examName}`);
          }
          
          convertedExams.push(exam);
        }

        exams = await Exam.find({ _id: { $in: convertedExams.map(e => e._id) } })
          .populate('classroom')
          .sort({ date: 1, startTime: 1 });

        console.log(`📋 Converted ${exams.length} ExamTimetable entry(ies) to Exam record(s)`);
      }

      // Get ALL uploaded classrooms (including all blocks)
      const Classroom = require('../models/Classroom');
      const roomQuery = { isActive: true };
      if (campus) roomQuery.campus = campus;
      const allRooms = await Classroom.find(roomQuery).sort({ block: 1, roomNumber: 1 });
      
      console.log(`🏫 Found ${allRooms.length} classroom(s) to allocate invigilators`);
      
      // Log blocks distribution
      const blocksCount = {};
      allRooms.forEach(room => {
        blocksCount[room.block] = (blocksCount[room.block] || 0) + 1;
      });
      console.log(`📊 Blocks distribution:`, blocksCount);
      
      // Log sample rooms from each block
      const sampleRooms = {};
      allRooms.forEach(room => {
        if (!sampleRooms[room.block] || sampleRooms[room.block].length < 2) {
          if (!sampleRooms[room.block]) sampleRooms[room.block] = [];
          sampleRooms[room.block].push({
            roomNumber: room.roomNumber,
            block: room.block,
            isActive: room.isActive,
            _id: room._id
          });
        }
      });
      console.log(`📋 Sample rooms by block:`, JSON.stringify(sampleRooms, null, 2));

      if (allRooms.length === 0) {
        return { success: false, message: 'No classrooms found. Please upload classrooms first.' };
      }

      // Get faculty from 'faculties' collection
      const baseFacultyQuery = { isActive: true };
      const excelFacultyQuery = {
        ...baseFacultyQuery,
        uploadedViaExcel: true
      };

      if (campus) {
        baseFacultyQuery.campus = campus;
        excelFacultyQuery.campus = campus;
      }
      if (department) {
        baseFacultyQuery.department = department;
        excelFacultyQuery.department = department;
      }

      let faculty = await Faculty.find(excelFacultyQuery);

      console.log(`👥 Found ${faculty.length} faculty member(s) from uploaded Excel for allocation`);

      if (faculty.length === 0) {
        console.log('⚠️  No faculty with uploadedViaExcel=true found. Falling back to all active faculty for allocation.');
        faculty = await Faculty.find(baseFacultyQuery);
        console.log(`👥 Found ${faculty.length} active faculty member(s) after fallback query`);
      }

      if (faculty.length === 0) {
        return {
          success: false,
          message: 'No faculty available for allocation. Please create or upload active faculty (with campus and department) first.'
        };
      }

      // Check if we have enough faculty (need at least 2 * number of rooms per session)
      const minFacultyRequired = allRooms.length * 2;
      if (faculty.length < minFacultyRequired) {
        return {
          success: false,
          message: `Insufficient faculty. Required: ${minFacultyRequired} (2 per room × ${allRooms.length} rooms), Found: ${faculty.length}`
        };
      }

      // Get existing allocations to calculate workload
      const existingAllocations = await Allocation.find({
        status: { $ne: 'cancelled' }
      });

      // Calculate workload for each faculty
      const workloadMap = this.calculateWorkload(existingAllocations, faculty);

      // Group exams by date and session (morning/afternoon)
      // Since exam types don't mix on same date, all exams in a session will be same type
      const sessions = this.groupExamsBySession(exams);
      console.log(`⏰ Found ${sessions.length} session(s) to allocate`);

      // Process each session - assign faculty to ALL rooms
      const results = [];
      let totalAllocations = 0;
      let successfulSessions = 0;

      for (const session of sessions) {
        // Determine exam type from first exam (all exams in session are same type)
        const examType = session.exams[0].examType || 'semester';
        
        console.log(`\n📅 Processing ${session.sessionType} session: ${moment(session.date).format('YYYY-MM-DD')}`);
        console.log(`   Exam Type: ${examType}`);
        console.log(`   Exams in this session: ${session.exams.length}`);
        console.log(`   Allocating to ${allRooms.length} classroom(s)`);
        
        const result = await this.allocateForSession(
          session,
          allRooms,
          faculty,
          workloadMap,
          campus,
          examType
        );
        
        if (result.success) {
          successfulSessions++;
          totalAllocations += result.allocationsCreated || 0;
        }
        
        results.push(result);
      }

      // Detect conflicts after allocation
      await this.detectConflicts();
      
      return {
        success: true,
        message: `Allocated invigilators to all ${allRooms.length} classrooms for ${successfulSessions} session(s). Total allocations: ${totalAllocations}`,
        results,
        summary: {
          sessionsProcessed: sessions.length,
          successfulSessions: successfulSessions,
          totalRooms: allRooms.length,
          totalAllocations: totalAllocations
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Group exams by date and session (morning/afternoon)
   * Morning: 08:00 - 12:00
   * Afternoon: 12:00 - 18:00
   */
  groupExamsBySession(exams) {
    const sessions = {};
    
    exams.forEach(exam => {
      const date = moment(exam.date).format('YYYY-MM-DD');
      const startHour = parseInt(exam.startTime.split(':')[0]);
      
      // Determine session type
      let sessionType = 'morning';
      if (startHour >= 12) {
        sessionType = 'afternoon';
      }
      
      const sessionKey = `${date}_${sessionType}`;
      
      if (!sessions[sessionKey]) {
        sessions[sessionKey] = {
          date: exam.date,
          sessionType: sessionType,
          exams: []
        };
      }
      sessions[sessionKey].exams.push(exam);
    });
    
    return Object.values(sessions);
  }

  /**
   * Allocate faculty to ALL rooms for a session
   * Ensures: Each room gets exactly 2 faculties, no faculty allocated twice in same session
   * Since exam types don't mix on same date, all exams in session are same type
   */
  async allocateForSession(session, allRooms, faculty, workloadMap, campus = null, examType = 'semester') {
    const { date, sessionType, exams } = session;
    const examDate = moment(date).format('YYYY-MM-DD');
    
    // Get time range for this session
    const sessionStart = sessionType === 'morning' ? '08:00' : '12:00';
    const sessionEnd = sessionType === 'morning' ? '12:00' : '18:00';
    
    // Filter available faculty (no time conflicts for this session)
    const availableFaculty = [];
    for (const f of faculty) {
      if (campus && f.campus !== campus) {
        continue;
      }
      
      // Check if faculty has any conflict during this session
      const hasConflict = await this.hasTimeConflict(
        f._id,
        examDate,
        sessionStart,
        sessionEnd
      );
      if (!hasConflict) {
        availableFaculty.push(f);
      }
    }

    console.log(`   Available faculty (no conflicts): ${availableFaculty.length}`);

    // Need at least 2 * number of rooms
    const requiredFaculty = allRooms.length * 2;
    if (availableFaculty.length < requiredFaculty) {
      return {
        success: false,
        session: {
          date: examDate,
          sessionType: sessionType,
          examType: examType
        },
        message: `Insufficient available faculty. Required: ${requiredFaculty} (2 per room × ${allRooms.length} rooms), Found: ${availableFaculty.length}`
      };
    }

    // Calculate acknowledgment deadline
    const examDateMoment = moment(date);
    const acknowledgmentDeadline = examDateMoment.clone()
      .subtract(1, 'days')
      .set({ hour: 18, minute: 0, second: 0 });

    // Get first exam for reference
    const referenceExam = exams[0];
    
    // Use exam type to determine allocation strategy
    if (examType === 'labs') {
      return await this.allocateLabsForSession(
        session,
        allRooms,
        faculty,
        workloadMap,
        campus,
        acknowledgmentDeadline
      );
    }

    // For mid-term/semester: Assign exactly 2 unique faculties per room
    // No faculty should be allocated twice in the same session
    const allocations = [];
    const usedFacultyInSession = new Set(); // Track faculty used in this session
    
    // Shuffle faculty for fair distribution
    const shuffledFaculty = [...availableFaculty].sort(() => Math.random() - 0.5);
    let facultyIndex = 0;

    for (const room of allRooms) {
      const selectedFaculty = [];
      
      // Select exactly 2 unique faculties for this room
      while (selectedFaculty.length < 2 && facultyIndex < shuffledFaculty.length) {
        const candidate = shuffledFaculty[facultyIndex];
        const facultyId = candidate._id.toString();
        
        // Check if this faculty is already used in this session
        if (!usedFacultyInSession.has(facultyId)) {
          selectedFaculty.push(candidate);
          usedFacultyInSession.add(facultyId);
        }
        
        facultyIndex++;
        
        // If we've checked all faculty and still need more, wrap around
        if (facultyIndex >= shuffledFaculty.length && selectedFaculty.length < 2) {
          // Reset index and try again (shouldn't happen if we have enough faculty)
          facultyIndex = 0;
          if (usedFacultyInSession.size >= shuffledFaculty.length) {
            break; // All faculty already used
          }
        }
      }

      if (selectedFaculty.length < 2) {
        return {
          success: false,
          session: {
            date: examDate,
            sessionType: sessionType,
            examType: examType
          },
          message: `Could not assign 2 unique faculty to room ${room.roomNumber}. Insufficient available faculty.`
        };
      }

      // Use the time range from exams in this session
      const examStart = exams[0].startTime;
      const examEnd = exams[exams.length - 1].endTime || exams[0].endTime;
      
      // Calculate live status window
      const examStartMoment = moment(`${examDate} ${examStart}`, 'YYYY-MM-DD HH:mm');
      const liveStatusOpensAt = examStartMoment.clone().subtract(30, 'minutes');
      const liveStatusClosesAt = examStartMoment.clone();

      // Create allocations for this room
      for (const facultyMember of selectedFaculty) {
        const allocation = await Allocation.create({
          exam: referenceExam._id, // Link to first exam for reference
          classroom: room._id, // Ensure classroom is set - CRITICAL!
          faculty: facultyMember._id,
          date: date,
          startTime: examStart,
          endTime: examEnd,
          campus: room.campus || referenceExam.campus,
          department: referenceExam.department || room.department || 'General',
          status: 'assigned',
          acknowledgmentDeadline: acknowledgmentDeadline.toDate(),
          preExamAcknowledgment: {
            status: 'pending'
          },
          liveStatusWindow: {
            opensAt: liveStatusOpensAt.toDate(),
            closesAt: liveStatusClosesAt.toDate()
          }
        });

        allocations.push(allocation);

        // Update workload map
        const facultyId = facultyMember._id.toString();
        if (!workloadMap[facultyId]) {
          workloadMap[facultyId] = { count: 0, hours: 0, dates: new Set() };
        }
        workloadMap[facultyId].count++;
        const hours = this.calculateHours(examStart, examEnd);
        workloadMap[facultyId].hours += hours;
        workloadMap[facultyId].dates.add(examDate);
      }
    }
    
    // Log allocation creation summary by block
    const allocationsByBlock = {};
    allRooms.forEach(room => {
      allocationsByBlock[room.block] = (allocationsByBlock[room.block] || 0) + 2; // 2 faculties per room
    });
    console.log(`   📊 Allocations created by block:`, allocationsByBlock);

    // Update all exams in this session to 'allocated' status
    for (const exam of exams) {
      exam.status = 'allocated';
      await exam.save();
    }

    console.log(`   ✅ Allocated ${allocations.length} invigilators to ${allRooms.length} rooms`);
    console.log(`   ✅ Used ${usedFacultyInSession.size} unique faculty members`);

    return {
      success: true,
      session: {
        date: examDate,
        sessionType: sessionType,
        examType: examType
      },
      roomsAllocated: allRooms.length,
      allocationsCreated: allocations.length,
      uniqueFacultyUsed: usedFacultyInSession.size,
      allocations: allocations.map(a => a._id)
    };
  }

  /**
   * Allocate labs exams for a session (subject teacher required)
   * Since all exams in session are labs type, we can optimize this
   */
  async allocateLabsForSession(session, allRooms, faculty, workloadMap, campus, acknowledgmentDeadline) {
    const { date, sessionType, exams } = session;
    const examDate = moment(date).format('YYYY-MM-DD');
    const labsExams = exams; // All exams are labs type
    
    // Get all unique course names from labs exams
    const courseNames = [...new Set(labsExams.map(e => e.courseName).filter(Boolean))];
    
    console.log(`   Labs session - Course names: ${courseNames.join(', ')}`);
    
    // Get time range for this session
    const sessionStart = sessionType === 'morning' ? '08:00' : '12:00';
    const sessionEnd = sessionType === 'morning' ? '12:00' : '18:00';
    
    // Filter available faculty (no time conflicts for this session)
    const availableFaculty = [];
    for (const f of faculty) {
      if (campus && f.campus !== campus) {
        continue;
      }
      
      const hasConflict = await this.hasTimeConflict(
        f._id,
        examDate,
        sessionStart,
        sessionEnd
      );
      if (!hasConflict) {
        availableFaculty.push(f);
      }
    }
    
    const allocations = [];
    const usedFacultyInSession = new Set();
    
    for (const room of allRooms) {
      const selectedFaculty = [];
      
      // Step 1: Try to find 1 subject teacher (matching any course name)
      if (courseNames.length > 0) {
        const subjectFaculty = availableFaculty.filter(f => {
          if (usedFacultyInSession.has(f._id.toString())) return false;
          return courseNames.some(courseName => {
            return (f.subject && f.subject.toLowerCase().trim() === courseName.toLowerCase().trim()) ||
                   (f.subjects && Array.isArray(f.subjects) && f.subjects.some(sub => 
                     sub.toLowerCase().trim() === courseName.toLowerCase().trim()
                   ));
          });
        });
        
        if (subjectFaculty.length > 0) {
          const candidate = subjectFaculty[0];
          selectedFaculty.push(candidate);
          usedFacultyInSession.add(candidate._id.toString());
          console.log(`   ✅ Selected subject faculty: ${candidate.name} for room ${room.roomNumber}`);
        }
      }
      
      // Step 2: Add 1 more faculty (any faculty, not used in session)
      const remainingFaculty = availableFaculty.filter(f => {
        if (usedFacultyInSession.has(f._id.toString())) return false;
        return true;
      });
      
      if (remainingFaculty.length > 0 && selectedFaculty.length < 2) {
        selectedFaculty.push(remainingFaculty[0]);
        usedFacultyInSession.add(remainingFaculty[0]._id.toString());
      }
      
      if (selectedFaculty.length < 2) {
        return {
          success: false,
          session: {
            date: examDate,
            sessionType: sessionType,
            examType: 'labs'
          },
          message: `Could not assign 2 faculty to room ${room.roomNumber} for labs. Insufficient available faculty.`
        };
      }
      
      // Create allocations
      const examStart = exams[0].startTime;
      const examEnd = exams[exams.length - 1].endTime || exams[0].endTime;
      const examStartMoment = moment(`${examDate} ${examStart}`, 'YYYY-MM-DD HH:mm');
      const liveStatusOpensAt = examStartMoment.clone().subtract(30, 'minutes');
      const liveStatusClosesAt = examStartMoment.clone();
      
      for (const facultyMember of selectedFaculty) {
        const allocation = await Allocation.create({
          exam: labsExams[0]._id,
          classroom: room._id,
          faculty: facultyMember._id,
          date: date,
          startTime: examStart,
          endTime: examEnd,
          campus: room.campus || labsExams[0].campus,
          department: labsExams[0].department || room.department || 'General',
          status: 'assigned',
          acknowledgmentDeadline: acknowledgmentDeadline.toDate(),
          preExamAcknowledgment: {
            status: 'pending'
          },
          liveStatusWindow: {
            opensAt: liveStatusOpensAt.toDate(),
            closesAt: liveStatusClosesAt.toDate()
          }
        });
        allocations.push(allocation);
        
        // Update workload map
        const facultyId = facultyMember._id.toString();
        if (!workloadMap[facultyId]) {
          workloadMap[facultyId] = { count: 0, hours: 0, dates: new Set() };
        }
        workloadMap[facultyId].count++;
        const hours = this.calculateHours(examStart, examEnd);
        workloadMap[facultyId].hours += hours;
        workloadMap[facultyId].dates.add(examDate);
      }
    }
    
    // Update exams status
    for (const exam of exams) {
      exam.status = 'allocated';
      await exam.save();
    }
    
    console.log(`   ✅ Allocated ${allocations.length} invigilators to ${allRooms.length} rooms`);
    console.log(`   ✅ Used ${usedFacultyInSession.size} unique faculty members`);
    
    return {
      success: true,
      session: {
        date: examDate,
        sessionType: sessionType,
        examType: 'labs'
      },
      roomsAllocated: allRooms.length,
      allocationsCreated: allocations.length,
      uniqueFacultyUsed: usedFacultyInSession.size,
      allocations: allocations.map(a => a._id)
    };
  }

  /**
   * Check if faculty has time conflict
   */
  async hasTimeConflict(facultyId, date, startTime, endTime) {
    const examDate = moment(date).format('YYYY-MM-DD');
    const examStart = moment(`${examDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
    const examEnd = moment(`${examDate} ${endTime}`, 'YYYY-MM-DD HH:mm');

    const existingAllocations = await Allocation.find({
      faculty: facultyId,
      date: {
        $gte: moment(examDate).startOf('day').toDate(),
        $lte: moment(examDate).endOf('day').toDate()
      },
      status: { $ne: 'cancelled' }
    });

    for (const alloc of existingAllocations) {
      const allocStart = moment(
        `${moment(alloc.date).format('YYYY-MM-DD')} ${alloc.startTime}`,
        'YYYY-MM-DD HH:mm'
      );
      const allocEnd = moment(
        `${moment(alloc.date).format('YYYY-MM-DD')} ${alloc.endTime}`,
        'YYYY-MM-DD HH:mm'
      );

      if (examStart.isBefore(allocEnd) && allocStart.isBefore(examEnd)) {
        return true; // Conflict found
      }
    }

    return false; // No conflict
  }

  /**
   * Allocate invigilators for a classroom-time slot
   * This is the main allocation method - allocates for classrooms, not individual exams
   */
  async allocateClassroomTimeSlot(slotData, faculty, workloadMap) {
    try {
      const { classroom, date, startTime, endTime, campus, exams, maxRequiredInvigilators, examTypes } = slotData;
      const examDate = moment(date).format('YYYY-MM-DD');
      const requiredCount = maxRequiredInvigilators || 2;
      
      console.log(`🏫 Allocating for classroom ${classroom.roomNumber || classroom._id} on ${examDate} ${startTime}-${endTime}`);
      console.log(`   Exams in this slot: ${exams.length}, Required invigilators: ${requiredCount}`);

      // Filter faculty by campus
      let facultyToUse = faculty.filter(f => {
        return !campus || f.campus === campus;
      });
      
      if (facultyToUse.length === 0) {
        facultyToUse = faculty;
      }

      // Check if any exam is labs type
      const hasLabs = examTypes.has('labs');
      
      let selectedFaculty = [];
      
      if (hasLabs) {
        // For labs: Need 1 same subject teacher + 1 any faculty
        // Get all unique course names from labs exams
        const labsExams = exams.filter(e => e.examType === 'labs');
        const courseNames = [...new Set(labsExams.map(e => e.courseName).filter(Boolean))];
        
        if (courseNames.length > 0) {
          // Find subject faculty for any of the labs courses
          const subjectFaculty = facultyToUse.filter(f => {
            return courseNames.some(courseName => {
              return (f.subject && f.subject.toLowerCase().trim() === courseName.toLowerCase().trim()) ||
                     (f.subjects && Array.isArray(f.subjects) && f.subjects.some(sub => 
                       sub.toLowerCase().trim() === courseName.toLowerCase().trim()
                     ));
            });
          });
          
          if (subjectFaculty.length > 0) {
            const config = await this.getConfig();
            const scoredSubjectFaculty = [];
            for (const f of subjectFaculty) {
              // Use first labs exam for scoring
              const score = await this.calculateFacultyScore(
                f, labsExams[0], examDate, startTime, endTime, workloadMap, config
              );
              scoredSubjectFaculty.push({ faculty: f, score });
            }
            scoredSubjectFaculty.sort((a, b) => b.score - a.score);
            
            for (const { faculty: f } of scoredSubjectFaculty) {
              if (await this.isFacultyAvailable(f, examDate, startTime, endTime, workloadMap, config)) {
                selectedFaculty.push(f);
                console.log(`   ✅ Selected subject faculty: ${f.name}`);
                break;
              }
            }
          }
        }
      }
      
      // Select remaining faculty (for mid-term/semester or additional for labs)
      if (selectedFaculty.length < requiredCount) {
        const config = await this.getConfig();
        const remainingFaculty = facultyToUse.filter(f => 
          !selectedFaculty.some(sf => sf._id.toString() === f._id.toString())
        );
        
        // Use first exam for scoring (or any exam)
        const examForScoring = exams[0];
        
        const scoredFaculty = [];
        for (const f of remainingFaculty) {
          const score = await this.calculateFacultyScore(
            f, examForScoring, examDate, startTime, endTime, workloadMap, config
          );
          scoredFaculty.push({ faculty: f, score });
        }
        
        scoredFaculty.sort((a, b) => b.score - a.score);
        
        for (const { faculty: f } of scoredFaculty) {
          if (selectedFaculty.length >= requiredCount) break;
          if (await this.isFacultyAvailable(f, examDate, startTime, endTime, workloadMap, config)) {
            selectedFaculty.push(f);
          }
        }
      }

      if (selectedFaculty.length < requiredCount) {
        return {
          success: false,
          classroomId: classroom._id || classroom,
          message: `Insufficient available faculty for classroom ${classroom.roomNumber || 'N/A'}. Required: ${requiredCount}, Found: ${selectedFaculty.length}`
        };
      }

      // Create allocations for this classroom-time slot
      // Each allocation links to the classroom and all exams in that slot
      const allocations = [];
      const classroomId = classroom._id || classroom;
      
      for (const facultyMember of selectedFaculty) {
        // Create one allocation per faculty member for this classroom-time slot
        // Link to all exams in this slot
        const allocation = await Allocation.create({
          classroom: classroomId,
          exam: exams[0]._id, // Link to first exam for reference (optional)
          faculty: facultyMember._id,
          date: date,
          startTime: startTime,
          endTime: endTime,
          campus: campus,
          department: exams[0].department, // Use first exam's department
          status: 'assigned'
        });

        allocations.push(allocation);

        // Update workload map
        const facultyId = facultyMember._id.toString();
        if (!workloadMap[facultyId]) {
          workloadMap[facultyId] = { count: 0, hours: 0, dates: new Set() };
        }
        workloadMap[facultyId].count++;
        const hours = this.calculateHours(startTime, endTime);
        workloadMap[facultyId].hours += hours;
        workloadMap[facultyId].dates.add(examDate);
      }

      // Update all exams in this slot to 'allocated' status
      const examIds = [];
      for (const exam of exams) {
        exam.status = 'allocated';
        exam.allocatedInvigilators = selectedFaculty.map(f => ({
          faculty: f._id,
          allocatedAt: new Date()
        }));
        await exam.save();
        examIds.push(exam._id);
      }

      // Note: Email notifications are NOT sent automatically during allocation
      // Admin must use "Notify All" button to send emails to faculty

      return {
        success: true,
        classroomId: classroomId,
        classroomName: classroom.roomNumber || 'N/A',
        allocations: allocations.map(a => a._id),
        allocatedFacultyIds: selectedFaculty.map(f => f._id.toString()),
        examIds: examIds,
        examsCount: exams.length
      };
    } catch (error) {
      return {
        success: false,
        classroomId: slotData.classroom._id || slotData.classroom,
        message: error.message
      };
    }
  }

  /**
   * Allocate invigilators for a single exam
   * Each exam is processed individually - allocates invigilators to the exam's classroom
   */
  async allocateExam(exam, faculty, workloadMap) {
    try {
      // Check if allocations already exist for this exam (prevent duplicates)
      const existingAllocations = await Allocation.find({
        exam: exam._id,
        status: { $ne: 'cancelled' }
      });

      if (existingAllocations.length > 0) {
        console.log(`   ⚠️  Allocations already exist for exam ${exam.examName} (${exam.examId}). Skipping duplicate allocation.`);
        return {
          success: true,
          examId: exam._id,
          message: 'Allocations already exist for this exam',
          allocations: existingAllocations.map(a => a._id),
          skipped: true
        };
      }

      const requiredCount = exam.requiredInvigilators || 2; // Default 2
      const examDate = moment(exam.date).format('YYYY-MM-DD');
      const examStart = exam.startTime;
      const examEnd = exam.endTime;
      const examType = exam.examType || 'semester'; // mid-term, semester, labs

      // For Labs: Need 1 same subject teacher + 1 any faculty
      if (examType === 'labs') {
        return await this.allocateLabsExam(exam, faculty, workloadMap, examDate, examStart, examEnd);
      }

      // For Mid-Term and Semester: Any 2 faculties
      // Score and rank faculty
      const config = await this.getConfig();
      const scoredFaculty = [];
      for (const f of faculty) {
        const score = await this.calculateFacultyScore(
          f,
          exam,
          examDate,
          examStart,
          examEnd,
          workloadMap,
          config
        );
        scoredFaculty.push({ faculty: f, score });
      }

      // Sort by score (higher is better)
      scoredFaculty.sort((a, b) => b.score - a.score);

      // Select top N faculty
      const selectedFaculty = [];
      for (const { faculty: f } of scoredFaculty) {
        if (selectedFaculty.length >= requiredCount) break;

        // Check if faculty is available for this time slot
        if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
          selectedFaculty.push(f);
        }
      }

      if (selectedFaculty.length < requiredCount) {
        return {
          success: false,
          examId: exam._id,
          message: `Insufficient available faculty. Required: ${requiredCount}, Found: ${selectedFaculty.length}`
        };
      }

      // Calculate acknowledgment deadline (1-2 days before exam)
      const examDateMoment = moment(exam.date);
      const acknowledgmentDeadline = examDateMoment.clone().subtract(1, 'days').set({ hour: 18, minute: 0, second: 0 }); // 1 day before, 6 PM
      
      // Calculate live status window (30 minutes before exam)
      const examStartMoment = moment(`${examDateMoment.format('YYYY-MM-DD')} ${exam.startTime}`, 'YYYY-MM-DD HH:mm');
      const liveStatusOpensAt = examStartMoment.clone().subtract(30, 'minutes');
      const liveStatusClosesAt = examStartMoment.clone();

      // Create allocations
      const allocations = [];
      const classroomId = exam.classroom._id ? exam.classroom._id : exam.classroom;
      
      for (const facultyMember of selectedFaculty) {
        const allocation = await Allocation.create({
          exam: exam._id,
          classroom: classroomId,
          faculty: facultyMember._id,
          date: exam.date,
          startTime: exam.startTime,
          endTime: exam.endTime,
          campus: exam.campus,
          department: exam.department,
          status: 'assigned',
          // Pre-exam acknowledgment settings
          acknowledgmentDeadline: acknowledgmentDeadline.toDate(),
          preExamAcknowledgment: {
            status: 'pending'
          },
          // Live status window
          liveStatusWindow: {
            opensAt: liveStatusOpensAt.toDate(),
            closesAt: liveStatusClosesAt.toDate()
          }
        });

        allocations.push(allocation);

        // Update workload map
        if (!workloadMap[facultyMember._id]) {
          workloadMap[facultyMember._id] = { count: 0, hours: 0, dates: new Set() };
        }
        workloadMap[facultyMember._id].count++;
        const hours = this.calculateHours(examStart, examEnd);
        workloadMap[facultyMember._id].hours += hours;
        workloadMap[facultyMember._id].dates.add(examDate);
      }

      // Assign reserved faculty for each allocation
      const ReservedAllocation = require('../models/ReservedAllocation');
      const reservedAllocations = [];
      
      for (const allocation of allocations) {
        // Find 1-2 reserved faculty (same campus, light workload, no conflicts)
        const reservedFaculty = await this.selectReservedFaculty(
          exam, 
          allocation, 
          faculty, 
          workloadMap, 
          selectedFaculty
        );
        
        // Add reserved faculty to allocation
        if (reservedFaculty.length > 0) {
          allocation.reservedFaculty = reservedFaculty.map((rf, index) => ({
            faculty: rf._id,
            priority: index + 1,
            status: 'available'
          }));
          await allocation.save();
          
          // Create ReservedAllocation records
          for (let i = 0; i < reservedFaculty.length; i++) {
            const reserved = await ReservedAllocation.create({
              exam: exam._id,
              primaryAllocation: allocation._id,
              reservedFaculty: reservedFaculty[i]._id,
              priority: i + 1,
              status: 'available'
            });
            reservedAllocations.push(reserved);
          }
        }
      }

      // Update exam status
      exam.status = 'allocated';
      exam.allocatedInvigilators = selectedFaculty.map(f => ({
        faculty: f._id,
        allocatedAt: new Date()
      }));
      await exam.save();

      // Note: Email notifications are NOT sent automatically during allocation
      // Admin must use "Notify All" button to send emails to faculty

      return {
        success: true,
        examId: exam._id,
        allocations: allocations.map(a => a._id),
        allocatedFacultyIds: selectedFaculty.map(f => f._id.toString()),
        reservedAllocations: reservedAllocations.map(ra => ra._id)
      };
    } catch (error) {
      return {
        success: false,
        examId: exam._id,
        message: error.message
      };
    }
  }

  /**
   * Allocate invigilators for Labs exam
   * Labs need: 1 same subject teacher + 1 any faculty per class
   */
  async allocateLabsExam(exam, faculty, workloadMap, examDate, examStart, examEnd) {
    const config = await this.getConfig();
    try {
      const requiredCount = exam.requiredInvigilators || 2; // Default 2
      const Allocation = require('../models/Allocation');
      
      // Filter faculty matching exam's courseName (same subject name)
      // Match by subject name field or subjects array containing the courseName
      const subjectFaculty = faculty.filter(f => {
        const campusMatch = !exam.campus || f.campus === exam.campus;
        
        // Check if faculty teaches this subject (match by course name, not course code)
        const subjectMatch = exam.courseName && (
          (f.subject && f.subject.toLowerCase().trim() === exam.courseName.toLowerCase().trim()) ||
          (f.subjects && Array.isArray(f.subjects) && f.subjects.some(sub => 
            sub.toLowerCase().trim() === exam.courseName.toLowerCase().trim()
          ))
        );
        
        return campusMatch && subjectMatch;
      });
      
      // All other faculty (for second invigilator)
      const anyFaculty = faculty.filter(f => {
        const campusMatch = !exam.campus || f.campus === exam.campus;
        return campusMatch;
      });
      
      console.log(`   📚 Labs exam: Found ${subjectFaculty.length} subject faculty (matching course: ${exam.courseName}), ${anyFaculty.length} total faculty`);
      
      const selectedFaculty = [];
      
      // Step 1: Select 1 faculty from same subject (matching course name)
      if (subjectFaculty.length > 0) {
        // Score and rank subject faculty
        const config = await this.getConfig();
        const scoredSubjectFaculty = [];
        for (const f of subjectFaculty) {
          const score = await this.calculateFacultyScore(f, exam, examDate, examStart, examEnd, workloadMap, config);
          scoredSubjectFaculty.push({ faculty: f, score });
        }
        
        scoredSubjectFaculty.sort((a, b) => b.score - a.score);
        
        // Find first available subject faculty
        for (const { faculty: f } of scoredSubjectFaculty) {
          if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
            selectedFaculty.push(f);
            const subjectInfo = f.subject || (f.subjects && f.subjects.length > 0 ? f.subjects.join(', ') : 'N/A');
            console.log(`   ✅ Selected subject faculty: ${f.name} (Subject: ${subjectInfo}, Dept: ${f.department})`);
            break;
          }
        }
      }
      
      // Step 2: Select 1 more faculty from any department (excluding already selected)
      if (selectedFaculty.length < requiredCount) {
        const remainingFaculty = anyFaculty.filter(f => 
          !selectedFaculty.some(sf => sf._id.toString() === f._id.toString())
        );
        
        // Score and rank remaining faculty
        const scoredRemaining = [];
        for (const f of remainingFaculty) {
          const score = await this.calculateFacultyScore(f, exam, examDate, examStart, examEnd, workloadMap, config);
          scoredRemaining.push({ faculty: f, score });
        }
        
        scoredRemaining.sort((a, b) => b.score - a.score);
        
        // Find available faculty
        for (const { faculty: f } of scoredRemaining) {
          if (selectedFaculty.length >= requiredCount) break;
          
          if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
            selectedFaculty.push(f);
            console.log(`   ✅ Selected any faculty: ${f.name} (${f.department || 'Any'})`);
            break;
          }
        }
      }
      
      // If we still don't have enough, try without availability check (last resort)
      if (selectedFaculty.length < requiredCount) {
        const remainingFaculty = anyFaculty.filter(f => 
          !selectedFaculty.some(sf => sf._id.toString() === f._id.toString())
        );
        
        for (const f of remainingFaculty) {
          if (selectedFaculty.length >= requiredCount) break;
          selectedFaculty.push(f);
          console.log(`   ⚠️  Selected faculty without availability check: ${f.name}`);
        }
      }
      
      if (selectedFaculty.length < requiredCount) {
        return {
          success: false,
          examId: exam._id,
          message: `Insufficient available faculty for labs exam. Required: ${requiredCount}, Found: ${selectedFaculty.length}`
        };
      }
      
      // Calculate acknowledgment deadline (1-2 days before exam)
      const examDateMoment = moment(exam.date);
      const acknowledgmentDeadline = examDateMoment.clone().subtract(1, 'days').set({ hour: 18, minute: 0, second: 0 }); // 1 day before, 6 PM
      
      // Calculate live status window (30 minutes before exam)
      const examStartMoment = moment(`${examDateMoment.format('YYYY-MM-DD')} ${exam.startTime}`, 'YYYY-MM-DD HH:mm');
      const liveStatusOpensAt = examStartMoment.clone().subtract(30, 'minutes');
      const liveStatusClosesAt = examStartMoment.clone();

      // Create allocations
      const allocations = [];
      const classroomId = exam.classroom._id ? exam.classroom._id : exam.classroom;
      
      for (const facultyMember of selectedFaculty) {
        const allocation = await Allocation.create({
          exam: exam._id,
          classroom: classroomId,
          faculty: facultyMember._id,
          date: exam.date,
          startTime: exam.startTime,
          endTime: exam.endTime,
          campus: exam.campus,
          department: exam.department,
          status: 'assigned',
          // Pre-exam acknowledgment settings
          acknowledgmentDeadline: acknowledgmentDeadline.toDate(),
          preExamAcknowledgment: {
            status: 'pending'
          },
          // Live status window
          liveStatusWindow: {
            opensAt: liveStatusOpensAt.toDate(),
            closesAt: liveStatusClosesAt.toDate()
          }
        });

        allocations.push(allocation);

        // Update workload map
        if (!workloadMap[facultyMember._id]) {
          workloadMap[facultyMember._id] = { count: 0, hours: 0, dates: new Set() };
        }
        workloadMap[facultyMember._id].count++;
        const hours = this.calculateHours(examStart, examEnd);
        workloadMap[facultyMember._id].hours += hours;
        workloadMap[facultyMember._id].dates.add(examDate);
      }

      // Assign reserved faculty for each allocation
      const ReservedAllocation = require('../models/ReservedAllocation');
      const reservedAllocations = [];
      
      for (const allocation of allocations) {
        // Find 1-2 reserved faculty (same campus, light workload, no conflicts)
        const reservedFaculty = await this.selectReservedFaculty(
          exam, 
          allocation, 
          faculty, 
          workloadMap, 
          selectedFaculty
        );
        
        // Add reserved faculty to allocation
        if (reservedFaculty.length > 0) {
          allocation.reservedFaculty = reservedFaculty.map((rf, index) => ({
            faculty: rf._id,
            priority: index + 1,
            status: 'available'
          }));
          await allocation.save();
          
          // Create ReservedAllocation records
          for (let i = 0; i < reservedFaculty.length; i++) {
            const reserved = await ReservedAllocation.create({
              exam: exam._id,
              primaryAllocation: allocation._id,
              reservedFaculty: reservedFaculty[i]._id,
              priority: i + 1,
              status: 'available'
            });
            reservedAllocations.push(reserved);
          }
        }
      }

      // Update exam status
      exam.status = 'allocated';
      exam.allocatedInvigilators = selectedFaculty.map(f => ({
        faculty: f._id,
        allocatedAt: new Date()
      }));
      await exam.save();

      // Note: Email notifications are NOT sent automatically during allocation
      // Admin must use "Notify All" button to send emails to faculty

      return {
        success: true,
        examId: exam._id,
        allocations: allocations.map(a => a._id),
        allocatedFacultyIds: selectedFaculty.map(f => f._id.toString()),
        reservedAllocations: reservedAllocations.map(ra => ra._id)
      };
    } catch (error) {
      return {
        success: false,
        examId: exam._id,
        message: error.message
      };
    }
  }

  /**
   * Calculate heuristic score for faculty assignment
   */
  async calculateFacultyScore(faculty, exam, examDate, examStart, examEnd, workloadMap, config = null) {
    if (!config) {
      config = await this.getConfig();
    }
    
    let score = 100; // Base score

    const workload = workloadMap[faculty._id] || { count: 0, hours: 0, dates: new Set() };

    // 1. Workload distribution (lower workload = higher score)
    const workloadPenalty = workload.count * 10;
    score -= workloadPenalty;

    // 2. Hours per day (prefer faculty with fewer hours) - use config
    const hoursToday = workload.dates.has(examDate) ? workload.hours : 0;
    const examHours = this.calculateHours(examStart, examEnd);
    const maxHours = config.maxHoursPerDay || 6;
    if (hoursToday + examHours > maxHours) {
      score -= 100; // Heavy penalty if exceeds max hours
    } else if (hoursToday >= maxHours) {
      score -= 50;
    } else {
      score -= hoursToday * 5;
    }

    // 3. Same day repetition penalty - use config
    if (workload.dates.has(examDate) && !config.allowSameDayRepetition) {
      score -= 100; // Heavy penalty if same-day not allowed
    } else if (workload.dates.has(examDate)) {
      score -= 30; // Prefer faculty who haven't been assigned today
    }

    // 4. Campus match bonus - use config weight
    if (faculty.campus === exam.campus) {
      score += config.campusPreferenceWeight || 20;
    }

    // 5. Department match bonus - use config weight
    if (faculty.department === exam.department) {
      score += config.departmentPreferenceWeight || 15;
    }

    // 6. Availability check
    if (faculty.availability && faculty.availability.length > 0) {
      const dayOfWeek = moment(examDate).format('dddd');
      const dayAvailability = faculty.availability.find(a => a.day === dayOfWeek);
      if (dayAvailability) {
        const isAvailable = dayAvailability.timeSlots.some(slot => {
          return examStart >= slot.start && examEnd <= slot.end;
        });
        if (!isAvailable) {
          score -= 40; // Penalty if not available
        } else {
          score += 10; // Bonus if explicitly available
        }
      }
    }

    // 7. Random factor for fairness (small variation)
    score += Math.random() * 5;

    return Math.max(0, score); // Ensure non-negative
  }

  /**
   * Check if faculty is available for time slot
   */
  async isFacultyAvailable(faculty, date, startTime, endTime, workloadMap, config = null) {
    if (!config) {
      config = await this.getConfig();
    }

    const examDate = moment(date).format('YYYY-MM-DD');
    const workload = workloadMap[faculty._id] || { dates: new Set(), hours: 0 };
    const examHours = this.calculateHours(startTime, endTime);

    // Check max hours per day - use config
    const hoursToday = workload.dates.has(examDate) ? workload.hours : 0;
    const maxHours = config.maxHoursPerDay || 6;
    if (hoursToday + examHours > maxHours) {
      return false;
    }

    // Check same-day repetition - use config
    if (workload.dates.has(examDate) && !config.allowSameDayRepetition) {
      return false;
    }

    // Check max duties per faculty - use config
    if (config.maxDutiesPerFaculty && workload.count >= config.maxDutiesPerFaculty) {
      return false;
    }

    // Check time gap between duties if same day
    if (workload.dates.has(examDate) && config.timeGapBetweenDuties > 0) {
      // This would need to check actual existing allocations for time gap
      // Simplified check for now - could be enhanced
    }

    return true;
  }

  /**
   * Calculate hours between two time strings
   */
  calculateHours(startTime, endTime) {
    const start = moment(startTime, 'HH:mm');
    const end = moment(endTime, 'HH:mm');
    return end.diff(start, 'hours', true);
  }

  /**
   * Calculate current workload for all faculty
   */
  calculateWorkload(allocations, faculty) {
    const workloadMap = {};

    faculty.forEach(f => {
      workloadMap[f._id] = {
        count: 0,
        hours: 0,
        dates: new Set()
      };
    });

    allocations.forEach(allocation => {
      const facultyId = allocation.faculty.toString();
      if (workloadMap[facultyId]) {
        workloadMap[facultyId].count++;
        const hours = this.calculateHours(allocation.startTime, allocation.endTime);
        workloadMap[facultyId].hours += hours;
        workloadMap[facultyId].dates.add(moment(allocation.date).format('YYYY-MM-DD'));
      }
    });

    return workloadMap;
  }

  /**
   * Detect conflicts in allocations
   */
  async detectConflicts() {
    try {
      // Clear existing unresolved conflicts
      await Conflict.deleteMany({ status: { $ne: 'resolved' } });

      const allocations = await Allocation.find({
        status: { $ne: 'cancelled' }
      }).populate('faculty exam');

      const conflicts = [];

      // Group allocations by faculty and date
      const facultyDateMap = {};
      allocations.forEach(allocation => {
        const facultyId = allocation.faculty._id.toString();
        const date = moment(allocation.date).format('YYYY-MM-DD');
        const key = `${facultyId}-${date}`;

        if (!facultyDateMap[key]) {
          facultyDateMap[key] = [];
        }
        facultyDateMap[key].push(allocation);
      });

      // Check for conflicts
      for (const [key, allocs] of Object.entries(facultyDateMap)) {
        if (allocs.length > 1) {
          // Check for overlapping time slots (HIGH severity)
          for (let i = 0; i < allocs.length; i++) {
            for (let j = i + 1; j < allocs.length; j++) {
              if (this.isTimeOverlapping(allocs[i], allocs[j])) {
                conflicts.push({
                  type: 'overlapping_time',
                  severity: 'high',
                  faculty: allocs[i].faculty._id,
                  allocations: [allocs[i]._id, allocs[j]._id],
                  description: `Faculty ${allocs[i].faculty.name} has overlapping time slots on ${moment(allocs[i].date).format('YYYY-MM-DD')}`
                });
              }
            }
          }

          // Multiple duties same day (MEDIUM severity)
          if (allocs.length > 1 && conflicts.length === 0) {
            conflicts.push({
              type: 'multiple_duties_same_day',
              severity: 'medium',
              faculty: allocs[0].faculty._id,
              allocations: allocs.map(a => a._id),
              description: `Faculty ${allocs[0].faculty.name} has ${allocs.length} duties on ${moment(allocs[0].date).format('YYYY-MM-DD')}`
            });
          }
        }
      }

      // Save conflicts
      for (const conflictData of conflicts) {
        const suggestedActions = this.generateResolutionSuggestions(conflictData);
        await Conflict.create({
          ...conflictData,
          resolution: {
            suggestedActions
          }
        });
      }

      return conflicts;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Select reserved faculty for an allocation
   * Criteria: Same campus, light workload, no time conflicts
   */
  async selectReservedFaculty(exam, allocation, allFaculty, workloadMap, selectedFaculty) {
    try {
      const config = await this.getConfig();
      const examDate = moment(exam.date).format('YYYY-MM-DD');
      const examStart = exam.startTime;
      const examEnd = exam.endTime;
      
      // Filter out already selected faculty and those with conflicts
      const availableFaculty = allFaculty.filter(f => {
        // Not already selected
        if (selectedFaculty.some(sf => sf._id.toString() === f._id.toString())) {
          return false;
        }
        
        // Same campus
        if (f.campus !== exam.campus) {
          return false;
        }
        
        // Active faculty
        if (!f.isActive) {
          return false;
        }
        
        return true;
      });
      
      // Score and rank available faculty (prefer light workload)
      const scoredFaculty = [];
      for (const f of availableFaculty) {
        const score = await this.calculateFacultyScore(
          f, exam, examDate, examStart, examEnd, workloadMap, config
        );
        // Bonus for very light workload (ideal for reserved faculty)
        const workload = workloadMap[f._id] || { count: 0, hours: 0 };
        if (workload.count === 0) {
          score += 50; // Heavy bonus for zero workload
        } else if (workload.count <= 2) {
          score += 20; // Bonus for light workload
        }
        scoredFaculty.push({ faculty: f, score });
      }
      
      // Sort by score (higher is better)
      scoredFaculty.sort((a, b) => b.score - a.score);
      
      // Select top 1-2 reserved faculty
      const reservedFaculty = [];
      for (const { faculty: f } of scoredFaculty) {
        if (reservedFaculty.length >= 2) break; // Max 2 reserved per allocation
        
        // Check availability
        if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
          reservedFaculty.push(f);
        }
      }
      
      return reservedFaculty;
    } catch (error) {
      console.error('Error selecting reserved faculty:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Check if two allocations have overlapping time slots
   */
  isTimeOverlapping(allocation1, allocation2) {
    const start1 = moment(`${moment(allocation1.date).format('YYYY-MM-DD')} ${allocation1.startTime}`, 'YYYY-MM-DD HH:mm');
    const end1 = moment(`${moment(allocation1.date).format('YYYY-MM-DD')} ${allocation1.endTime}`, 'YYYY-MM-DD HH:mm');
    const start2 = moment(`${moment(allocation2.date).format('YYYY-MM-DD')} ${allocation2.startTime}`, 'YYYY-MM-DD HH:mm');
    const end2 = moment(`${moment(allocation2.date).format('YYYY-MM-DD')} ${allocation2.endTime}`, 'YYYY-MM-DD HH:mm');

    return start1.isBefore(end2) && start2.isBefore(end1);
  }

  /**
   * Select reserved faculty for an allocation
   * Criteria: Same campus, light workload, no time conflicts
   */
  async selectReservedFaculty(exam, allocation, allFaculty, workloadMap, selectedFaculty) {
    try {
      const config = await this.getConfig();
      const examDate = moment(exam.date).format('YYYY-MM-DD');
      const examStart = exam.startTime;
      const examEnd = exam.endTime;
      
      // Filter out already selected faculty and those with conflicts
      const availableFaculty = allFaculty.filter(f => {
        // Not already selected
        if (selectedFaculty.some(sf => sf._id.toString() === f._id.toString())) {
          return false;
        }
        
        // Same campus
        if (f.campus !== exam.campus) {
          return false;
        }
        
        // Active faculty
        if (!f.isActive) {
          return false;
        }
        
        return true;
      });
      
      // Score and rank available faculty (prefer light workload)
      const scoredFaculty = [];
      for (const f of availableFaculty) {
        const score = await this.calculateFacultyScore(
          f, exam, examDate, examStart, examEnd, workloadMap, config
        );
        // Bonus for very light workload (ideal for reserved faculty)
        const workload = workloadMap[f._id] || { count: 0, hours: 0 };
        if (workload.count === 0) {
          score += 50; // Heavy bonus for zero workload
        } else if (workload.count <= 2) {
          score += 20; // Bonus for light workload
        }
        scoredFaculty.push({ faculty: f, score });
      }
      
      // Sort by score (higher is better)
      scoredFaculty.sort((a, b) => b.score - a.score);
      
      // Select top 1-2 reserved faculty
      const reservedFaculty = [];
      for (const { faculty: f } of scoredFaculty) {
        if (reservedFaculty.length >= 2) break; // Max 2 reserved per allocation
        
        // Check availability
        if (await this.isFacultyAvailable(f, examDate, examStart, examEnd, workloadMap, config)) {
          reservedFaculty.push(f);
        }
      }
      
      return reservedFaculty;
    } catch (error) {
      console.error('Error selecting reserved faculty:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Generate resolution suggestions for conflicts
   */
  generateResolutionSuggestions(conflict) {
    const suggestions = [];

    if (conflict.type === 'overlapping_time') {
      suggestions.push('Reassign one of the conflicting allocations to another faculty member');
      suggestions.push('Reschedule one of the exams to a different time slot');
      suggestions.push('Cancel one of the allocations if not critical');
    } else if (conflict.type === 'multiple_duties_same_day') {
      suggestions.push('Distribute duties across different days');
      suggestions.push('Assign additional faculty to share the workload');
      suggestions.push('Verify if faculty can handle multiple duties on the same day');
    }

    return suggestions;
  }
}

module.exports = new AllocationService();


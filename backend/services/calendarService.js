const Exam = require('../models/Exam');
const Allocation = require('../models/Allocation');
const moment = require('moment');

class CalendarService {
  /**
   * Get calendar events for admin (entire university)
   */
  async getAdminCalendar(filters = {}) {
    try {
      const { campus, department, examType, startDate, endDate } = filters;
      
      // Build query for exams
      const examQuery = { status: { $ne: 'cancelled' } };
      if (campus) examQuery.campus = campus;
      if (department) examQuery.department = department;
      if (examType) examQuery.examType = examType;
      if (startDate || endDate) {
        examQuery.date = {};
        if (startDate) examQuery.date.$gte = new Date(startDate);
        if (endDate) examQuery.date.$lte = new Date(endDate);
      }

      // Get all exams without populating allocatedInvigilators.faculty (will do manually)
      const exams = await Exam.find(examQuery)
        .populate('classroom', 'roomNumber block floor building')
        .sort({ date: 1, startTime: 1 });

      // Manually populate faculty in allocatedInvigilators
      const { Faculty } = require('../utils/userHelper');
      const facultyIds = [...new Set(exams.flatMap(exam => 
        (exam.allocatedInvigilators || []).map(ai => ai.faculty?.toString()).filter(Boolean)
      ))];
      const facultyMap = new Map();
      
      if (facultyIds.length > 0) {
        const facultyMembers = await Faculty.find({ _id: { $in: facultyIds } })
          .select('name email employeeId department');
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

      const events = [];

      examsWithFaculty.forEach(exam => {
        const examDate = moment(exam.date);
        const startDateTime = moment(`${examDate.format('YYYY-MM-DD')} ${exam.startTime}`, 'YYYY-MM-DD HH:mm');
        const endDateTime = moment(`${examDate.format('YYYY-MM-DD')} ${exam.endTime}`, 'YYYY-MM-DD HH:mm');

        // Main exam event
        events.push({
          id: `exam-${exam._id}`,
          title: exam.examName,
          start: startDateTime.toDate(),
          end: endDateTime.toDate(),
          resource: {
            type: 'exam',
            examId: exam._id,
            examName: exam.examName,
            courseCode: exam.courseCode,
            courseName: exam.courseName,
            department: exam.department,
            campus: exam.campus,
            examType: exam.examType,
            classroom: exam.classroom,
            allocatedFaculty: exam.allocatedInvigilators?.map(a => ({
              _id: a.faculty?._id,
              name: a.faculty?.name,
              email: a.faculty?.email,
              employeeId: a.faculty?.employeeId,
              department: a.faculty?.department
            })) || [],
            totalStudents: exam.totalStudents,
            requiredInvigilators: exam.requiredInvigilators,
            color: this.getEventColor(exam.examType, exam.department)
          }
        });

        // Individual allocation events for each faculty
        if (exam.allocatedInvigilators && exam.allocatedInvigilators.length > 0) {
          exam.allocatedInvigilators.forEach(inv => {
            if (inv.faculty) {
              events.push({
                id: `allocation-${exam._id}-${inv.faculty._id}`,
                title: `${inv.faculty.name} - ${exam.examName}`,
                start: startDateTime.toDate(),
                end: endDateTime.toDate(),
                resource: {
                  type: 'allocation',
                  examId: exam._id,
                  examName: exam.examName,
                  courseCode: exam.courseCode,
                  facultyId: inv.faculty._id,
                  facultyName: inv.faculty.name,
                  facultyEmail: inv.faculty.email,
                  department: exam.department,
                  campus: exam.campus,
                  classroom: exam.classroom,
                  color: '#3B82F6' // Blue for allocations
                }
              });
            }
          });
        }
      });

      return {
        success: true,
        events,
        totalEvents: events.length,
        dateRange: {
          start: startDate || (exams.length > 0 ? moment(exams[0].date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')),
          end: endDate || (exams.length > 0 ? moment(exams[exams.length - 1].date).format('YYYY-MM-DD') : moment().add(1, 'month').format('YYYY-MM-DD'))
        }
      };
    } catch (error) {
      throw new Error(`Error fetching admin calendar: ${error.message}`);
    }
  }

  /**
   * Get calendar events for faculty (their own duties only)
   */
  async getFacultyCalendar(facultyId, filters = {}) {
    try {
      const { startDate, endDate } = filters;
      
      // Build query for allocations
      const allocationQuery = {
        faculty: facultyId,
        status: { $ne: 'cancelled' }
      };
      
      if (startDate || endDate) {
        allocationQuery.date = {};
        if (startDate) allocationQuery.date.$gte = new Date(startDate);
        if (endDate) allocationQuery.date.$lte = new Date(endDate);
      }

      // Get all allocations for this faculty
      const allocations = await Allocation.find(allocationQuery)
        .populate({
          path: 'exam',
          populate: {
            path: 'classroom',
            select: 'roomNumber block floor building'
          }
        })
        .sort({ date: 1, startTime: 1 });

      const events = [];

      allocations.forEach(allocation => {
        const exam = allocation.exam;
        if (!exam) return;

        const examDate = moment(allocation.date);
        const startDateTime = moment(`${examDate.format('YYYY-MM-DD')} ${allocation.startTime}`, 'YYYY-MM-DD HH:mm');
        const endDateTime = moment(`${examDate.format('YYYY-MM-DD')} ${allocation.endTime}`, 'YYYY-MM-DD HH:mm');

        events.push({
          id: `duty-${allocation._id}`,
          title: exam.examName || 'Invigilation Duty',
          start: startDateTime.toDate(),
          end: endDateTime.toDate(),
          resource: {
            type: 'duty',
            allocationId: allocation._id,
            examId: exam._id,
            examName: exam.examName,
            courseCode: exam.courseCode,
            courseName: exam.courseName,
            date: allocation.date,
            startTime: allocation.startTime,
            endTime: allocation.endTime,
            campus: allocation.campus,
            department: allocation.department,
            classroom: exam.classroom,
            status: allocation.status,
            color: this.getDutyColor(allocation.status)
          }
        });
      });

      return {
        success: true,
        events,
        totalEvents: events.length,
        dateRange: {
          start: startDate || (events.length > 0 ? moment(events[0].start).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')),
          end: endDate || (events.length > 0 ? moment(events[events.length - 1].start).format('YYYY-MM-DD') : moment().add(1, 'month').format('YYYY-MM-DD'))
        }
      };
    } catch (error) {
      throw new Error(`Error fetching faculty calendar: ${error.message}`);
    }
  }

  /**
   * Get event color based on exam type and department
   */
  getEventColor(examType, department) {
    // Color scheme based on exam type
    const examTypeColors = {
      'mid-term': '#F59E0B', // Amber
      'semester': '#10B981', // Green
      'labs': '#3B82F6'      // Blue
    };

    return examTypeColors[examType] || '#6B7280'; // Gray default
  }

  /**
   * Get duty color based on status
   */
  getDutyColor(status) {
    const statusColors = {
      'assigned': '#3B82F6',    // Blue
      'confirmed': '#10B981',   // Green
      'replaced': '#EF4444',    // Red
      'cancelled': '#6B7280'    // Gray
    };

    return statusColors[status] || '#3B82F6';
  }
}

module.exports = new CalendarService();


const Exam = require('../models/Exam');
const Allocation = require('../models/Allocation');
const { Faculty, Admin, Hod } = require('../utils/userHelper');
const Conflict = require('../models/Conflict');
const moment = require('moment');

class AnalyticsService {
  /**
   * Get admin analytics (entire university)
   */
  async getAdminAnalytics(filters = {}) {
    try {
      const { campus, department, startDate, endDate } = filters;

      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.date = {};
        if (startDate) dateFilter.date.$gte = new Date(startDate);
        if (endDate) dateFilter.date.$lte = new Date(endDate);
      }

      // Build query filters
      const examQuery = { status: { $ne: 'cancelled' }, ...dateFilter };
      const allocationQuery = { status: { $ne: 'cancelled' } };
      const facultyQuery = { isActive: true };

      if (campus) {
        examQuery.campus = campus;
        allocationQuery.campus = campus;
        facultyQuery.campus = campus;
      }
      if (department) {
        examQuery.department = department;
        allocationQuery.department = department;
        facultyQuery.department = department;
      }

      // OPTIMIZATION: Fetch all data ONCE using Promise.all
      // Use .lean() for faster execution
      const [exams, allocations, totalFaculty, totalConflicts] = await Promise.all([
        Exam.find(examQuery).lean(),
        Allocation.find(allocationQuery).lean(),
        Faculty.countDocuments(facultyQuery),
        Conflict.countDocuments({ status: 'detected' })
      ]);

      // Process in-memory (Sync operations where possible)
      // Faculty workload needs DB access for faculty details
      const facultyWorkload = await this.getFacultyWorkloadAnalytics(allocations, facultyQuery);

      // These are now purely synchronous data processing
      const departmentAnalytics = this.getDepartmentAnalytics(exams, allocations);
      const campusAnalytics = this.getCampusAnalytics(exams, allocations);
      const timeAnalytics = this.getTimeBasedAnalytics(allocations);

      // Need to populate exam info for allocations if missing? 
      // Actually getExamTypeAnalytics used .populate().
      // Here allocations are lean and NOT populated.
      // But we have `exams` array! We can lookup.
      const examTypeAnalytics = this.getExamTypeAnalytics(exams, allocations);

      const conflictAnalytics = await this.getConflictAnalytics(campus, department);

      return {
        success: true,
        overview: {
          totalExams: exams.length,
          totalAllocations: allocations.length,
          totalFaculty,
          totalConflicts,
          averageDutiesPerFaculty: totalFaculty > 0 ? (allocations.length / totalFaculty).toFixed(2) : 0,
          allocationCoverage: exams.length > 0 ? ((allocations.length / (exams.length * 2)) * 100).toFixed(2) : 0
        },
        facultyWorkload,
        departmentAnalytics,
        campusAnalytics,
        timeAnalytics,
        examTypeAnalytics,
        conflictAnalytics
      };
    } catch (error) {
      console.error(error);
      throw new Error(`Error generating admin analytics: ${error.message}`);
    }
  }

  /**
   * Get faculty workload analytics
   */
  async getFacultyWorkloadAnalytics(allocations, facultyQuery) {
    // Manually populate faculty from Faculty collection
    const facultyIds = [...new Set(allocations.map(a => a.faculty?.toString()).filter(Boolean))];
    const facultyMap = new Map();

    if (facultyIds.length > 0) {
      const facultyMembers = await Faculty.find({
        _id: { $in: facultyIds },
        ...facultyQuery
      }).select('name email employeeId department campus').lean();

      facultyMembers.forEach(f => {
        facultyMap.set(f._id.toString(), f);
      });
    }

    const workloadMap = {};

    allocations.forEach(alloc => {
      const facultyId = alloc.faculty?.toString();
      if (!facultyId || !facultyMap.has(facultyId)) return;

      const faculty = facultyMap.get(facultyId);

      if (!workloadMap[facultyId]) {
        workloadMap[facultyId] = {
          facultyId,
          facultyName: faculty?.name || 'Unknown',
          department: faculty?.department || 'N/A',
          totalDuties: 0,
          totalHours: 0
        };
      }

      workloadMap[facultyId].totalDuties++;
      // Handle missing time
      if (alloc.startTime && alloc.endTime) {
        const start = moment(alloc.startTime, 'HH:mm');
        const end = moment(alloc.endTime, 'HH:mm');
        workloadMap[facultyId].totalHours += end.diff(start, 'hours', true);
      }
    });

    const workloadArray = Object.values(workloadMap);
    workloadArray.sort((a, b) => b.totalDuties - a.totalDuties);

    // Workload distribution
    const distribution = {
      zeroDuties: 0,
      oneToThree: 0,
      fourToSix: 0,
      sevenToTen: 0,
      aboveTen: 0
    };

    workloadArray.forEach(w => {
      if (w.totalDuties === 0) distribution.zeroDuties++;
      else if (w.totalDuties <= 3) distribution.oneToThree++;
      else if (w.totalDuties <= 6) distribution.fourToSix++;
      else if (w.totalDuties <= 10) distribution.sevenToTen++;
      else distribution.aboveTen++;
    });

    return {
      topFaculty: workloadArray.slice(0, 10),
      distribution,
      averageDuties: workloadArray.length > 0
        ? (workloadArray.reduce((sum, w) => sum + w.totalDuties, 0) / workloadArray.length).toFixed(2)
        : 0,
      averageHours: workloadArray.length > 0
        ? (workloadArray.reduce((sum, w) => sum + w.totalHours, 0) / workloadArray.length).toFixed(2)
        : 0,
      total: workloadArray.length
    };
  }

  /**
   * Get department-wise analytics
   */
  getDepartmentAnalytics(exams, allocations) {
    const deptMap = {};

    exams.forEach(exam => {
      const dept = exam.department || 'Unknown';
      if (!deptMap[dept]) {
        deptMap[dept] = {
          department: dept,
          totalExams: 0,
          totalAllocations: 0,
          totalHours: 0
        };
      }
      deptMap[dept].totalExams++;
    });

    allocations.forEach(alloc => {
      const dept = alloc.department || 'Unknown';
      if (!deptMap[dept]) {
        deptMap[dept] = {
          department: dept,
          totalExams: 0,
          totalAllocations: 0,
          totalHours: 0
        };
      }
      deptMap[dept].totalAllocations++;
      if (alloc.startTime && alloc.endTime) {
        const start = moment(alloc.startTime, 'HH:mm');
        const end = moment(alloc.endTime, 'HH:mm');
        deptMap[dept].totalHours += end.diff(start, 'hours', true);
      }
    });

    const deptArray = Object.values(deptMap);
    deptArray.forEach(d => {
      d.averageAllocationsPerExam = d.totalExams > 0 ? (d.totalAllocations / d.totalExams).toFixed(2) : 0;
      d.averageHours = d.totalAllocations > 0 ? (d.totalHours / d.totalAllocations).toFixed(2) : 0;
    });

    return deptArray.sort((a, b) => b.totalAllocations - a.totalAllocations);
  }

  /**
   * Get campus-wise analytics
   */
  getCampusAnalytics(exams, allocations) {
    const campusMap = {};

    exams.forEach(exam => {
      const campus = exam.campus || 'Unknown';
      if (!campusMap[campus]) {
        campusMap[campus] = {
          campus,
          totalExams: 0,
          totalAllocations: 0
        };
      }
      campusMap[campus].totalExams++;
    });

    allocations.forEach(alloc => {
      const campus = alloc.campus || 'Unknown';
      if (!campusMap[campus]) {
        campusMap[campus] = {
          campus,
          totalExams: 0,
          totalAllocations: 0
        };
      }
      campusMap[campus].totalAllocations++;
    });

    return Object.values(campusMap).sort((a, b) => b.totalAllocations - a.totalAllocations);
  }

  /**
   * Get time-based analytics
   */
  getTimeBasedAnalytics(allocations) {
    // Daily distribution
    const dailyMap = {};
    allocations.forEach(alloc => {
      const date = moment(alloc.date).format('YYYY-MM-DD');
      if (!dailyMap[date]) {
        dailyMap[date] = { date, count: 0 };
      }
      dailyMap[date].count++;
    });

    const dailyArray = Object.values(dailyMap)
      .sort((a, b) => moment(a.date).diff(moment(b.date)))
      .slice(-30); // Last 30 days

    // Peak hours
    const hourMap = {};
    allocations.forEach(alloc => {
      if (alloc.startTime) {
        const hour = moment(alloc.startTime, 'HH:mm').format('HH:00');
        hourMap[hour] = (hourMap[hour] || 0) + 1;
      }
    });

    const peakHours = Object.entries(hourMap)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      dailyTrend: dailyArray,
      peakHours
    };
  }

  /**
   * Get exam type analytics
   */
  getExamTypeAnalytics(exams, allocations) {
    // We need to link allocations to exams to found exam type
    // Since allocations are lean, alloc.exam is an ID
    // We create a map of exams for quick lookup
    const examMap = new Map();
    exams.forEach(e => examMap.set(e._id.toString(), e));

    const typeMap = {
      'mid-term': { count: 0, allocations: 0 },
      'semester': { count: 0, allocations: 0 },
      'labs': { count: 0, allocations: 0 }
    };

    exams.forEach(exam => {
      const type = exam.examType || 'semester';
      if (typeMap[type]) {
        typeMap[type].count++;
      }
    });

    allocations.forEach(alloc => {
      // Find exam for this allocation
      const examId = alloc.exam?.toString();
      const exam = examMap.get(examId);
      const type = exam?.examType || 'semester';

      if (typeMap[type]) {
        typeMap[type].allocations++;
      }
    });

    return Object.entries(typeMap).map(([type, data]) => ({
      examType: type,
      examCount: data.count,
      allocationCount: data.allocations,
      averageAllocations: data.count > 0 ? (data.allocations / data.count).toFixed(2) : 0
    }));
  }

  /**
   * Get conflict analytics
   */
  async getConflictAnalytics(campus, department) {
    const conflictQuery = {};
    if (campus || department) {
      conflictQuery.details = {};
      if (campus) conflictQuery.details.campus = campus;
      if (department) conflictQuery.details.department = department;
    }

    // Still need DB for this as we didn't fetch conflicts in main method
    // But it's fast on its own collection
    const conflicts = await Conflict.find({
      status: 'detected',
      ...conflictQuery
    }).lean();

    const severityCount = {
      high: 0,
      medium: 0,
      low: 0
    };

    conflicts.forEach(c => {
      if (severityCount[c.severity]) {
        severityCount[c.severity]++;
      }
    });

    return {
      total: conflicts.length,
      bySeverity: severityCount,
      resolved: await Conflict.countDocuments({ status: 'resolved' }),
      pending: conflicts.length
    };
  }

  /**
   * Get faculty personal analytics
   */
  async getFacultyAnalytics(facultyId, filters = {}) {
    try {
      const { startDate, endDate } = filters;

      const allocationQuery = {
        faculty: facultyId,
        status: { $ne: 'cancelled' }
      };

      if (startDate || endDate) {
        allocationQuery.date = {};
        if (startDate) allocationQuery.date.$gte = new Date(startDate);
        if (endDate) allocationQuery.date.$lte = new Date(endDate);
      }

      // Use lean for performance
      const allocations = await Allocation.find(allocationQuery)
        .populate('exam', 'examName courseCode examType department campus')
        .lean();

      // Basic statistics
      let totalHours = 0;
      const monthlyStats = {};
      const departmentStats = {};
      const campusStats = {};
      const examTypeStats = {};
      const timeSlotStats = {};

      allocations.forEach(alloc => {
        if (alloc.startTime && alloc.endTime) {
          const start = moment(alloc.startTime, 'HH:mm');
          const end = moment(alloc.endTime, 'HH:mm');
          const hours = end.diff(start, 'hours', true);
          totalHours += hours;
        }

        // Monthly breakdown
        const month = moment(alloc.date).format('YYYY-MM');
        monthlyStats[month] = (monthlyStats[month] || 0) + 1;

        // Department breakdown
        const dept = alloc.department || 'Unknown';
        departmentStats[dept] = (departmentStats[dept] || 0) + 1;

        // Campus breakdown
        const campus = alloc.campus || 'Unknown';
        campusStats[campus] = (campusStats[campus] || 0) + 1;

        // Exam type breakdown
        const examType = alloc.exam?.examType || 'semester';
        examTypeStats[examType] = (examTypeStats[examType] || 0) + 1;

        // Time slot breakdown
        if (alloc.startTime) {
          const timeSlot = alloc.startTime.substring(0, 2) + ':00';
          timeSlotStats[timeSlot] = (timeSlotStats[timeSlot] || 0) + 1;
        }
      });

      // Get department average for comparison
      const faculty = await Faculty.findById(facultyId).lean();
      const departmentAverage = await this.getDepartmentAverage(faculty?.department, allocationQuery);

      return {
        success: true,
        overview: {
          totalDuties: allocations.length,
          totalHours: Math.round(totalHours * 10) / 10,
          averageHoursPerDuty: allocations.length > 0 ? (totalHours / allocations.length).toFixed(2) : 0,
          upcomingDuties: allocations.filter(a => moment(a.date).isAfter(moment())).length
        },
        monthlyBreakdown: Object.entries(monthlyStats)
          .map(([month, count]) => ({ month, count }))
          .sort((a, b) => moment(a.month).diff(moment(b.month))),
        departmentBreakdown: Object.entries(departmentStats)
          .map(([department, count]) => ({ department, count })),
        campusBreakdown: Object.entries(campusStats)
          .map(([campus, count]) => ({ campus, count })),
        examTypeBreakdown: Object.entries(examTypeStats)
          .map(([examType, count]) => ({ examType, count })),
        timeSlotBreakdown: Object.entries(timeSlotStats)
          .map(([timeSlot, count]) => ({ timeSlot, count }))
          .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)),
        comparison: {
          departmentAverage: departmentAverage.averageDuties,
          personalDuties: allocations.length,
          difference: allocations.length - departmentAverage.averageDuties
        }
      };
    } catch (error) {
      throw new Error(`Error generating faculty analytics: ${error.message}`);
    }
  }

  /**
   * Get department average workload
   */
  async getDepartmentAverage(department, baseQuery) {
    if (!department) return { averageDuties: 0 };

    const deptQuery = { ...baseQuery, department };
    const deptAllocations = await Allocation.find(deptQuery).lean();
    const facultyInDept = await Faculty.countDocuments({
      department,
      isActive: true
    });

    const averageDuties = facultyInDept > 0
      ? (deptAllocations.length / facultyInDept).toFixed(2)
      : 0;

    return { averageDuties: parseFloat(averageDuties) };
  }
}

module.exports = new AnalyticsService();


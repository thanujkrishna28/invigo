const ExamTimetable = require('../models/ExamTimetable');
const Allocation = require('../models/Allocation');
const moment = require('moment');

/**
 * Cleanup Service
 * Automatically cleans up old records and operational data
 */
class CleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  /**
   * Clean up old converted ExamTimetable records
   * @param {number} daysOld - Delete records older than X days (default: 30)
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldConvertedRecords(daysOld = 30) {
    try {
      const cutoffDate = moment().subtract(daysOld, 'days').toDate();

      const query = {
        status: 'converted',
        convertedAt: { $lt: cutoffDate }
      };

      const result = await ExamTimetable.deleteMany(query);

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleanup: Deleted ${result.deletedCount} old converted ExamTimetable record(s) (older than ${daysOld} days)`);
      }

      return {
        success: true,
        deletedCount: result.deletedCount,
        cutoffDate: cutoffDate,
        message: `Cleaned up ${result.deletedCount} old converted ExamTimetable record(s)`
      };
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up operational data (Acknowledgements & Live Status) for past exams
   * Resets status fields to clear historical operational data as requested
   */
  async cleanupAllocationOperationalData() {
    try {
      // Find allocations for exams that ended before today (past exams)
      const cutoffDate = moment().startOf('day').toDate();

      // Update query: All allocations before today with any status data set
      const query = {
        date: { $lt: cutoffDate },
        $or: [
          { 'liveStatus.status': { $ne: null } },
          { 'preExamAcknowledgment.status': { $in: ['acknowledged', 'unavailable'] } }
        ]
      };

      const update = {
        $set: {
          'liveStatus': { status: null }, // Reset Live Status
          // Reset Acknowledgment to default 'pending' state effectively "deleting" the interaction record
          'preExamAcknowledgment': { status: 'pending' },
          'acknowledgmentReminderSent': false
        }
      };

      const result = await Allocation.updateMany(query, update);

      if (result.modifiedCount > 0) {
        console.log(`🧹 Operational Cleanup: Reset data for ${result.modifiedCount} past allocation(s)`);
      }

      return {
        success: true,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      console.error('❌ Operational Cleanup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start automatic cleanup scheduler
   * Runs cleanup every 24 hours
   * @param {number} daysOld - Delete records older than X days (default: 30)
   * @param {number} intervalHours - Run cleanup every X hours (default: 24)
   */
  startAutoCleanup(daysOld = 30, intervalHours = 24) {
    if (this.cleanupInterval) {
      console.log('⚠️  Auto cleanup already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds

    // Run cleanup immediately on start
    this.runAllCleanupTasks(daysOld);

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      if (!this.isRunning) {
        this.runAllCleanupTasks(daysOld);
      }
    }, intervalMs);

    console.log(`✅ Auto cleanup started: Running every ${intervalHours} hours`);
  }

  /**
   * Helper to run all cleanup tasks sequentially
   */
  async runAllCleanupTasks(daysOld) {
    this.isRunning = true;
    try {
      await this.cleanupOldConvertedRecords(daysOld);
      await this.cleanupAllocationOperationalData();
    } catch (err) {
      console.error('Error in auto cleanup routine:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop automatic cleanup scheduler
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Auto cleanup stopped');
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const totalConverted = await ExamTimetable.countDocuments({ status: 'converted' });
      const oldConverted = await ExamTimetable.countDocuments({
        status: 'converted',
        convertedAt: { $lt: moment().subtract(30, 'days').toDate() }
      });

      const cutoffDate = moment().startOf('day').toDate();
      const pendingOperationalCleanup = await Allocation.countDocuments({
        date: { $lt: cutoffDate },
        $or: [
          { 'liveStatus.status': { $ne: null } },
          { 'preExamAcknowledgment.status': { $in: ['acknowledged', 'unavailable'] } }
        ]
      });

      return {
        totalConverted,
        oldConverted30Days: oldConverted,
        pendingOperationalCleanup,
        canCleanup: oldConverted > 0 || pendingOperationalCleanup > 0
      };
    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error);
      return {
        totalConverted: 0,
        oldConverted30Days: 0,
        pendingOperationalCleanup: 0,
        canCleanup: false
      };
    }
  }
}

module.exports = new CleanupService();


const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(to, subject, html, text = null, attachments = []) {
    if (!this.transporter) {
      const missingVars = [];
      if (!process.env.EMAIL_HOST) missingVars.push('EMAIL_HOST');
      if (!process.env.EMAIL_USER) missingVars.push('EMAIL_USER');
      if (!process.env.EMAIL_PASS) missingVars.push('EMAIL_PASS');
      
      console.warn(`⚠️  Email service not configured. Missing: ${missingVars.join(', ')}`);
      console.warn('   Please configure email settings in .env file');
      return { success: false, message: `Email service not configured. Missing: ${missingVars.join(', ')}` };
    }

    try {
      console.log(`   📤 Sending email to: ${to}`);
      console.log(`   📧 From: ${process.env.EMAIL_USER}`);
      console.log(`   📝 Subject: ${subject}`);
      if (attachments.length > 0) {
        console.log(`   📎 Attachments: ${attachments.length}`);
      }
      
      const mailOptions = {
        from: `"Schedulo" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html
      };

      if (attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`   ✅ Email sent successfully! Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`   ❌ Email send error: ${error.message}`);
      if (error.code === 'EAUTH') {
        console.error('   ⚠️  Authentication failed. Check EMAIL_USER and EMAIL_PASS in .env');
        console.error('   💡 For Gmail, use App Password, not regular password');
      } else if (error.code === 'ECONNECTION') {
        console.error('   ⚠️  Connection failed. Check EMAIL_HOST and EMAIL_PORT in .env');
      }
      return { success: false, message: error.message, code: error.code };
    }
  }

  /**
   * Send allocation notification to faculty (Duty Letter Format)
   */
  async sendAllocationNotification(faculty, allocation, exam, classroom) {
    const moment = require('moment');
    const Classroom = require('../models/Classroom');
    
    // Format date as DD/MM/YYYY
    const examDate = moment(allocation.date).format('DD/MM/YYYY');
    const letterDate = moment().format('DD/MM/YYYY');
    
    // Determine exam type from exam name
    const examType = this.determineExamType(exam.examName);
    
    // Get faculty title (Dr./Mr./Ms.)
    const title = this.getFacultyTitle(faculty.name);
    
    // Convert time to 12-hour format with AM/PM
    const formatTime12Hour = (time24) => {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'P.M.' : 'A.M.';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };
    
    const startTime12 = formatTime12Hour(allocation.startTime);
    const endTime12 = formatTime12Hour(allocation.endTime);
    const timeRange = `${startTime12} – ${endTime12}`;
    
    // Get room number from classroom - try multiple sources
    // Priority: allocation.classroom > classroom parameter > exam.classroom
    let roomNumber = null;
    let roomDisplay = null;
    
    // First try: classroom parameter (directly passed)
    if (classroom && classroom.roomNumber) {
      roomNumber = classroom;
    }
    // Second try: allocation.classroom (from allocation object)
    else if (allocation && allocation.classroom) {
      if (allocation.classroom.roomNumber) {
        // Already populated
        roomNumber = allocation.classroom;
      } else if (allocation.classroom._id || typeof allocation.classroom === 'string') {
        // Need to populate
        roomNumber = await Classroom.findById(allocation.classroom._id || allocation.classroom);
      }
    }
    // Third try: exam.classroom
    else if (exam && exam.classroom) {
      if (exam.classroom.roomNumber) {
        // Already populated
        roomNumber = exam.classroom;
      } else if (exam.classroom._id || typeof exam.classroom === 'string') {
        // Need to populate
        roomNumber = await Classroom.findById(exam.classroom._id || exam.classroom);
      }
    }
    
    // Format room display if we have valid room data
    // Format: "A-Block – 201 (Floor 2)" or "A-Block – 201"
    if (roomNumber && roomNumber.roomNumber) {
      const block = roomNumber.block || '';
      const floor = roomNumber.floor || '';
      const roomNum = roomNumber.roomNumber || '';
      
      // Capitalize first letter of block and format as "A-Block"
      const formattedBlock = block ? block.charAt(0).toUpperCase() + block.slice(1).toLowerCase().replace('-block', '-Block') : '';
      
      if (formattedBlock && floor && roomNum) {
        roomDisplay = `${formattedBlock} – ${roomNum} (Floor ${floor})`;
      } else if (formattedBlock && roomNum) {
        roomDisplay = `${formattedBlock} – ${roomNum}`;
      } else if (roomNum) {
        roomDisplay = `Room ${roomNum}`;
      }
    }
    
    // University details from environment or defaults
    const universityName = process.env.UNIVERSITY_NAME || 'Vignan University';
    const examCellEmail = process.env.EXAM_CELL_EMAIL || 'examcell@vignan.edu';
    const examCellPhone = process.env.EXAM_CELL_PHONE || 'XXXXXXXX';
    const campusAddress = process.env.CAMPUS_ADDRESS || faculty.campus || 'Vignan University Campus';
    
    const subject = `Invigilation Duty Assignment – ${exam.examName} - ${examDate}`;
    
    // Professional email format matching university letterhead style
    const html = `
      <div style="background-color:#ffffff;padding:0;font-family:'Times New Roman',Times,serif;font-size:14px;line-height:1.6;color:#000000;max-width:800px;margin:0 auto;">
        
        <!-- Header Section -->
        <div style="text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #000000;">
          <div style="font-size:18px;font-weight:bold;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">VIGNAN UNIVERSITY</div>
          <div style="font-size:14px;font-weight:bold;margin-bottom:15px;">Office of the Controller of Examinations</div>
        </div>

        <!-- Document Info -->
        <div style="margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #cccccc;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:5px 0;font-size:13px;"><strong>Date:</strong> ${letterDate}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;"><strong>Examination:</strong> ${examType}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;"><strong>Campus:</strong> ${campusAddress}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;"><strong>Email:</strong> <a href="mailto:${examCellEmail}" style="color:#0000ff;text-decoration:underline;">${examCellEmail}</a></td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;"><strong>Phone:</strong> ${examCellPhone}</td>
            </tr>
          </table>
        </div>

        <!-- Title -->
        <div style="text-align:center;font-size:16px;font-weight:bold;margin-bottom:25px;">
          Invigilation Duty Letter
        </div>

        <!-- To Section -->
        <div style="margin-bottom:20px;">
          <div style="font-weight:bold;margin-bottom:8px;font-size:14px;">To</div>
          <div style="margin-left:20px;">
            <div style="font-weight:bold;margin-bottom:5px;">${title} ${faculty.name}</div>
            <div style="margin-bottom:3px;">Department of ${this.formatDepartmentName(faculty.department || 'Computer Science and Engineering')}</div>
            <div>${universityName}</div>
          </div>
        </div>

        <!-- Subject -->
        <div style="margin-bottom:20px;">
          <div style="font-weight:bold;margin-bottom:8px;font-size:14px;">Subject: Invigilation Duty Assignment – University Examination</div>
        </div>

        <!-- Salutation -->
        <div style="margin-bottom:20px;">
          <p style="margin:0 0 10px 0;">Dear <strong>${title} ${faculty.name.split(' ')[0]}</strong>,</p>
          <p style="margin:0;">You are hereby informed that you have been assigned <strong>invigilation duty</strong> for the following university examination as per the details mentioned below.</p>
        </div>

        <!-- Duty Details Table -->
        <div style="margin:25px 0;">
          <div style="font-weight:bold;margin-bottom:12px;font-size:14px;">Duty Details</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #000000;margin-top:10px;">
            <tr>
              <td style="padding:10px 12px;border:1px solid #000000;font-weight:bold;width:40%;background-color:#f0f0f0;">Particular</td>
              <td style="padding:10px 12px;border:1px solid #000000;font-weight:bold;background-color:#f0f0f0;">Details</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #000000;">Examination</td>
              <td style="padding:10px 12px;border:1px solid #000000;">${examType}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #000000;">Date</td>
              <td style="padding:10px 12px;border:1px solid #000000;">${examDate}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #000000;">Time</td>
              <td style="padding:10px 12px;border:1px solid #000000;">${timeRange}</td>
            </tr>
            ${roomDisplay ? `
            <tr>
              <td style="padding:10px 12px;border:1px solid #000000;">Examination Hall / Room</td>
              <td style="padding:10px 12px;border:1px solid #000000;">${roomDisplay}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding:10px 12px;border:1px solid #000000;">Campus</td>
              <td style="padding:10px 12px;border:1px solid #000000;">${allocation.campus}</td>
            </tr>
          </table>
        </div>

        <!-- Instructions -->
        <div style="margin:25px 0;">
          <div style="font-weight:bold;margin-bottom:12px;font-size:14px;">Instructions</div>
          <ol style="margin:0;padding-left:25px;line-height:1.8;">
            <li style="margin-bottom:8px;">Report to the examination hall <strong>30 minutes before</strong> the commencement of the examination.</li>
            <li style="margin-bottom:8px;">Carry your <strong>valid University ID card</strong> during invigilation duty.</li>
            <li style="margin-bottom:8px;">Ensure that all <strong>examination rules and regulations</strong> are strictly followed.</li>
            <li style="margin-bottom:8px;">Any inability to attend the assigned duty must be <strong>intimated to the Exam Cell in advance</strong>.</li>
            <li style="margin-bottom:0;"><strong>Unauthorized absence</strong> will be viewed seriously as per university norms.</li>
          </ol>
        </div>

        <!-- Acknowledgement -->
        <div style="margin:25px 0;">
          <div style="font-weight:bold;margin-bottom:8px;font-size:14px;">Acknowledgement</div>
          <p style="margin:0;">Kindly acknowledge the receipt of this duty assignment at the earliest convenience through the faculty portal or official communication channel.</p>
        </div>

        <!-- Signature -->
        <div style="margin-top:40px;">
          <div style="font-weight:bold;margin-bottom:5px;">Controller of Examinations</div>
          <div>${universityName}</div>
        </div>

        <!-- Footer Note -->
        <div style="margin-top:30px;padding-top:15px;border-top:1px solid #cccccc;font-size:12px;font-style:italic;color:#666666;text-align:center;">
          <p style="margin:0;">This is a system-generated document and does not require a physical signature.</p>
        </div>

      </div>
    `;

    return await this.sendEmail(faculty.email, subject, html);
  }

  /**
   * Determine exam type from exam name
   */
  determineExamType(examName) {
    const name = examName.toLowerCase();
    if (name.includes('mid') || name.includes('midterm')) {
      return 'Mid Semester';
    } else if (name.includes('end') || name.includes('final')) {
      return 'End Semester';
    } else if (name.includes('supplementary') || name.includes('supply')) {
      return 'Supplementary';
    }
    return 'University Examination';
  }

  /**
   * Get faculty title from name
   */
  getFacultyTitle(name) {
    if (name.toLowerCase().startsWith('dr.')) {
      return 'Dr.';
    } else if (name.toLowerCase().startsWith('prof.')) {
      return 'Prof.';
    } else if (name.toLowerCase().startsWith('mr.')) {
      return 'Mr.';
    } else if (name.toLowerCase().startsWith('ms.') || name.toLowerCase().startsWith('mrs.')) {
      return 'Ms.';
    }
    // Default based on common patterns
    return 'Dr.';
  }

  /**
   * Format department name properly
   */
  formatDepartmentName(dept) {
    if (!dept) return 'Computer Science and Engineering';
    
    // Common department abbreviations to full names
    const deptMap = {
      'CSE': 'Computer Science and Engineering',
      'IT': 'Information Technology',
      'ECE': 'Electronics and Communication Engineering',
      'EEE': 'Electrical and Electronics Engineering',
      'ME': 'Mechanical Engineering',
      'CE': 'Civil Engineering',
      'BT': 'Biotechnology',
      'CS': 'Computer Science and Engineering'
    };
    
    const upperDept = dept.toUpperCase().trim();
    return deptMap[upperDept] || dept;
  }

  /**
   * Send change request notification
   */
  // Removed: Change request functionality
  // async sendChangeRequestNotification(adminEmail, faculty, allocation) {
  //   const subject = `Change Request Submitted - ${allocation.exam.examName}`;
  //   const html = `
  //     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  //       <h2 style="color: #4F46E5;">Change Request Submitted</h2>
  //       <p>A faculty member has submitted a change request:</p>
  //       <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  //         <p><strong>Faculty:</strong> ${faculty.name} (${faculty.email})</p>
  //         <p><strong>Exam:</strong> ${allocation.exam.examName}</p>
  //         <p><strong>Date:</strong> ${new Date(allocation.date).toLocaleDateString()}</p>
  //         <p><strong>Reason:</strong> ${allocation.changeRequest.reason}</p>
  //       </div>
  //       <p>Please review the request in the admin dashboard.</p>
  //     </div>
  //   `;
  //   return await this.sendEmail(adminEmail, subject, html);
  // }

  /**
   * Send acknowledgment reminder to faculty
   */
  async sendAcknowledgmentReminder(faculty, allocation, exam, classroom) {
    const deadline = new Date(allocation.acknowledgmentDeadline).toLocaleString();
    const subject = `⚠️ Reminder: Acknowledge Your Invigilation Duty - ${exam.examName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #F59E0B;">Acknowledgment Reminder</h2>
        <p>Dear ${faculty.name},</p>
        <p>This is a reminder that you have a pending acknowledgment for your invigilation duty.</p>
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #92400E;">Deadline: ${deadline}</p>
        </div>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Exam:</strong> ${exam.examName}</p>
          <p><strong>Course Code:</strong> ${exam.courseCode}</p>
          <p><strong>Date:</strong> ${new Date(allocation.date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${allocation.startTime} - ${allocation.endTime}</p>
          <p><strong>Venue:</strong> ${classroom.roomNumber}${classroom.block ? `, ${classroom.block}` : ''}${classroom.floor ? `, Floor ${classroom.floor}` : ''}</p>
          <p><strong>Campus:</strong> ${allocation.campus}</p>
        </div>
        <p style="margin-top: 20px;">
          <strong>Please acknowledge your duty or mark as unavailable before the deadline.</strong>
        </p>
        <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
          If you are unable to attend, please mark as unavailable and provide a reason.
        </p>
      </div>
    `;
    return await this.sendEmail(faculty.email, subject, html);
  }

  /**
   * Send emergency alert to admin when faculty is unable to reach
   */
  async sendEmergencyAlert(adminEmail, faculty, allocation, exam, emergencyReason, reservedFaculty) {
    const subject = `🚨 URGENT: Faculty Unable to Reach - ${exam.examName}`;
    const reservedList = reservedFaculty && reservedFaculty.length > 0
      ? reservedFaculty.map((rf, index) => 
          `<li>${index + 1}. ${rf.faculty?.name} (${rf.faculty?.email}) - Priority ${rf.priority}</li>`
        ).join('')
      : '<li>No reserved faculty available</li>';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">🚨 Emergency Alert</h2>
        <div style="background: #FEE2E2; border-left: 4px solid #DC2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #991B1B;">Faculty Unable to Reach Exam Hall</p>
        </div>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Faculty:</strong> ${faculty.name} (${faculty.email})</p>
          <p><strong>Exam:</strong> ${exam.examName}</p>
          <p><strong>Course Code:</strong> ${exam.courseCode}</p>
          <p><strong>Date:</strong> ${new Date(allocation.date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${allocation.startTime} - ${allocation.endTime}</p>
          <p><strong>Emergency Reason:</strong> ${emergencyReason}</p>
        </div>
        <div style="background: #DBEAFE; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-weight: bold; margin-bottom: 10px;">Suggested Reserved Faculty:</p>
          <ul style="margin: 0; padding-left: 20px;">
            ${reservedList}
          </ul>
        </div>
        <p style="margin-top: 20px; color: #DC2626; font-weight: bold;">
          Please take immediate action to replace the faculty member.
        </p>
      </div>
    `;
    return await this.sendEmail(adminEmail, subject, html);
  }
}

module.exports = new EmailService();


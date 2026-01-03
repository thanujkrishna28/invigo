// Import jsPDF - handle different module formats
let jsPDF;
try {
  const jspdfModule = require('jspdf');
  // Try different ways to get the constructor
  if (typeof jspdfModule === 'function') {
    jsPDF = jspdfModule;
  } else if (jspdfModule.jsPDF) {
    jsPDF = jspdfModule.jsPDF;
  } else if (jspdfModule.default && typeof jspdfModule.default === 'function') {
    jsPDF = jspdfModule.default;
  } else {
    jsPDF = jspdfModule;
  }
} catch (e) {
  console.error('Error loading jsPDF:', e);
  throw new Error('jsPDF library not found. Please install: npm install jspdf');
}
const XLSX = require('xlsx');
const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const Allocation = require('../models/Allocation');
const Exam = require('../models/Exam');
const moment = require('moment');

class ReportService {
  /**
   * Generate PDF report for allocations
   */
  async generatePDFReport(allocations, options = {}) {
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      let yPosition = 20;

      // Title
      doc.setFontSize(18);
      doc.text(options.title || 'Invigilation Allocation Report', 14, yPosition);
      yPosition += 10;

      // Date range
      if (options.startDate || options.endDate) {
        doc.setFontSize(10);
        const dateRange = `Date Range: ${options.startDate || 'Start'} to ${options.endDate || 'End'}`;
        doc.text(dateRange, 14, yPosition);
        yPosition += 5;
      }

      // Summary
      doc.setFontSize(12);
      doc.text(`Total Allocations: ${allocations.length}`, 14, yPosition);
      yPosition += 10;

      // Table headers - removed Exam Name, added Block and Room Number
      doc.setFontSize(10);
      const headers = ['Date', 'Time', 'Faculty', 'Course Code', 'Block', 'Room', 'Campus'];
      const colWidths = [25, 25, 40, 20, 15, 15, 30];
      let xPosition = 14;

      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += 5;

      // Draw line
      doc.line(14, yPosition, 200, yPosition);
      yPosition += 5;

      // Table rows
      doc.setFontSize(9);
      allocations.forEach((allocation) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }

        // Get classroom info - prioritize allocation.classroom, then exam.classroom
        let classroom = allocation.classroom || allocation.exam?.classroom;
        if (classroom && typeof classroom === 'object') {
          // Already populated
        } else {
          classroom = null;
        }

        xPosition = 14;
        const row = [
          moment(allocation.date).format('DD/MM/YYYY'),
          `${allocation.startTime}-${allocation.endTime}`,
          allocation.faculty?.name || 'N/A',
          allocation.exam?.courseCode || 'N/A',
          classroom?.block || 'N/A',
          classroom?.roomNumber || 'N/A',
          allocation.campus
        ];

        row.forEach((cell, index) => {
          const maxWidth = colWidths[index] - 2;
          const cellText = cell.toString().substring(0, Math.floor(maxWidth / 2));
          doc.text(cellText, xPosition, yPosition);
          xPosition += colWidths[index];
        });

        yPosition += 5;
      });

      // Return PDF as proper Buffer
      // CRITICAL: Buffer.from() cannot directly convert ArrayBuffer
      // Must convert ArrayBuffer -> Uint8Array -> Buffer
      const pdfArrayBuffer = doc.output('arraybuffer');
      const uint8Array = new Uint8Array(pdfArrayBuffer);
      const buffer = Buffer.from(uint8Array);
      
      if (buffer.length === 0) {
        throw new Error('Generated PDF buffer is empty - ArrayBuffer conversion failed');
      }
      
      return buffer;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate Excel report for allocations
   */
  async generateExcelReport(allocations, options = {}) {
    try {
      const workbook = XLSX.utils.book_new();

      // Prepare data - removed Exam Name, added Block and Room Number
      const data = allocations.map(allocation => {
        // Get classroom info - prioritize allocation.classroom, then exam.classroom
        let classroom = allocation.classroom || allocation.exam?.classroom;
        
        // Handle populated classroom object or string ID
        if (classroom && typeof classroom === 'object') {
          // Already populated
        } else if (classroom && typeof classroom === 'string') {
          // String ID - can't use it, set to null
          classroom = null;
        } else {
          classroom = null;
        }

        return {
          'Date': moment(allocation.date).format('YYYY-MM-DD'),
          'Start Time': allocation.startTime,
          'End Time': allocation.endTime,
          'Faculty Name': allocation.faculty?.name || 'N/A',
          'Faculty Email': allocation.faculty?.email || 'N/A',
          'Employee ID': allocation.faculty?.employeeId || 'N/A',
          'Course Code': allocation.exam?.courseCode || 'N/A',
          'Block': classroom?.block || 'N/A',
          'Room Number': classroom?.roomNumber || 'N/A',
          'Floor': classroom?.floor || 'N/A',
          'Campus': allocation.campus,
          'Department': allocation.department,
          'Status': allocation.status
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths for better readability
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 10 }, // Start Time
        { wch: 10 }, // End Time
        { wch: 25 }, // Faculty Name
        { wch: 30 }, // Faculty Email
        { wch: 15 }, // Employee ID
        { wch: 15 }, // Course Code
        { wch: 12 }, // Block
        { wch: 12 }, // Room Number
        { wch: 8 },  // Floor
        { wch: 20 }, // Campus
        { wch: 15 }, // Department
        { wch: 12 }  // Status
      ];
      worksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Allocations');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return buffer;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate individual duty letter (PDF) for faculty - Professional Certificate Format
   */
  async generateDutyLetter(allocation) {
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      const universityName = process.env.UNIVERSITY_NAME || 'VIGNAN\'S Foundation for Science, Technology & Research';
      const universitySubtitle = process.env.UNIVERSITY_SUBTITLE || '(Deemed to be UNIVERSITY)';
      const universityEst = process.env.UNIVERSITY_EST || 'Estd. u/s 3 of UGC Act 1956';

      // Header Section - University Name (Left side, styled like certificate)
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(200, 0, 0); // Red color for VIGNAN'S
      doc.text('VIGNAN\'S', 20, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0); // Black for rest
      doc.text(universityName, 20, yPosition);
      yPosition += 4;
      doc.text(`${universitySubtitle} ${universityEst}`, 20, yPosition);
      yPosition = 20; // Reset for right side

      // NAAC Badge area (Right side) - Text representation
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 100, 200);
      doc.text('NAAC A', pageWidth - 20, yPosition, { align: 'right' });
      doc.text('Accredited', pageWidth - 20, yPosition + 4, { align: 'right' });
      yPosition = 40;

      // Reference and Date (Top section)
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      const refNumber = `Ref: VFSTR/Exam/Invigilation/${moment().format('YYYY')}/${allocation._id.toString().slice(-6)}`;
      doc.text(refNumber, 20, yPosition);
      const letterDate = moment().format('DD.MM.YYYY');
      doc.text(`Date: ${letterDate}`, pageWidth - 20, yPosition, { align: 'right' });
      yPosition += 15;

      // Title - Centered and Underlined
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('INVIGILATION DUTY LETTER', pageWidth / 2, yPosition, { align: 'center' });
      // Draw underline
      const titleWidth = doc.getTextWidth('INVIGILATION DUTY LETTER');
      doc.setLineWidth(0.5);
      doc.line((pageWidth - titleWidth) / 2, yPosition + 2, (pageWidth + titleWidth) / 2, yPosition + 2);
      yPosition += 20;

      // Main Body Content
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      
      // Get classroom info
      let venueText = allocation.campus;
      if (allocation.exam && allocation.exam.classroom) {
        const Classroom = require('../models/Classroom');
        let classroom;
        if (typeof allocation.exam.classroom === 'object' && allocation.exam.classroom.roomNumber) {
          classroom = allocation.exam.classroom;
        } else {
          classroom = await Classroom.findById(allocation.exam.classroom).lean();
        }
        if (classroom) {
          const venueParts = [classroom.roomNumber];
          if (classroom.block) venueParts.push(classroom.block);
          if (classroom.floor) venueParts.push(`Floor ${classroom.floor}`);
          venueText = `${venueParts.join(', ')}, ${allocation.campus}`;
        }
      }

      const facultyName = allocation.faculty?.name || 'Faculty Member';
      const employeeId = allocation.faculty?.employeeId || '';
      const department = allocation.department || '';
      const examName = allocation.exam?.examName || 'N/A';
      const courseCode = allocation.exam?.courseCode || 'N/A';
      const examDate = moment(allocation.date).format('DD.MM.YYYY');
      const dayName = moment(allocation.date).format('dddd');
      const examTime = `${allocation.startTime} - ${allocation.endTime}`;

      // Body text - Professional format
      const maxWidth = pageWidth - 40;
      
      // First part of sentence
      doc.setFont(undefined, 'normal');
      doc.text('This is to inform that', 20, yPosition);
      let xPos = 20 + doc.getTextWidth('This is to inform that ');
      
      // Faculty name in bold
      doc.setFont(undefined, 'bold');
      doc.text(facultyName, xPos, yPosition);
      xPos += doc.getTextWidth(facultyName);
      
      // Rest of sentence
      doc.setFont(undefined, 'normal');
      const restOfText = `, ${department ? `Department of ${department}` : 'Faculty Member'}${employeeId ? ` (Employee ID: ${employeeId})` : ''} has been assigned invigilation duty for the following examination:`;
      const restLines = doc.splitTextToSize(restOfText, maxWidth - (xPos - 20));
      
      if (restLines.length === 1) {
        doc.text(restOfText, xPos, yPosition);
        yPosition += 6;
      } else {
        // First line continues from name
        doc.text(restLines[0], xPos, yPosition);
        yPosition += 6;
        // Remaining lines
        restLines.slice(1).forEach(line => {
          doc.text(line, 20, yPosition);
          yPosition += 6;
        });
      }
      
      yPosition += 8;

      // Examination Details Box
      const boxX = 20;
      const boxY = yPosition;
      const boxWidth = pageWidth - 40;
      const boxHeight = 55;
      
      // Draw box
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(boxX, boxY, boxWidth, boxHeight);
      
      let innerY = boxY + 8;
      const innerX = boxX + 5;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('EXAMINATION DETAILS', innerX, innerY);
      innerY += 8;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Exam Name: ${examName}`, innerX, innerY);
      innerY += 6;
      
      doc.text(`Course Code: ${courseCode}`, innerX, innerY);
      innerY += 6;
      
      doc.text(`Date: ${examDate} (${dayName})`, innerX, innerY);
      innerY += 6;
      
      doc.text(`Time: ${examTime}`, innerX, innerY);
      innerY += 6;
      
      doc.text(`Venue: ${venueText}`, innerX, innerY);
      
      yPosition = boxY + boxHeight + 15;

      // Closing text
      doc.setFontSize(11);
      doc.text('Please ensure your presence at the specified time and location. Your cooperation in this matter is highly appreciated.', 20, yPosition, { maxWidth: maxWidth });
      yPosition += 10;

      // Signature Section (Right aligned)
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Yours sincerely,', pageWidth - 20, yPosition, { align: 'right' });
      yPosition += 12;
      
      // Space for signature line
      doc.setLineWidth(0.3);
      doc.line(pageWidth - 60, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('REGISTRAR', pageWidth - 20, yPosition, { align: 'right' });
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const addressLines = [
        universityName.toUpperCase(),
        universitySubtitle.toUpperCase(),
        'VADLAMUDI-522 213',
        'GUNTUR (DISTRICT), A.P. INDIA'
      ];
      addressLines.forEach(line => {
        doc.text(line, pageWidth - 20, yPosition, { align: 'right' });
        yPosition += 4;
      });

      // Yellow Footer Band
      const footerY = pageHeight - 15;
      doc.setFillColor(255, 255, 0); // Yellow
      doc.rect(0, footerY, pageWidth, 15, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      const footerText = 'Vadlamudi, Guntur Dist.- 522213. Andhra Pradesh, India. | Phone: +91 863 2344 700 | e-mail: info@vignan.ac.in';
      doc.text(footerText, pageWidth / 2, footerY + 10, { align: 'center' });

      // Return PDF as proper Buffer
      // jsPDF output('arraybuffer') returns an ArrayBuffer
      let pdfOutput;
      try {
        pdfOutput = doc.output('arraybuffer');
        console.log('PDF output type:', typeof pdfOutput, 'Is ArrayBuffer:', pdfOutput instanceof ArrayBuffer);
        
        // Convert ArrayBuffer to Node.js Buffer
        // CRITICAL: Buffer.from() cannot directly convert ArrayBuffer
        // Must convert ArrayBuffer -> Uint8Array -> Buffer
        if (pdfOutput instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(pdfOutput);
          const buffer = Buffer.from(uint8Array);
          console.log('PDF buffer created from ArrayBuffer:', buffer.length, 'bytes');
          if (buffer.length === 0) {
            throw new Error('Generated PDF buffer is empty - ArrayBuffer conversion failed');
          }
          return buffer;
        } else if (Buffer.isBuffer(pdfOutput)) {
          console.log('PDF already a buffer:', pdfOutput.length, 'bytes');
          return pdfOutput;
        } else {
          // Try as Uint8Array
          const uint8Array = new Uint8Array(pdfOutput);
          const buffer = Buffer.from(uint8Array);
          console.log('PDF buffer from Uint8Array:', buffer.length, 'bytes');
          return buffer;
        }
      } catch (outputError) {
        console.error('Error in doc.output():', outputError);
        // Try alternative output method
        try {
          const pdfString = doc.output('datauristring');
          // Extract base64 part and convert
          const base64Data = pdfString.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          console.log('PDF buffer from base64:', buffer.length, 'bytes');
          return buffer;
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          throw new Error(`PDF generation failed: ${outputError.message}`);
        }
      }
    } catch (error) {
      console.error('Error generating duty letter:', error);
      throw error;
    }
  }

  /**
   * Generate iCal format for Google Calendar
   */
  generateICal(allocation) {
    const start = moment(`${moment(allocation.date).format('YYYY-MM-DD')} ${allocation.startTime}`, 'YYYY-MM-DD HH:mm');
    const end = moment(`${moment(allocation.date).format('YYYY-MM-DD')} ${allocation.endTime}`, 'YYYY-MM-DD HH:mm');

    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Schedulo//Invigilation Duty//EN',
      'BEGIN:VEVENT',
      `UID:${allocation._id}@schedulo`,
      `DTSTART:${start.format('YYYYMMDDTHHmmss')}`,
      `DTEND:${end.format('YYYYMMDDTHHmmss')}`,
      `SUMMARY:Invigilation - ${allocation.exam?.examName || 'Exam'}`,
      `DESCRIPTION:Invigilation duty for ${allocation.exam?.courseCode || ''} at ${allocation.campus}`,
      `LOCATION:${allocation.campus}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return ical;
  }

  /**
   * Generate Exam Timetable as HTML Table (for email embedding)
   */
  generateTimetableHTML(exams, options = {}) {
    const universityName = options.universityName || 'Vignan University';
    const semester = options.semester || 'All Semesters';
    const assessmentPeriod = options.period || moment().format('MMMM-YYYY');
    const releaseDate = options.releaseDate || moment().format('DD.MM.YYYY');
    const examTime = options.examTime || '09:00 A.M. to 11:30 A.M.';

    // Group exams by date and department
    const grouped = {};
    exams.forEach(exam => {
      const date = moment(exam.date).format('DD.MM.YYYY');
      const dept = exam.department || 'Other';
      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][dept]) grouped[date][dept] = [];
      grouped[date][dept].push(exam);
    });

    const dates = Object.keys(grouped).sort((a, b) => {
      const dateA = moment(a, 'DD.MM.YYYY');
      const dateB = moment(b, 'DD.MM.YYYY');
      return dateA - dateB;
    });

    const departments = [...new Set(exams.map(e => e.department || 'Other'))].sort();

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 100%; margin: 0 auto; padding: 20px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1e40af; font-size: 24px; margin: 0;">${universityName}</h1>
          <h2 style="color: #4f46e5; font-size: 20px; margin: 10px 0;">EXAM TIMETABLE</h2>
          <p style="margin: 5px 0; color: #374151;">Semester: ${semester}</p>
          <p style="margin: 5px 0; color: #374151;">Assessment Period: ${assessmentPeriod}</p>
          <p style="margin: 5px 0; color: #374151;">Released Date: ${releaseDate}</p>
          <p style="margin: 5px 0; color: #374151;">Assessment Time: ${examTime}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
          <thead>
            <tr style="background: #4285f4; color: white;">
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left; font-weight: bold;">Date & Branch</th>
    `;

    dates.forEach(date => {
      const dayName = moment(date, 'DD.MM.YYYY').format('dddd');
      html += `<th style="border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;">${date}<br><span style="font-size: 10px;">(${dayName})</span></th>`;
    });

    html += `
            </tr>
          </thead>
          <tbody>
    `;

    departments.forEach(dept => {
      html += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold; background: #f3f4f6;">${dept}</td>
      `;
      
      dates.forEach(date => {
        const deptExams = grouped[date]?.[dept] || [];
        html += `<td style="border: 1px solid #ddd; padding: 10px; vertical-align: top;">`;
        
        if (deptExams.length === 0) {
          html += `<span style="color: #9ca3af;">--</span>`;
        } else {
          deptExams.forEach((exam, idx) => {
            const examName = (exam.examName || exam.courseName || '').substring(0, 25);
            const courseCode = exam.courseCode || '';
            html += `
              <div style="margin-bottom: ${idx < deptExams.length - 1 ? '8px' : '0'};">
                <div style="font-weight: 600; color: #1f2937;">${examName}</div>
                <div style="font-size: 10px; color: #6b7280;">(${courseCode})</div>
              </div>
            `;
          });
        }
        
        html += `</td>`;
      });
      
      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  /**
   * Generate Exam Timetable as Image (JPG)
   */
  async generateTimetableImage(exams, options = {}) {
    try {
      // Generate HTML first
      const html = this.generateTimetableHTML(exams, options);
      
      // Try to use node-html-to-image if available, otherwise use puppeteer
      let imageBuffer;
      
      try {
        // Try node-html-to-image first (lighter weight)
        const nodeHtmlToImage = require('node-html-to-image');
        imageBuffer = await nodeHtmlToImage({
          html: html,
          type: 'jpeg',
          quality: 90,
          puppeteerArgs: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        });
      } catch (e) {
        // Fallback to puppeteer if node-html-to-image is not available
        try {
          const puppeteer = require('puppeteer');
          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: 'networkidle0' });
          await page.setViewport({ width: 1200, height: 800 });
          
          imageBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 90,
            fullPage: true
          });
          
          await browser.close();
        } catch (puppeteerError) {
          throw new Error(`Image generation requires puppeteer or node-html-to-image. Install with: npm install puppeteer or npm install node-html-to-image. Error: ${puppeteerError.message}`);
        }
      }
      
      return imageBuffer;
    } catch (error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  /**
   * Generate Exam Timetable PDF (Department-wise, Date-wise format)
   */
  async generateTimetablePDF(exams, options = {}) {
    try {
      // Use the already-resolved jsPDF constructor
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      const universityName = options.universityName || 'Vignan University';
      doc.text(universityName, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;

      doc.setFontSize(14);
      doc.text('EXAM TIMETABLE', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const semester = options.semester || 'All Semesters';
      doc.text(`Semester: ${semester}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      const assessmentPeriod = options.period || moment().format('MMMM-YYYY');
      doc.text(`Assessment Period: ${assessmentPeriod}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      const releaseDate = options.releaseDate || moment().format('DD.MM.YYYY');
      doc.text(`Released Date: ${releaseDate}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      const examTime = options.examTime || '09:00 A.M. to 11:30 A.M.';
      doc.text(`Assessment Time: ${examTime}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Group exams by date and department
      const grouped = {};
      exams.forEach(exam => {
        const date = moment(exam.date).format('DD.MM.YYYY');
        const dept = exam.department || 'Other';
        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][dept]) grouped[date][dept] = [];
        grouped[date][dept].push(exam);
      });

      const dates = Object.keys(grouped).sort((a, b) => {
        const dateA = moment(a, 'DD.MM.YYYY');
        const dateB = moment(b, 'DD.MM.YYYY');
        return dateA - dateB;
      });

      const departments = [...new Set(exams.map(e => e.department || 'Other'))].sort();

      // Calculate column widths
      const firstColWidth = 35;
      const dateColWidth = (pageWidth - firstColWidth - 20) / dates.length;

      // Table header
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setFillColor(66, 139, 202);
      doc.rect(10, yPosition, firstColWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Date & Branch', 12, yPosition + 5);

      let xPos = 10 + firstColWidth;
      dates.forEach(date => {
        const dayName = moment(date, 'DD.MM.YYYY').format('dddd');
        doc.rect(xPos, yPosition, dateColWidth, 8, 'F');
        doc.text(date, xPos + 2, yPosition + 3, { maxWidth: dateColWidth - 4 });
        doc.text(`(${dayName})`, xPos + 2, yPosition + 6, { maxWidth: dateColWidth - 4 });
        xPos += dateColWidth;
      });

      yPosition += 8;
      doc.setTextColor(0, 0, 0);

      // Table rows
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      departments.forEach(dept => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.rect(10, yPosition, firstColWidth, 15, 'FD');
        doc.text(dept, 12, yPosition + 8);

        xPos = 10 + firstColWidth;
        dates.forEach(date => {
          const deptExams = grouped[date]?.[dept] || [];
          doc.rect(xPos, yPosition, dateColWidth, 15, 'FD');
          
          if (deptExams.length === 0) {
            doc.setFont(undefined, 'normal');
            doc.text('--', xPos + 2, yPosition + 8);
          } else {
            let textY = yPosition + 4;
            deptExams.forEach((exam, idx) => {
              if (textY < yPosition + 15) {
                doc.setFont(undefined, 'normal');
                const examName = (exam.examName || exam.courseName || '').substring(0, 20);
                const courseCode = exam.courseCode || '';
                doc.text(examName, xPos + 2, textY, { maxWidth: dateColWidth - 4 });
                textY += 3;
                doc.text(`(${courseCode})`, xPos + 2, textY, { maxWidth: dateColWidth - 4 });
                textY += 4;
              }
            });
          }
          xPos += dateColWidth;
        });

        yPosition += 15;
      });

      // Return PDF as buffer - ensure it's a proper buffer
      // CRITICAL: Buffer.from() cannot directly convert ArrayBuffer
      // Must convert ArrayBuffer -> Uint8Array -> Buffer
      const pdfArrayBuffer = doc.output('arraybuffer');
      const uint8Array = new Uint8Array(pdfArrayBuffer);
      const buffer = Buffer.from(uint8Array);
      
      if (buffer.length === 0) {
        throw new Error('Generated PDF buffer is empty - ArrayBuffer conversion failed');
      }
      
      return buffer;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }

  /**
   * Generate Exam Timetable Excel (Department-wise, Date-wise format)
   */
  async generateTimetableExcel(exams, options = {}) {
    try {
      const workbook = XLSX.utils.book_new();

      // Group exams by date and department
      const grouped = {};
      exams.forEach(exam => {
        const date = moment(exam.date).format('DD.MM.YYYY');
        const dept = exam.department || 'Other';
        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][dept]) grouped[date][dept] = [];
        grouped[date][dept].push(exam);
      });

      const dates = Object.keys(grouped).sort((a, b) => {
        const dateA = moment(a, 'DD.MM.YYYY');
        const dateB = moment(b, 'DD.MM.YYYY');
        return dateA - dateB;
      });

      const departments = [...new Set(exams.map(e => e.department || 'Other'))].sort();

      // Prepare data array
      const data = [];
      
      // Header row
      const headerRow = ['Date & Branch'];
      dates.forEach(date => {
        const dayName = moment(date, 'DD.MM.YYYY').format('dddd');
        headerRow.push(`${date} (${dayName})`);
      });
      data.push(headerRow);

      // Data rows
      departments.forEach(dept => {
        const row = [dept];
        dates.forEach(date => {
          const deptExams = grouped[date]?.[dept] || [];
          if (deptExams.length === 0) {
            row.push('--');
          } else {
            const examTexts = deptExams.map(exam => {
              const examName = exam.examName || exam.courseName || '';
              const courseCode = exam.courseCode || '';
              return `${examName} (${courseCode})`;
            });
            row.push(examTexts.join(' / '));
          }
        });
        data.push(row);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      
      // Set column widths
      const colWidths = [{ wch: 15 }];
      dates.forEach(() => colWidths.push({ wch: 30 }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Exam Timetable');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return buffer;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new ReportService();


require('dotenv').config();
const mongoose = require('mongoose');
const reportService = require('../services/reportService');
const Allocation = require('../models/Allocation');
const fs = require('fs');
const path = require('path');

async function testPDFDownload() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/schedulo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Fetch some allocations
    const allocations = await Allocation.find({ status: { $ne: 'cancelled' } })
      .populate('faculty', 'name email employeeId')
      .populate('exam', 'examName courseCode')
      .limit(10)
      .sort({ date: 1, startTime: 1 });

    console.log(`📋 Found ${allocations.length} allocations\n`);

    if (allocations.length === 0) {
      console.log('⚠️  No allocations found. Creating test data...');
      // Create a minimal test allocation structure
      const testAllocations = [{
        date: new Date(),
        startTime: '09:00',
        endTime: '12:00',
        campus: 'Test Campus',
        department: 'CSE',
        faculty: { name: 'Test Faculty', email: 'test@example.com' },
        exam: { examName: 'Test Exam', courseCode: 'CS101' }
      }];
      
      const pdfBuffer = await reportService.generatePDFReport(testAllocations, {
        title: 'Test Report'
      });
      
      const testFile = path.join(__dirname, '../test-output-empty.pdf');
      fs.writeFileSync(testFile, pdfBuffer);
      console.log(`✅ Test PDF written to: ${testFile}`);
      console.log(`   File size: ${pdfBuffer.length} bytes`);
      console.log(`   First 50 bytes: ${pdfBuffer.slice(0, 50).toString('hex')}`);
      console.log(`   PDF Header: "${pdfBuffer.slice(0, 4).toString('utf8')}"`);
    } else {
      // Generate PDF with real data
      console.log('📄 Generating PDF with real allocation data...');
      const pdfBuffer = await reportService.generatePDFReport(allocations, {
        title: 'Invigilation Allocation Report',
        startDate: null,
        endDate: null
      });

      console.log(`✅ PDF generated: ${pdfBuffer.length} bytes`);
      console.log(`   First 50 bytes: ${pdfBuffer.slice(0, 50).toString('hex')}`);
      console.log(`   PDF Header: "${pdfBuffer.slice(0, 4).toString('utf8')}"`);
      
      // Write to file for inspection
      const outputFile = path.join(__dirname, '../test-output-real.pdf');
      fs.writeFileSync(outputFile, pdfBuffer);
      console.log(`\n✅ PDF written to: ${outputFile}`);
      console.log(`   You can open this file to verify it's valid`);
      
      // Verify PDF structure
      if (pdfBuffer.slice(0, 4).toString('utf8') === '%PDF') {
        console.log('   ✅ Valid PDF header confirmed');
      } else {
        console.log('   ❌ Invalid PDF header!');
      }
      
      // Check for PDF end marker
      const pdfEnd = pdfBuffer.slice(-20).toString('utf8');
      if (pdfEnd.includes('%%EOF')) {
        console.log('   ✅ Valid PDF end marker found');
      } else {
        console.log('   ⚠️  PDF end marker not found in last 20 bytes');
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testPDFDownload();


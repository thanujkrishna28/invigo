require('dotenv').config();
const reportService = require('../services/reportService');

async function testPDFGeneration() {
  try {
    console.log('🧪 Testing PDF Generation...\n');

    // Test 1: Generate a simple PDF report with empty allocations
    console.log('Test 1: Generating PDF report with empty allocations...');
    const emptyAllocations = [];
    const pdfBuffer1 = await reportService.generatePDFReport(emptyAllocations, {
      title: 'Test Report'
    });
    console.log(`✅ PDF Buffer 1 generated: ${pdfBuffer1.length} bytes`);
    console.log(`   First 20 bytes: ${pdfBuffer1.slice(0, 20).toString('hex')}`);
    console.log(`   First 20 chars: ${pdfBuffer1.slice(0, 20).toString('utf8')}`);
    
    // Check if it starts with PDF header
    const pdfHeader = pdfBuffer1.slice(0, 4).toString('utf8');
    console.log(`   PDF Header: "${pdfHeader}" (should be "%PDF")`);
    
    if (pdfHeader.startsWith('%PDF')) {
      console.log('   ✅ Valid PDF header found!\n');
    } else {
      console.log('   ❌ Invalid PDF header!\n');
    }

    // Test 2: Generate timetable PDF
    console.log('Test 2: Generating timetable PDF with empty exams...');
    const emptyExams = [];
    const pdfBuffer2 = await reportService.generateTimetablePDF(emptyExams, {
      universityName: 'Test University'
    });
    console.log(`✅ PDF Buffer 2 generated: ${pdfBuffer2.length} bytes`);
    console.log(`   First 20 bytes: ${pdfBuffer2.slice(0, 20).toString('hex')}`);
    console.log(`   First 20 chars: ${pdfBuffer2.slice(0, 20).toString('utf8')}`);
    
    const pdfHeader2 = pdfBuffer2.slice(0, 4).toString('utf8');
    console.log(`   PDF Header: "${pdfHeader2}" (should be "%PDF")`);
    
    if (pdfHeader2.startsWith('%PDF')) {
      console.log('   ✅ Valid PDF header found!\n');
    } else {
      console.log('   ❌ Invalid PDF header!\n');
    }

    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Error during PDF generation test:', error);
    console.error('Stack:', error.stack);
  }
}

testPDFGeneration();


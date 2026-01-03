/**
 * Test email sending functionality
 * Usage: node scripts/testEmail.js <email_address>
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

const testEmail = async (testEmailAddress) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ Email service not configured!');
      console.error('Missing environment variables:');
      if (!process.env.EMAIL_HOST) console.error('  - EMAIL_HOST');
      if (!process.env.EMAIL_USER) console.error('  - EMAIL_USER');
      if (!process.env.EMAIL_PASS) console.error('  - EMAIL_PASS');
      console.error('\nPlease configure email settings in .env file');
      process.exit(1);
    }

    console.log('\n📧 Email Configuration:');
    console.log(`   Host: ${process.env.EMAIL_HOST}`);
    console.log(`   Port: ${process.env.EMAIL_PORT || 587}`);
    console.log(`   User: ${process.env.EMAIL_USER}`);
    console.log(`   To: ${testEmailAddress}\n`);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Verify connection
    console.log('🔍 Verifying email connection...');
    await transporter.verify();
    console.log('✅ Email server connection verified!\n');

    // Send test email
    console.log(`📤 Sending test email to ${testEmailAddress}...`);
    
    const mailOptions = {
      from: `"Schedulo Test" <${process.env.EMAIL_USER}>`,
      to: testEmailAddress,
      subject: 'Test Email from Schedulo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
            <h1 style="margin: 0;">✅ Test Email Successful!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Schedulo Email Service</p>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; margin-top: 0;">Email Configuration Test</h2>
            <p style="color: #374151;">This is a test email to verify that your email service is configured correctly.</p>
            
            <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
              <p style="margin: 0; color: #065f46;"><strong>✅ Email service is working correctly!</strong></p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
                You can now send allocation notifications to faculty members.
              </p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 6px;">
              <p style="margin: 0; color: #92400e;"><strong>📋 Configuration Details:</strong></p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #78350f;">
                <li>Host: ${process.env.EMAIL_HOST}</li>
                <li>Port: ${process.env.EMAIL_PORT || 587}</li>
                <li>From: ${process.env.EMAIL_USER}</li>
              </ul>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>💡 Next Steps:</strong> If you received this email, your email service is configured correctly. 
              You can now use the "Notify All" feature to send allocation notifications to faculty members.
            </p>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated test email from Schedulo.</p>
          </div>
        </div>
      `,
      text: `
Test Email from Schedulo
========================

✅ Email service is working correctly!

This is a test email to verify that your email service is configured correctly.

Configuration Details:
- Host: ${process.env.EMAIL_HOST}
- Port: ${process.env.EMAIL_PORT || 587}
- From: ${process.env.EMAIL_USER}

If you received this email, your email service is configured correctly. 
You can now use the "Notify All" feature to send allocation notifications to faculty members.

This is an automated test email from Schedulo.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log('\n📬 Please check the inbox (and spam folder) of the recipient email address.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error sending test email:');
    console.error(`   ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.error('⚠️  Authentication failed!');
      console.error('   - Check EMAIL_USER and EMAIL_PASS in .env');
      console.error('   - For Gmail, use App Password, not regular password');
      console.error('   - Make sure 2-factor authentication is enabled');
      console.error('   - Generate App Password: https://myaccount.google.com/apppasswords\n');
    } else if (error.code === 'ECONNECTION') {
      console.error('⚠️  Connection failed!');
      console.error('   - Check EMAIL_HOST and EMAIL_PORT in .env');
      console.error('   - Verify your email server is accessible\n');
    } else if (error.code === 'EENVELOPE') {
      console.error('⚠️  Invalid email address!');
      console.error(`   - Check the email address: ${testEmailAddress}\n`);
    }
    
    process.exit(1);
  }
};

// Get email address from command line argument
const emailAddress = process.argv[2];

if (!emailAddress) {
  console.error('❌ Please provide an email address');
  console.error('Usage: node scripts/testEmail.js <email_address>');
  console.error('Example: node scripts/testEmail.js test@example.com\n');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(emailAddress)) {
  console.error(`❌ Invalid email address: ${emailAddress}`);
  console.error('Please provide a valid email address\n');
  process.exit(1);
}

testEmail(emailAddress);

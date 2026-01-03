/**
 * Script to create .env file if it doesn't exist
 * Run: node scripts/setupEnv.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

// Generate a random JWT secret
const generateSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

const setupEnv = () => {
  try {
    // Check if .env already exists
    if (fs.existsSync(envPath)) {
      console.log('✅ .env file already exists');
      
      // Read and check if JWT_SECRET is set
      const envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('JWT_SECRET=') && !envContent.includes('JWT_SECRET=your_')) {
        console.log('✅ JWT_SECRET is already configured');
        return;
      } else {
        console.log('⚠️  JWT_SECRET is missing or using placeholder');
        console.log('   Please update JWT_SECRET in .env file');
        return;
      }
    }

    // Create .env from .env.example if it exists
    let envContent = '';
    if (fs.existsSync(envExamplePath)) {
      envContent = fs.readFileSync(envExamplePath, 'utf8');
      // Replace placeholder JWT_SECRET with generated one
      envContent = envContent.replace(
        /JWT_SECRET=.*/,
        `JWT_SECRET=${generateSecret()}`
      );
    } else {
      // Create default .env content
      envContent = `# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/schedulo

# JWT Configuration
JWT_SECRET=${generateSecret()}
JWT_EXPIRE=7d

# Email Configuration (Nodemailer) - Optional
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# University Details (for duty letters)
UNIVERSITY_NAME=Vignan University
EXAM_CELL_EMAIL=examcell@vignan.edu
EXAM_CELL_PHONE=XXXXXXXX
CAMPUS_ADDRESS=Vignan University Campus

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
`;
    }

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
    console.log('✅ JWT_SECRET has been generated automatically');
    console.log('\n📝 Next steps:');
    console.log('   1. Review the .env file');
    console.log('   2. Update MONGODB_URI if needed');
    console.log('   3. Restart your backend server');
    
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
    process.exit(1);
  }
};

setupEnv();


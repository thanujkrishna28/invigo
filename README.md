# Schedulo - Smart Campus Automation & Scheduling Platform 🎓

A **production-ready** full-stack application for automated invigilator allocation during exams using AI-assisted fairness allocation, faculty availability, and real-time notifications. Features a **modern Gemini-inspired UI** with glassmorphism, dark mode, and smooth animations. Fully optimized for mobile devices and ready for Play Store deployment.

> **Modern UI/UX**: Built with a stunning Gemini aesthetic featuring glassmorphism effects, vibrant gradients, dark mode support, and fluid animations for an exceptional user experience.

## 🚀 Features Overview

### 🔐 User Roles
- **Admin** - Full university access, manages all departments and allocations
- **HOD (Head of Department)** - Department-scoped access, manages their department only
- **Faculty** - Personal access, views their duties and submits change requests

---

## 📋 Features by Role

### 👨‍💼 Admin Module

#### Dashboard & Analytics
- ✅ **Dashboard** - Comprehensive statistics and overview
  - Total exams, scheduled exams, allocated exams
  - Total faculty, allocations, conflicts
  - Total classrooms
  - Recent allocations
- ✅ **Calendar View** - University-wide calendar
  - View all exams and allocations
  - Filter by campus, department, exam type
  - Interactive date selection with event details
  - Color-coded events by exam type
- ✅ **Analytics Dashboard** - Comprehensive analytics
  - Overview statistics (total exams, allocations, faculty, conflicts)
  - Faculty workload distribution (top performers, distribution charts)
  - Department-wise analytics (allocations, averages)
  - Campus-wise analytics (distribution charts)
  - Time-based trends (daily allocation trends, peak hours)
  - Exam type distribution (Mid-Term, Semester, Labs)
  - Conflict analytics with severity breakdown

#### File Management
- ✅ **Preview & Validation for CSV/Excel Uploads**
  - Parse and validate data before saving
  - Show preview table with parsed data
  - Highlight errors and warnings
  - Allow validation, fix errors, cancel or confirm save
- ✅ **File Upload System** (CSV/Excel)
  - Upload exam timetables
  - Upload classroom details
  - Upload faculty details
  - Support for multiple file formats

#### Exam Timetable Preparation
- ✅ **Separate Timetable System** for exam schedule management
- ✅ **Exam Type Filtering** - View Mid-Term or Semester timetables separately
- ✅ **Department-wise Scheduling** with conflict prevention
- ✅ **Validation Rules**:
  - Mid-Term: Maximum 2 exams per day per department
  - Semester: Maximum 1 exam per day per department
  - No same-subject conflicts for same department/date/time
- ✅ **Download Options**: PDF and Image (JPG) formats
- ✅ **Notify All Faculty** with embedded timetable in email
- ✅ **Campus and Department Filters** with dynamic dropdowns

#### Allocation Management
- ✅ **Allocation Configuration** - Configure allocation parameters:
  - Max invigilation hours per day (default: 6)
  - Max duties per faculty (optional, no limit by default)
  - Same-day repetition allowed/not allowed (default: allowed)
  - Time gap between duties in minutes (default: 30)
  - Department preference weight (0-100, default: 15)
  - Campus preference weight (0-100, default: 20)
- ✅ **Preview Allocation** - Preview before finalizing
  - See who will be assigned to each exam
  - Detect conflicts (overlapping times, etc.)
  - View faculty workload distribution
  - Review summary statistics
  - Confirm or adjust before saving
- ✅ **Auto Allocation Engine** - AI-based with heuristic scoring
  - **Session-Based Allocation** - Groups exams by date and session (morning/afternoon)
    - Morning session: 08:00 - 12:00
    - Afternoon session: 12:00 - 18:00
  - **All-Room Allocation** - Allocates faculty to ALL uploaded classrooms
    - Each room gets exactly 2 unique faculty members
    - No faculty allocated twice in the same session
    - Ensures fair distribution across all blocks (A, H, N, O, etc.)
  - Uses configurable parameters
  - Fair workload distribution
  - Exam type-specific rules:
    - **Mid-Term & Semester**: Any 2 faculties per room
    - **Labs**: 1 same-subject teacher + 1 any faculty per room
- ✅ **Smart Conflict Detector** with severity levels
  - High Severity: Overlapping time slots
  - Medium Severity: Multiple duties on same day
  - Provides resolution suggestions

#### User Management
- ✅ **Separate User Collections** - Users stored in dedicated MongoDB collections
  - **Admins** → `admins` collection
  - **HODs** → `hods` collection
  - **Faculty** → `faculties` collection
  - Migration scripts available for existing users
- ✅ **Register Users** - Create admin, HOD, or faculty users (saved to respective collections)
- ✅ **View All Faculty** - List all faculty with workload statistics
- ✅ **Manage Allocations** - View, edit, delete allocations
  - Filter by campus and department
  - Search functionality
  - Grouped by room display

#### Reports & Exports
- ✅ **PDF Reports** - Generate allocation reports using jsPDF
  - Allocation reports with detailed tables
  - Individual duty letters (professional certificate format)
  - Exam timetable PDFs (landscape format, department-wise)
- ✅ **Excel Reports** - Export data to Excel using XLSX library
  - Allocation data export
  - Faculty workload reports
  - Exam schedule exports
- ✅ **Image Reports** - Download timetables as JPG
  - Uses Puppeteer or node-html-to-image for HTML to image conversion
  - High-quality JPEG output (90% quality)
  - Full-page screenshots of timetables

#### Communication
- ✅ **Email Notifications** (Nodemailer) with professional HTML templates
  - **Allocation Notifications** - Professional duty letter format
    - University letterhead style
    - Duty details table (Examination, Date, Time, Room, Campus)
    - Instructions and acknowledgement sections
    - No "Course / Subject" field (as per requirements)
    - Correct room information (formatted as "A-Block – 201 (Floor 2)")
  - Timetable notifications with embedded schedules
  - Change request notifications
  - Email test script: `npm run test-email`
- ✅ **Real-time Notifications** via Socket.io
  - Instant updates when allocations are made
  - Live dashboard updates
  - Faculty-specific notifications

#### Technical Features
- ✅ **Multi-campus Support** - Manage multiple campuses
- ✅ **Multi-department Support** - Handle all departments
- ✅ **Mobile Responsive** - Fully optimized for phones and tablets

---

### 👔 HOD (Head of Department) Module

#### Dashboard
- ✅ **Department Dashboard** - Statistics for their department only
  - Total exams in department
  - Scheduled and allocated exams
  - Department faculty count
  - Active conflicts
  - Recent allocations

#### Schedule Management
- ✅ **View Department Exams** - See all exams for their department
  - Filter by status, date range
  - Search exams
  - View exam details
- ✅ **View Department Allocations** - See all allocations for department faculty
  - Filter by date, status, faculty
  - View allocation details

#### Allocation
- ✅ **Auto Allocate** - Trigger allocation for their department only
  - Uses same allocation engine as admin
  - Scoped to department exams and faculty
  - Real-time notifications to allocated faculty

#### Faculty Management
- ✅ **View Department Faculty** - List all faculty in their department
  - View faculty workload
  - See allocation statistics per faculty

#### Blocks & Classrooms
- ✅ **View Department Blocks** - See blocks and floors relevant to department

---

### 👨‍🏫 Faculty Module

#### Dashboard
- ✅ **Personal Dashboard** - Individual statistics
  - Total duties assigned
  - Total hours
  - Upcoming duties (next 7 days)
  - Today's duties
  - Recent allocations

#### Calendar View
- ✅ **Personal Calendar** - View only their duties
  - Interactive calendar widget
  - Click dates to see duties
  - View duty details in modal
  - Color-coded by status

#### Analytics
- ✅ **Personal Analytics Dashboard**
  - Overview statistics (total duties, hours, average hours per duty, upcoming)
  - Monthly duties distribution (bar charts)
  - Department and campus breakdown (pie charts)
  - Exam type distribution (Mid-Term, Semester, Labs)
  - Time slot preferences (when duties are scheduled)
  - Comparison with department average (workload comparison)

#### Duties Management
- ✅ **My Duties** - View all assigned invigilation duties
  - Filter by view (today, week, month, all)
  - See exam details, classroom, time
  - Download duty letter (PDF)
  - Export to Google Calendar (iCal)
- ✅ **View Exam Timetables** - See exam schedules
  - Filtered by campus and department
  - View upcoming exams

#### Change Requests
- ✅ **Submit Change Requests** - Request allocation changes
  - Select allocation to change
  - Provide reason
  - Suggest replacement faculty (optional)
  - Track request status
- ✅ **View Change Requests** - See all change requests
  - View status (pending, approved, rejected)
  - See responses

#### Communication
- ✅ **Real-time Notifications** - Receive instant updates
  - New allocation notifications
  - Change request updates
- ✅ **Email Notifications** - Get emails for:
  - New allocations
  - Change request responses
  - Exam timetable updates

#### Exports
- ✅ **Duty Letter PDF** - Download professional duty letter
- ✅ **iCal Export** - Add duties to Google Calendar or Outlook

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js + Express.js
- **Database**: MongoDB (Mongoose ODM)
  - Separate collections: `admins`, `hods`, `faculties`
  - Compound indexes for efficient queries
- **Authentication**: JWT (jsonwebtoken)
- **File Uploads**: Multer
- **Real-time**: Socket.io
- **Email**: Nodemailer (Gmail SMTP support)
- **PDF Generation**: 
  - **jsPDF** (v2.5.1) - For allocation reports and duty letters
  - **docx** (v9.5.1) - For Word document generation (optional)
- **Image Generation**:
  - **Puppeteer** (optional) - For HTML to image conversion
  - **node-html-to-image** (optional) - Lightweight alternative for timetable images
- **Excel Export**: **XLSX** (v0.18.5) - For Excel file generation
- **Date Handling**: Moment.js
- **File Parsing**: Papa Parse (CSV), XLSX (Excel)
- **Validation**: express-validator

### Frontend
- **Framework**: React.js 18 with Hooks
- **UI Library**: Material-UI (MUI) v7 - Modern React component library
  - @mui/material - Core components
  - @mui/icons-material - Icon library
  - @emotion/react & @emotion/styled - CSS-in-JS styling
- **Styling**: 
  - **Tailwind CSS 3** - Utility-first CSS framework
  - **Custom CSS** - Gemini-inspired design system with glassmorphism
  - **PostCSS & Autoprefixer** - CSS processing
- **Routing**: React Router 6
- **State Management**: React Context API (AuthContext, SocketContext)
- **HTTP Client**: Axios
- **Real-time**: Socket.io Client
- **Notifications**: React Hot Toast
- **Charts**: Recharts - Composable charting library
- **Calendar**: react-calendar
- **Image Generation**: html2canvas
- **Icons**: 
  - Lucide React - Modern icon library
  - Material-UI Icons - Comprehensive icon set
- **Date Handling**: Moment.js
- **Build Tool**: Vite - Next generation frontend tooling
  - Lightning-fast HMR (Hot Module Replacement)
  - Optimized production builds
  - ES modules support

---

## 📁 Project Structure

```
MSD/
├── backend/
│   ├── models/              # MongoDB models
│   │   ├── User.js          # Legacy User model (for migration)
│   │   ├── Admin.js         # Admin model (collection: 'admins')
│   │   ├── Hod.js           # HOD model (collection: 'hods')
│   │   ├── Faculty.js       # Faculty model (collection: 'faculties')
│   │   ├── Exam.js          # Exam model
│   │   ├── Allocation.js    # Allocation model
│   │   ├── Classroom.js     # Classroom model
│   │   ├── Conflict.js      # Conflict model
│   │   ├── ExamTimetable.js # Exam timetable model
│   │   └── AllocationConfig.js # Allocation configuration model
│   ├── utils/               # Utility functions
│   │   ├── generateToken.js # JWT token generation
│   │   └── userHelper.js    # User operations across collections
│   ├── routes/              # API routes
│   │   ├── auth.js          # Authentication routes
│   │   ├── admin.js         # Admin routes
│   │   ├── hod.js           # HOD routes
│   │   ├── faculty.js       # Faculty routes
│   │   ├── upload.js        # File upload routes
│   │   ├── reports.js       # Report generation routes
│   │   └── conflicts.js     # Conflict management routes
│   ├── services/            # Business logic
│   │   ├── allocationService.js    # Allocation algorithm
│   │   ├── emailService.js         # Email notifications
│   │   ├── fileUploadService.js    # File upload processing
│   │   ├── reportService.js        # Report generation
│   │   ├── calendarService.js      # Calendar data formatting
│   │   └── analyticsService.js     # Analytics calculations
│   ├── middleware/          # Express middleware
│   │   └── auth.js          # Authentication & authorization
│   ├── utils/               # Utility functions
│   │   └── generateToken.js # JWT token generation
│   ├── templates/           # CSV templates for uploads
│   │   ├── exam-timetable-template.csv
│   │   ├── exam-timetable-prep-template.csv
│   │   ├── faculty-template.csv
│   │   ├── classroom-template.csv
│   │   └── vignan-blocks-template.csv
│   ├── scripts/             # Utility scripts
│   │   ├── createAdmin.js   # Create admin users (saves to 'admins' collection)
│   │   ├── createFaculty.js # Create faculty users (saves to 'faculties' collection)
│   │   ├── createHOD.js     # Create HOD users (saves to 'hods' collection)
│   │   ├── migrateUsersToCollections.js # Migrate users from 'users' to separate collections
│   │   ├── createCollections.js # Create empty collections in MongoDB
│   │   ├── checkAdminUser.js # Check admin user location (diagnostic)
│   │   ├── fixClassroomIndexes.js # Fix classroom database indexes
│   │   ├── killPort5000.ps1 # Kill processes using port 5000 (Windows)
│   │   ├── checkUsers.js    # Check if users exist
│   │   ├── countUsers.js    # Count users by role
│   │   ├── testEmail.js     # Test email configuration
│   │   ├── testAllocationEmail.js # Test allocation notification email format
│   │   └── setupEnv.js      # Setup environment files
│   ├── uploads/             # Temporary file uploads
│   ├── server.js            # Express server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   │   ├── Layout.jsx   # Main layout with sidebar
│   │   │   └── PrivateRoute.jsx # Protected route wrapper
│   │   ├── pages/           # Page components
│   │   │   ├── Login.jsx    # Login page
│   │   │   ├── admin/       # Admin pages
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── AdminSchedule.jsx
│   │   │   │   ├── AdminManage.jsx
│   │   │   │   ├── AdminExamTimetable.jsx
│   │   │   │   ├── AdminCalendar.jsx
│   │   │   │   ├── AdminAnalytics.jsx
│   │   │   │   ├── AdminExams.jsx
│   │   │   │   ├── AdminAllocations.jsx
│   │   │   │   ├── AdminFaculty.jsx
│   │   │   │   ├── AdminConflicts.jsx
│   │   │   │   └── AdminUploads.jsx
│   │   │   ├── hod/         # HOD pages
│   │   │   │   ├── HodDashboard.jsx
│   │   │   │   ├── HodSchedule.jsx
│   │   │   │   └── HodFaculty.jsx
│   │   │   └── faculty/     # Faculty pages
│   │   │       ├── FacultyDashboard.jsx
│   │   │       ├── FacultyDuties.jsx
│   │   │       ├── FacultyCalendar.jsx
│   │   │       ├── FacultyAnalytics.jsx
│   │   │       └── FacultyChangeRequests.jsx
│   │   ├── context/         # React contexts
│   │   │   ├── AuthContext.jsx   # Authentication context
│   │   │   └── SocketContext.jsx # Socket.io context
│   │   ├── App.jsx          # Main app component with routes
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Global styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── README.md                # This file
├── SETUP.md                 # Detailed setup guide
├── QUICK_START.md           # Quick start guide
└── TROUBLESHOOTING.md       # Troubleshooting guide
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v14 or higher)
- **MongoDB** (local installation or MongoDB Atlas cloud)
- **npm** or **yarn** package manager

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd MSD
```

### Step 2: Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in `backend/` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/schedulo
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
UNIVERSITY_NAME=Vignan University
```

**Note**: For Gmail, you need to:
- Enable 2-factor authentication
- Generate an App Password: https://myaccount.google.com/apppasswords
- Use the App Password in `EMAIL_PASS`

4. Create admin user:
```bash
npm run create-admin
```
This will prompt you to create admin and demo faculty users.

5. Start the backend server:
```bash
npm run dev
```

You should see:
```
✅ MongoDB Connected
🚀 Server running on port 5000
```

### Step 3: Frontend Setup

1. Open a new terminal and navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

---

## 👤 Creating Users

### Create Admin User
```bash
cd backend
npm run create-admin
```
Interactive script to create admin users. Supports batch creation.

### Create Faculty User
```bash
cd backend
npm run create-faculty
```
Interactive script to create faculty users. **Subject name is required** (for lab exam allocation).

### Create HOD User
```bash
cd backend
npm run create-hod
```
Interactive script to create HOD (Head of Department) users. **Department is required**.

### Check Users
```bash
cd backend
npm run check-users
```
Check if default users exist.

### Count Users
```bash
cd backend
npm run count-users
```
Get detailed count of all users by role, campus, and department.

---

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
  - Body: `{ email, password }`
  - Returns: JWT token and user data
- `POST /api/auth/register` - Register new user (Admin only)
  - Body: `{ name, email, password, role, employeeId, department, campus, subject }`
  - Role: `admin`, `hod`, or `faculty`
  - Subject is required for faculty role
- `GET /api/auth/me` - Get current authenticated user

### Admin Routes
- `GET /api/admin/dashboard` - Dashboard statistics
  - Query params: `campus`, `department`, `startDate`, `endDate`
- `GET /api/admin/calendar` - Get calendar events (entire university)
  - Query params: `campus`, `department`, `examType`, `startDate`, `endDate`
- `GET /api/admin/analytics` - Get admin analytics (entire university)
  - Query params: `campus`, `department`, `startDate`, `endDate`
- `POST /api/admin/allocate` - Trigger auto allocation
  - Body: `{ examIds?, campus?, department? }`
- `GET /api/admin/exams` - Get all exams
  - Query params: `campus`, `department`, `startDate`, `endDate`, `status`
- `GET /api/admin/allocations` - Get all allocations
  - Query params: `campus`, `department`, `startDate`, `endDate`, `status`
- `GET /api/admin/faculty` - Get all faculty with workload
  - Query params: `campus`, `department`
- `GET /api/admin/campuses` - Get list of all campuses
- `GET /api/admin/departments` - Get list of all departments
  - Query params: `campus`
- `POST /api/admin/allocations/notify-all` - Send email notifications to all faculty
  - Query params: `campus`, `department`
- `DELETE /api/admin/allocations/:id` - Delete an allocation

### HOD Routes
- `GET /api/hod/dashboard` - HOD dashboard statistics (department only)
- `POST /api/hod/allocate` - Trigger allocation for HOD's department only
- `GET /api/hod/exams` - Get exams for HOD's department
  - Query params: `status`, `startDate`, `endDate`
- `GET /api/hod/allocations` - Get allocations for HOD's department
  - Query params: `startDate`, `endDate`, `status`, `facultyId`
- `GET /api/hod/faculty` - Get faculty in HOD's department with workload
- `GET /api/hod/blocks` - Get blocks and floors for department

### Faculty Routes
- `GET /api/faculty/dashboard` - Faculty personal dashboard
- `GET /api/faculty/calendar` - Get calendar events (their own duties only)
  - Query params: `startDate`, `endDate`
- `GET /api/faculty/analytics` - Get faculty personal analytics
  - Query params: `startDate`, `endDate`
- `GET /api/faculty/duties` - Get faculty duties
  - Query params: `view` (today, week, month, all)
- `GET /api/faculty/exams` - Get exam timetables
  - Query params: `campus`, `department`, `startDate`, `endDate`, `status`
- `POST /api/faculty/change-request/:id` - Submit change request
  - Body: `{ reason, replacementFacultyId? }`
- `GET /api/faculty/change-requests` - Get all change requests by faculty

### Exam Timetable Routes (Admin)
- `GET /api/admin/timetable` - Get exam timetable entries
  - Query params: `examType` (mid-term, semester), `campus`, `department`
- `GET /api/admin/timetable/pdf` - Download timetable as PDF
  - Query params: `examType`, `campus`, `department`
- `GET /api/admin/timetable/image` - Download timetable as JPG image
  - Query params: `examType`, `campus`, `department`
- `POST /api/admin/timetable/notify` - Notify all faculty with timetable
  - Body: `{ examType, campus, department }`

### Upload Routes (Admin)
- `POST /api/upload/exam-timetable/preview` - Preview exam timetable (validate without saving)
  - Form data: `file`, `examType` (mid-term, semester, labs)
  - Returns: Preview data with errors and warnings
- `POST /api/upload/exam-timetable` - Upload exam timetable (regular exams)
  - Form data: `file`, `examType`
- `POST /api/upload/exam-timetable-prep` - Upload exam timetable (preparation system)
  - Form data: `file`, `examType`
- `POST /api/upload/classrooms` - Upload classroom details
  - Form data: `file`
- `POST /api/upload/faculty` - Upload faculty details
  - Form data: `file`
  - Subject field is required for faculty uploads

**Note**: All upload endpoints support CSV and Excel (.xlsx, .xls) formats

### Allocation Configuration Routes (Admin)
- `GET /api/admin/allocation-config` - Get current allocation configuration
- `PUT /api/admin/allocation-config` - Update allocation configuration
  - Body: `{ maxHoursPerDay?, maxDutiesPerFaculty?, allowSameDayRepetition?, timeGapBetweenDuties?, departmentPreferenceWeight?, campusPreferenceWeight? }`

### Preview Allocation Routes (Admin)
- `POST /api/admin/preview-allocation` - Preview allocation without saving
  - Body: `{ examIds?: [], campus?: string, department?: string }`
  - Returns: Preview with assignments, conflicts, and summary statistics

### Reports Routes
- `GET /api/reports/pdf` - Generate PDF report
  - Query params: `campus`, `department`
- `GET /api/reports/excel` - Generate Excel report
  - Query params: `campus`, `department`
- `GET /api/reports/duty-letter/:id` - Download duty letter for allocation (PDF)
- `GET /api/reports/ical/:id` - Download iCal file for allocation

### Conflicts Routes
- `GET /api/conflicts` - Get all conflicts
  - Query params: `severity`, `status`
- `POST /api/conflicts/detect` - Manually trigger conflict detection
- `PATCH /api/conflicts/:id/resolve` - Resolve a conflict
  - Body: `{ resolution: string }`

---

## 📋 CSV Templates

All templates are located in `backend/templates/`

### Exam Timetable Preparation Template
**File**: `exam-timetable-prep-template.csv`

**Required Fields**:
- `examName` - Name of the exam
- `courseCode` - Course code (e.g., CS301)
- `date` - Exam date (YYYY-MM-DD)
- `startTime` - Start time (HH:mm or 12-hour format)
- `endTime` - End time (HH:mm or 12-hour format)
- `department` - Department name

**Optional Fields**:
- `courseName` - Course name

**Validation Rules**:
- Mid-Term: Maximum 2 exams per day per department
- Semester: Maximum 1 exam per day per department
- No same-subject conflicts (same courseCode for same department on same date/time)

### Exam Timetable Template (Regular)
**File**: `exam-timetable-template.csv`

**Required Fields**:
- `examId` - Unique exam identifier
- `examName` - Name of the exam
- `courseCode` - Course code
- `date` - Exam date (YYYY-MM-DD)
- `startTime` - Start time (HH:mm)
- `endTime` - End time (HH:mm)
- `campus` - Campus name
- `department` - Department name
- `totalStudents` - Number of students

**Optional Fields**:
- `courseName` - Course name
- `roomNumber` - Room number (if provided, must exist in database)
- `requiredInvigilators` - Number of invigilators needed (default: 2)
- `block`, `floor` - Building details

**Note**: If `roomNumber` is not provided, system will auto-allocate an available classroom

### Faculty Template
**File**: `faculty-template.csv`

**Required Fields**:
- `name` - Faculty name
- `email` - Email address (must be unique)
- `campus` - Campus name
- `subject` - **Subject name (REQUIRED)** - e.g., "Data Structures", "Operating Systems"

**Optional Fields**:
- `password` - Password (if not provided, uses employeeId or email prefix)
- `employeeId` - Employee ID
- `department` - Department name
- `subjects` - Comma-separated list of subjects
- `phone` - Phone number
- `maxHoursPerDay` - Maximum hours per day (default: 6)
- `isActive` - true/false (default: true)
- `role` - User role: `admin`, `hod`, or `faculty` (default: `faculty`)

**Note**: 
- Subject name is required for faculty (not course code)
- For HOD users, set `role: 'hod'` and ensure `department` is specified

### Classroom Template
**File**: `classroom-template.csv`

**Required Fields**:
- `roomNumber` - Room number
- `block` - Building block (e.g., A-block, H-block, N-block)
- `floor` - Floor number
- `campus` - Campus name
- `capacity` - Room capacity

**Optional Fields**:
- `building` - Building name (defaults to block name)
- `department` - Primary department
- `departments` - Comma-separated list of departments that can use this room
- `facilities` - Comma-separated list
- `isActive` - true/false (default: true)
- `isExamOnly` - true/false (for rooms like O-block that are only used during exams)

---

## 🧠 Allocation Algorithm

The system uses a **heuristic scoring algorithm** for fair workload distribution that considers:

### Configurable Parameters
- **Max Hours Per Day** - Maximum invigilation hours allowed per faculty per day (default: 6)
- **Max Duties Per Faculty** - Maximum total duties per faculty (optional, no limit by default)
- **Allow Same-Day Repetition** - Whether faculty can have multiple duties on the same day (default: true)
- **Time Gap Between Duties** - Minimum time gap required between duties in minutes (default: 30)
- **Department Preference Weight** - Weight for preferring same department faculty (0-100, default: 15)
- **Campus Preference Weight** - Weight for preferring same campus faculty (0-100, default: 20)

### Scoring Factors
1. **Workload Distribution** - Lower workload = higher score (fairness)
2. **Hours Per Day** - Prefer faculty with fewer hours today
3. **Same-Day Repetition** - Penalty if same-day not allowed
4. **Campus Match** - Bonus for matching campus (configurable weight)
5. **Department Match** - Bonus for matching department (configurable weight)
6. **Availability** - Check faculty availability settings
7. **Random Factor** - Small variation for fairness

### Exam Type Rules
- **Mid-Term & Semester**: Any 2 faculties per class
- **Labs**: 
  - 1 same-subject teacher (matches `exam.courseName` with `faculty.subject` or `faculty.subjects`)
  - 1 any faculty per class

### Configuration
Admin can configure all allocation parameters through `/api/admin/allocation-config`

---

## 🔍 Conflict Detection

The system automatically detects conflicts with severity levels:

### High Severity
- **Overlapping Time Slots** - Faculty assigned to multiple exams at the same time
- Automatic detection after allocations
- Requires immediate resolution

### Medium Severity
- **Multiple Duties Same Day** - Faculty has multiple duties on the same day (if same-day repetition not allowed)
- Can be allowed if configuration permits

### Conflict Detection Features
- Automatic detection after allocation
- Manual detection via API
- Resolution tracking
- Severity-based prioritization
- Resolution suggestions

---

## 📧 Email Notifications

### Configuration
Configure email settings in `backend/.env`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Email Types
1. **Allocation Notifications**
   - Sent to faculty when assigned invigilation duty
   - Professional HTML template
   - Includes exam details, classroom, date, time
   - Duty letter format

2. **Timetable Notifications**
   - Sent to all faculty when timetable is finalized
   - Embedded HTML table with exam schedule
   - Filtered by campus/department

3. **Change Request Notifications**
   - Sent when change request is approved/rejected
   - Includes resolution details

### Testing Email
```bash
cd backend
npm run test-email
```

---

## 📱 Mobile Responsive

The UI is **fully responsive** and optimized for:

- ✅ **Desktop** (1024px+)
- ✅ **Tablet** (768px - 1023px)
- ✅ **Mobile devices** (320px - 767px)
- ✅ **Touch-friendly** - All buttons minimum 44px height
- ✅ **Smooth scrolling** - Optimized for mobile browsers
- ✅ **Play Store ready** - Optimized for app deployment

### Mobile Features
- Responsive sidebar navigation with hamburger menu
- Horizontal scrolling tables
- Touch-optimized buttons and inputs
- Responsive grid layouts
- Abbreviated labels on small screens
- Optimized font sizes and spacing
- Calendar view optimized for mobile

---

## 🎨 UI/UX Features

### Modern Gemini-Inspired Design System
- **Glassmorphism Effects**: Frosted glass UI elements with backdrop blur and transparency
  - Semi-transparent cards with blur effects
  - Layered depth with subtle shadows
  - Premium, modern aesthetic throughout the application
- **Dark Mode Support**: Elegant dark color scheme optimized for reduced eye strain
  - Deep purple and blue gradients
  - High contrast for readability
  - Smooth transitions between light and dark elements
- **Vibrant Gradients**: Dynamic color gradients for visual appeal
  - Purple to blue gradients for primary elements
  - Smooth color transitions
  - Eye-catching hover effects
- **Smooth Animations**: Fluid micro-interactions and transitions
  - Hover animations on buttons and cards
  - Smooth page transitions
  - Loading animations and skeleton screens
  - Interactive element feedback

### Navigation & Layout
- **Sidebar Navigation**: Fixed sidebar on desktop, hamburger menu on mobile
  - Smooth slide-in/out animations
  - Active route highlighting
  - Role-based menu items
- **Responsive Grid Layouts**: Adaptive layouts for all screen sizes
  - Mobile-first design approach
  - Touch-optimized spacing and sizing
  - Horizontal scrolling tables for mobile

### Real-time Features
- **Live Notifications**: Socket.io for instant updates
  - Toast notifications with custom styling
  - Real-time dashboard updates
  - Faculty-specific notifications
- **Interactive Components**: 
  - Charts & Visualizations (Recharts) with smooth animations
  - Interactive calendars for scheduling
  - Drag-and-drop support (where applicable)

### User Experience
- **Loading States**: Professional loading indicators
  - Spinners with gradient effects
  - Skeleton screens for content loading
  - Progress indicators
- **Error Handling**: Comprehensive error messages and validation
  - User-friendly error messages
  - Form validation with real-time feedback
  - Toast notifications for success/error states
- **Accessibility**: WCAG compliant design
  - Keyboard navigation support
  - Screen reader friendly
  - High contrast ratios

---

## 🔐 Security

- **JWT-based Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Role-based Access Control**: Admin, HOD, Faculty roles with different permissions
- **Input Validation**: express-validator for request validation
- **Secure File Uploads**: Multer with file type and size restrictions
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Environment Variables**: Sensitive data in .env files (not committed)
- **Protected Routes**: Middleware-based route protection

---

## 📊 Key Pages

### Admin Pages
- **Dashboard** (`/admin`) - Statistics and recent allocations
- **Schedule** (`/admin/schedule`) - Manage exams, view allocations
- **Calendar** (`/admin/calendar`) - University-wide calendar view
- **Analytics** (`/admin/analytics`) - Comprehensive analytics dashboard
- **Manage** (`/admin/manage`) - Upload files and view allocations
- **Exam Timetable** (`/admin/timetable`) - Create and manage exam schedules
- **Faculty** (`/admin/faculty`) - View and manage faculty
- **Conflicts** (`/admin/conflicts`) - View and resolve conflicts
- **Exams** (`/admin/exams`) - View all exams
- **Allocations** (`/admin/allocations`) - View all allocations
- **Uploads** (`/admin/uploads`) - Upload CSV/Excel files

### HOD Pages
- **Dashboard** (`/hod`) - Department statistics and overview
- **Schedule** (`/hod/schedule`) - View department exams and allocations
- **Faculty** (`/hod/faculty`) - View department faculty

### Faculty Pages
- **Dashboard** (`/faculty`) - Personal statistics and upcoming duties
- **My Duties** (`/faculty/duties`) - View all assigned invigilation duties
- **Calendar** (`/faculty/calendar`) - Personal calendar view
- **Analytics** (`/faculty/analytics`) - Personal analytics dashboard
- **Change Requests** (`/faculty/change-requests`) - Submit and track change requests

---

## 🚀 Deployment

### Building for Production

1. **Backend**:
```bash
cd backend
npm install --production
# Set production environment variables in .env
npm start
```

2. **Frontend**:
```bash
cd frontend
npm install
npm run build
# Serve the dist/ folder with a web server (nginx, apache, etc.)
```

### Environment Variables (Production)

Ensure all required environment variables are set:
```env
PORT=5000
MONGODB_URI=mongodb://your-production-connection-string
JWT_SECRET=strong_random_secret_key_change_this
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_production_email@gmail.com
EMAIL_PASS=your_production_app_password
FRONTEND_URL=https://your-frontend-domain.com
UNIVERSITY_NAME=Your University Name
```

### For Play Store (Mobile App)
1. Build the frontend:
```bash
cd frontend
npm run build
```

2. The app is optimized for mobile with:
   - Touch-friendly controls
   - Responsive layouts
   - Mobile viewport settings
   - PWA-ready structure

---

## 🆕 Recent Updates

### Allocation & Data Management
- ✅ **Session-Based Allocation** - Groups exams by morning (08:00-12:00) and afternoon (12:00-18:00) sessions
- ✅ **All-Room Allocation** - Allocates faculty to ALL uploaded classrooms (not just exam-specific rooms)
  - Ensures 2 unique faculty per room per session
  - No faculty allocated twice in the same session
  - Works across all blocks (A, H, N, O, etc.)
- ✅ **Separate User Collections** - Users stored in dedicated MongoDB collections (`admins`, `hods`, `faculties`)
  - Migration scripts available: `scripts/migrateUsersToCollections.js`
  - Improved authentication across collections
- ✅ **Classroom Upload Fixes** - Fixed duplicate key errors for same room numbers across different blocks
  - Proper compound indexing: `{ roomNumber, block, floor, campus }`
  - Supports multiple blocks with same room numbers

### Email & Communication
- ✅ **Professional Email Format** - University letterhead style duty letters
  - Removed "Course / Subject" field
  - Correct room display format: "A-Block – 201 (Floor 2)"
  - Professional formatting matching official university letters
- ✅ **Email Test Scripts** - `scripts/testEmail.js` and `scripts/testAllocationEmail.js`
  - Test email configuration
  - Test allocation notification format

### UI & Display
- ✅ **Allocation Filters** - Campus and department filters with dynamic dropdowns
  - Filters work correctly with separate user collections
  - Faculty data properly populated in allocation cards
- ✅ **Calendar View** - Admin: University-wide calendar | Faculty: Personal duties calendar
- ✅ **Analytics Dashboard** - Admin: Comprehensive university analytics | Faculty: Personal analytics with comparisons

### File Management
- ✅ **Preview & Validation for CSV/Excel Uploads** - Validate data before saving
- ✅ **Auto-Assign Classrooms** - Automatically assigns classrooms to exams if not specified
- ✅ **Faculty Upload Flag** - `uploadedViaExcel` flag to distinguish Excel-uploaded faculty

### Other Features
- ✅ **Allocation Configuration** - Configure allocation parameters (max hours, duties, preferences)
- ✅ **Preview Allocation** - Preview assignments and conflicts before finalizing
- ✅ **HOD Module** - Complete HOD functionality with department-scoped access
- ✅ **Create HOD Script** - `npm run create-hod` for creating HOD users
- ✅ Exam Timetable Preparation system
- ✅ Exam type-specific allocation (Mid-Term, Semester, Labs)
- ✅ Subject-based allocation for lab exams
- ✅ Image download for timetables
- ✅ Enhanced mobile responsiveness
- ✅ Real-time socket notifications

---

## 📚 Additional Documentation

- **SETUP.md** - Detailed setup instructions
- **QUICK_START.md** - Quick start guide
- **TROUBLESHOOTING.md** - Common issues and solutions
- **Templates README** - `backend/templates/README.md` for CSV template details

---

## 🧪 Utility Scripts

All scripts are in `backend/scripts/` and can be run with `npm run <script-name>`:

- `npm run create-admin` - Create admin users interactively (saves to 'admins' collection)
- `npm run create-faculty` - Create faculty users interactively (subject required, saves to 'faculties' collection)
- `npm run create-hod` - Create HOD users interactively (department required, saves to 'hods' collection)
- `npm run check-users` - Check if default users exist
- `npm run count-users` - Count all users by role, campus, and department
- `npm run test-email` - Test email configuration
- `npm run setup-env` - Setup environment files interactively

**Additional Scripts** (run directly with `node scripts/<script-name>.js`):
- `migrateUsersToCollections.js` - Migrate existing users from 'users' collection to separate collections
- `createCollections.js` - Create empty 'admins', 'hods', 'faculties' collections
- `checkAdminUser.js` - Diagnostic script to find admin user location
- `fixClassroomIndexes.js` - Fix classroom database indexes (removes incorrect unique constraints)
- `testAllocationEmail.js` - Test allocation notification email format
- `killPort5000.ps1` - PowerShell script to kill processes using port 5000 (Windows)

---

## 📄 License

ISC

---

## 👥 Contributing

This is a production-ready system built following clean architecture principles and industry best practices.

---

**Built with ❤️ for Smart Campus Automation**

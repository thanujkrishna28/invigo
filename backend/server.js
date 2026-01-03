const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not defined in .env file!');
  console.error('📝 Please create a .env file in the backend folder with JWT_SECRET');
  console.error('💡 Example: JWT_SECRET=your_super_secret_key_here');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://invigo.vercel.app",
        "https://schedulo-three.vercel.app",
        "https://schedulo-i52jw7fj9-thanujkrishna22-1138s-projects.vercel.app"
      ];
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://invigo.vercel.app",
      "https://schedulo-three.vercel.app",
      "https://schedulo-i52jw7fj9-thanujkrishna22-1138s-projects.vercel.app"
    ];
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io available to routes
app.set('io', io);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/hod', require('./routes/hod'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/allocations', require('./routes/allocations'));
app.use('/api/conflicts', require('./routes/conflicts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/reminders', require('./routes/reminders'));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Schedulo API is running' });
});

// Root endpoint for UptimeRobot monitoring
app.get('/', (req, res) => {
  res.status(200).send('Server is active and running!');
});

// Start automatic cleanup service
const cleanupService = require('./services/cleanupService');
const CLEANUP_DAYS_OLD = parseInt(process.env.CLEANUP_DAYS_OLD) || 30; // Default: 30 days
const CLEANUP_INTERVAL_HOURS = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 24; // Default: every 24 hours

// Start auto cleanup when server starts
cleanupService.startAutoCleanup(CLEANUP_DAYS_OLD, CLEANUP_INTERVAL_HOURS);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🧹 Auto cleanup: Enabled (deletes converted records older than ${CLEANUP_DAYS_OLD} days, runs every ${CLEANUP_INTERVAL_HOURS} hours)`);
});


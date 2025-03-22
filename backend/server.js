const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Catch all uncaught exceptions to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

// Import models
const User = require('./models/user');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Essential middleware (keep it minimal and in the right order)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ===== DIRECT API ENDPOINTS =====

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'virtual-betting-api', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'GET works!' });
});

// Test POST endpoint
app.post('/api/test', (req, res) => {
  res.json({ message: 'POST works!', body: req.body });
});

// Simplified registration endpoint (no bcrypt to avoid crashes)
app.post('/api/simple-register', (req, res) => {
  try {
    console.log('Simple registration attempt:', req.body);
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Just respond with success to test the endpoint
    res.json({
      success: true,
      message: 'Registration endpoint reached',
      data: { username, email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Non-async registration with real database save
app.post('/api/no-async-register', (req, res) => {
  console.log('No-async registration attempt:', req.body);
  const { username, email, password } = req.body;
  
  // Create user without bcrypt
  const user = new User({
    username,
    email: email.toLowerCase(),
    password: 'password123', // Simplified for testing
    isVerified: true,
    registrationIP: '127.0.0.1',
    registrationDate: new Date(),
    coins: 1000
  });
  
  // Use promise chaining instead of async/await
  user.save()
    .then((savedUser) => {
      console.log('User saved successfully');
      res.json({ 
        success: true, 
        message: 'User registered!',
        user: {
          id: savedUser._id,
          username: savedUser.username,
          email: savedUser.email
        }
      });
    })
    .catch((error) => {
      console.error('Error saving user:', error);
      res.status(500).json({ error: error.message });
    });
});

// ===== IMPORT ROUTE MODULES =====
const userRoutes = require('./routes/users');
const tournamentRoutes = require('./routes/tournaments');
const eventRoutes = require('./routes/events');
const betRoutes = require('./routes/bets');
const healthRoutes = require('./routes/health');

// ===== MOUNT ROUTE MODULES =====
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/health', healthRoutes);

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Express error handler:', err);
  res.status(500).json({ 
    error: 'Server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});

// ===== STATIC FILES & SPA =====
app.use(express.static(path.join(__dirname, '../frontend/public')));

// SPA fallback - MUST be after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ===== CONNECTION & SERVER STARTUP =====
function startServer() {
  try {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
      console.log(`Visit http://localhost:${port} to access the application`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

// Connect to MongoDB with proper error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/virtual_betting';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // 30 seconds timeout for server selection
})
.then(() => {
  console.log('MongoDB connected successfully');
  startServer();
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  console.log('Starting server anyway...');
  startServer();
});
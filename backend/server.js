const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Import route files
const userRoutes = require('./routes/users');
const tournamentRoutes = require('./routes/tournaments'); // New tournament routes
const eventRoutes = require('./routes/events'); // Updated event routes
const betRoutes = require('./routes/bets');
const healthRoutes = require('./routes/health');

// Import database connection
require('./config/database');

// Import models
const User = require('./models/user');
const Tournament = require('./models/tournament');
const Event = require('./models/event');
const Bet = require('./models/bet');
const IPRegistry = require('./models/ipRegistry');

const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/admin.html'));
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes); // Add tournament routes
app.use('/api/events', eventRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/health', healthRoutes);

// Root API route
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Virtual Betting API',
    version: '1.0.0',
    status: 'online',
    endpoints: [
      '/api/users',
      '/api/tournaments',
      '/api/events',
      '/api/bets'
    ]
  });
});

// Serve SPA for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  console.log(`Visit http://localhost:${port} to access the application`);
  console.log(`Admin panel available at http://localhost:${port}/admin`);
});

// Add middleware to check if user is admin
const isAdmin = (req, res, next) => {
  // Get user from session or token
  const user = req.user;
  
  // If user is not logged in or not an admin, redirect to login
  if (!user || !user.isAdmin) {
    return res.redirect('/login');
  }
  
  // User is an admin, proceed
  next();
};

// Admin panel route (protected by isAdmin middleware)
app.get('/admin', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/admin.html'));
});
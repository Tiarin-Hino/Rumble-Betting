const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const IPRegistry = require('../models/ipRegistry');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { getClientIP, trackIPRegistration, registrationLimiter } = require('../middleware/ipRateLimit');
const jwt = require('jsonwebtoken');
const config = require('../env');

// User Registration - Modified to handle bcrypt more reliably
router.post('/register', [
  // Input validation
  body('username').isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
    .matches(/^[A-Za-z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscores'),
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  // Removed IP limiting middleware to avoid potential issues
], (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password } = req.body;
  const ip = req.ip || '127.0.0.1'; // Fallback if IP detection fails

  // Use promise chaining instead of async/await for better error handling
  User.findOne({ username: new RegExp(`^${username}$`, 'i') })
    .then(existingUsername => {
      if (existingUsername) {
        throw { status: 400, message: 'Username already taken' };
      }
      return User.findOne({ email: email.toLowerCase() });
    })
    .then(existingEmail => {
      if (existingEmail) {
        throw { status: 400, message: 'Email already registered' };
      }
      
      // Hash password - Handle bcrypt separately to catch potential errors
      return bcrypt.hash(password, 10);
    })
    .then(hashedPassword => {
      // Create new user
      const newUser = new User({
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        isVerified: true, // Auto-verified since no email verification
        registrationIP: ip,
        coins: 1000,
        registrationDate: new Date()
      });
      
      // Save user
      return newUser.save();
    })
    .then(newUser => {
      // Optional: Track IP registration (but don't let it break the flow)
      try {
        trackIPRegistration(ip);
      } catch (ipError) {
        console.error('IP tracking error (non-fatal):', ipError);
      }
      
      // Return success response without waiting for IP registry update
      res.status(201).json({
        message: 'Registration successful! You can now log in.',
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          coins: newUser.coins,
          registrationDate: newUser.registrationDate
        }
      });
      
      // Update IP registry asynchronously (don't block response)
      IPRegistry.findOne({ ip })
        .then(ipRecord => {
          if (!ipRecord) {
            ipRecord = new IPRegistry({
              ip,
              registrations: [{ userId: newUser._id }]
            });
          } else {
            ipRecord.registrations.push({ userId: newUser._id });
          }
          return ipRecord.save();
        })
        .catch(ipError => {
          console.error('IP registry update error (non-fatal):', ipError);
        });
    })
    .catch(error => {
      console.error('Registration error:', error);
      // Return appropriate error response
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      res.status(500).json({ error: 'Server error during registration' });
    });
});

// User Login - Modified to handle bcrypt more reliably
router.post('/login', [
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }

  const { email, password } = req.body;
  const ip = getClientIP(req) || '127.0.0.1';
  let foundUser;

  // Verify request has required fields
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  // Use promise chaining for better error handling
  User.findOne({ email: email.toLowerCase() })
    .then(user => {
      if (!user) {
        throw { status: 401, message: 'Invalid email or password' };
      }
      
      if (user.isBanned) {
        throw { status: 403, message: 'Account banned', reason: user.banReason || 'Violation of platform rules' };
      }
      
      foundUser = user;
      // Compare password
      return bcrypt.compare(password, user.password);
    })
    .then(isMatch => {
      if (!isMatch) {
        throw { status: 401, message: 'Invalid email or password' };
      }
      
      // Generate JWT token
      const token = generateJWT(foundUser);
      
      // Set HTTP-only cookie with the token
      if (process.env.NODE_ENV === 'production') {
        res.cookie('auth_token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000 // 1 hour
        });
      } else {
        res.cookie('auth_token', token, {
          httpOnly: true,
          maxAge: 3600000 // 1 hour
        });
      }
      
      // Update last login (but don't wait for it to complete)
      foundUser.lastLoginDate = new Date();
      foundUser.lastLoginIP = ip;
      foundUser.save().catch(saveErr => {
        console.error('Error updating last login:', saveErr);
      });
      
      // Return user data (excluding password)
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: foundUser._id,
          username: foundUser.username,
          email: foundUser.email,
          coins: foundUser.coins,
          isAdmin: foundUser.isAdmin,
          registrationDate: foundUser.registrationDate,
          lastLoginDate: foundUser.lastLoginDate
        },
        token: token // Include token in response for backward compatibility
      });
    })
    .catch(error => {
      console.error('Login error:', error);
      if (error.status) {
        return res.status(error.status).json({ 
          success: false, 
          error: error.message,
          reason: error.reason
        });
      }
      return res.status(500).json({ 
        success: false,
        error: 'Server error during login',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
      });
    });
});

// Function to generate JWT
function generateJWT(user) {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';
  
  return jwt.sign(
    { 
      userId: user._id,
      username: user.username,
      isAdmin: user.isAdmin 
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Keep the rest of your routes as they are...
// Logout route
router.post('/logout', (req, res) => { /* ... */ });

// Verify authentication route
router.get('/verify-auth', isAuthenticated, async (req, res) => { /* ... */ });

// Leaderboard route
router.get('/leaderboard', async (req, res) => { /* ... */ });

// Get user profile
router.get('/profile', isAuthenticated, async (req, res) => { /* ... */ });

// Change password
router.post('/change-password', isAuthenticated, [ /* ... */ ], async (req, res) => { /* ... */ });

// Reset password (for forgotten passwords)
router.post('/reset-password', [ /* ... */ ], async (req, res) => { /* ... */ });

// Admin routes
router.get('/admin/users', isAdmin, async (req, res) => { /* ... */ });
router.post('/admin/ban/:userId', isAdmin, [ /* ... */ ], async (req, res) => { /* ... */ });
router.post('/admin/unban/:userId', isAdmin, async (req, res) => { /* ... */ });
router.get('/admin/ip/:ip', isAdmin, async (req, res) => { /* ... */ });

module.exports = router;
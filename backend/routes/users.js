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

// User Registration
router.post('/register', [
  // Input validation
  body('username').isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
    .matches(/^[A-Za-z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscores'),
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  
  // IP limiting middleware
  registrationLimiter
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password } = req.body;
  const ip = req.clientIP;

  try {
    // Check if username exists
    const existingUsername = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if email exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      isVerified: true, // Auto-verified since no email verification
      registrationIP: ip,
      coins: 1000,
      registrationDate: new Date()
    });

    // Save user
    await newUser.save();

    // Track IP registration
    trackIPRegistration(ip);

    // Update IP registry in database
    let ipRecord = await IPRegistry.findOne({ ip });
    
    if (!ipRecord) {
      ipRecord = new IPRegistry({
        ip,
        registrations: [{ userId: newUser._id }]
      });
    } else {
      ipRecord.registrations.push({ userId: newUser._id });
    }
    
    await ipRecord.save();

    // Return success (don't include password)
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
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  try {
    // Clear auth cookie if using cookies
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

// Verify authentication route
router.get('/verify-auth', isAuthenticated, async (req, res) => {
  try {
    // If middleware succeeds, user is authenticated
    // Return user data without sensitive info
    res.status(200).json({
      authenticated: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        coins: req.user.coins,
        isAdmin: req.user.isAdmin,
        registrationDate: req.user.registrationDate,
        lastLoginDate: req.user.lastLoginDate
      }
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Server error during authentication verification' });
  }
});

// User Login
router.post('/login', [
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  try {
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
    const ip = getClientIP(req);

    // Verify request has required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }
    
    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        error: 'Account banned',
        reason: user.banReason || 'Violation of platform rules'
      });
    }
    
    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }
    
    // Generate JWT token
    const token = generateJWT(user);
    
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
    
    // Update last login
    user.lastLoginDate = new Date();
    user.lastLoginIP = ip;
    await user.save();
    
    // Return user data (excluding password)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        coins: user.coins,
        isAdmin: user.isAdmin,
        registrationDate: user.registrationDate,
        lastLoginDate: user.lastLoginDate
      },
      token: token // Include token in response for backward compatibility
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Server error during login',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
    });
  }
});

// Function to generate JWT - make sure this is defined
function generateJWT(user) {
  // If this function isn't defined elsewhere, implement it here
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

// Leaderboard route
router.get('/leaderboard', async (req, res) => {
  try {
    // Get query parameters for pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Aggregate pipeline to calculate statistics
    const usersWithStats = await User.aggregate([
      // Match non-banned users
      { $match: { isBanned: { $ne: true } } },
      
      // Lookup bets to get betting statistics
      {
        $lookup: {
          from: 'bets',
          localField: '_id',
          foreignField: 'userId',
          as: 'userBets'
        }
      },
      
      // Add calculated fields
      {
        $addFields: {
          totalBet: {
            $sum: '$userBets.amount'
          },
          wonBets: {
            $size: {
              $filter: {
                input: '$userBets',
                as: 'bet',
                cond: { $eq: ['$$bet.status', 'won'] }
              }
            }
          },
          totalBets: { $size: '$userBets' },
          winRate: {
            $cond: [
              { $gt: [{ $size: '$userBets' }, 0] },
              {
                $multiply: [
                  { 
                    $divide: [
                      { 
                        $size: {
                          $filter: {
                            input: '$userBets',
                            as: 'bet',
                            cond: { $eq: ['$$bet.status', 'won'] }
                          }
                        }
                      },
                      { 
                        $size: {
                          $filter: {
                            input: '$userBets',
                            as: 'bet',
                            cond: { 
                              $in: ['$$bet.status', ['won', 'lost']] 
                            }
                          }
                        }
                      }
                    ]
                  },
                  100
                ]
              },
              0
            ]
          }
        }
      },
      
      // Project only needed fields
      {
        $project: {
          _id: 1,
          username: 1,
          coins: 1,
          registrationDate: 1,
          totalBet: 1,
          totalBets: 1,
          wonBets: 1,
          winRate: 1,
          userBets: 0 // Remove the full bets array
        }
      },
      
      // Sort by coins descending
      { $sort: { coins: -1 } },
      
      // Pagination
      { $skip: skip },
      { $limit: limit }
    ]);
    
    // Count total users for pagination
    const totalUsers = await User.countDocuments({ isBanned: { $ne: true } });
    const totalPages = Math.ceil(totalUsers / limit);
    
    // Add rank to each user based on their position
    const usersWithRank = usersWithStats.map((user, index) => ({
      ...user,
      rank: skip + index + 1
    }));
    
    res.status(200).json({
      users: usersWithRank,
      pagination: {
        total: totalUsers,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error retrieving leaderboard' });
  }
});

// Get user profile
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    // User is already in req.user from middleware
    res.status(200).json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        coins: req.user.coins,
        isAdmin: req.user.isAdmin,
        registrationDate: req.user.registrationDate,
        lastLoginDate: req.user.lastLoginDate
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error retrieving profile' });
  }
});

// Change password
router.post('/change-password', isAuthenticated, [
  body('currentPassword').isLength({ min: 8 }).withMessage('Current password must be at least 8 characters'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, req.user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    req.user.password = hashedPassword;
    await req.user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Server error during password change' });
  }
});

// Reset password (for forgotten passwords)
router.post('/reset-password', [
  body('username').isLength({ min: 3 }).withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, newPassword } = req.body;

  try {
    // Find user by username and email (both must match)
    const user = await User.findOne({ 
      username: new RegExp(`^${username}$`, 'i'),
      email: email.toLowerCase()
    });

    if (!user) {
      return res.status(404).json({ error: 'No account found with the provided username and email' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error during password reset' });
  }
});

// Admin route: Get all users
router.get('/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.status(200).json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error retrieving users' });
  }
});

// Admin route: Ban a user
router.post('/admin/ban/:userId', isAdmin, [
  body('reason').isString().withMessage('Ban reason is required')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId } = req.params;
  const { reason } = req.body;

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isBanned = true;
    user.banReason = reason;
    
    await user.save();

    res.status(200).json({ message: 'User banned successfully', user: userId });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Server error banning user' });
  }
});

// Admin route: Unban a user
router.post('/admin/unban/:userId', isAdmin, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isBanned = false;
    user.banReason = null;
    
    await user.save();

    res.status(200).json({ message: 'User unbanned successfully', user: userId });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Server error unbanning user' });
  }
});

// Admin route: Check IP registrations
router.get('/admin/ip/:ip', isAdmin, async (req, res) => {
  const { ip } = req.params;

  try {
    const ipRecord = await IPRegistry.findOne({ ip }).populate('registrations.userId', 'username email registrationDate');
    
    if (!ipRecord) {
      return res.status(404).json({ error: 'IP address not found in registry' });
    }

    res.status(200).json({ ipRecord });
  } catch (error) {
    console.error('IP check error:', error);
    res.status(500).json({ error: 'Server error checking IP' });
  }
});

module.exports = router;
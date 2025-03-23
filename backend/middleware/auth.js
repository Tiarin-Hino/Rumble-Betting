// middleware/auth.js - Server-side implementation
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Get the JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Authentication middleware for Express
const isAuthenticated = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    let token = null;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // Or check for cookie
    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user by ID
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Admin check middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
};

module.exports = {
  isAuthenticated,
  isAdmin
};
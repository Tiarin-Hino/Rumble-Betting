// middleware/auth.js - Fixed implementation that supports both token and cookie auth

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const config = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-fallback-secret-key'
};

// Get token from request (either from header or cookies)
const getTokenFromRequest = (req) => {
  // First check for Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  
  // Then check for cookie (for browser clients)
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }
  
  return null;
};

// Check if user is authenticated
const isAuthenticated = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // 1. Verify JWT (proper way)
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const userId = decoded.userId;
      
      // Find user in database
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Check if user is banned
      if (user.isBanned) {
        return res.status(403).json({ 
          error: 'Account banned', 
          reason: user.banReason || 'Violation of platform rules' 
        });
      }
      
      // Add user to request object
      req.user = user;
      return next();
    } catch (jwtError) {
      // 2. Fallback to legacy token format (for compatibility during transition)
      if (jwtError.name === 'JsonWebTokenError') {
        // Try old format: "userId"
        const userId = token;
        
        // Find user in database
        const user = await User.findById(userId);
        
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
        
        // Check if user is banned
        if (user.isBanned) {
          return res.status(403).json({ 
            error: 'Account banned', 
            reason: user.banReason || 'Violation of platform rules' 
          });
        }
        
        // Add user to request object
        req.user = user;
        return next();
      }
      
      // If JWT error is not related to format, it's invalid
      return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user is an admin
const isAdmin = (req, res, next) => {
  isAuthenticated(req, res, () => {
    if (req.user && req.user.isAdmin) {
      return next();
    }
    
    return res.status(403).json({ error: 'Admin access required' });
  });
};

module.exports = {
  isAuthenticated,
  isAdmin
};
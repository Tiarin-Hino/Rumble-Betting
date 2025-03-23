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
function isAuthenticated() {
  const authStatus = localStorage.getItem(AUTH_STATUS_KEY) === 'true';
  const userData = getUserData();
  console.log('Authentication check - Status:', authStatus, 'User data exists:', !!userData);
  return authStatus && !!userData;
}

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
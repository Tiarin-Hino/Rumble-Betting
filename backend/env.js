// backend/env.js
require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-fallback-secret-key',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '1h',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual_betting',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
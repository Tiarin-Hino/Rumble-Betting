// models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  registrationIP: {
    type: String,
    required: true
  },
  lastLoginIP: {
    type: String
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  lastLoginDate: {
    type: Date
  },
  coins: {
    type: Number,
    default: 1000
  },
  winRate: {
    type: Number,
    default: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
// models/ipRegistry.js
const mongoose = require('mongoose');

const ipRegistrySchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  registrations: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String
  }
});

const IPRegistry = mongoose.model('IPRegistry', ipRegistrySchema);
module.exports = IPRegistry;
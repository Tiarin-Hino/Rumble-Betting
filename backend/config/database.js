// config/database.js
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection URL (from environment variable or default)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/virtual_betting';

// Connection options
const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000
}
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Connect to MongoDB with retry logic
const connectWithRetry = () => {
  console.log('Attempting to connect to MongoDB...');
  
  mongoose.connect(MONGODB_URI, connectOptions)
    .then(() => {
      console.log('Connected to MongoDB successfully');
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      console.log('Retrying connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

// Initial connection
connectWithRetry();

// Handle connection events
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected, attempting to reconnect...');
  connectWithRetry();
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});

module.exports = mongoose;
// ipRateLimit.js - With optional Redis fallback to memory
require('dotenv').config();
const Redis = require('ioredis');

// Configuration for IP rate limiting
const IP_REGISTRATION_LIMIT = parseInt(process.env.IP_REGISTRATION_LIMIT) || 2; // Max accounts per IP
const IP_TRACKING_DURATION = parseInt(process.env.IP_TRACKING_DURATION) || 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// In-memory fallback registry
const memoryRegistry = {};

// Try to connect to Redis if available, otherwise use memory storage
let redis = null;
let useRedis = false;

try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log('Attempting to connect to Redis at:', redisUrl);
  
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    retryStrategy: (times) => {
      if (times > 3) {
        console.log('Redis connection failed after 3 retries, using in-memory storage');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000); // Time between retries
    }
  });
  
  // Set a flag to track Redis availability
  let redisAvailable = false;
  
  redis.on('connect', () => {
    console.log('Successfully connected to Redis');
    redisAvailable = true;
    useRedis = true;
  });
  
  redis.on('error', (err) => {
    if (redisAvailable) {
      console.error('Redis connection lost:', err);
      redisAvailable = false;
      useRedis = false;
    } else {
      console.log('Redis not available, using in-memory storage for IP rate limiting');
      // Only log once to avoid spamming the console
      redis.disconnect();
      redis = null;
      useRedis = false;
    }
  });
} catch (error) {
  console.log('Redis initialization failed, using in-memory storage for IP rate limiting:', error.message);
  useRedis = false;
}

// Regular memory cleanup to prevent memory leaks (only if using memory storage)
setInterval(() => {
  if (!useRedis) {
    const now = Date.now();
    Object.keys(memoryRegistry).forEach(ip => {
      // Clean up old timestamps
      if (memoryRegistry[ip] && memoryRegistry[ip].timestamps) {
        memoryRegistry[ip].timestamps = memoryRegistry[ip].timestamps.filter(
          timestamp => now - timestamp < IP_TRACKING_DURATION
        );
        
        // Update count based on valid timestamps
        memoryRegistry[ip].count = memoryRegistry[ip].timestamps.length;
        
        // Remove IP from registry if no valid timestamps left
        if (memoryRegistry[ip].timestamps.length === 0) {
          delete memoryRegistry[ip];
        }
      }
    });
  }
}, 3600000); // Run cleanup every hour

// Get client IP address (including forwarded IPs from proxies)
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Track IP registration
const trackIPRegistration = async (ip) => {
  try {
    const now = Date.now();
    
    if (useRedis && redis) {
      // Redis implementation
      const key = `ip_reg:${ip}`;
      
      // Get existing data
      const data = await redis.get(key);
      let ipData = data ? JSON.parse(data) : { count: 0, timestamps: [] };
      
      // Add new registration
      ipData.count++;
      ipData.timestamps.push(now);
      
      // Clean up old timestamps
      ipData.timestamps = ipData.timestamps.filter(
        timestamp => now - timestamp < IP_TRACKING_DURATION
      );
      
      // Update count based on valid timestamps
      ipData.count = ipData.timestamps.length;
      
      // Save back to Redis with expiration
      await redis.set(key, JSON.stringify(ipData), 'EX', Math.floor(IP_TRACKING_DURATION / 1000));
      
      return ipData.count;
    } else {
      // Memory implementation fallback
      if (!memoryRegistry[ip]) {
        memoryRegistry[ip] = {
          count: 1,
          timestamps: [now]
        };
      } else {
        // Add new registration
        memoryRegistry[ip].count++;
        memoryRegistry[ip].timestamps.push(now);
        
        // Clean up old timestamps
        memoryRegistry[ip].timestamps = memoryRegistry[ip].timestamps.filter(
          timestamp => now - timestamp < IP_TRACKING_DURATION
        );
        
        // Update count based on valid timestamps
        memoryRegistry[ip].count = memoryRegistry[ip].timestamps.length;
      }
      
      return memoryRegistry[ip].count;
    }
  } catch (error) {
    // Log error but don't fail the request
    console.error('Error tracking IP registration:', error);
    return 1; // Return minimum count if tracking fails
  }
};

// Check if IP has exceeded registration limit
const checkIPLimit = async (ip) => {
  try {
    if (useRedis && redis) {
      // Redis implementation
      const key = `ip_reg:${ip}`;
      const data = await redis.get(key);
      
      if (!data) return false;
      
      const ipData = JSON.parse(data);
      const now = Date.now();
      
      // Clean old timestamps
      ipData.timestamps = ipData.timestamps.filter(
        timestamp => now - timestamp < IP_TRACKING_DURATION
      );
      
      // Update count after cleanup
      ipData.count = ipData.timestamps.length;
      
      // Save cleaned data
      await redis.set(key, JSON.stringify(ipData), 'EX', Math.floor(IP_TRACKING_DURATION / 1000));
      
      // Check if exceeded limit
      return ipData.count >= IP_REGISTRATION_LIMIT;
    } else {
      // Memory implementation fallback
      if (!memoryRegistry[ip]) return false;
      
      // Clean old timestamps
      const now = Date.now();
      memoryRegistry[ip].timestamps = memoryRegistry[ip].timestamps.filter(
        timestamp => now - timestamp < IP_TRACKING_DURATION
      );
      
      // Update count after cleanup
      memoryRegistry[ip].count = memoryRegistry[ip].timestamps.length;
      
      // Check if exceeded limit
      return memoryRegistry[ip].count >= IP_REGISTRATION_LIMIT;
    }
  } catch (error) {
    // Log error but don't block registration if checking fails
    console.error('Error checking IP limit:', error);
    return false;
  }
};

// Middleware to limit registrations per IP
const registrationLimiter = async (req, res, next) => {
  const ip = getClientIP(req);
  
  try {
    // Check if IP has reached limit
    if (await checkIPLimit(ip)) {
      return res.status(429).json({ 
        error: 'Too many accounts created from this IP address',
        message: 'Maximum registration limit reached for your network'
      });
    }
    
    // Store IP in request for later tracking
    req.clientIP = ip;
    next();
  } catch (error) {
    console.error('IP rate limiting error:', error);
    // Don't block registration if rate limiting fails
    req.clientIP = ip;
    next();
  }
};

// Function to store IP registration in the database
const storeIPRegistration = async (ip, userId, dbModel) => {
  try {
    // First track in Redis/memory
    await trackIPRegistration(ip);
    
    // Then store in database for persistence and admin lookup
    let ipRecord = await dbModel.findOne({ ip });
    
    if (!ipRecord) {
      ipRecord = new dbModel({
        ip,
        registrations: [{ userId, timestamp: new Date() }]
      });
    } else {
      ipRecord.registrations.push({ userId, timestamp: new Date() });
    }
    
    await ipRecord.save();
    return true;
  } catch (error) {
    console.error('Error storing IP registration:', error);
    return false;
  }
};

module.exports = {
  getClientIP,
  trackIPRegistration,
  checkIPLimit,
  registrationLimiter,
  storeIPRegistration
};
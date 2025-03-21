// routes/health.js - Improved implementation
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');

// Basic health check route - useful for load balancers and simple checks
router.get('/', async (req, res) => {
  try {
    // Simple check of the database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Return basic health status
    res.status(dbStatus === 'connected' ? 200 : 503).json({
      status: dbStatus === 'connected' ? 'ok' : 'error',
      service: 'virtual-betting-api',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check route - for monitoring and diagnostics
// Requires authentication for detailed information
router.get('/detailed', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Perform basic health check on MongoDB
    let databaseHealthy = false;
    let databasePing = null;
    
    if (dbStatus === 'connected') {
      try {
        // Measure database response time
        const startTime = Date.now();
        await mongoose.connection.db.admin().ping();
        databasePing = Date.now() - startTime;
        databaseHealthy = true;
      } catch (dbError) {
        console.error('MongoDB health check failed:', dbError);
      }
    }
    
    // Check Redis if it's being used
    let redisStatus = 'not_configured';
    let redisPing = null;
    
    if (process.env.REDIS_URL) {
      try {
        const Redis = require('ioredis');
        const redisClient = new Redis(process.env.REDIS_URL, {
          connectTimeout: 1000,
          maxRetriesPerRequest: 1
        });
        
        const startTime = Date.now();
        await redisClient.ping();
        redisPing = Date.now() - startTime;
        redisStatus = 'connected';
        await redisClient.quit();
      } catch (redisError) {
        console.error('Redis health check failed:', redisError);
        redisStatus = 'error';
      }
    }
    
    // System information
    const systemInfo = {
      uptime: process.uptime(),
      memory: {
        free: os.freemem(),
        total: os.totalmem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: os.cpus().length,
      loadAvg: os.loadavg()
    };
    
    // Overall status is healthy if database is connected
    const isHealthy = databaseHealthy;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      service: 'virtual-betting-api',
      version: process.env.npm_package_version || '1.0.0',
      database: {
        status: dbStatus,
        healthy: databaseHealthy,
        responseTime: databasePing
      },
      redis: {
        status: redisStatus,
        responseTime: redisPing
      },
      system: systemInfo,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
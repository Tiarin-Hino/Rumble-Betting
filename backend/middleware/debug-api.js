// Add this to a file like debug-api.js and include it in your server.js
// This will help diagnose and fix the 504 timeout issues

// Enhanced error handling middleware
const enhancedErrorHandler = (err, req, res, next) => {
    console.error('API ERROR:', err);
    console.error('Request path:', req.path);
    console.error('Request method:', req.method);
    console.error('Request body:', req.body);
    console.error('Request headers:', req.headers);
    console.error('Stack trace:', err.stack);
    
    // Check for timeout errors
    if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'Request timed out',
        code: 'TIMEOUT_ERROR',
        message: 'The server took too long to process your request'
      });
    }
    
    // Check for validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: Object.values(err.errors).map(e => e.message)
      });
    }
    
    // Custom API Error
    if (err.isApiError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        details: err.details
      });
    }
    
    // Cast Errors (e.g., invalid ObjectId)
    if (err.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid data format',
        field: err.path,
        details: err.message
      });
    }
    
    // Duplicate Key Error
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({
        error: 'Duplicate value',
        field,
        details: `${field} already exists`
      });
    }
    
    // Default server error
    return res.status(500).json({
      error: 'Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
      requestId: req.requestId || 'unknown'
    });
  };
  
  // Request logging middleware
  const requestLogger = (req, res, next) => {
    // Generate a unique request ID
    req.requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    console.log(`[${req.requestId}] ${req.method} ${req.url}`);
    
    // For POST/PUT requests, log the body
    if (['POST', 'PUT'].includes(req.method) && req.body) {
      const sanitizedBody = { ...req.body };
      // Remove sensitive fields
      if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
      console.log(`[${req.requestId}] Request body:`, sanitizedBody);
    }
  
    // Log response
    const originalSend = res.send;
    res.send = function(body) {
      // Log the response
      try {
        // Try to parse JSON responses
        const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
        console.log(`[${req.requestId}] Response:`, 
          parsedBody && typeof parsedBody === 'object' ? 
            { status: res.statusCode, data: parsedBody } : 
            { status: res.statusCode, type: typeof body });
      } catch (err) {
        // For non-JSON responses
        console.log(`[${req.requestId}] Response: status=${res.statusCode}, type=${typeof body}`);
      }
      originalSend.call(this, body);
    };
  
    // Track response time
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${req.requestId}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`[${req.requestId}] SLOW REQUEST: ${req.method} ${req.url} - ${duration}ms`);
      }
    });
  
    next();
  };
  
  // Timeout middleware to prevent hanging requests
  const timeoutMiddleware = (timeout = 30000) => (req, res, next) => {
    // Set a timeout for the request
    req.setTimeout(timeout, () => {
      const err = new Error('Request timeout');
      err.name = 'TimeoutError';
      next(err);
    });
    next();
  };
  
  // Fix for bet route - direct implementation
  const fixBetRoute = (router) => {
    router.post('/', async (req, res) => {
      console.log('Received bet request:', req.body);
      
      try {
        // Validate that we have the required fields
        const { eventId, selection, amount } = req.body;
        
        if (!eventId || !selection || !amount) {
          console.error('Missing required fields:', { eventId, selection, amount });
          return res.status(400).json({ 
            error: 'Missing required fields',
            details: 'eventId, selection, and amount are required'
          });
        }
        
        // Check authentication
        if (!req.user) {
          console.error('User not authenticated');
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Check if user has enough coins
        if (req.user.coins < amount) {
          console.error('Insufficient coins', { available: req.user.coins, requested: amount });
          return res.status(400).json({ error: 'Insufficient coins' });
        }
  
        // Process the bet without transactions (to avoid timeouts)
        // Find the event
        const Event = require('../models/event');
        const event = await Event.findById(eventId);
        
        if (!event) {
          console.error('Event not found:', eventId);
          return res.status(404).json({ error: 'Event not found' });
        }
        
        // Check if event is accepting bets
        if (event.status !== 'upcoming' && event.status !== 'active') {
          console.error('Event not accepting bets:', event.status);
          return res.status(400).json({ error: 'Event is not accepting bets' });
        }
        
        // Find the selected option
        const option = event.options.find(opt => opt.name === selection);
        if (!option) {
          console.error('Invalid betting option:', selection);
          return res.status(400).json({ error: 'Invalid betting option' });
        }
        
        // Calculate potential win
        const odds = option.odds;
        const potentialWin = Math.round(amount * odds);
        
        // Deduct coins from user
        req.user.coins -= amount;
        await req.user.save();
        
        // Create bet record
        const Bet = require('../models/bet');
        const newBet = new Bet({
          userId: req.user._id,
          eventId: event._id,
          selection: selection,
          amount: amount,
          odds: odds,
          potentialWin: potentialWin,
          status: 'active'
        });
        
        // Save the bet
        await newBet.save();
        
        // Update event statistics (do this asynchronously)
        event.totalBetAmount = (event.totalBetAmount || 0) + amount;
        const teamBetAmount = event.teamBetAmounts.get(selection) || 0;
        event.teamBetAmounts.set(selection, teamBetAmount + amount);
        event.save().catch(err => console.error('Error updating event stats:', err));
        
        // Send success response
        res.status(201).json({
          message: 'Bet placed successfully',
          bet: {
            id: newBet._id,
            eventId,
            selection,
            amount,
            odds,
            potentialWin,
            status: 'active',
            createdAt: newBet.createdAt
          },
          userCoins: req.user.coins
        });
        
        // Recalculate odds asynchronously (don't wait for it)
        try {
          event.recalculateOdds().catch(err => {
            console.error('Error recalculating odds (non-fatal):', err);
          });
        } catch (oddsError) {
          console.error('Error starting odds recalculation:', oddsError);
        }
        
      } catch (error) {
        console.error('Error processing bet:', error);
        res.status(500).json({ 
          error: 'Server error processing bet',
          message: error.message
        });
      }
    });
    
    return router;
  };
  
  // Install in your server.js
  module.exports = {
    enhancedErrorHandler,
    requestLogger,
    timeoutMiddleware,
    fixBetRoute
  };
  
  // Usage example in server.js:
  /*
  const { enhancedErrorHandler, requestLogger, timeoutMiddleware, fixBetRoute } = require('./debug-api');
  
  // Apply these early in your middleware chain
  app.use(requestLogger);
  app.use(timeoutMiddleware(30000)); // 30 second timeout
  
  // Add the fixed bet route
  const betRoutes = require('./routes/bets');
  fixBetRoute(betRoutes);
  app.use('/api/bets', betRoutes);
  
  // Add error handler as the last middleware
  app.use(enhancedErrorHandler);
  */
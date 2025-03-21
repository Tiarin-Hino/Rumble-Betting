// routes/events.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Event = require('../models/event');
const Bet = require('../models/bet');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// ========== PUBLIC ROUTES ==========

// Get all events with filtering
router.get('/', async (req, res) => {
  try {
    // Parse query parameters
    const eventType = req.query.type; // 'overallWinner' or 'match'
    const status = req.query.status; // 'upcoming', 'active', 'finished', 'cancelled'
    const tournamentId = req.query.tournament; // filter by tournament
    
    // Build filter
    const filter = {};
    
    if (eventType && ['overallWinner', 'match'].includes(eventType)) {
      filter.eventType = eventType;
    }
    
    if (status && ['upcoming', 'active', 'finished', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    
    if (tournamentId) {
      filter.tournamentId = tournamentId;
    }
    
    // Execute query with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const events = await Event.find(filter)
      .sort({ eventDate: 1 })
      .skip(skip)
      .limit(limit)
      .populate('tournamentId', 'name status');
    
    const total = await Event.countDocuments(filter);
    
    res.status(200).json({
      events,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Server error retrieving events' });
  }
});

// Get active events
router.get('/active', async (req, res) => {
  try {
    const events = await Event.find({
      status: { $in: ['upcoming', 'active'] },
      eventDate: { $gte: new Date() }
    })
    .sort({ eventDate: 1 })
    .populate('tournamentId', 'name status');
    
    res.status(200).json({ events });
  } catch (error) {
    console.error('Get active events error:', error);
    res.status(500).json({ error: 'Server error retrieving active events' });
  }
});

// Get event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('tournamentId', 'name status teams');
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.status(200).json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Server error retrieving event' });
  }
});

// ========== AUTHENTICATED USER ROUTES ==========

// Place a bet
router.post('/:id/bet', isAuthenticated, [
  body('selection').notEmpty().withMessage('Selection is required'),
  body('amount').isInt({ min: 10 }).withMessage('Bet amount must be at least 10 coins')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const eventId = req.params.id;
    const { selection, amount } = req.body;
    const user = req.user;
    
    // Place bet
    const result = await Bet.placeBet({
      eventId,
      selection,
      amount
    }, user);
    
    res.status(201).json({
      message: 'Bet placed successfully',
      bet: result.bet,
      userCoins: result.userCoins
    });
  } catch (error) {
    console.error('Place bet error:', error);
    res.status(400).json({ error: error.message || 'Failed to place bet' });
  }
});

// Get user's bets for an event
router.get('/:id/my-bets', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user._id;
    
    const bets = await Bet.find({
      userId,
      eventId
    }).sort({ createdAt: -1 });
    
    res.status(200).json({ bets });
  } catch (error) {
    console.error('Get my event bets error:', error);
    res.status(500).json({ error: 'Server error retrieving bets' });
  }
});

// ========== ADMIN ROUTES ==========

// Update event general information
router.put('/:id', isAdmin, [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().isString(),
  body('eventDate').optional().isISO8601().withMessage('Valid event date is required'),
  body('status').optional().isIn(['upcoming', 'active', 'finished', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if event is finished
    if (event.status === 'finished' && req.body.status !== 'finished') {
      return res.status(400).json({ error: 'Cannot modify a finished event' });
    }
    
    // Update fields
    const allowedUpdates = ['title', 'description', 'eventDate', 'status'];
    
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        if (field === 'eventDate') {
          event[field] = new Date(req.body[field]);
        } else {
          event[field] = req.body[field];
        }
      }
    }
    
    await event.save();
    
    res.status(200).json({
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Server error updating event' });
  }
});

// Update event betting options and odds
router.put('/:id/options', isAdmin, [
  body('options').isArray({ min: 1 }).withMessage('At least one option is required'),
  body('options.*.name').notEmpty().withMessage('Option name is required'),
  body('options.*.odds').isFloat({ min: 1.01 }).withMessage('Odds must be at least 1.01')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if event is finished
    if (event.status === 'finished') {
      return res.status(400).json({ error: 'Cannot modify options for a finished event' });
    }
    
    // For match events, verify we have the correct options
    if (event.eventType === 'match') {
      const requiredOptions = [event.matchTeams.team1, event.matchTeams.team2, 'Draw'];
      
      // Verify all required options are present
      for (const required of requiredOptions) {
        if (!req.body.options.some(opt => opt.name === required)) {
          return res.status(400).json({ 
            error: `Match events must include options for ${requiredOptions.join(', ')}`
          });
        }
      }
    }
    
    // Update options
    event.options = req.body.options;
    
    // Initialize teamBetAmounts for new options
    req.body.options.forEach(option => {
      if (!event.teamBetAmounts.has(option.name)) {
        event.teamBetAmounts.set(option.name, 0);
      }
    });
    
    await event.save();
    
    res.status(200).json({
      message: 'Event options updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event options error:', error);
    res.status(500).json({ error: 'Server error updating event options' });
  }
});

// Set event result directly (for special cases)
router.post('/:id/result', isAdmin, [
  body('result').notEmpty().withMessage('Result is required')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Verify the result is a valid option
    const isValidOption = event.options.some(opt => opt.name === req.body.result);
    
    if (!isValidOption) {
      return res.status(400).json({ error: 'Result must be one of the event options' });
    }
    
    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Update event
      event.result = req.body.result;
      event.status = 'finished';
      
      // For match events, also set the score if provided
      if (event.eventType === 'match' && req.body.score) {
        event.score = req.body.score;
      }
      
      await event.save({ session });
      
      // Settle bets
      await Bet.settleEventBets(event._id, session);
      
      await session.commitTransaction();
      
      res.status(200).json({
        message: 'Event result set successfully',
        event
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Set event result error:', error);
    res.status(500).json({ error: error.message || 'Server error setting event result' });
  }
});

// Get admin bet statistics for an event
router.get('/:id/admin/stats', isAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get bet statistics
    const bets = await Bet.find({ eventId: event._id });
    
    // Calculate statistics
    const statistics = {
      totalBets: bets.length,
      totalAmount: bets.reduce((sum, bet) => sum + bet.amount, 0),
      potentialPayout: bets.reduce((sum, bet) => {
        return bet.status === 'active' ? sum + bet.potentialWin : sum;
      }, 0),
      byStatus: {
        active: bets.filter(bet => bet.status === 'active').length,
        won: bets.filter(bet => bet.status === 'won').length,
        lost: bets.filter(bet => bet.status === 'lost').length,
        cancelled: bets.filter(bet => bet.status === 'cancelled').length
      },
      byOption: {}
    };
    
    // Calculate bets by option
    for (const option of event.options) {
      const optionBets = bets.filter(bet => bet.selection === option.name);
      statistics.byOption[option.name] = {
        count: optionBets.length,
        amount: optionBets.reduce((sum, bet) => sum + bet.amount, 0),
        potentialPayout: optionBets.reduce((sum, bet) => {
          return bet.status === 'active' ? sum + bet.potentialWin : sum;
        }, 0)
      };
    }
    
    res.status(200).json({
      event: {
        id: event._id,
        title: event.title,
        status: event.status,
        result: event.result
      },
      statistics
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({ error: 'Server error retrieving event statistics' });
  }
});

module.exports = router;
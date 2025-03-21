const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const Event = require('../models/event');
const Bet = require('../models/bet');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

// Function to recalculate odds based on betting volume
// bets.js - Improved recalculateOdds function
async function recalculateOdds(eventId) {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Find the event with session
    const event = await Event.findById(eventId).session(session);
    
    if (!event) {
      throw new Error('Event not found for odds recalculation');
    }
    
    // Get all bets for this event
    const bets = await Bet.find({ 
      eventId: event._id,
      status: 'active'
    }).session(session);
    
    // Calculate total amount bet on each option
    const optionTotals = {};
    let totalBetAmount = 0;
    
    // Initialize totals for each option
    event.options.forEach(option => {
      optionTotals[option.name] = 0;
    });
    
    // Sum up bets for each option
    bets.forEach(bet => {
      if (optionTotals.hasOwnProperty(bet.option)) {
        optionTotals[bet.option] += bet.amount;
        totalBetAmount += bet.amount;
      }
    });
    
    // Skip recalculation if there are no bets or very low bet volume
    if (totalBetAmount < 100) {
      await session.commitTransaction();
      session.endSession();
      return;
    }
    
    // Recalculate odds based on betting distribution
    // Using a simplified market-based odds calculation
    const houseEdgePercent = 5; // 5% house edge
    const houseEdgeMultiplier = 1 + (houseEdgePercent / 100);
    
    event.options.forEach((option, index) => {
      const amountOnOption = optionTotals[option.name];
      
      // Calculate fair odds based on betting distribution
      // Adding house edge to ensure profit
      if (amountOnOption > 0 && totalBetAmount > 0) {
        const probability = amountOnOption / totalBetAmount;
        const fairOdds = 1 / probability;
        const adjustedOdds = fairOdds / houseEdgeMultiplier;
        
        // Clamp odds to reasonable values (1.01 to 100)
        event.options[index].odds = Math.max(1.01, Math.min(100, adjustedOdds.toFixed(2)));
      }
    });
    
    // Save updated odds to event
    await event.save({ session });
    await session.commitTransaction();
    
    console.log(`Odds recalculated for event: ${event.title}`);
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Error recalculating odds:', error);
  } finally {
    session.endSession();
  }
}

// Place a bet with proper transaction support
router.post('/', isAuthenticated, [
  body('eventId').notEmpty().withMessage('Event ID is required'),
  body('option').notEmpty().withMessage('Betting option is required'),
  body('amount').isInt({ min: 10 }).withMessage('Bet amount must be at least 10 coins')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { eventId, option, amount } = req.body;
  const userId = req.user._id;
  
  // Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find event within transaction
    const event = await Event.findById(eventId).session(session);
    
    if (!event) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if event is available for betting
    if (event.status !== 'upcoming' && event.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Event is not available for betting' });
    }
    
    // Check if betting option is valid
    const selectedOption = event.options.find(opt => opt.name === option);
    
    if (!selectedOption) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid betting option' });
    }
    
    // Get user with session to ensure latest data
    const user = await User.findById(userId).session(session);
    
    // Check if user has enough coins
    if (user.coins < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Insufficient coins' });
    }
    
    // Calculate potential win
    const odds = selectedOption.odds;
    const potentialWin = Math.round(amount * odds);
    
    // Create bet
    const newBet = new Bet({
      userId,
      eventId,
      option,
      amount,
      odds,
      potentialWin,
      status: 'active'
    });
    
    // Deduct coins from user
    user.coins -= amount;
    await user.save({ session });
    
    // Save bet
    await newBet.save({ session });
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // Recalculate odds for the event (outside transaction)
    await recalculateOdds(eventId);
    
    res.status(201).json({
      message: 'Bet placed successfully',
      bet: {
        id: newBet._id,
        eventId,
        option,
        amount,
        odds,
        potentialWin,
        status: 'active',
        createdAt: newBet.createdAt
      },
      userCoins: user.coins
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Place bet error:', error);
    res.status(500).json({ error: 'Server error placing bet' });
  }
});

// Get user's bets
router.get('/my-bets', isAuthenticated, async (req, res) => {
  try {
    const bets = await Bet.find({ userId: req.user._id })
      .populate('eventId', 'title eventDate status result')
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.status(200).json({ bets });
  } catch (error) {
    console.error('Get user bets error:', error);
    res.status(500).json({ error: 'Server error retrieving bets' });
  }
});

// Get user's active bets
router.get('/my-bets/active', isAuthenticated, async (req, res) => {
  try {
    const bets = await Bet.find({ 
      userId: req.user._id,
      status: 'active'
    })
    .populate('eventId', 'title eventDate status result')
    .sort({ createdAt: -1 })
    .select('-__v');
    
    res.status(200).json({ bets });
  } catch (error) {
    console.error('Get active bets error:', error);
    res.status(500).json({ error: 'Server error retrieving active bets' });
  }
});

// Get user's historical bets
router.get('/my-bets/history', isAuthenticated, async (req, res) => {
  try {
    const bets = await Bet.find({ 
      userId: req.user._id,
      status: { $in: ['won', 'lost'] }
    })
    .populate('eventId', 'title eventDate status result')
    .sort({ createdAt: -1 })
    .select('-__v');
    
    res.status(200).json({ bets });
  } catch (error) {
    console.error('Get bet history error:', error);
    res.status(500).json({ error: 'Server error retrieving bet history' });
  }
});

// Get bet by ID
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const bet = await Bet.findById(req.params.id)
      .populate('eventId', 'title eventDate status result options')
      .select('-__v');
    
    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }
    
    // Check if bet belongs to user
    if (bet.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized access to bet' });
    }
    
    res.status(200).json({ bet });
  } catch (error) {
    console.error('Get bet error:', error);
    res.status(500).json({ error: 'Server error retrieving bet' });
  }
});

// Admin: Settle all bets for an event
router.post('/admin/settle/:eventId', isAdmin, async (req, res) => {
  try {
    // Find event
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if event is finished
    if (event.status !== 'finished') {
      return res.status(400).json({ error: 'Cannot settle bets for an unfinished event' });
    }
    
    // Check if event has a result
    if (!event.result) {
      return res.status(400).json({ error: 'Event does not have a result' });
    }
    
    // Get all active bets for this event
    const bets = await Bet.find({
      eventId: event._id,
      status: 'active'
    });
    
    // Process each bet
    const results = {
      totalBets: bets.length,
      settledBets: 0,
      winningBets: 0,
      losingBets: 0
    };
    
    for (const bet of bets) {
      // Check if bet matches the result
      const isWinner = bet.option === event.result;
      
      // Update bet status
      bet.status = isWinner ? 'won' : 'lost';
      bet.settledAt = new Date();
      await bet.save();
      
      // If bet is a winner, credit the user
      if (isWinner) {
        const user = await User.findById(bet.userId);
        
        if (user) {
          user.coins += bet.potentialWin;
          await user.save();
        }
        
        results.winningBets++;
      } else {
        results.losingBets++;
      }
      
      results.settledBets++;
    }
    
    res.status(200).json({
      message: 'Bets settled successfully',
      results
    });
  } catch (error) {
    console.error('Settle bets error:', error);
    res.status(500).json({ error: 'Server error settling bets' });
  }
});

// Admin: Get all bets for an event
router.get('/admin/event/:eventId', isAdmin, async (req, res) => {
  try {
    const bets = await Bet.find({ eventId: req.params.eventId })
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.status(200).json({ 
      eventId: req.params.eventId,
      betsCount: bets.length,
      bets 
    });
  } catch (error) {
    console.error('Get event bets error:', error);
    res.status(500).json({ error: 'Server error retrieving event bets' });
  }
});

// Admin: Get summary of bets for an event
router.get('/admin/event/:eventId/summary', isAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get all bets for this event
    const bets = await Bet.find({ eventId: req.params.eventId });
    
    // Calculate totals for each option
    const optionsTotals = {};
    
    // Initialize totals for each option
    event.options.forEach(option => {
      optionsTotals[option.name] = {
        count: 0,
        amount: 0,
        potentialPayout: 0
      };
    });
    
    // Sum up bets for each option
    bets.forEach(bet => {
      if (optionsTotals[bet.option]) {
        optionsTotals[bet.option].count++;
        optionsTotals[bet.option].amount += bet.amount;
        optionsTotals[bet.option].potentialPayout += bet.potentialWin;
      }
    });
    
    // Calculate overall totals
    const totalBets = bets.length;
    const totalAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const potentialPayouts = bets.reduce((sum, bet) => sum + bet.potentialWin, 0);
    
    res.status(200).json({
      eventId: req.params.eventId,
      title: event.title,
      status: event.status,
      result: event.result,
      totalBets,
      totalAmount,
      potentialPayouts,
      optionsTotals
    });
  } catch (error) {
    console.error('Get event summary error:', error);
    res.status(500).json({ error: 'Server error retrieving event summary' });
  }
});

// Cancel a bet (only if event hasn't started)
router.post('/:id/cancel', isAuthenticated, async (req, res) => {
  try {
    // Find bet
    const bet = await Bet.findById(req.params.id);
    
    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }
    
    // Check if bet belongs to user
    if (bet.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized access to bet' });
    }
    
    // Check if bet can be cancelled
    if (bet.status !== 'active') {
      return res.status(400).json({ error: 'Only active bets can be cancelled' });
    }
    
    // Find event to check its status
    const event = await Event.findById(bet.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if event has started
    if (event.status !== 'upcoming') {
      return res.status(400).json({ error: 'Cannot cancel bet after event has started' });
    }
    
    // Cancel bet
    bet.status = 'cancelled';
    await bet.save();
    
    // Refund coins to user
    req.user.coins += bet.amount;
    await req.user.save();
    
    res.status(200).json({
      message: 'Bet cancelled successfully',
      refundAmount: bet.amount,
      userCoins: req.user.coins
    });
  } catch (error) {
    console.error('Cancel bet error:', error);
    res.status(500).json({ error: 'Server error cancelling bet' });
  }
});

module.exports = router;
module.exports = recalculateOdds;
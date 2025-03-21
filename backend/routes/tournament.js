// routes/tournaments.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Tournament = require('../models/tournament');
const Event = require('../models/event');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// ========== PUBLIC ROUTES ==========

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    // Parse query parameters
    const status = req.query.status; // Filter by status
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    if (status && ['upcoming', 'active', 'finished', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    
    // Execute query with pagination
    const tournaments = await Tournament.find(filter)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Tournament.countDocuments(filter);
    
    res.status(200).json({
      tournaments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ error: 'Server error retrieving tournaments' });
  }
});

// Get tournament by ID
router.get('/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get the overall winner event
    const overallWinnerEvent = await Event.findById(tournament.overallWinnerEventId);
    
    // Get match events for this tournament
    const matches = await Event.find({
      tournamentId: tournament._id,
      eventType: 'match'
    }).sort({ eventDate: 1 });
    
    res.status(200).json({
      tournament,
      overallWinnerEvent,
      matches
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({ error: 'Server error retrieving tournament' });
  }
});

// Get overall winner event for a tournament
router.get('/:id/overall-winner', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const overallWinnerEvent = await Event.findById(tournament.overallWinnerEventId);
    
    if (!overallWinnerEvent) {
      return res.status(404).json({ error: 'Overall winner event not found' });
    }
    
    res.status(200).json({ event: overallWinnerEvent });
  } catch (error) {
    console.error('Get overall winner event error:', error);
    res.status(500).json({ error: 'Server error retrieving event' });
  }
});

// Get matches for a tournament
router.get('/:id/matches', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get match events for this tournament with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {
      tournamentId: tournament._id,
      eventType: 'match'
    };
    
    // Add status filter if provided
    if (req.query.status && ['upcoming', 'active', 'finished', 'cancelled'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    
    const matches = await Event.find(filter)
      .sort({ eventDate: 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Event.countDocuments(filter);
    
    res.status(200).json({
      tournament: {
        id: tournament._id,
        name: tournament.name,
        status: tournament.status
      },
      matches,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get tournament matches error:', error);
    res.status(500).json({ error: 'Server error retrieving matches' });
  }
});

// ========== ADMIN ROUTES ==========

// Create a new tournament
router.post('/', isAdmin, [
  body('name').notEmpty().withMessage('Tournament name is required'),
  body('description').optional().isString(),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required')
    .custom((value, { req }) => {
      // Ensure end date is after start date
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('teams').isArray({ min: 2 }).withMessage('At least 2 teams are required'),
  body('teams.*.name').notEmpty().withMessage('Team name is required')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { name, description, startDate, endDate, teams, status } = req.body;
    
    // Create tournament
    const tournament = new Tournament({
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      teams,
      status: status || 'upcoming'
    });
    
    await tournament.save();
    
    // The Overall Winner event is automatically created in the pre-save hook
    
    res.status(201).json({
      message: 'Tournament created successfully',
      tournament
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Server error creating tournament' });
  }
});

// Update tournament
router.put('/:id', isAdmin, [
  body('name').optional().notEmpty().withMessage('Tournament name cannot be empty'),
  body('description').optional().isString(),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('status').optional().isIn(['upcoming', 'active', 'finished', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Block updating a finished tournament
    if (tournament.status === 'finished' && req.body.status !== 'finished') {
      return res.status(400).json({ error: 'Cannot modify a finished tournament' });
    }
    
    // Update fields
    const allowedUpdates = ['name', 'description', 'startDate', 'endDate', 'status'];
    
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        // Convert date strings to Date objects
        if (field === 'startDate' || field === 'endDate') {
          tournament[field] = new Date(req.body[field]);
        } else {
          tournament[field] = req.body[field];
        }
      }
    }
    
    // Special handling for status change
    if (req.body.status === 'finished' && tournament.finalRankings.length === 0) {
      return res.status(400).json({ 
        error: 'Cannot mark tournament as finished without setting final rankings'
      });
    }
    
    await tournament.save();
    
    res.status(200).json({
      message: 'Tournament updated successfully',
      tournament
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({ error: 'Server error updating tournament' });
  }
});

// Add/update teams in a tournament
router.put('/:id/teams', isAdmin, [
  body('teams').isArray({ min: 2 }).withMessage('At least 2 teams are required'),
  body('teams.*.name').notEmpty().withMessage('Team name is required'),
  body('teams.*.description').optional().isString(),
  body('teams.*.logo').optional().isString()
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Block updating teams for a finished tournament
    if (tournament.status === 'finished') {
      return res.status(400).json({ error: 'Cannot update teams for a finished tournament' });
    }
    
    // Update teams
    tournament.teams = req.body.teams;
    
    await tournament.save();
    
    // The Overall Winner event gets updated in the tournament pre-save hook
    
    res.status(200).json({
      message: 'Tournament teams updated successfully',
      tournament
    });
  } catch (error) {
    console.error('Update tournament teams error:', error);
    res.status(500).json({ error: 'Server error updating tournament teams' });
  }
});

// Set tournament results and finish it
router.post('/:id/results', isAdmin, [
  body('rankings').isArray({ min: 1 }).withMessage('Rankings are required'),
  body('rankings.*.rank').isInt({ min: 1 }).withMessage('Rank must be a positive integer'),
  body('rankings.*.teamName').notEmpty().withMessage('Team name is required')
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { rankings } = req.body;
    
    // Verify all ranks are unique
    const ranks = rankings.map(r => r.rank);
    if (new Set(ranks).size !== ranks.length) {
      return res.status(400).json({ error: 'Each team must have a unique rank' });
    }
    
    // Set results and settle bets
    const result = await Tournament.setResults(req.params.id, rankings);
    
    res.status(200).json({
      message: 'Tournament results set successfully',
      tournament: result.tournament
    });
  } catch (error) {
    console.error('Set tournament results error:', error);
    res.status(500).json({ error: error.message || 'Server error setting tournament results' });
  }
});

// Create a match within a tournament
router.post('/:id/matches', isAdmin, [
  body('title').optional().notEmpty().withMessage('Match title cannot be empty'),
  body('description').optional().isString(),
  body('eventDate').isISO8601().withMessage('Valid event date is required'),
  body('team1').notEmpty().withMessage('Team 1 is required'),
  body('team2').notEmpty().withMessage('Team 2 is required')
    .custom((value, { req }) => {
      // Ensure teams are different
      if (value === req.body.team1) {
        throw new Error('Team 2 must be different from Team 1');
      }
      return true;
    })
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Verify teams exist in tournament
    const team1Exists = tournament.teams.some(team => team.name === req.body.team1);
    const team2Exists = tournament.teams.some(team => team.name === req.body.team2);
    
    if (!team1Exists) {
      return res.status(400).json({ error: `Team "${req.body.team1}" not found in tournament` });
    }
    
    if (!team2Exists) {
      return res.status(400).json({ error: `Team "${req.body.team2}" not found in tournament` });
    }
    
    // Create match event
    const matchData = {
      title: req.body.title || `${req.body.team1} vs ${req.body.team2}`,
      description: req.body.description || `Match between ${req.body.team1} and ${req.body.team2}`,
      eventDate: new Date(req.body.eventDate),
      tournamentId: tournament._id,
      team1: req.body.team1,
      team2: req.body.team2,
      status: req.body.status || 'upcoming'
    };
    
    const match = await Event.createMatch(matchData);
    
    res.status(201).json({
      message: 'Match created successfully',
      match
    });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ error: error.message || 'Server error creating match' });
  }
});

// Set match result
router.post('/:tournamentId/matches/:matchId/result', isAdmin, [
  body('winner').notEmpty().withMessage('Winner is required'),
  body('score').optional().isString()
], async (req, res) => {
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { tournamentId, matchId } = req.params;
    const { winner, score } = req.body;
    
    // Verify tournament exists
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Set match result and settle bets
    const result = await Event.setMatchResult(matchId, winner, score);
    
    res.status(200).json({
      message: 'Match result set successfully',
      match: result.match
    });
  } catch (error) {
    console.error('Set match result error:', error);
    res.status(500).json({ error: error.message || 'Server error setting match result' });
  }
});

// Delete a tournament (handles all related events and bets)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Check if there are active bets
    const Bet = require('../models/bet');
    const activeBets = await Bet.countDocuments({
      tournamentId: tournament._id,
      status: 'active'
    });
    
    if (activeBets > 0) {
      return res.status(400).json({
        error: 'Cannot delete tournament with active bets',
        activeBets
      });
    }
    
    // Delete all events
    await Event.deleteMany({ tournamentId: tournament._id });
    
    // Delete tournament
    await Tournament.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      message: 'Tournament and all related events deleted successfully'
    });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({ error: 'Server error deleting tournament' });
  }
});

module.exports = router;
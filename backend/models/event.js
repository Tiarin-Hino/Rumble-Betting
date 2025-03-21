// models/event.js
const mongoose = require('mongoose');

// Event Schema
const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Type of event: 'overallWinner' or 'match'
  eventType: {
    type: String,
    enum: ['overallWinner', 'match'],
    required: true
  },
  // Link to parent tournament
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
    index: true
  },
  eventDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'finished', 'cancelled'],
    default: 'upcoming'
  },
  // Betting options
  options: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    odds: {
      type: Number,
      required: true,
      min: 1.01,
      default: 2.0
    }
  }],
  // For match events only
  matchTeams: {
    team1: {
      type: String,
      trim: true
    },
    team2: {
      type: String,
      trim: true
    }
  },
  result: {
    type: String,
    trim: true
  },
  // Score for match events
  score: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Betting statistics
  totalBetAmount: {
    type: Number,
    default: 0
  },
  teamBetAmounts: {
    type: Map,
    of: Number,
    default: {}
  }
});

// Add indexes for better performance
eventSchema.index({ tournamentId: 1, eventType: 1 });
eventSchema.index({ status: 1, eventDate: 1 });

// Pre-save middleware to verify match teams exist in tournament
eventSchema.pre('save', async function(next) {
  try {
    if (this.eventType === 'match') {
      // For match events, ensure both teams exist in tournament
      if (!this.matchTeams || !this.matchTeams.team1 || !this.matchTeams.team2) {
        return next(new Error('Match events require two teams'));
      }
      
      const Tournament = mongoose.model('Tournament');
      const tournament = await Tournament.findById(this.tournamentId);
      
      if (!tournament) {
        return next(new Error('Tournament not found'));
      }
      
      const team1Exists = tournament.teams.some(team => team.name === this.matchTeams.team1);
      const team2Exists = tournament.teams.some(team => team.name === this.matchTeams.team2);
      
      if (!team1Exists || !team2Exists) {
        return next(new Error('Both teams must exist in the tournament'));
      }
      
      // Check if options match match teams
      if (!this.options || this.options.length !== 3) {
        // Create default options for match: team1 win, team2 win, draw
        this.options = [
          { name: this.matchTeams.team1, odds: 2.0 },
          { name: this.matchTeams.team2, odds: 2.0 },
          { name: 'Draw', odds: 3.0 }
        ];
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Methods for recalculating odds
eventSchema.methods.recalculateOdds = async function() {
  // Skip if no bets placed
  if (this.totalBetAmount <= 0) return;
  
  const houseEdgePercent = 5; // 5% house edge
  const houseEdgeMultiplier = 1 + (houseEdgePercent / 100);
  
  // Recalculate odds for each option based on betting distribution
  this.options.forEach((option, index) => {
    const teamBetAmount = this.teamBetAmounts.get(option.name) || 0;
    
    if (teamBetAmount > 0 && this.totalBetAmount > 0) {
      const probability = teamBetAmount / this.totalBetAmount;
      const fairOdds = 1 / probability;
      const adjustedOdds = fairOdds / houseEdgeMultiplier;
      
      // Set new odds with constraints (1.01 to 100)
      this.options[index].odds = Math.max(1.01, Math.min(100, parseFloat(adjustedOdds.toFixed(2))));
    }
  });
  
  await this.save();
};

// Static methods
eventSchema.statics = {
  // Create a match event
  async createMatch(matchData) {
    const Tournament = mongoose.model('Tournament');
    const tournament = await Tournament.findById(matchData.tournamentId);
    
    if (!tournament) {
      throw new Error('Tournament not found');
    }
    
    // Verify teams exist in tournament
    const team1Exists = tournament.teams.some(team => team.name === matchData.team1);
    const team2Exists = tournament.teams.some(team => team.name === matchData.team2);
    
    if (!team1Exists || !team2Exists) {
      throw new Error('Both teams must exist in the tournament');
    }
    
    // Create match event
    const match = new this({
      title: matchData.title || `${matchData.team1} vs ${matchData.team2}`,
      description: matchData.description || `Match between ${matchData.team1} and ${matchData.team2}`,
      eventType: 'match',
      tournamentId: matchData.tournamentId,
      eventDate: matchData.eventDate,
      status: matchData.status || 'upcoming',
      matchTeams: {
        team1: matchData.team1,
        team2: matchData.team2
      },
      options: [
        { name: matchData.team1, odds: 2.0 },
        { name: matchData.team2, odds: 2.0 },
        { name: 'Draw', odds: 3.0 }
      ]
    });
    
    // Initialize team bet amounts
    match.teamBetAmounts.set(matchData.team1, 0);
    match.teamBetAmounts.set(matchData.team2, 0);
    match.teamBetAmounts.set('Draw', 0);
    
    return match.save();
  },
  
  // Set match result and settle bets
  async setMatchResult(matchId, winner, score) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find match
      const match = await this.findById(matchId).session(session);
      
      if (!match) {
        throw new Error('Match not found');
      }
      
      if (match.eventType !== 'match') {
        throw new Error('This operation is only valid for match events');
      }
      
      // Validate winner
      if (![match.matchTeams.team1, match.matchTeams.team2, 'Draw'].includes(winner)) {
        throw new Error('Invalid winner');
      }
      
      // Update match
      match.result = winner;
      match.score = score;
      match.status = 'finished';
      await match.save({ session });
      
      // Settle bets
      const Bet = mongoose.model('Bet');
      await Bet.settleEventBets(matchId, session);
      
      await session.commitTransaction();
      
      return {
        success: true,
        match
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },
  
  // Get events by tournament
  async getByTournament(tournamentId) {
    return this.find({ tournamentId }).sort({ eventDate: 1 });
  },
  
  // Get active events
  async getActive() {
    return this.find({
      status: { $in: ['upcoming', 'active'] },
      eventDate: { $gte: new Date() }
    }).sort({ eventDate: 1 });
  }
};

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
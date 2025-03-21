// models/tournament.js
const mongoose = require('mongoose');
const Event = require('./event');

// Tournament Schema
const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'finished', 'cancelled'],
    default: 'upcoming'
  },
  teams: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    logo: {
      type: String,
      trim: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Link to the automatically created Overall Winner event
  overallWinnerEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  // Final tournament results
  finalRankings: [{
    rank: {
      type: Number,
      required: true,
      min: 1
    },
    teamName: {
      type: String,
      required: true,
      trim: true
    }
  }]
});

// Pre-save middleware to create/update the Overall Winner event
tournamentSchema.pre('save', async function(next) {
  try {
    // If this is a new tournament or teams have been modified
    if (this.isNew || this.isModified('teams')) {
      // Create or update the Overall Winner event
      let overallEvent;
      
      if (this.overallWinnerEventId) {
        // Update existing event
        overallEvent = await Event.findById(this.overallWinnerEventId);
        
        if (!overallEvent) {
          // If for some reason the event was deleted, create a new one
          overallEvent = new Event({
            title: `${this.name} - Overall Winner`,
            description: `Bet on the overall winner of ${this.name}`,
            eventType: 'overallWinner',
            tournamentId: this._id,
            eventDate: this.endDate,
            status: this.status
          });
        }
      } else {
        // Create new Overall Winner event
        overallEvent = new Event({
          title: `${this.name} - Overall Winner`,
          description: `Bet on the overall winner of ${this.name}`,
          eventType: 'overallWinner',
          tournamentId: this._id,
          eventDate: this.endDate,
          status: this.status
        });
      }
      
      // Create betting options from tournament teams
      overallEvent.options = this.teams.map(team => ({
        name: team.name,
        odds: 2.0, // Default odds
        teamId: team._id
      }));
      
      // Save the event
      await overallEvent.save();
      
      // Store the event ID in the tournament
      this.overallWinnerEventId = overallEvent._id;
    }
    
    // If status has changed to 'finished', update the overall winner event
    if (this.isModified('status') && this.status === 'finished') {
      if (this.overallWinnerEventId) {
        await Event.findByIdAndUpdate(this.overallWinnerEventId, {
          status: 'finished'
        });
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Cascade delete events when tournament is deleted
tournamentSchema.pre('remove', async function(next) {
  try {
    // Delete all events related to this tournament
    await Event.deleteMany({ tournamentId: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

// Static methods
tournamentSchema.statics = {
  // Get active tournaments
  findActive() {
    return this.find({
      status: { $in: ['upcoming', 'active'] }
    }).sort({ startDate: 1 });
  },
  
  // Get tournaments with events
  async findWithEvents(query = {}) {
    const tournaments = await this.find(query).sort({ startDate: -1 });
    
    // Fetch events for each tournament
    const results = [];
    
    for (const tournament of tournaments) {
      const events = await Event.find({ tournamentId: tournament._id });
      
      results.push({
        ...tournament.toObject(),
        events: events.map(event => event.toObject())
      });
    }
    
    return results;
  },
  
  // Update tournament final rankings and settle the overall winner event
  async setResults(tournamentId, rankings) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Get tournament
      const tournament = await this.findById(tournamentId).session(session);
      
      if (!tournament) {
        throw new Error('Tournament not found');
      }
      
      // Validate rankings
      if (!rankings || !rankings.length) {
        throw new Error('Rankings are required');
      }
      
      // Ensure all teams in rankings exist in tournament
      for (const ranking of rankings) {
        const teamExists = tournament.teams.some(team => team.name === ranking.teamName);
        if (!teamExists) {
          throw new Error(`Team ${ranking.teamName} does not exist in tournament`);
        }
      }
      
      // Update tournament
      tournament.finalRankings = rankings;
      tournament.status = 'finished';
      await tournament.save({ session });
      
      // Update overall winner event
      if (tournament.overallWinnerEventId) {
        const overallEvent = await Event.findById(tournament.overallWinnerEventId).session(session);
        
        if (overallEvent) {
          overallEvent.status = 'finished';
          overallEvent.result = rankings[0].teamName; // The winner is rank 1
          await overallEvent.save({ session });
          
          // Settle bets for this event
          await Bet.settleEventBets(overallEvent._id, session);
        }
      }
      
      await session.commitTransaction();
      return { success: true, tournament };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
};

const Tournament = mongoose.model('Tournament', tournamentSchema);
module.exports = Tournament;
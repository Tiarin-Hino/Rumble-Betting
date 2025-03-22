// models/bet.js
const mongoose = require('mongoose');

// Bet Schema
const betSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
    index: true
  },
  // Team or outcome the user bet on
  selection: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 10
  },
  odds: {
    type: Number,
    required: true,
    min: 1.01
  },
  potentialWin: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'won', 'lost', 'cancelled', 'void'],
    default: 'active',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  settledAt: {
    type: Date
  }
});

// Add indexes for better query performance
betSchema.index({ userId: 1, status: 1 });
betSchema.index({ eventId: 1, status: 1 });
betSchema.index({ tournamentId: 1, status: 1 });
betSchema.index({ createdAt: -1 });

// Instance methods
betSchema.methods = {
  // Cancel a bet
  async cancel(session) {
    // Start a transaction if not provided
    const useSession = session || await mongoose.startSession();
    if (!session) useSession.startTransaction();
    
    try {
      const User = mongoose.model('User');
      const Event = mongoose.model('Event');
      
      // Find the user
      const user = await User.findById(this.userId).session(useSession);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Refund the bet amount
      user.coins += this.amount;
      await user.save({ session: useSession });
      
      // Update event bet statistics
      const event = await Event.findById(this.eventId).session(useSession);
      
      if (event) {
        // Decrease total bet amount
        event.totalBetAmount = Math.max(0, (event.totalBetAmount || 0) - this.amount);
        
        // Decrease team bet amount
        const teamBetAmount = event.teamBetAmounts.get(this.selection) || 0;
        event.teamBetAmounts.set(this.selection, Math.max(0, teamBetAmount - this.amount));
        
        await event.save({ session: useSession });
      }
      
      // Update bet status
      this.status = 'cancelled';
      this.settledAt = new Date();
      await this.save({ session: useSession });
      
      // Commit transaction if we started it
      if (!session) await useSession.commitTransaction();
      
      return {
        success: true,
        refundAmount: this.amount,
        userCoins: user.coins
      };
    } catch (error) {
      // Abort transaction if we started it
      if (!session) await useSession.abortTransaction();
      throw error;
    } finally {
      // End session if we started it
      if (!session) useSession.endSession();
    }
  }
};

// Static methods
betSchema.statics = {
  // Place a new bet
  async placeBet(betData, user) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const Event = mongoose.model('Event');
      const Tournament = mongoose.model('Tournament');
      
      // Find the event
      const event = await Event.findById(betData.eventId).session(session);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Verify tournament
      const tournament = await Tournament.findById(event.tournamentId).session(session);
      
      if (!tournament) {
        throw new Error('Tournament not found');
      }
      
      // Verify event is accepting bets
      if (event.status !== 'upcoming' && event.status !== 'active') {
        throw new Error('Event is not accepting bets');
      }
      
      // Verify the selection exists
      const option = event.options.find(opt => opt.name === betData.selection);
      
      if (!option) {
        throw new Error('Invalid selection');
      }
      
      // Check if user has enough coins
      if (user.coins < betData.amount) {
        throw new Error('Insufficient coins');
      }
      
      // Calculate potential win
      const odds = option.odds;
      const potentialWin = Math.round(betData.amount * odds);
      
      // Create bet
      const bet = new this({
        userId: user._id,
        eventId: event._id,
        tournamentId: event.tournamentId,
        selection: betData.selection,
        amount: betData.amount,
        odds,
        potentialWin,
        status: 'active'
      });
      
      // Update user balance
      user.coins -= betData.amount;
      await user.save({ session });
      
      // Update event bet statistics
      event.totalBetAmount = (event.totalBetAmount || 0) + betData.amount;
      
      // Update team bet amount
      const teamBetAmount = event.teamBetAmounts.get(betData.selection) || 0;
      event.teamBetAmounts.set(betData.selection, teamBetAmount + betData.amount);
      
      await event.save({ session });
      await bet.save({ session });
      
      await session.commitTransaction();
      
      // Recalculate odds (outside transaction)
      await event.recalculateOdds();
      
      return { 
        success: true,
        bet,
        userCoins: user.coins
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },
  
  // Settle bets for an event
  async settleEventBets(eventId, session) {
    const Event = mongoose.model('Event');
    const User = mongoose.model('User');

    try {
      // Find the event
      const event = await Event.findById(eventId);

      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== 'finished') {
        throw new Error('Cannot settle bets for an unfinished event');
      }

      if (!event.result) {
        throw new Error('Event result is not set');
      }

      // Get all active bets for this event
      const activeBets = await this.find({
        eventId: event._id,
        status: 'active'
      });

      // Settlement statistics
      const results = {
        eventId: event._id,
        totalBets: activeBets.length,
        settledBets: 0,
        winningBets: 0,
        losingBets: 0,
        totalPayout: 0
      };

      // Process each bet
      for (const bet of activeBets) {
        // Check if bet matches the winner
        const isWinner = bet.selection === event.result;

        // Update bet status
        bet.status = isWinner ? 'won' : 'lost';
        bet.settledAt = new Date();

        // Process winning bet
        if (isWinner) {
          const user = await User.findById(bet.userId);

          if (user) {
            // Credit winnings
            user.coins += bet.potentialWin;
            results.totalPayout += bet.potentialWin;
            await user.save();
          }

          results.winningBets++;
        } else {
          results.losingBets++;
        }

        await bet.save();
        results.settledBets++;
      }

      return results;
    } catch (error) {
      console.error('Error settling bets:', error);
      throw error;
    }
  },
  
  // Get user bets
  async getUserBets(userId, options = {}) {
    const query = { userId };
    
    // Filter by status if provided
    if (options.status) {
      query.status = options.status;
    }
    
    // Filter by tournament if provided
    if (options.tournamentId) {
      query.tournamentId = options.tournamentId;
    }
    
    // Filter by event if provided
    if (options.eventId) {
      query.eventId = options.eventId;
    }
    
    // Get bets with pagination
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    
    const [bets, total] = await Promise.all([
      this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'eventId',
          select: 'title eventType status result score'
        })
        .populate({
          path: 'tournamentId',
          select: 'name status'
        }),
      this.countDocuments(query)
    ]);
    
    return {
      bets,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    };
  }
};

const Bet = mongoose.model('Bet', betSchema);
module.exports = Bet;
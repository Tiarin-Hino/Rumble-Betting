const User = require('../models/user');
const Event = require('../models/event');
const Bet = require('../models/bet');

async function resetDatabase() {
  await Event.deleteMany({});
  await Bet.deleteMany({});
  await User.deleteMany({username: {$ne: 'admin'}});
  console.log('Database reset successful');
  process.exit(0);
}

resetDatabase();
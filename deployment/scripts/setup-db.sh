#!/bin/bash
# scripts/setup-db.sh - Initial database setup

DB_ENDPOINT=$1
DB_USERNAME=$2
DB_PASSWORD=$3
DB_NAME=$4

echo "Setting up MongoDB database..."

# Check if MongoDB command is installed
if ! [ -x "$(command -v mongosh)" ]; then
  echo "Error: MongoDB Shell is not installed." >&2
  echo "Installing MongoDB Shell..."
  
  # Install MongoDB Shell based on OS
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org-shell
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install mongosh
  else
    echo "Unsupported OS. Please install MongoDB Shell manually."
    exit 1
  fi
fi

# Create init script
cat > init-script.js << EOF
// Connect to MongoDB
db = db.getSiblingDB('admin');

// Authenticate as admin
db.auth('$DB_USERNAME', '$DB_PASSWORD');

// Create application database if it doesn't exist
db = db.getSiblingDB('$DB_NAME');

// Create collections
db.createCollection('users');
db.createCollection('verificationTokens');
db.createCollection('passwordResetTokens');
db.createCollection('ipRegistry');
db.createCollection('events');
db.createCollection('bets');

// Create indexes
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.verificationTokens.createIndex({ "token": 1 }, { unique: true });
db.verificationTokens.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 86400 });
db.passwordResetTokens.createIndex({ "token": 1 }, { unique: true });
db.passwordResetTokens.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 3600 });
db.ipRegistry.createIndex({ "ip": 1 }, { unique: true });

// Create admin user if it doesn't exist
db.users.updateOne(
  { username: 'admin' },
  {
    \$setOnInsert: {
      username: 'admin',
      email: 'admin@example.com',
      password: '$2b$10\$XtGOcgsM6w5Th0qzQEPlr.KLNbGI3Qb6pN1iiT8K8UpBf9CXOuVMu', // 'adminpassword'
      isVerified: true,
      registrationIP: '127.0.0.1',
      registrationDate: new Date(),
      coins: 10000,
      winRate: 0,
      isAdmin: true
    }
  },
  { upsert: true }
);

// Create sample betting events
db.events.insertMany([
  {
    title: 'Team A vs Team B',
    description: 'Regular season match between Team A and Team B',
    eventDate: new Date(new Date().getTime() + 3*24*60*60*1000), // 3 days from now
    status: 'upcoming',
    options: [
      { name: 'Team A Win', odds: 1.8 },
      { name: 'Draw', odds: 3.5 },
      { name: 'Team B Win', odds: 2.1 }
    ]
  },
  {
    title: 'Tournament Quarter Finals',
    description: 'Quarter finals of the annual tournament',
    eventDate: new Date(new Date().getTime() + 6*24*60*60*1000), // 6 days from now
    status: 'upcoming',
    options: [
      { name: 'Team C Win', odds: 1.5 },
      { name: 'Draw', odds: 3.8 },
      { name: 'Team D Win', odds: 2.4 }
    ]
  },
  {
    title: 'Championship Game',
    description: 'Final championship game of the season',
    eventDate: new Date(new Date().getTime() + 14*24*60*60*1000), // 14 days from now
    status: 'upcoming',
    options: [
      { name: 'Team X Win', odds: 2.1 },
      { name: 'Draw', odds: 4.2 },
      { name: 'Team Y Win', odds: 1.7 }
    ]
  }
]);

print('Database setup completed successfully!');
EOF

# Connect to MongoDB and run init script
mongosh "mongodb://${DB_USERNAME}:${DB_PASSWORD}@${DB_ENDPOINT}:27017/admin" --file init-script.js

# Clean up
rm init-script.js

echo "Database setup completed!"
# VirtualBet - Virtual Betting Platform

A fun virtual betting platform where users can practice betting without risking real money. This application includes user registration with IP tracking to prevent multiple accounts, virtual coin system, and various betting features.

## Features

- **User Authentication**
  - Username and password login (no email verification required)
  - IP-based registration limiting
  - Password reset functionality

- **Virtual Betting**
  - Place bets on upcoming events
  - Track active bets and betting history
  - View potential winnings
  - Cancel bets before events start

- **Events Management**
  - Browse upcoming, active, and finished events
  - Different betting options with odds
  - Event results and settlement

- **User Profile**
  - Virtual coin balance
  - Betting statistics
  - Win rate tracking

- **Leaderboard**
  - Ranking of top players by virtual coins
  - Win rate comparison

## Local Development Setup

### Prerequisites
- Node.js (v14+)
- MongoDB (local or Docker)
- Git

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/virtual-betting.git
   cd virtual-betting
   ```

2. **Start the application with Docker Compose**
   ```bash
   docker-compose up
   ```

   This will start:
   - MongoDB database at port 27017
   - Backend server at port 3000
   - Frontend server at port 8080

3. **Access the application**
   Open your browser and go to http://localhost:8080

### Manual Setup

1. **Start MongoDB**
   ```bash
   # Option 1: Using Docker
   docker run -d --name mongodb -p 27017:27017 -v mongodb_data:/data/db mongo:latest
   
   # Option 2: Using local installation
   # Start your local MongoDB service
   ```

2. **Set up and start the backend**
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Set up and start the frontend**
   ```bash
   cd frontend/public
   # Use any simple HTTP server, for example:
   npx serve
   ```

4. **Access the application**
   Open your browser and go to the URL shown by your HTTP server (typically http://localhost:3000 or http://localhost:5000)

### Default Admin Account

The system creates a default admin account on startup:
- Email: admin@example.com
- Password: admin123

## API Endpoints

### Authentication
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login user
- `POST /api/users/reset-password` - Reset password
- `GET /api/users/profile` - Get user profile

### Events
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get event by ID
- `GET /api/events/filter/upcoming` - Get upcoming events
- `GET /api/events/filter/active` - Get active events
- `GET /api/events/filter/finished` - Get finished events

### Bets
- `POST /api/bets` - Place a bet
- `GET /api/bets/my-bets` - Get user's bets
- `GET /api/bets/my-bets/active` - Get user's active bets
- `GET /api/bets/my-bets/history` - Get user's betting history
- `POST /api/bets/:id/cancel` - Cancel a bet

### Admin Endpoints
- `GET /api/users/admin/users` - Get all users
- `POST /api/users/admin/ban/:userId` - Ban a user
- `POST /api/users/admin/unban/:userId` - Unban a user
- `GET /api/users/admin/ip/:ip` - Check IP registrations
- `POST /api/events` - Create a new event
- `PUT /api/events/:id` - Update an event
- `POST /api/events/:id/result` - Set event result
- `POST /api/bets/admin/settle/:eventId` - Settle all bets for an event

## Project Structure

```
virtual-betting/
├── backend/
│   ├── server.js                  # Main Express server file
│   ├── database.js                # MongoDB connection and schemas
│   ├── middleware/
│   │   ├── auth.js                # Authentication middleware
│   │   └── ipRateLimit.js         # IP rate limiting
│   ├── routes/
│   │   ├── users.js               # User routes
│   │   ├── events.js              # Event routes
│   │   └── bets.js                # Bet routes
│   └── package.json
│
├── frontend/
│   └── public/
│       ├── index.html             # Main HTML file
│       ├── assets/
│       │   ├── css/
│       │   │   └── main.css       # Main stylesheet
│       │   ├── js/
│       │   │   ├── auth.js        # Authentication functions
│       │   │   ├── bets.js        # Betting functions
│       │   │   ├── config.js      # Configuration
│       │   │   ├── events.js      # Events handling
│       │   │   └── main.js        # Main application logic
│       │   └── img/
│       │       └── favicon.ico    # Site favicon
│       └── nginx.conf             # Nginx configuration for Docker
│
├── deployment/                    # AWS deployment files
│   ├── cloudformation/            # AWS CloudFormation templates
│   ├── docker/                    # Docker configuration for deployment
│   ├── scripts/                   # Deployment scripts
│   └── env/                       # Environment configuration
│
├── docker-compose.yml             # Docker Compose configuration
├── .dockerignore                  # Docker ignore file
├── .gitignore                     # Git ignore file
└── README.md                      # This file
```

## AWS Deployment

To deploy this application to AWS:

1. Make sure you have AWS CLI installed and configured:
   ```bash
   aws configure
   ```

2. Run the deployment script:
   ```bash
   cd deployment
   ./scripts/deploy.sh
   ```

3. Follow the prompts to enter your domain name and subdomain.

The deployment script will:
- Create necessary AWS resources (ECS, RDS, S3, CloudFront, etc.)
- Set up HTTPS with AWS Certificate Manager
- Configure DNS with Route 53
- Deploy the application

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- This project is for educational purposes only
- No real money is involved in the betting system
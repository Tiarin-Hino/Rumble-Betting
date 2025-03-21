virtual-betting/
│
├── backend/
│   ├── server.js                  # Main Express server file
│   ├── database.js                # MongoDB connection and schema definitions
│   ├── reset-db.js                # MongoDB reset
│   ├── Dockerfile                 # Backend Docker configuration
│   ├── middleware/
│   │   ├── auth.js                # Authentication middleware
│   │   ├── apiRateLimit.js        # API rate limiting middleware
│   │   ├── errorHandler.js        # Error handling middleware
│   │   ├── auth.js                # Authentication middleware
│   │   └── ipRateLimit.js         # IP rate limiting middleware
│   ├── routes/
│   │   ├── users.js               # User registration, login routes
│   │   ├── events.js              # Betting events routes
│   │   ├── health.js              # Health check routes
│   │   └── bets.js                # Placing and managing bets routes
│   ├── utils/
│   │   └── validator.js           # Validator utils
│   └── package.json               # Backend dependencies
│
├── frontend/
│   ├── Dockerfile                 # Frontend Docker configuration
│   ├── nginx.conf                 # NGINX configuration
│   └── public/
│       ├── index.html             # Main HTML file
│       ├── favicon.ico             
│       ├── assets/
│       │   ├── css/
│       │   │   └── main.css       # Main stylesheet
│       │   ├── js/
│       │   │   ├── auth.js        # Authentication functions
│       │   │   ├── bets.js        # Betting functions
│       │   │   ├── config.js      # API configuration
│       │   │   ├── dom-utils.js   # DOm utils
│       │   │   ├── events.js      # Events handling
│       │   │   └── main.js        # Main application logic
│       │   └── img/               # Image assets
│       └── nginx.conf             # Nginx configuration for Docker
│
├── deployment/                    # AWS Deployment files
│   ├── cloudformation/
│   │   ├── main.yaml              # Main CloudFormation template
│   │   ├── vpc.yaml               # VPC and network configuration
│   │   ├── ecs.yaml               # ECS service configuration
│   │   ├── rds.yaml               # MongoDB database configuration
│   │   ├── s3-cloudfront.yaml     # Static assets and CDN
│   │   └── domain.yaml            # DNS and certificate configuration
│   ├── docker/
│   │   ├── config/
│   │   │   └──env.js              # Env configuration file
│   │   ├── backend.dockerfile     # Backend Docker configuration
│   │   └── frontend.dockerfile    # Frontend Docker configuration
│   ├── scripts/
│   │   ├── deploy.sh              # Main deployment script
│   │   ├── build.sh               # Build Docker images
│   │   └── setup-db.sh            # Database initialization
│   └── env/
│       ├── prod.env.example       # Production environment variables template
│       └── secrets.env.example    # Secrets template
│
├── docker-compose.yml             # Local development setup with Docker
├── .env                           # Environment variables
├── package.json                   # Root package.json for scripts
└── README.md                      # Project documentation
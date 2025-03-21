require('dotenv').config();

// Required environment variables
const requiredEnvVars = [
  'MONGODB_URI'
];

// Optional environment variables with defaults
const envConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  IP_REGISTRATION_LIMIT: parseInt(process.env.IP_REGISTRATION_LIMIT, 10) || 1,
  IP_TRACKING_DURATION: parseInt(process.env.IP_TRACKING_DURATION, 10) || 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-do-not-use-in-production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '1h',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};

// Check required env vars
const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

// Warn about default JWT secret in production
if (envConfig.NODE_ENV === 'production' && envConfig.JWT_SECRET === 'default-jwt-secret-do-not-use-in-production') {
  console.warn('WARNING: Using default JWT secret in production environment!');
}

module.exports = envConfig;
// middleware/securityHeaders.js
const helmet = require('helmet');

// Custom CSP configuration
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
    styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
};

// Security headers middleware
const securityHeaders = [
  helmet({
    contentSecurityPolicy: cspConfig,
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' }
  })
];

module.exports = securityHeaders;
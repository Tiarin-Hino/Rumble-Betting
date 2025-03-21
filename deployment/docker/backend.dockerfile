# Backend Dockerfile with multi-stage build and security enhancements
FROM node:16-alpine as builder

WORKDIR /app

# Install dependencies first (leverages Docker cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Production image
FROM node:16-alpine

# Install wget for health check
RUN apk add --no-cache wget

# Set up non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy from builder stage
COPY --from=builder --chown=appuser:appgroup /app .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Create health check endpoint (ensure this route exists)
RUN mkdir -p /app/routes && \
    echo "const express = require('express'); \
    const router = express.Router(); \
    router.get('/', (req, res) => { \
      res.status(200).json({ status: 'ok', service: 'betting-backend', timestamp: new Date().toISOString() }); \
    }); \
    module.exports = router;" > /app/routes/health.js

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
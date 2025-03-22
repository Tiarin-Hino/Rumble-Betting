#!/bin/bash

# Stop all running containers
echo "Stopping containers..."
docker-compose down

# Clean up unused Docker resources
echo "Pruning Docker system..."
docker system prune -f

# Rebuild the containers
echo "Building containers..."
docker-compose build --no-cache

# Start the containers in detached mode
echo "Starting containers in detached mode..."
docker-compose up -d

echo "Docker restart completed successfully!"
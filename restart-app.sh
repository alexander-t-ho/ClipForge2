#!/bin/bash

# ClipForge2 - Clean Restart Script
# This script ensures a clean restart without telemetry/metrics popups

echo "🔄 Stopping ClipForge2 processes..."

# Kill all related processes
pkill -f webpack
pkill -f electron  
pkill -f node

# Wait for processes to fully stop
sleep 3

echo "🧹 Cleaning cache..."

# Clean build cache
rm -rf build/
rm -rf node_modules/.cache/

echo "🚀 Starting ClipForge2..."

# Start the application
npm run electron-dev

echo "✅ ClipForge2 started successfully!"

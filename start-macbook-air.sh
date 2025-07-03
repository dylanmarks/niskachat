#!/bin/bash

# NiskaChat startup script for MacBook Air
# This script disables LLM to prevent crashes on resource-constrained systems

echo "🖥️  Starting NiskaChat in MacBook Air mode..."
echo "   - LLM disabled to prevent crashes"
echo "   - Enhanced fallback summaries enabled"
echo "   - Resource usage optimized"
echo ""

# Set environment variables for MacBook Air
export NODE_ENV=development
export LLM_ENABLED=false
export LLM_TIMEOUT=5000

# Start backend with LLM disabled
echo "🚀 Starting backend server..."
npm run start:backend &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend..."
npm run start &
FRONTEND_PID=$!

echo ""
echo "✅ NiskaChat started successfully!"
echo "   - Backend: http://localhost:3000"
echo "   - Frontend: http://localhost:4200"
echo "   - Press Ctrl+C to stop both services"
echo ""

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Stopping NiskaChat..."
  kill $BACKEND_PID $FRONTEND_PID 2> /dev/null
  echo "✅ Stopped successfully"
  exit 0
}

# Trap signals to cleanup
trap cleanup INT TERM

# Wait for processes
wait

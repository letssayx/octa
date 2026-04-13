#!/bin/bash

# Octa Desktop - 100% Local Frontend Start Script

echo "=============================================="
echo "🚀 Starting Octa Desktop Environment..."
echo "=============================================="

# Ensure we are in the repository root
cd "$(dirname "$0")"

# Check if frontend node_modules exist, if not, install them
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

echo "⚛️  Starting Vite Frontend on port 5174..."
cd frontend
npm run dev

#!/bin/bash

echo "=============================================="
echo "🚀 Starting Octa Desktop Environment (WSL)..."
echo "=============================================="

# Ensure .env exists
if [ ! -f backend/.env ]; then
    echo "⚠️  backend/.env not found! Copying from .env.example..."
    cp backend/.env.example backend/.env
    echo "👉 Please update backend/.env with your local Docker TimescaleDB credentials when ready."
fi

# Start Backend
echo "🐍 Starting FastAPI Backend on port 8081..."
cd backend
# Create venv if doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi
python3 main.py &
cd ..

# Start Frontend
echo "⚛️  Starting Vite Frontend on port 5174..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev &
cd ..

echo "=============================================="
echo "✅ Octa Desktop is running!"
echo "➡️  Frontend: http://localhost:5174"
echo "➡️  Backend:  http://localhost:8081"
echo "Use 'pkill -f uvicorn' and 'pkill -f vite' to stop servers manually."
echo "=============================================="

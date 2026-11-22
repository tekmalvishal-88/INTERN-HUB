#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  InternHub - One-Click Local Deployment"
echo "============================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Install Node.js 20+ from https://nodejs.org/"
  exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env"
  echo "[INFO] Created .env from .env.example. Add your GEMINI_API_KEY inside .env for AI Assistant."
fi

if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing dependencies..."
  npm install
fi

echo "[2/3] Building production bundle..."
npm run build

echo "[3/3] Starting InternHub at http://localhost:3000 ..."
if command -v open >/dev/null 2>&1; then
  (sleep 2 && open "http://localhost:3000") &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 2 && xdg-open "http://localhost:3000") &
fi

npm run start:local

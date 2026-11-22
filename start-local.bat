@echo off
setlocal
echo ============================================
echo   InternHub - One-Click Local Deployment
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install Node.js 20+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example. Add your GEMINI_API_KEY inside .env if needed.
  )
)

if not exist "node_modules" (
  echo [1/3] Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo [2/3] Building production bundle...
call npm run build
if errorlevel 1 exit /b 1

echo [3/3] Starting InternHub at http://localhost:3000 ...
start "" http://localhost:3000
call npm run start:local

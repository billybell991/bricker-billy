@echo off
cd /d "%~dp0"

echo === Bricker Billy Launcher ===

if not exist "node_modules" (
    echo Installing dependencies, this may take a minute...
    npm install
)

echo Starting dev server...
start "" cmd /c "npm run dev & pause"

echo Waiting for server to start...
timeout /t 3 /nobreak > nul

start "" "http://localhost:5173"

@echo off
echo Starting AUDIT AI Backend Server...
echo.

cd /d "%~dp0"

echo Installing dependencies...
call npm install
echo.

echo Starting server...
call npm run dev

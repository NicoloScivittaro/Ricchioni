@echo off
cd /d "%~dp0"
node scripts/start-party.mjs
if errorlevel 1 pause

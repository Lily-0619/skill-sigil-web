@echo off
chcp 65001 >nul
cd /d "%~dp0"
call npm run editor
if errorlevel 1 pause

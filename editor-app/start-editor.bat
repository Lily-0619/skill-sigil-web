@echo off
setlocal
cd /d "%~dp0"

set "NPM_CMD="
where npm.cmd >nul 2>&1
if not errorlevel 1 set "NPM_CMD=npm.cmd"
if defined NPM_CMD goto npm_found

if exist "%~d0\AI\npm.cmd" set "PATH=%~d0\AI;%PATH%"
if exist "%~d0\AI\npm.cmd" set "NPM_CMD=%~d0\AI\npm.cmd"
if defined NPM_CMD goto npm_found

if exist "E:\AI\npm.cmd" set "PATH=E:\AI;%PATH%"
if exist "E:\AI\npm.cmd" set "NPM_CMD=E:\AI\npm.cmd"
if defined NPM_CMD goto npm_found

echo Node.js and npm were not found.
echo Install Node.js or place the portable runtime in E:\AI.
pause
exit /b 1

:npm_found
set "NODE_EXE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
if not defined NODE_EXE if exist "%~d0\AI\node.exe" set "NODE_EXE=%~d0\AI\node.exe"
if not defined NODE_EXE if exist "E:\AI\node.exe" set "NODE_EXE=E:\AI\node.exe"
if not defined NODE_EXE goto node_missing

if /i "%~1"=="--check" goto check
if not exist "node_modules\electron\dist\electron.exe" goto install
if not exist "node_modules\vite\bin\vite.js" goto install
goto start

:install
echo Preparing the Windows runtime. This may take a few minutes...
call "%NPM_CMD%" install
if errorlevel 1 goto install_failed
if not exist "node_modules\electron\dist\electron.exe" goto runtime_missing
if not exist "node_modules\vite\bin\vite.js" goto runtime_missing
goto start

:start
echo Building the editor...
"%NODE_EXE%" "node_modules\vite\bin\vite.js" build
if errorlevel 1 goto launch_failed
echo Starting the editor...
"node_modules\electron\dist\electron.exe" .
if errorlevel 1 goto launch_failed
exit /b 0

:check
echo NPM_CMD=%NPM_CMD%
if not exist "node_modules\electron\dist\electron.exe" goto runtime_missing
if not exist "node_modules\vite\bin\vite.js" goto runtime_missing
echo Runtime check passed.
echo NODE_EXE=%NODE_EXE%
exit /b 0

:node_missing
echo Node.js was not found.
echo Install Node.js or place the portable runtime in E:\AI.
pause
exit /b 1

:install_failed
echo Failed to prepare the Windows runtime. Check the network connection.
pause
exit /b 1

:runtime_missing
echo The Windows runtime is incomplete. Run this file again while online.
pause
exit /b 1

:launch_failed
echo The editor could not be started.
pause
exit /b 1

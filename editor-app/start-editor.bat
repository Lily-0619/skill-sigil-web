@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
if not defined NODE_EXE if exist "%~d0\AI\node.exe" set "NODE_EXE=%~d0\AI\node.exe"
if not defined NODE_EXE if exist "E:\AI\node.exe" set "NODE_EXE=E:\AI\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE goto node_missing
for %%I in ("%NODE_EXE%") do set "PATH=%%~dpI;%PATH%"

if /i "%~1"=="--check" goto check
if not exist "node_modules\electron\dist\electron.exe" goto install
if not exist "node_modules\vite\bin\vite.js" goto install
goto start

:install
set "NPM_CMD="
for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%I"
if not defined NPM_CMD goto npm_missing
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

:npm_missing
echo npm is required to prepare missing dependencies.
echo Install Node.js with npm, then run this file again.
pause
exit /b 1

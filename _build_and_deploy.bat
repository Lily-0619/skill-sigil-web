@echo off
chcp 65001 >nul
cd /d "D:\Cloude cowork\スキル秘伝HP\skill-sigil-web"
(
  echo ===== npm test =====
  call npm test
  echo TEST_EXIT=%errorlevel%
  echo.
  echo ===== npm run build =====
  call npm run build
  echo BUILD_EXIT=%errorlevel%
  echo.
  echo ===== copy dist/index.html =====
  copy /Y "dist\index.html" "..\スキル秘伝HP.html"
  echo COPY_EXIT=%errorlevel%
  echo.
  echo ###### ALL DONE ######
) > "_build_log.txt" 2>&1
echo FINISHED
pause

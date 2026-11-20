@echo off
REM Double-click launcher for end users (Windows).
setlocal
cd /d "%~dp0"

echo.
echo  TAZIA helper TURN — one-click start
echo  ===================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-TaziaTurn.ps1" %*
set ERR=%ERRORLEVEL%

echo.
if %ERR% neq 0 (
  echo  Something went wrong (exit %ERR%).
  echo  If Docker is missing: https://www.docker.com/products/docker-desktop/
) else (
  echo  Done. Paste the card values into TAZIA → Zones → Fix.
)
echo.
pause
exit /b %ERR%

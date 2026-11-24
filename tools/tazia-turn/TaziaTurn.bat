@echo off
REM Double-click helper (builds once if needed, then runs).
setlocal
cd /d "%~dp0"
if exist "%USERPROFILE%\go-sdk\bin\go.exe" set "PATH=%USERPROFILE%\go-sdk\bin;%PATH%"
if exist "%USERPROFILE%\sdk\go\bin\go.exe" set "PATH=%USERPROFILE%\sdk\go\bin;%PATH%"
if exist "%ProgramFiles%\Go\bin\go.exe" set "PATH=%ProgramFiles%\Go\bin;%PATH%"
if not exist "dist\TaziaTurn.exe" (
  echo Building TaziaTurn.exe …
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build\build-desktop.ps1"
  if not exist "dist\TaziaTurn.exe" (
    echo Build failed. Install Go from https://go.dev/dl/ and retry.
    pause
    exit /b 1
  )
)
echo.
echo Starting TAZIA Turn — leave this window open.
echo Paste the card into TAZIA → Zones → Fix, then rejoin the zone.
echo.
"%~dp0dist\TaziaTurn.exe" %*
echo.
pause

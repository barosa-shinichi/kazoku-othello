@echo off
cd /d "%~dp0"
if not exist "build" mkdir "build"
echo started> "build\build-log.txt"
if not exist "%LOCALAPPDATA%\family-othello-tools\platform\android-35\android.jar" (
  echo SETUP: downloading build tools>> "build\build-log.txt"
  powershell -NoProfile -ExecutionPolicy Bypass -File ".\build.ps1" -Setup >> "build\build-log.txt" 2>&1
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File ".\build.ps1" >> "build\build-log.txt" 2>&1
)
echo EXIT %ERRORLEVEL%>> "build\build-log.txt"

@echo off
setlocal
cd /d "%~dp0"
if not exist "wifi\Start_Donovan_WiFi_Windows.bat" (
  echo ERROR: Wi-Fi launcher not found. Download and extract the entire repository ZIP.
  pause
  exit /b 1
)
call "wifi\Start_Donovan_WiFi_Windows.bat"
if errorlevel 1 (
  echo Wi-Fi launcher ended with an error.
  pause
  exit /b 1
)

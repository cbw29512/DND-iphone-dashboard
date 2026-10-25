@echo off
setlocal
cd /d "%~dp0"
echo.
echo  DONOVAN - LAPTOP CONTROLS + iPHONE QR DISPLAY
 echo ---------------------------------------------
where py >nul 2>&1
if not errorlevel 1 (
  set "PY=py -3"
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python 3 is required. Install from python.org and try again.
    pause
    exit /b 1
  )
  set "PY=python"
)
%PY% -c "import fastapi, uvicorn, qrcode" >nul 2>&1
if errorlevel 1 (
  echo Installing Wi-Fi server and QR code requirements...
  %PY% -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Dependency installation failed. Check your Internet connection, then retry.
    pause
    exit /b 1
  )
)
echo.
echo Laptop page: http://localhost:8765/
echo iPhone: scan the QR displayed on the laptop page.
echo Both devices must be on the same reachable Wi-Fi.
echo.
%PY% run_wifi.py
if errorlevel 1 (
  echo Server failed to start. Check port 8765 and firewall.
  pause
)

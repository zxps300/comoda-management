@echo off
:: ============================================
:: Allow Comoda backend through Windows Firewall
:: Must be run as Administrator (right-click → Run as administrator)
:: ============================================

echo Adding firewall rule for Comoda Backend (port 8000)...

netsh advfirewall firewall delete rule name="Comoda Backend (PHP)" >nul 2>&1

netsh advfirewall firewall add rule ^
  name="Comoda Backend (PHP)" ^
  dir=in ^
  action=allow ^
  protocol=TCP ^
  localport=8000 ^
  remoteip=LocalSubnet,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12

if %errorlevel% equ 0 (
    echo.
    echo ✓ Firewall rule added successfully!
    echo   Mobile devices can now reach this PC on port 8000.
) else (
    echo.
    echo ✗ Failed. Please right-click this file and select "Run as administrator".
)

echo.
pause

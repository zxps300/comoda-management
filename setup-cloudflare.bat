@echo off
title Comoda — Cloudflare Tunnels Setup
color 0B
cls

echo ============================================
echo   COMODA — Cloudflare Tunnels Setup
echo ============================================
echo.
echo This script sets up Cloudflare Tunnels so your
echo digital menu can be accessed from ANY network.
echo.
echo ============================================
echo.

REM === Check if cloudflared is already available ===
where cloudflared >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] cloudflared is already installed and in PATH.
    goto :done
)

REM Check if cloudflared exists in our local tools directory
if exist "%~dp0tools\cloudflared.exe" (
    echo [OK] cloudflared found in tools\ directory.
    goto :done
)

echo [!] cloudflared is not installed.
echo.
echo You have two options:
echo.
echo   1. AUTOMATIC: Download cloudflared now (requires internet)
echo   2. MANUAL:    Download from https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
echo                 and place cloudflared-windows-amd64.exe as cloudflared.exe in: %~dp0tools\
echo.
set /p CHOICE="Choose option (1 or 2): "

if "%CHOICE%"=="1" goto :download
if "%CHOICE%"=="2" goto :manual
echo Invalid choice.
pause
exit /b 1

:download
echo.
echo [1/2] Creating tools directory...
if not exist "%~dp0tools" mkdir "%~dp0tools"

echo [2/2] Downloading cloudflared for Windows (amd64)...
powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%~dp0tools\cloudflared.exe' -UseBasicParsing } catch { Write-Host 'ERROR: Download failed. Check your internet connection.'; exit 1 } }"
if %errorlevel% neq 0 (
    echo ERROR: Failed to download cloudflared.
    pause
    exit /b 1
)

if not exist "%~dp0tools\cloudflared.exe" (
    echo ERROR: Download failed. Please download manually.
    pause
    exit /b 1
)

echo [OK] cloudflared downloaded to tools\cloudflared.exe
echo.

:done
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo   Cloudflare Tunnels is ready to use.
echo   Run 'start-cloudflare.bat' to launch the
echo   system with a public trycloudflare URL.
echo.
echo ============================================
pause
exit /b 0

:manual
echo.
echo Please download cloudflared from: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
echo Save it as cloudflared.exe in: %~dp0tools\
echo Then run this setup script again.
echo.
pause
exit /b 0

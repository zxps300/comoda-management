@echo off
title Comoda Restaurant - Permanent QR Online Mode
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\comoda-supervisor.ps1" -Mode online
if errorlevel 1 pause

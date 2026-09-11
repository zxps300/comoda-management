@echo off
title Comoda Restaurant Management System
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\comoda-supervisor.ps1" -Mode local
if errorlevel 1 pause

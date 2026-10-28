@echo off
cd /d "%~dp0"
title LAN Cinema
if not exist ".next" (
  echo Build pertama kali, mohon tunggu...
  call npm run build
  if errorlevel 1 (
    echo Build gagal.
    pause
    exit /b 1
  )
)
call npm start
pause
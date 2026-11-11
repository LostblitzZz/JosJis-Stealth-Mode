@echo off
chcp 65001 >nul
title JOSJIS Discord - Backend Server
color 0E

echo ======================================================================
echo           🚀 JOSJIS DISCORD - BACKEND SERVER LAUNCHER 🚀
echo ======================================================================
echo.

if not exist "node_modules" (
    echo Menginstal dependensi server (Express, Socket.io, Cors)...
    call npm install
)

echo Menjalankan server JOSJIS...
node server.js
pause

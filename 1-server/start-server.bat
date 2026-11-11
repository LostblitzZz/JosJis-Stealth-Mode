@echo off
chcp 65001 >nul
title JOSJIS IT TEAM - Backend Server (SQLite3 Persistent)
color 0B

echo ======================================================================
echo       🚀 JOSJIS IT TEAM - BACKEND SERVER (SQLITE3 PERSISTENT) 🚀
echo ======================================================================
echo.

if not exist "node_modules" (
    echo Menginstal dependensi server (Express, Socket.io, SQLite3, Cors)...
    call npm install
)

echo Menjalankan server JOSJIS IT TEAM...
node server.js
pause

@echo off
chcp 65001 >nul
title JOSJIS IT TEAM - Launcher
color 0B

echo Memulai JOSJIS IT TEAM...
cd "2-client-user"

if not exist "node_modules" (
    echo Menginstal dependensi aplikasi klien pertama kali...
    call npm install --prefer-offline
)

start "" npm start
exit

@echo off
chcp 65001 >nul
title JOSJIS IT TEAM - Launcher
color 0B

echo ==========================================================
echo           🛡️ JOSJIS IT TEAM - APP LAUNCHER
echo ==========================================================
echo  [1] Jalankan Compact Web Client (Instan, Ringan ^< 50KB)
echo  [2] Jalankan Desktop Client (Mode Pengembang Electron)
echo  [3] Jalankan Portable EXE (dari dist\josjis.exe)
echo ----------------------------------------------------------
set /p choice="Pilih mode [1-3] (Default: 1): "
if "%choice%"=="" set choice=1

if "%choice%"=="1" (
    start msedge.exe --app="http://192.168.18.50:3000/app" --window-size=1020,680 --user-data-dir="%LOCALAPPDATA%\JosjisCompactProfile"
    exit
)
if "%choice%"=="3" (
    if exist "2-client-user\dist\josjis.exe" (
        start "" "2-client-user\dist\josjis.exe"
        exit
    ) else (
        echo File dist\josjis.exe belum ada, jalankan build.bat terlebih dahulu!
        pause
        exit /b
    )
)

cd "2-client-user"
if not exist "node_modules" (
    echo Menginstal dependensi aplikasi klien pertama kali...
    call npm install --prefer-offline
)

start "" npm start
exit

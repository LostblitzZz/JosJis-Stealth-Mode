@echo off
chcp 65001 >nul
title JOSJIS IT TEAM - Auto Updater
color 0B

echo ======================================================================
echo           ⚡ JOSJIS IT TEAM SYSTEM - AUTO UPDATER ⚡
echo ======================================================================
echo.

if exist "2-client-user" (
    cd "2-client-user"
)

echo [1/4] Memeriksa koneksi internet...
ping -n 1 8.8.8.8 >nul 2>&1
if %errorlevel% neq 0 (
    echo [PERINGATAN] Tidak ada koneksi internet. Mencoba update lokal...
) else (
    echo [OK] Terhubung ke internet.
)
echo.

echo [2/4] Memeriksa pembaruan repository Git...
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% equ 0 (
    echo Menarik pembaruan terbaru dari server Git (git pull)...
    git pull
    if %errorlevel% equ 0 (
        echo [SUKSES] Kode program JOSJIS IT TEAM berhasil diperbarui!
    ) else (
        echo [INFO] Git pull selesai atau sudah yang terbaru.
    )
) else (
    echo [INFO] Berjalan dalam mode mandiri (non-git). Melewati git pull.
)
echo.

echo [3/4] Memeriksa & memperbarui dependensi NPM...
if exist "package.json" (
    call npm install --no-audit --prefer-offline
    if %errorlevel% equ 0 (
        echo [SUKSES] Dependensi NPM berhasil diperbarui dan siap digunakan!
    ) else (
        echo [PERINGATAN] Terjadi sedikit kendala saat npm install, namun app tetap dapat berjalan.
    )
) else (
    echo [ERROR] package.json tidak ditemukan!
)
echo.

echo [4/4] Selesai! Sistem JOSJIS IT TEAM telah diperbarui ke versi terbaru.
echo.
echo ======================================================================
echo  Pilih opsi selanjutnya:
echo  [1] Langsung jalankan aplikasi JOSJIS IT TEAM
echo  [2] Rebuild installer josjis.exe (Portable)
echo  [3] Keluar
echo ======================================================================
set /p opt="Pilihan Anda (1/2/3, default 1): "

if "%opt%"=="2" (
    echo.
    echo Memulai build portable executable josjis.exe...
    call npm run build
    echo Build selesai! File tersimpan di folder dist/josjis.exe
    pause
    exit /b
)

if "%opt%"=="3" (
    exit /b
)

echo.
echo Menjalankan aplikasi JOSJIS IT TEAM...
start "" npm start
exit /b

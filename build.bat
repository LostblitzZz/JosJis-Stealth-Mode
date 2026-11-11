@echo off
chcp 65001 >nul
title JOSJIS IT TEAM - Builder (Portable EXE)
color 0A

echo ======================================================================
echo           🛠️ JOSJIS IT TEAM - BUILD PORTABLE EXE 🛠️
echo ======================================================================
echo.

if exist "2-client-user" (
    cd "2-client-user"
)

echo Memulai kompilasi Electron Builder ke josjis.exe...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo [SUKSES] Portable executable berhasil dibuat di folder dist/josjis.exe!
    echo ======================================================================
) else (
    echo.
    echo [ERROR] Terjadi kegagalan saat build.
)

pause

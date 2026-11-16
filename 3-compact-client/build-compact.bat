@echo off
chcp 65001 >nul
title JOSJIS IT TEAM - Compact Builder (< 50 KB)
color 0A

echo ======================================================================
echo       ⚡ JOSJIS IT TEAM - COMPACT STEALTH CLIENT BUILDER ⚡
echo ======================================================================
echo.

set "CSC="
if exist "%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set "CSC=%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
) else if exist "%windir%\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
    set "CSC=%windir%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

if "%CSC%"=="" (
    echo [ERROR] Kompiler csc.exe .NET Framework 4.0/4.5 tidak ditemukan.
    pause
    exit /b 1
)

echo Mengompilasi JosjisCompact.cs menggunakan built-in Windows .NET compiler...
"%CSC%" /target:winexe /optimize+ /platform:anycpu /out:Josjis-Compact.exe JosjisCompact.cs /reference:System.Windows.Forms.dll /reference:System.Drawing.dll

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo [SUKSES] Josjis-Compact.exe berhasil dibuat! (Ukuran ~45 KB)
    echo Fitur:
    echo  - 0 dependensi luar, 100%% native Windows
    echo  - Boss Key (Alt + Q)
    echo  - Auto-Opacity Ghost Mode (transparan otomatis saat mouse keluar)
    echo  - Panic Key (Esc)
    echo  - System Tray Icon
    echo ======================================================================
) else (
    echo.
    echo [ERROR] Terjadi kegagalan kompilasi.
)

pause

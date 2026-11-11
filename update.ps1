# JOSJIS IT TEAM - PowerShell Auto Updater
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          ⚡ JOSJIS IT TEAM SYSTEM - AUTO UPDATER (PS) ⚡" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$targetDir = if (Test-Path "2-client-user") { "2-client-user" } else { "." }
Set-Location $targetDir

Write-Host "[1/4] Memeriksa koneksi internet..." -ForegroundColor Yellow
$ping = Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet
if ($ping) {
    Write-Host "[OK] Terhubung ke internet." -ForegroundColor Green
} else {
    Write-Host "[PERINGATAN] Offline mode. Melanjutkan proses lokal..." -ForegroundColor Yellow
}

Write-Host "`n[2/4] Memeriksa git updates..." -ForegroundColor Yellow
try {
    $gitStatus = git status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Menjalankan git pull..." -ForegroundColor Cyan
        git pull
        Write-Host "[OK] Repository telah diperbarui." -ForegroundColor Green
    } else {
        Write-Host "[INFO] Direktori bukan git repository. Lanjut langkah berikutnya." -ForegroundColor Gray
    }
} catch {
    Write-Host "[INFO] Git tidak terdeteksi." -ForegroundColor Gray
}

Write-Host "`n[3/4] Memeriksa paket npm..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    npm install --no-audit --prefer-offline
    Write-Host "[OK] Dependensi terinstal lengkap." -ForegroundColor Green
}

Write-Host "`n[4/4] Sistem JOSJIS IT TEAM siap!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
$choice = Read-Host "Jalankan JOSJIS IT TEAM sekarang? (Y/N, default Y)"
if ($choice -ne "N" -and $choice -ne "n") {
    Write-Host "Memulai JOSJIS IT TEAM..." -ForegroundColor Cyan
    Start-Process -FilePath "npm" -ArgumentList "start"
}

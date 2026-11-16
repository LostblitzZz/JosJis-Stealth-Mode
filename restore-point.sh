#!/usr/bin/env bash
# ==============================================================================
# JOSJIS IT TEAM - RESTORE SCRIPT
# Restore state to Tag: v2.3-stable-restore-point (Commit: 31dbbe2)
# ==============================================================================
set -e

REPO_DIR="/home/raitzu/JosJis-Stealth-Mode"
cd "$REPO_DIR"

echo "=== [1/4] Mengembalikan Kode Git ke Restore Point Stable ==="
git checkout v2.3-stable-restore-point
echo "✓ Git HEAD dipulihkan ke v2.3-stable-restore-point"

echo "=== [2/4] Memulihkan Database SQLite dari Snapshot ==="
if [ -f "$REPO_DIR/1-server/backups/josjis.db.restore-point-v2.3" ]; then
    cp "$REPO_DIR/1-server/backups/josjis.db.restore-point-v2.3" "$REPO_DIR/1-server/josjis.db"
    echo "✓ Database SQLite dipulihkan dari snapshot."
fi

echo "=== [3/4] Memulihkan Executable Windows josjis-stealth.exe ==="
if [ -f "$REPO_DIR/2-client-user/dist/josjis-stealth-restore-point-v2.3.exe" ]; then
    cp "$REPO_DIR/2-client-user/dist/josjis-stealth-restore-point-v2.3.exe" "$REPO_DIR/2-client-user/dist/josjis-stealth.exe"
    echo "✓ Executable dist/josjis-stealth.exe dipulihkan."
fi

echo "=== [4/4] Memuat Ulang Service Server & Tunnel PM2 ==="
pm2 reload josjis-server || pm2 restart josjis-server
pm2 reload josjis-tunnel || pm2 restart josjis-tunnel

echo "=========================================================="
echo "✓ RESTORE SELESAI: Sistem kembali ke titik aman 100%!"
echo "=========================================================="

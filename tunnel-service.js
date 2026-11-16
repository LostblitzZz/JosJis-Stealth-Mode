/**
 * JOSJIS IT TEAM - Tunnel Manager Service
 * Manages Cloudflare Quick Tunnel, extracts live public HTTPS URL,
 * and automatically configures client server.txt and download packages.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname;
const COMPACT_DIR = path.join(PROJECT_ROOT, '3-compact-client');
const PUBLIC_URL_FILE = path.join(PROJECT_ROOT, 'public-url.txt');
const SERVER_TXT = path.join(COMPACT_DIR, 'server.txt');
const QUICK_LAUNCH = path.join(COMPACT_DIR, 'Josjis-Quick-Launch.bat');
const ZIP_PATH = path.join(COMPACT_DIR, 'josjis-compact.zip');
const CONFIG_YML = path.join(PROJECT_ROOT, 'quick-tunnel.yml');

let currentUrl = null;

function updateClientConfig(tunnelUrl) {
  currentUrl = tunnelUrl;
  const webAppUrl = `${tunnelUrl}/app`;

  // 1. Simpan public-url.txt
  fs.writeFileSync(PUBLIC_URL_FILE, tunnelUrl, 'utf8');

  // 2. Simpan server.txt untuk JosjisCompact.exe
  fs.writeFileSync(SERVER_TXT, webAppUrl, 'utf8');

  // 3. Update Josjis-Quick-Launch.bat
  const batContent = `@echo off\r\ntitle JOSJIS IT TEAM - Quick Launcher\r\nstart msedge.exe --app="${webAppUrl}" --window-size=1020,680 --user-data-dir="%LOCALAPPDATA%\\JosjisCompactProfile"\r\n`;
  fs.writeFileSync(QUICK_LAUNCH, batContent, 'utf8');

  // 4. Update zip paket compact client
  try {
    const py = `import zipfile, os
zpath = r"${ZIP_PATH}"
src = r"${COMPACT_DIR}"
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as zf:
    for f in ["JosjisCompact.cs", "build-compact.bat", "Josjis-Quick-Launch.bat", "server.txt"]:
        full = os.path.join(src, f)
        if os.path.exists(full):
            zf.write(full, f)
`;
    execSync(`python3 -c '${py}'`);
  } catch (err) {
    console.error('[Tunnel] Gagal update zip:', err.message);
  }

  console.log('================================================================');
  console.log('       🛡️ JOSJIS IT TEAM - CLOUDFLARE STEALTH TUNNEL ONLINE');
  console.log('================================================================');
  console.log(`🌐 Live Public URL : ${tunnelUrl}`);
  console.log(`📱 Web Console URL : ${webAppUrl}`);
  console.log('📁 Client server.txt, Quick-Launch.bat & zip berhasil diperbarui.');
  console.log('================================================================');
}

function startTunnel() {
  console.log('[Tunnel] Memulai Cloudflare Tunnel untuk http://127.0.0.1:3000 ...');

  const proc = spawn('cloudflared', [
    '--config', CONFIG_YML,
    'tunnel',
    '--url', 'http://127.0.0.1:3000'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

  const handleLine = (data) => {
    const text = data.toString();
    const match = text.match(urlRegex);
    if (match && match[0] !== currentUrl) {
      updateClientConfig(match[0]);
    }
  };

  proc.stdout.on('data', handleLine);
  proc.stderr.on('data', handleLine);

  proc.on('close', (code) => {
    console.warn(`[Tunnel] Process exited with code ${code}. Merestart dalam 5 detik...`);
    setTimeout(startTunnel, 5000);
  });

  proc.on('error', (err) => {
    console.error('[Tunnel] Error:', err);
  });
}

startTunnel();

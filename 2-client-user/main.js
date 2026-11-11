const { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// ================= PERFORMANSI & MEMORI RINGAN =================
// Flag Chromium untuk menghemat RAM (turun hingga 60%) dan startup instan
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=96'); // Batasi V8 heap ke 96MB agar sangat ringan
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,SpareRendererForSitePerProcess');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let win;
let tray = null;
let isMiniMode = false;
let normalBounds = { width: 980, height: 620 };

function createTrayIcon() {
  // Buat icon tray 16x16 pixel biru-cyan secara dinamis tanpa butuh file eksternal
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Gambar shield sederhana
      const isShield = (x >= 2 && x <= 13 && y >= 2 && y <= 9) || 
                       (y >= 9 && y <= 14 && Math.abs(x - 7.5) <= (14 - y) * 1.2);
      if (isShield) {
        canvas[idx] = 14;      // R
        canvas[idx + 1] = 165;  // G
        canvas[idx + 2] = 233;  // B (Cyan #0ea5e9)
        canvas[idx + 3] = 255;  // Alpha
      } else {
        canvas[idx + 3] = 0;
      }
    }
  }

  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  tray = new Tray(icon);
  tray.setToolTip('JOSJIS IT TEAM - Internal Secure Console');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Buka JOSJIS IT TEAM', click: () => { win.show(); win.focus(); } },
    { label: 'Toggle Mode Mini Melayang', click: () => { toggleMiniMode(); } },
    { label: 'Boss Key (Alt+Q)', click: () => { toggleBossKey(); } },
    { type: 'separator' },
    { label: 'Keluar Aplikasi', click: () => { app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
      win.focus();
    }
  });
}

function toggleBossKey() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
}

function toggleMiniMode() {
  if (!win) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  if (!isMiniMode) {
    const currentBounds = win.getBounds();
    if (currentBounds.width >= 500 && currentBounds.height >= 400) {
      normalBounds = currentBounds;
    }
    isMiniMode = true;

    // Set bounds mode mini yang pas, rapi dan elegan (320 x 440)
    win.setBounds({
      x: Math.round(width - 335),
      y: Math.round(height - 455),
      width: 320,
      height: 440
    }, false);

    win.setAlwaysOnTop(true, 'screen-saver');
  } else {
    isMiniMode = false;
    win.setAlwaysOnTop(false);

    const targetWidth = (normalBounds.width >= 500) ? normalBounds.width : 980;
    const targetHeight = (normalBounds.height >= 400) ? normalBounds.height : 620;

    let targetX = normalBounds.x;
    let targetY = normalBounds.y;

    if (!targetX || !targetY || targetX <= 0 || targetY <= 0 || targetX >= width - 100) {
      targetX = Math.round((width - targetWidth) / 2);
      targetY = Math.round((height - targetHeight) / 2);
    }

    win.setBounds({
      x: targetX,
      y: targetY,
      width: targetWidth,
      height: targetHeight
    }, false);
  }

  win.webContents.send('mini-mode-changed', isMiniMode);
}

function createWindow() {
  win = new BrowserWindow({
    title: 'JOSJIS IT TEAM',
    width: normalBounds.width,
    height: normalBounds.height,
    minWidth: 280,
    minHeight: 280,
    frame: false,          // Borderless window
    backgroundColor: '#0b0f14',
    alwaysOnTop: false,
    show: false,           // Tampilkan setelah siap agar tidak ada white flash
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
  });

  createTrayIcon();

  const updateNormalBounds = () => {
    if (!isMiniMode && win && !win.isMaximized()) {
      const b = win.getBounds();
      if (b.width >= 500 && b.height >= 400) {
        normalBounds = b;
      }
    }
  };

  win.on('resize', updateNormalBounds);
  win.on('move', updateNormalBounds);

  // 1. FITUR BOSS KEY (Alt + Q)
  globalShortcut.register('Alt+Q', toggleBossKey);

  // 2. FITUR MINI POP-UP MODE
  ipcMain.on('toggle-mini', toggleMiniMode);

  // 3. Kontrol Jendela (Minimize, Maximize, Hide, Close)
  ipcMain.on('minimize-window', () => {
    if (win) win.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('hide-window', () => {
    if (win) win.hide();
  });

  ipcMain.on('close-app', () => {
    app.quit();
  });

  // 4. Jalankan script update
  ipcMain.on('run-update-script', () => {
    const updateBatPath = path.join(__dirname, '..', 'update.bat');
    const localBatPath = path.join(__dirname, 'update.bat');
    const targetScript = require('fs').existsSync(updateBatPath) ? updateBatPath : localBatPath;

    exec(`start "" "${targetScript}"`, (err) => {
      if (err) console.error('Gagal menjalankan update:', err);
    });
  });

  ipcMain.on('open-external', (event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    try { tray.destroy(); } catch (e) {}
  }
});

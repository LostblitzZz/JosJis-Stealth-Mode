# 🛡️ JOSJIS IT TEAM v2.3

Aplikasi komunikasi internal & monitoring operasional **JOSJIS IT TEAM** dengan antarmuka **IT Console & Stealth Ops** (Boss Key `Alt+Q`, Ghost Mode transparan, Mini Pop-up melayang), dilengkapi **Database Persisten (SQLite3 WAL)**, **Sistem Akun Multi-User (Register & Login)**, serta pilihan **Web Console** dan **Compact Stealth Client (< 50 KB)**.

---

## 🌟 Fitur Utama (v2.3)

1. **🔐 Sistem Akun Multi-User IT Portal**:
   - Menu **Register** & **Login** lengkap khusus tim IT.
   - Pilihan peran IT: *IT Lead*, *DevOps*, *SysAdmin*, *Developer*, *CyberSec*, *IT Support*.
   - Avatar icon tech: Terminal 💻, SysAdmin 🛡️, Server 🖧, Cloud ⚡, Security 🔒, Kopi ☕.
   - Panel profil anggota di pojok kiri bawah dengan indikator status kehadiran (🟢 Online, 🟡 Idle, 🔴 DND, ⚪ Invisible).

2. **💾 Database SQLite3 Persisten & Online Realtime**:
   - **Data tersimpan permanen di disk server**: Menggunakan mesin **SQLite3** dengan Write-Ahead Logging (WAL) sehingga chat, channel, dan akun anggota tidak akan pernah hilang meski aplikasi atau server ditutup/restart.
   - **Bisa diinspeksi**: File database `1-server/josjis.db` dapat dibuka dan dilihat layaknya pgAdmin menggunakan tool visual gratis seperti **DB Browser for SQLite** atau **DBeaver**.
   - **Koneksi Realtime Socket.io**: Terhubung langsung ke backend server online tanpa ketergantungan broker publik eksternal.
   - Channel bawaan divisi IT:
     - `# general`: Diskusi umum tim IT
     - `# it-ops`: Operasional server, deployment, & infrastruktur
     - `# incident-alerts`: Laporan insiden darurat & bug kritis
     - `# server-log`: Log aktivitas daemon & status sistem
     - `# random-talk`: Obrolan santai tim & ngopi
   - Bebas menambahkan channel kustom baru dengan tombol `+`.

3. **⚡ Josjis Compact Stealth Client (< 50 KB)**:
   - Client native Windows (C# .NET) super ringan dengan ukuran file hanya **~45 KB** (bukan 100+ MB).
   - Menggunakan engine bawaan Windows (Microsoft Edge) tanpa perlu bundle Chromium atau Node.js.
   - Fitur Win32 OS-level: **Boss Key (`Alt + Q`)**, **Auto-Opacity Ghost Mode** (transparan 15% saat mouse menjauh), **Panic Key (`Esc`)**, dan **System Tray**.
   - Bisa dikompilasi 1 detik menggunakan compiler bawaan Windows (`csc.exe`) via `build-compact.bat`.

4. **🌐 Direct Web Console (0 MB Download)**:
   - Server langsung menyajikan tampilan antarmuka web client di route `/app`.
   - Siapa pun di jaringan lokal dapat langsung mengakses console dari browser tanpa download maupun install.

5. **🎨 Desain IT Console & Stealth Ops**:
   - Tampilan Cyber-Dark modern bernuansa terminal IT profesional.
   - Panel kanan daftar anggota IT online (`TIM ONLINE`).
   - Notifikasi suara audio saat ada pesan masuk.
   - **Boss Key (`Alt + Q`)**: Sembunyikan dan munculkan jendela secara instan.
   - **Ghost Mode (Transparan)**: Jendela menjadi transparan (opacity 15%) saat mouse menjauh.
   - **Mini Pop-up Mode**: Mode melayang di pojok kanan bawah.

---

## 📂 Struktur Direktori

```
JosJis-Stealth-Mode/
├── 1-server/                   # Central Backend Server (Express + Socket.io + SQLite3)
│   ├── server.js               # REST API, Socket.io, & Static Web Console
│   ├── database.js             # SQLite3 WAL Storage Layer
│   └── package.json
│
├── 2-client-user/              # Aplikasi Klien Desktop (Electron Full)
│   ├── index.html              # Antarmuka Cyber-Dark JOSJIS IT TEAM
│   ├── main.js                 # Electron Main Process & Win32 Shortcut
│   ├── db.js                   # Engine Local Cache & Storage
│   └── package.json
│
├── 3-compact-client/           # Klien Native Super Ringan (< 50 KB)
│   ├── JosjisCompact.cs        # Source code C# Native Win32 Client
│   ├── build-compact.bat       # Script compile 1-klik via csc.exe bawaan Windows
│   └── Josjis-Quick-Launch.bat # Shortcut instan Edge standalone app
│
├── start-app.bat               # Launcher multi-mode (Compact / Dev / EXE)
├── update.bat                  # 1-Klik update seluruh sistem (Batch)
├── update.ps1                  # 1-Klik update seluruh sistem (PowerShell)
├── build.bat                   # 1-Klik kompilasi portable josjis.exe
└── README.md
```

---

## 🚀 Cara Menjalankan

1. **Jalankan Aplikasi:**
   - Cukup klik dua kali **`start-app.bat`** di folder utama, lalu pilih mode yang diinginkan:
     - `[1]` Compact Web Client (Instan & ringan)
     - `[2]` Desktop Developer Client (Electron)
     - `[3]` Portable EXE (`2-client-user/dist/josjis.exe`)
   - **ATAU** buka browser ke alamat server: `http://192.168.18.50:3000/app`
2. **Kompilasi Compact Client (< 50 KB):**
   - Buka folder `3-compact-client/` dan klik dua kali **`build-compact.bat`**.
3. **Update Otomatis:**
   - Cukup klik dua kali **`update.bat`**.

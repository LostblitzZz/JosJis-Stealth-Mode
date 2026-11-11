# 🛡️ JOSJIS IT TEAM v2.1

Aplikasi komunikasi internal & monitoring operasional **JOSJIS IT TEAM** dengan antarmuka **IT Console & Stealth Ops** (Boss Key `Alt+Q`, Ghost Mode transparan, Mini Pop-up melayang), dilengkapi **Database Persisten** dan **Sistem Akun Multi-User (Register & Login)**.

---

## 🌟 Fitur Utama (v2.1)

1. **🔐 Sistem Akun Multi-User IT Portal**:
   - Menu **Register** & **Login** lengkap khusus tim IT.
   - Pilihan peran IT: *IT Lead*, *DevOps*, *SysAdmin*, *Developer*, *CyberSec*, *IT Support*.
   - Avatar icon tech: Terminal 💻, SysAdmin 🛡️, Server 🖧, Cloud ⚡, Security 🔒, Kopi ☕.
   - Panel profil anggota di pojok kiri bawah dengan indikator status kehadiran (🟢 Online, 🟡 Idle, 🔴 DND, ⚪ Invisible).

2. **💾 Database Persisten (Chat & Channel Saver)**:
   - **Pesan tidak akan pernah hilang** saat berpindah-pindah channel atau saat aplikasi dibuka ulang!
   - Seluruh riwayat pesan di semua channel tersimpan di database lokal [`db.js`](file:///d:/Porto%20Project/josjis/2-client-user/db.js).
   - Channel bawaan divisi IT:
     - `# general`: Diskusi umum tim IT
     - `# it-ops`: Operasional server, deployment, & infrastruktur
     - `# incident-alerts`: Laporan insiden darurat & bug kritis
     - `# server-log`: Log aktivitas daemon & status sistem
     - `# random-talk`: Obrolan santai tim & ngopi
   - Bebas menambahkan channel kustom baru dengan tombol `+`.

3. **🎨 Desain IT Console & Stealth Ops**:
   - Tampilan Cyber-Dark modern bernuansa terminal IT profesional.
   - Panel kanan daftar anggota IT online (`TIM ONLINE`).
   - Notifikasi suara audio saat ada pesan masuk.
   - **Boss Key (`Alt + Q`)**: Sembunyikan dan munculkan jendela secara instan.
   - **Ghost Mode (Transparan)**: Jendela menjadi transparan (opacity 12%) saat mouse menjauh.
   - **Mini Pop-up Mode**: Mode melayang di pojok kanan bawah.

4. **🚀 Script Auto-Update 1-Klik**:
   - [`update.bat`](file:///d:/Porto%20Project/josjis/update.bat) & [`update.ps1`](file:///d:/Porto%20Project/josjis/update.ps1): Pengguna tinggal klik 2x untuk langsung memperbarui dependensi dan kode program secara otomatis.
   - Menu **⚡ Update** langsung di dalam aplikasi (Header bar & Pengaturan).

---

## 📂 Struktur Direktori

```
josjis/
├── 1-server/                   # Backend Server Opsional (Express + Socket.io + Database)
│   ├── server.js
│   ├── server_db.json
│   ├── start-server.bat        # 1-Klik jalankan server
│   └── package.json
│
├── 2-client-user/              # Aplikasi Klien Desktop (Electron + IT Console)
│   ├── index.html              # Antarmuka JOSJIS IT TEAM
│   ├── main.js                 # Electron Main Process & Shortcut
│   ├── db.js                   # Engine Database Persisten
│   ├── package.json
│   ├── update.bat              # Skrip update lokal
│   ├── build.bat               # Skrip build portable josjis.exe
│   └── dist/
│       └── josjis.exe          # Executable portabel siap pakai
│
├── start-app.bat               # 1-Klik jalankan aplikasi klien
├── update.bat                  # 1-Klik update seluruh sistem (Batch)
├── update.ps1                  # 1-Klik update seluruh sistem (PowerShell)
├── build.bat                   # 1-Klik kompilasi josjis.exe
└── README.md
```

---

## 🚀 Cara Menjalankan

1. **Jalankan Aplikasi:**
   - Cukup klik dua kali **`start-app.bat`** di folder utama, **ATAU**
   - Jalankan file executable portabel: **`2-client-user/dist/josjis.exe`**.
2. **Update Otomatis:**
   - Cukup klik dua kali **`update.bat`**.

/**
 * JOSJIS IT TEAM - Central Backend Server v2.2
 * Express + Socket.io + SQLite3 Persistent Database
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e7 // 10MB limit for image attachments
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ================= PASSWORD UTILS =================
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verify === hash;
}

function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.passwordHash;
  delete safe.salt;
  return safe;
}

// ================= REST API ROUTES =================

// 0. Root
app.get('/', (req, res) => {
  const exePath = path.join(__dirname, '../2-client-user/dist/josjis.exe');
  const exeAvailable = fs.existsSync(exePath);
  let exeSize = 0;
  if (exeAvailable) {
    try {
      exeSize = (fs.statSync(exePath).size / (1024 * 1024)).toFixed(1);
    } catch (_) {}
  }

  if (req.accepts('html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JOSJIS IT TEAM - Central Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0a0e14; color: #d3c6aa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #151b23; border: 1px solid #30363d; border-radius: 12px; padding: 36px 32px; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { color: #a7c080; margin: 12px 0 6px 0; font-size: 24px; letter-spacing: 0.5px; }
    p { color: #859289; font-size: 14px; margin-bottom: 26px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: rgba(167, 192, 128, 0.15); color: #a7c080; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #a7c080; color: #151b23; text-decoration: none; font-weight: bold; padding: 13px 28px; border-radius: 8px; font-size: 15px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(167, 192, 128, 0.3); }
    .btn:hover { background: #83c092; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(167, 192, 128, 0.4); }
    .meta { font-size: 12px; color: #7fbbb3; margin-top: 14px; }
    .db-badge { font-size: 11px; color: #9da9a0; margin-top: 20px; border-top: 1px solid #21262d; padding-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● SERVER ONLINE &amp; WAL PERSISTENT</div>
    <h1>JOSJIS IT TEAM</h1>
    <p>Central Synchronization &amp; Stealth Ops Network</p>
    ${exeAvailable ? `
      <a class="btn" href="/download/josjis.exe">⬇️ Download josjis.exe (${exeSize} MB)</a>
      <div class="meta">Executable Windows Portable versi terbaru</div>
    ` : `
      <div class="meta" style="color: #e67e80;">Executable belum di-build</div>
    `}
    <div class="db-badge">Database: SQLite3 WAL Mode | Realtime: Socket.io + Cloud MQTT</div>
  </div>
</body>
</html>`);
  }

  res.json({
    status: 'online',
    name: 'JOSJIS IT TEAM Central Server',
    version: '2.2.0',
    database: 'SQLite3 (Persistent)',
    downloadExe: exeAvailable ? '/download/josjis.exe' : null
  });
});

// Download latest Windows portable executable
app.get('/download/josjis.exe', (req, res) => {
  const exePath = path.join(__dirname, '../2-client-user/dist/josjis.exe');
  if (fs.existsSync(exePath)) {
    res.download(exePath, 'josjis.exe');
  } else {
    res.status(404).json({ error: 'Executable not found. Please compile client first.' });
  }
});

// 1. Health check
app.get('/api/status', async (req, res) => {
  try {
    const channels = await db.getChannels();
    res.json({
      status: 'online',
      name: 'JOSJIS IT TEAM Central Server',
      version: '2.2.0',
      database: 'SQLite3 (Persistent)',
      totalChannels: channels.length,
      timestamp: Date.now()
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 2. Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, displayName, avatar, role, bio } = req.body;
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Username minimal 3 karakter!' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password minimal 4 karakter!' });
    }

    const cleanUser = username.trim().toLowerCase();
    const existing = await db.getUserByUsername(cleanUser);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan anggota lain!' });
    }

    const { hash, salt } = hashPassword(password);
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const user = await db.registerUser({
      id: userId,
      username: cleanUser,
      passwordHash: hash,
      salt,
      displayName: displayName?.trim() || cleanUser,
      role: role?.trim() || 'IT Staff',
      avatar: avatar || 'avatar-terminal',
      bio: bio?.trim() || 'Anggota JOSJIS IT TEAM'
    });

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (e) {
    console.error('[API] Register error:', e);
    res.status(500).json({ success: false, message: 'Gagal mendaftar: ' + e.message });
  }
});

// 3. Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUser = username?.trim().toLowerCase();
    const user = await db.getUserByUsername(cleanUser);

    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      return res.status(401).json({ success: false, message: 'Username atau password salah!' });
    }

    await db.updateUserLogin(user.id);
    const updated = await db.getUserById(user.id);

    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (e) {
    console.error('[API] Login error:', e);
    res.status(500).json({ success: false, message: 'Gagal login: ' + e.message });
  }
});

// 4. Update Profile
app.post('/api/profile/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { displayName, role, avatar, bio, status, newPassword } = req.body;

    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (role) updates.role = role;
    if (avatar) updates.avatar = avatar;
    if (bio !== undefined) updates.bio = bio;
    if (status) updates.status = status;
    if (newPassword && newPassword.length >= 4) {
      const { hash, salt } = hashPassword(newPassword);
      updates.passwordHash = hash;
      updates.salt = salt;
    }

    const updatedUser = await db.updateUserProfile(userId, updates);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 5. Channels
app.get('/api/channels', async (req, res) => {
  try {
    const channels = await db.getChannels();
    res.json({ success: true, channels });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/channels', async (req, res) => {
  try {
    const { name, desc } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nama channel minimal 2 karakter!' });
    }
    const channel = await db.createChannel({ name, desc });
    io.emit('channel:created', channel);
    res.json({ success: true, channel });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.delete('/api/channels/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await db.deleteChannel(id);
    io.emit('channel:deleted', id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// 6. Messages
app.get('/api/messages/:channelId', async (req, res) => {
  try {
    const chId = req.params.channelId;
    const limit = parseInt(req.query.limit) || 200;
    const messages = await db.getMessages(chId, limit);
    res.json({ success: true, messages });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/messages/clear/:channelId', async (req, res) => {
  try {
    const chId = req.params.channelId;
    await db.clearChannelMessages(chId);
    io.emit('chat:cleared', { channelId: chId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ================= SOCKET.IO REALTIME =================
const onlineUsers = new Map(); // socket.id -> userObj

io.on('connection', (socket) => {
  console.log(`[SOCKET] Klien terhubung: ${socket.id}`);

  // User join / heartbeat
  socket.on('user:join', (userData) => {
    if (userData && userData.id) {
      onlineUsers.set(socket.id, userData);
      broadcastOnlineMembers();
    }
  });

  // Join channel room
  socket.on('channel:join', (channelId) => {
    socket.join(channelId);
  });

  // Send chat message
  socket.on('chat:message', async (rawMsg, ack) => {
    try {
      const savedMsg = await db.saveMessage(rawMsg);
      io.emit('chat:message', savedMsg);
      if (typeof ack === 'function') ack({ success: true, message: savedMsg });
    } catch (err) {
      console.error('[SOCKET] Gagal simpan pesan:', err);
      if (typeof ack === 'function') ack({ success: false, error: err.message });
    }
  });

  // User presence / status change
  socket.on('user:status', (statusData) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      user.status = statusData.status || 'online';
      onlineUsers.set(socket.id, user);
      broadcastOnlineMembers();
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    broadcastOnlineMembers();
    console.log(`[SOCKET] Klien terputus: ${socket.id}`);
  });
});

function broadcastOnlineMembers() {
  const uniqueUsers = new Map();
  onlineUsers.forEach((u) => {
    if (u && u.id) uniqueUsers.set(u.id, u);
  });
  io.emit('members:update', Array.from(uniqueUsers.values()));
}

// ================= START SERVER =================
db.init()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`  🛡️ JOSJIS IT TEAM - ONLINE SERVER v2.2 AKTIF`);
      console.log(`  🌐 Local: http://localhost:${PORT}`);
      console.log(`  🗄️ Database: SQLite3 (josjis.db - WAL Enabled)`);
      console.log(`=======================================================`);
    });
  })
  .catch((err) => {
    console.error('Fatal: Gagal memulai database server:', err);
    process.exit(1);
  });

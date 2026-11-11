/**
 * JOSJIS IT TEAM - Central Backend Server
 * Express + Socket.io + Persistent Database
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'server_db.json');

let db = {
  users: {},
  channels: {
    general: { id: 'general', name: 'general', desc: 'Diskusi umum divisi IT & operasional', isDefault: true, createdAt: Date.now() },
    'it-ops': { id: 'it-ops', name: 'it-ops', desc: 'Operasional server, maintenance, & infra', isDefault: true, createdAt: Date.now() },
    'incident-alerts': { id: 'incident-alerts', name: 'incident-alerts', desc: 'Laporan insiden kritis & bug', isDefault: true, createdAt: Date.now() },
    'server-log': { id: 'server-log', name: 'server-log', desc: 'Log aktivitas daemon & koneksi', isDefault: true, createdAt: Date.now() },
    'random-talk': { id: 'random-talk', name: 'random-talk', desc: 'Obrolan santai tim IT & kopi', isDefault: true, createdAt: Date.now() }
  },
  messages: {
    general: [],
    'it-ops': [],
    'incident-alerts': [],
    'server-log': [],
    'random-talk': []
  }
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = Object.assign(db, JSON.parse(raw));
      console.log('[DB] Data server JOSJIS IT TEAM berhasil dimuat.');
    }
  } catch (e) {
    console.error('[DB] Gagal memuat server_db.json:', e);
  }
}

function saveDb() {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('[DB] Gagal menyimpan server_db.json:', e);
  }
}

loadDb();

app.use(cors());
app.use(express.json());

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verify === hash;
}

// Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', name: 'JOSJIS IT TEAM Central Server', version: '2.1.0' });
});

// Register
app.post('/api/register', (req, res) => {
  const { username, password, displayName, avatar, role, bio } = req.body;
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Username minimal 3 karakter!' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ success: false, message: 'Password minimal 4 karakter!' });
  }

  const cleanUser = username.trim().toLowerCase();
  const exists = Object.values(db.users).find(u => u.username.toLowerCase() === cleanUser);
  if (exists) {
    return res.status(400).json({ success: false, message: 'Username sudah digunakan!' });
  }

  const { hash, salt } = hashPassword(password);
  const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  const newUser = {
    id: userId,
    username: cleanUser,
    displayName: displayName?.trim() || cleanUser,
    role: role?.trim() || 'IT Staff',
    passwordHash: hash,
    salt,
    avatar: avatar || 'avatar-terminal',
    bio: bio?.trim() || 'Anggota JOSJIS IT TEAM',
    status: 'online',
    createdAt: Date.now()
  };

  db.users[userId] = newUser;
  saveDb();

  const safe = { ...newUser };
  delete safe.passwordHash;
  delete safe.salt;
  res.json({ success: true, user: safe });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUser = username?.trim().toLowerCase();
  const user = Object.values(db.users).find(u => u.username.toLowerCase() === cleanUser);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ success: false, message: 'Username atau password salah!' });
  }

  user.status = 'online';
  saveDb();

  const safe = { ...user };
  delete safe.passwordHash;
  delete safe.salt;
  res.json({ success: true, user: safe });
});

// Channels & Messages
app.get('/api/channels', (req, res) => {
  res.json({ success: true, channels: Object.values(db.channels) });
});

app.get('/api/messages/:channelId', (req, res) => {
  const chId = req.params.channelId;
  const msgs = db.messages[chId] || [];
  res.json({ success: true, messages: msgs.slice(-200) });
});

// Socket.io
const activeSockets = new Map();

io.on('connection', (socket) => {
  console.log(`[SOCKET] Sesi terhubung: ${socket.id}`);

  socket.on('user:join', (userData) => {
    if (userData && userData.id) {
      activeSockets.set(socket.id, userData);
      io.emit('members:update', Array.from(activeSockets.values()));
    }
  });

  socket.on('channel:join', (channelId) => {
    socket.join(channelId);
  });

  socket.on('chat:message', (msg) => {
    const chId = msg.channelId || 'general';
    if (!db.messages[chId]) db.messages[chId] = [];

    const fullMsg = {
      id: msg.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      channelId: chId,
      userId: msg.userId,
      username: msg.username,
      displayName: msg.displayName || msg.username,
      role: msg.role || 'IT Staff',
      avatar: msg.avatar || 'avatar-terminal',
      text: msg.text,
      image: msg.image || null,
      timestamp: msg.timestamp || Date.now(),
      timeStr: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isSystem: Boolean(msg.isSystem)
    };

    db.messages[chId].push(fullMsg);
    if (db.messages[chId].length > 2000) db.messages[chId] = db.messages[chId].slice(-2000);
    saveDb();

    io.emit('chat:message', fullMsg);
  });

  socket.on('disconnect', () => {
    activeSockets.delete(socket.id);
    io.emit('members:update', Array.from(activeSockets.values()));
    console.log(`[SOCKET] Sesi terputus: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🛡️ JOSJIS IT TEAM - BACKEND SERVER BERJALAN`);
  console.log(`  🌐 Port: http://localhost:${PORT}`);
  console.log(`  📁 Database: ${DB_FILE}`);
  console.log(`=======================================================`);
});

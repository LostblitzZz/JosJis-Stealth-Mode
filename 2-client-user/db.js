/**
 * JOSJIS IT TEAM - Database Engine
 * Persistent local storage for Internal Team Chat & User Management
 * Uses JSON file storage in Electron's userData path with atomic writes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Database {
  constructor() {
    this.dbPath = this.resolveDbPath();
    this.data = {
      users: {},
      channels: {},
      messages: {},
      sessions: {
        currentUserId: null,
        rememberMe: true,
        secretKey: 'mbuh',
        theme: 'it-dark',
        soundEnabled: true,
        connectionMode: 'server',
        serverUrl: 'http://localhost:3000',
        stealthOpacity: 0.15
      }
    };
    this.init();
  }

  resolveDbPath() {
    try {
      const electron = require('electron');
      const app = electron.app || (electron.remote && electron.remote.app);
      if (app && typeof app.getPath === 'function') {
        const userDir = app.getPath('userData');
        return path.join(userDir, 'josjis_it_team_db.json');
      }
    } catch (e) {}
    const localDir = path.join(__dirname, 'data');
    if (!fs.existsSync(localDir)) {
      try { fs.mkdirSync(localDir, { recursive: true }); } catch (err) {}
    }
    return path.join(localDir, 'josjis_it_team_db.json');
  }

  init() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = Object.assign(this.data, parsed);
      }
    } catch (e) {
      console.error('[DB] Gagal memuat database lama, membuat baru:', e);
    }

    this.ensureDefaultChannels();
    this.save();
  }

  save() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = this.dbPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.dbPath);
    } catch (e) {
      console.error('[DB] Gagal menyimpan data:', e);
    }
  }

  ensureDefaultChannels() {
    const defaults = [
      { id: 'general', name: 'general', desc: 'Diskusi umum divisi IT & operasional harian', isDefault: true },
      { id: 'it-ops', name: 'it-ops', desc: 'Operasional server, maintenance, deployment & infra', isDefault: true },
      { id: 'incident-alerts', name: 'incident-alerts', desc: 'Laporan insiden kritis, bug darurat & outage', isDefault: true },
      { id: 'server-log', name: 'server-log', desc: 'Log aktivitas, daemon status & koneksi sistem', isDefault: true },
      { id: 'random-talk', name: 'random-talk', desc: 'Obrolan santai tim, meme teknis & kopi', isDefault: true }
    ];

    if (!this.data.channels) this.data.channels = {};
    defaults.forEach(ch => {
      if (!this.data.channels[ch.id]) {
        this.data.channels[ch.id] = {
          ...ch,
          createdAt: Date.now()
        };
      }
      if (!this.data.messages[ch.id]) {
        this.data.messages[ch.id] = [];
      }
    });
  }

  // ================= USER & AUTHENTICATION =================

  hashPassword(password, salt) {
    if (!salt) salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  verifyPassword(password, hash, salt) {
    const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return verify === hash;
  }

  registerUser(username, password, displayName, avatar, role = 'IT Staff', bio = '') {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) {
      return { success: false, message: 'Username minimal 3 karakter!' };
    }
    if (!password || password.length < 4) {
      return { success: false, message: 'Password minimal 4 karakter!' };
    }

    const exists = Object.values(this.data.users).find(u => u.username.toLowerCase() === cleanUser);
    if (exists) {
      return { success: false, message: 'Username sudah digunakan oleh anggota IT lain!' };
    }

    const { hash, salt } = this.hashPassword(password);
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const newUser = {
      id: userId,
      username: cleanUser,
      displayName: displayName.trim() || cleanUser,
      role: role.trim() || 'IT Staff',
      passwordHash: hash,
      salt: salt,
      avatar: avatar || 'avatar-terminal',
      bio: bio.trim() || 'Anggota JOSJIS IT TEAM',
      status: 'online',
      createdAt: Date.now(),
      lastLogin: Date.now()
    };

    this.data.users[userId] = newUser;
    this.data.sessions.currentUserId = userId;
    this.save();

    const safeUser = { ...newUser };
    delete safeUser.passwordHash;
    delete safeUser.salt;
    return { success: true, user: safeUser };
  }

  loginUser(username, password) {
    const cleanUser = username.trim().toLowerCase();
    const user = Object.values(this.data.users).find(u => u.username.toLowerCase() === cleanUser);

    if (!user) {
      return { success: false, message: 'ID Anggota / Username tidak ditemukan!' };
    }

    const isValid = this.verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return { success: false, message: 'Password salah!' };
    }

    user.lastLogin = Date.now();
    user.status = 'online';
    this.data.sessions.currentUserId = user.id;
    this.save();

    const safeUser = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.salt;
    return { success: true, user: safeUser };
  }

  saveRemoteUser(user) {
    if (!user || !user.id) return null;
    this.data.users[user.id] = { ...user };
    this.data.sessions.currentUserId = user.id;
    this.save();
    return user;
  }

  getCurrentUser() {
    const uid = this.data.sessions.currentUserId;
    if (uid && this.data.users[uid]) {
      const safe = { ...this.data.users[uid] };
      delete safe.passwordHash;
      delete safe.salt;
      return safe;
    }
    return null;
  }

  logout() {
    if (this.data.sessions.currentUserId && this.data.users[this.data.sessions.currentUserId]) {
      this.data.users[this.data.sessions.currentUserId].status = 'offline';
    }
    this.data.sessions.currentUserId = null;
    this.save();
    return { success: true };
  }

  updateProfile(userId, updates = {}) {
    const user = this.data.users[userId];
    if (!user) return { success: false, message: 'User tidak ditemukan' };

    if (updates.displayName) user.displayName = updates.displayName.trim();
    if (updates.role) user.role = updates.role.trim();
    if (updates.avatar) user.avatar = updates.avatar;
    if (updates.bio !== undefined) user.bio = updates.bio.trim();
    if (updates.status) user.status = updates.status;

    if (updates.newPassword) {
      if (updates.newPassword.length < 4) {
        return { success: false, message: 'Password baru minimal 4 karakter!' };
      }
      const { hash, salt } = this.hashPassword(updates.newPassword);
      user.passwordHash = hash;
      user.salt = salt;
    }

    this.save();
    const safe = { ...user };
    delete safe.passwordHash;
    delete safe.salt;
    return { success: true, user: safe };
  }

  getAllUsers() {
    return Object.values(this.data.users).map(u => {
      const copy = { ...u };
      delete copy.passwordHash;
      delete copy.salt;
      return copy;
    });
  }

  // ================= CHANNELS =================

  getChannels() {
    return Object.values(this.data.channels).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  setChannels(channelList) {
    if (!Array.isArray(channelList)) return;
    if (!this.data.channels) this.data.channels = {};
    channelList.forEach(ch => {
      this.data.channels[ch.id] = {
        id: ch.id,
        name: ch.name,
        desc: ch.desc || '',
        isDefault: Boolean(ch.isDefault),
        createdAt: ch.createdAt || Date.now()
      };
      if (!this.data.messages[ch.id]) {
        this.data.messages[ch.id] = [];
      }
    });
    this.save();
  }

  createChannel(name, description = '') {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName || cleanName.length < 2) {
      return { success: false, message: 'Nama channel minimal 2 karakter!' };
    }

    if (this.data.channels[cleanName]) {
      return { success: false, message: `Channel #${cleanName} sudah ada!` };
    }

    const channel = {
      id: cleanName,
      name: cleanName,
      desc: description.trim() || `Channel komunikasi IT #${cleanName}`,
      isDefault: false,
      createdAt: Date.now()
    };

    this.data.channels[cleanName] = channel;
    if (!this.data.messages[cleanName]) {
      this.data.messages[cleanName] = [];
    }
    this.save();
    return { success: true, channel };
  }

  deleteChannel(channelId) {
    if (this.data.channels[channelId]?.isDefault) {
      return { success: false, message: 'Channel sistem tidak boleh dihapus!' };
    }
    delete this.data.channels[channelId];
    delete this.data.messages[channelId];
    this.save();
    return { success: true };
  }

  // ================= MESSAGES & PERSISTENCE =================

  setMessages(channelId, messageList) {
    if (!channelId || !Array.isArray(messageList)) return;
    if (!this.data.messages[channelId]) this.data.messages[channelId] = [];
    
    const map = new Map();
    this.data.messages[channelId].forEach(m => map.set(m.id, m));
    messageList.forEach(m => map.set(m.id, m));

    this.data.messages[channelId] = Array.from(map.values())
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .slice(-2000);

    this.save();
  }

  saveMessage(msg) {
    const chId = msg.channelId || 'general';
    if (!this.data.messages[chId]) {
      this.data.messages[chId] = [];
    }

    const messageObj = {
      id: msg.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      channelId: chId,
      userId: msg.userId || 'anon',
      username: msg.username || 'anon',
      displayName: msg.displayName || msg.username || 'anon',
      role: msg.role || 'IT Staff',
      avatar: msg.avatar || 'avatar-terminal',
      text: msg.text || '',
      image: msg.image || null,
      timestamp: msg.timestamp || Date.now(),
      timeStr: msg.timeStr || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isSystem: Boolean(msg.isSystem)
    };

    const existingIndex = this.data.messages[chId].findIndex(m => m.id === messageObj.id);
    if (existingIndex === -1) {
      this.data.messages[chId].push(messageObj);
      if (this.data.messages[chId].length > 2000) {
        this.data.messages[chId] = this.data.messages[chId].slice(-2000);
      }
      this.save();
    }
    return messageObj;
  }

  getMessages(channelId, limit = 200) {
    if (!this.data.messages[channelId]) {
      return [];
    }
    const msgs = this.data.messages[channelId];
    return msgs.slice(-limit);
  }

  clearChannelMessages(channelId) {
    if (this.data.messages[channelId]) {
      this.data.messages[channelId] = [];
      this.save();
    }
    return { success: true };
  }

  // ================= SETTINGS =================

  getSettings() {
    return { ...this.data.sessions };
  }

  saveSettings(updates = {}) {
    this.data.sessions = { ...this.data.sessions, ...updates };
    this.save();
    return this.data.sessions;
  }
}

module.exports = new Database();

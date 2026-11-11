/**
 * JOSJIS IT TEAM - SQLite Database Layer
 * Reliable ACID-compliant persistence using SQLite3
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'josjis.db');

class SqliteDatabase {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('[DB] Gagal membuka database SQLite:', err);
          return reject(err);
        }
        console.log(`[DB] Database SQLite terhubung di: ${DB_PATH}`);
        
        // Aktifkan WAL (Write-Ahead Logging) untuk performa tinggi & anti korup
        this.db.run('PRAGMA journal_mode = WAL;', (walErr) => {
          if (walErr) console.warn('[DB] Gagal menyalakan WAL:', walErr);
          this.createTables()
            .then(() => this.seedDefaults())
            .then(resolve)
            .catch(reject);
        });
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async createTables() {
    // 1. Users table
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT DEFAULT 'IT Staff',
        avatar TEXT DEFAULT 'avatar-terminal',
        bio TEXT DEFAULT '',
        status TEXT DEFAULT 'online',
        created_at INTEGER,
        last_login INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

    // 2. Channels table
    await this.run(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        desc TEXT DEFAULT '',
        is_default INTEGER DEFAULT 0,
        created_at INTEGER
      )
    `);

    // 3. Messages table
    await this.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT,
        role TEXT,
        avatar TEXT,
        text TEXT,
        image TEXT,
        timestamp INTEGER,
        time_str TEXT,
        is_system INTEGER DEFAULT 0
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_messages_channel_time ON messages(channel_id, timestamp)`);

    console.log('[DB] Tabel-tabel SQLite siap.');
  }

  async seedDefaults() {
    const defaults = [
      { id: 'general', name: 'general', desc: 'Diskusi umum divisi IT & operasional harian' },
      { id: 'it-ops', name: 'it-ops', desc: 'Operasional server, maintenance, deployment & infra' },
      { id: 'incident-alerts', name: 'incident-alerts', desc: 'Laporan insiden kritis, bug darurat & outage' },
      { id: 'server-log', name: 'server-log', desc: 'Log aktivitas daemon, status sistem & audit' },
      { id: 'random-talk', name: 'random-talk', desc: 'Obrolan santai tim IT, meme & kopi' }
    ];

    for (const ch of defaults) {
      await this.run(
        `INSERT OR IGNORE INTO channels (id, name, desc, is_default, created_at) VALUES (?, ?, ?, 1, ?)`,
        [ch.id, ch.name, ch.desc, Date.now()]
      );
    }
  }

  // ================= USER OPERATIONS =================

  async registerUser({ id, username, passwordHash, salt, displayName, role, avatar, bio }) {
    const now = Date.now();
    await this.run(
      `INSERT INTO users (id, username, password_hash, salt, display_name, role, avatar, bio, status, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)`,
      [id, username, passwordHash, salt, displayName || username, role || 'IT Staff', avatar || 'avatar-terminal', bio || '', now, now]
    );

    return this.getUserById(id);
  }

  async getUserByUsername(username) {
    const row = await this.get(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`, [username.trim()]);
    return row ? this.mapUser(row) : null;
  }

  async getUserById(id) {
    const row = await this.get(`SELECT * FROM users WHERE id = ?`, [id]);
    return row ? this.mapUser(row) : null;
  }

  async updateUserLogin(id) {
    await this.run(`UPDATE users SET last_login = ?, status = 'online' WHERE id = ?`, [Date.now(), id]);
  }

  async updateUserStatus(id, status) {
    await this.run(`UPDATE users SET status = ? WHERE id = ?`, [status, id]);
  }

  async updateUserProfile(id, updates = {}) {
    const fields = [];
    const values = [];

    if (updates.displayName) { fields.push('display_name = ?'); values.push(updates.displayName.trim()); }
    if (updates.role) { fields.push('role = ?'); values.push(updates.role.trim()); }
    if (updates.avatar) { fields.push('avatar = ?'); values.push(updates.avatar); }
    if (updates.bio !== undefined) { fields.push('bio = ?'); values.push(updates.bio.trim()); }
    if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.passwordHash && updates.salt) {
      fields.push('password_hash = ?'); values.push(updates.passwordHash);
      fields.push('salt = ?'); values.push(updates.salt);
    }

    if (fields.length > 0) {
      values.push(id);
      await this.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return this.getUserById(id);
  }

  async getAllUsers() {
    const rows = await this.all(`SELECT id, username, display_name, role, avatar, bio, status, created_at, last_login FROM users ORDER BY display_name ASC`);
    return rows.map(r => this.mapUser(r));
  }

  mapUser(row) {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      avatar: row.avatar,
      bio: row.bio,
      status: row.status,
      passwordHash: row.password_hash,
      salt: row.salt,
      createdAt: row.created_at,
      lastLogin: row.last_login
    };
  }

  // ================= CHANNELS OPERATIONS =================

  async getChannels() {
    const rows = await this.all(`SELECT * FROM channels ORDER BY is_default DESC, created_at ASC`);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      desc: r.desc,
      isDefault: Boolean(r.is_default),
      createdAt: r.created_at
    }));
  }

  async createChannel({ name, desc = '' }) {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const id = clean;
    const now = Date.now();
    await this.run(
      `INSERT INTO channels (id, name, desc, is_default, created_at) VALUES (?, ?, ?, 0, ?)`,
      [id, clean, desc.trim() || `Channel komunikasi IT #${clean}`, now]
    );
    return { id, name: clean, desc: desc.trim(), isDefault: false, createdAt: now };
  }

  async deleteChannel(id) {
    const ch = await this.get(`SELECT * FROM channels WHERE id = ?`, [id]);
    if (!ch) throw new Error('Channel tidak ditemukan');
    if (ch.is_default) throw new Error('Channel sistem tidak boleh dihapus');

    await this.run(`DELETE FROM channels WHERE id = ?`, [id]);
    await this.run(`DELETE FROM messages WHERE channel_id = ?`, [id]);
    return true;
  }

  // ================= MESSAGES OPERATIONS =================

  async saveMessage(msg) {
    const id = msg.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = msg.timestamp || Date.now();
    const timeStr = msg.timeStr || new Date(now).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await this.run(
      `INSERT OR REPLACE INTO messages (id, channel_id, user_id, username, display_name, role, avatar, text, image, timestamp, time_str, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        msg.channelId || 'general',
        msg.userId || 'anon',
        msg.username || 'anon',
        msg.displayName || msg.username || 'anon',
        msg.role || 'IT Staff',
        msg.avatar || 'avatar-terminal',
        msg.text || '',
        msg.image || null,
        now,
        timeStr,
        msg.isSystem ? 1 : 0
      ]
    );

    return {
      id,
      channelId: msg.channelId || 'general',
      userId: msg.userId,
      username: msg.username,
      displayName: msg.displayName || msg.username,
      role: msg.role || 'IT Staff',
      avatar: msg.avatar || 'avatar-terminal',
      text: msg.text || '',
      image: msg.image || null,
      timestamp: now,
      timeStr,
      isSystem: Boolean(msg.isSystem)
    };
  }

  async getMessages(channelId, limit = 200) {
    const rows = await this.all(
      `SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT ?`,
      [channelId, limit]
    );

    // Balik urutan agar kronologis (pesan lama ke baru)
    return rows.reverse().map(r => ({
      id: r.id,
      channelId: r.channel_id,
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      role: r.role,
      avatar: r.avatar,
      text: r.text,
      image: r.image,
      timestamp: r.timestamp,
      timeStr: r.time_str,
      isSystem: Boolean(r.is_system)
    }));
  }

  async clearChannelMessages(channelId) {
    await this.run(`DELETE FROM messages WHERE channel_id = ?`, [channelId]);
    return true;
  }
}

module.exports = new SqliteDatabase();

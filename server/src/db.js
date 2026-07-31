const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'centro.db');
let db = null;
let SQL = null;

async function initDb() {
  SQL = await initSqlJs();

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  initSchema();
  return db;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error guardando base de datos:', err.message);
  }
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN (
        'domain', 'ssl', 'hosting', 'license', 'insurance',
        'certificate', 'tuition', 'subscription', 'warranty'
      )),
      expiry_date TEXT NOT NULL,
      cost REAL,
      provider TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      alert_email INTEGER DEFAULT 0,
      alert_whatsapp INTEGER DEFAULT 0,
      alert_telegram INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_items_expiry ON items(expiry_date)');

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Seed default admin user if no users exist
  const userCount = queryOne('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    const bcrypt = require('bcryptjs');
    const defaultPass = bcrypt.hashSync('admin', 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', defaultPass]);
    console.log('Usuario admin creado (contraseña: admin)');
  }

  // Ensure default settings exist
  const defaultSettings = {
    smtp_enabled: 'false',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from_email: '',
    smtp_from_name: 'Centro de Renovaciones',
    last_check_date: '',
    twilio_enabled: 'false',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_from_number: '',
    twilio_to_number: '',
  };

  Object.entries(defaultSettings).forEach(([key, value]) => {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  });

  saveDb();
}

// ---- Query Helpers ----

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ---- CRUD Operations ----

function getAllItems() {
  return queryAll('SELECT * FROM items ORDER BY expiry_date ASC').map(normalizeItem);
}

function getItemById(id) {
  const row = queryOne('SELECT * FROM items WHERE id = ?', [id]);
  return row ? normalizeItem(row) : null;
}

function createItem({ name, category, expiryDate, cost, provider, notes, alertEmail, alertWhatsApp, alertTelegram }) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdAt = new Date().toISOString();

  run(
    'INSERT INTO items (id, name, category, expiry_date, cost, provider, notes, alert_email, alert_whatsapp, alert_telegram, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, category, expiryDate, cost ?? null, provider ?? '', notes ?? '', alertEmail ? 1 : 0, alertWhatsApp ? 1 : 0, alertTelegram ? 1 : 0, createdAt]
  );

  return getItemById(id);
}

function updateItem(id, { name, category, expiryDate, cost, provider, notes, alertEmail, alertWhatsApp, alertTelegram }) {
  run(
    'UPDATE items SET name = ?, category = ?, expiry_date = ?, cost = ?, provider = ?, notes = ?, alert_email = ?, alert_whatsapp = ?, alert_telegram = ? WHERE id = ?',
    [name, category, expiryDate, cost ?? null, provider ?? '', notes ?? '', alertEmail ? 1 : 0, alertWhatsApp ? 1 : 0, alertTelegram ? 1 : 0, id]
  );

  return getItemById(id);
}

function deleteItem(id) {
  const existing = getItemById(id);
  run('DELETE FROM items WHERE id = ?', [id]);
  return !!existing;
}

function deleteAllItems() {
  run('DELETE FROM items');
}

function seedItems(items) {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO items (id, name, category, expiry_date, cost, provider, notes, alert_email, alert_whatsapp, alert_telegram, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const item of items) {
    stmt.bind([item.id, item.name, item.category, item.expiryDate, item.cost ?? null, item.provider ?? '', item.notes ?? '', item.alertEmail ? 1 : 0, item.alertWhatsApp ? 1 : 0, item.alertTelegram ? 1 : 0, item.createdAt || new Date().toISOString()]);
    stmt.step();
    stmt.reset();
  }
  stmt.free();
  saveDb();
  return getAllItems();
}

// ---- Settings ----

function getSettings() {
  const rows = queryAll('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach(row => { settings[row.key] = row.value; });

  return {
    smtp_enabled: settings.smtp_enabled === 'true',
    smtp_host: settings.smtp_host || '',
    smtp_port: settings.smtp_port || '587',
    smtp_user: settings.smtp_user || '',
    smtp_pass: settings.smtp_pass || '',
    smtp_from_email: settings.smtp_from_email || '',
    smtp_from_name: settings.smtp_from_name || 'Centro de Renovaciones',
    last_check_date: settings.last_check_date || '',
    twilio_enabled: settings.twilio_enabled === 'true',
    twilio_account_sid: settings.twilio_account_sid || '',
    twilio_auth_token: settings.twilio_auth_token || '',
    twilio_from_number: settings.twilio_from_number || '',
    twilio_to_number: settings.twilio_to_number || '',
  };
}

function updateSettings(newSettings) {
  Object.entries(newSettings).forEach(([key, value]) => {
    run('UPDATE settings SET value = ? WHERE key = ?', [String(value), key]);
  });
}

// ---- Helpers ----

function normalizeItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    expiryDate: row.expiry_date,
    cost: row.cost,
    provider: row.provider,
    notes: row.notes,
    alertEmail: !!row.alert_email,
    alertWhatsApp: !!row.alert_whatsapp,
    alertTelegram: !!row.alert_telegram,
    createdAt: row.created_at,
  };
}

// ---- Auth ----

function getUserByUsername(username) {
  return queryOne('SELECT * FROM users WHERE username = ?', [username]);
}

function updatePassword(username, hashedPassword) {
  run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);
}

// ---- Close ----

function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

module.exports = {
  initDb,
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  deleteAllItems,
  seedItems,
  getSettings,
  updateSettings,
  getUserByUsername,
  updatePassword,
  closeDb,
};

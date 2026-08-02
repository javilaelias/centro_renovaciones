const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Permite apuntar a una base de datos distinta (p. ej. en tests) vía variable de entorno.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'centro.db');
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

  // Migración: si la tabla items ya existe con un CHECK que no incluye la
  // categoría 'equipment' (agregada después), se recrea preservando los datos.
  // Se elimina cualquier items_old huérfano de una ejecución parcial previa
  // para que el RENAME nunca falle por una tabla residual.
  const itemsTable = queryOne("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'");
  if (itemsTable && itemsTable.sql && !itemsTable.sql.includes('equipment')) {
    db.run('DROP TABLE IF EXISTS items_old');
    db.run('ALTER TABLE items RENAME TO items_old');
    db.run(`
      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN (
          'domain', 'ssl', 'hosting', 'license', 'insurance',
          'certificate', 'tuition', 'subscription', 'warranty', 'equipment'
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
    db.run(`
      INSERT INTO items (id, name, category, expiry_date, cost, provider, notes,
        alert_email, alert_whatsapp, alert_telegram, created_at)
      SELECT id, name, category, expiry_date, cost, provider, notes,
        alert_email, alert_whatsapp, alert_telegram, created_at FROM items_old
    `);
    db.run('DROP TABLE items_old');
    console.log('Migración: categoría equipment agregada a la tabla items');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN (
        'domain', 'ssl', 'hosting', 'license', 'insurance',
        'certificate', 'tuition', 'subscription', 'warranty', 'equipment'
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
      role TEXT NOT NULL DEFAULT 'analyst',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migración: agregar columna role si la tabla ya existía sin ella
  const userCols = queryAll('PRAGMA table_info(users)');
  if (!userCols.some(c => c.name === 'role')) {
    db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'analyst'");
  }
  // El usuario admin (sembrado o preexistente) siempre tiene rol admin
  db.run("UPDATE users SET role = 'admin' WHERE username = 'admin'");

  // Push subscriptions table (browser Web Push)
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      subscription TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Historial de cambios de estado de requerimientos (auditoría)
  db.run(`
    CREATE TABLE IF NOT EXISTS item_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      username TEXT NOT NULL,
      from_estado TEXT DEFAULT '',
      to_estado TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_item_history_item ON item_history(item_id)');

  // Seed default admin user if no users exist
  const userCount = queryOne('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    const bcrypt = require('bcryptjs');
    const defaultPass = bcrypt.hashSync('admin', 10);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', defaultPass, 'admin']);
    console.log('Usuario admin creado (contraseña: admin)');
  }

  // Ensure default settings exist
  // Lista de estados disponibles para la gestión de requerimientos (JSON).
  // NOTA: mantener en sync con REQ_ESTADO_OPTIONS de script.js (botón "Restaurar").
  // Incluye los 9 estados reales que faltaban (Revisión OAB, Sin tramitar, etc.)
  // detectados en la auditoría sobre real_items.json (2026-08).
  const defaultReqEstados = [
    'En trámite', 'Sin tramitar', 'Revisión OAB', 'Revisión área usuaria',
    'En elaboración', 'Estudio de Mercado', 'Evaluación de Propuestas', 'Apoyo presupuestal',
    'Proceso de implementación/Activación/Entrega', 'Emisión de Conformidad',
    'Por suscribir contrato', 'Contratado', 'En ejecución', 'Ejecutado', 'Culminado', 'Vigente',
    'Para reformulación', 'Desistido', 'No corresponde atención OGTI'
  ];

  // Orden lógico por defecto del flujo de estados (solo avance).
  // NOTA: mantener en sync con REQ_FLOW_DEFAULT_ORDER de script.js.
  // La variante 'En tramite' (sin tilde) ya no existe como estado aparte:
  // se normaliza a 'En trámite' (misma normalización que en el frontend).
  const defaultReqFlowOrder = [
    'Sin tramitar',
    'En trámite',
    'Revisión OAB',
    'Revisión área usuaria',
    'En elaboración',
    'Estudio de Mercado',
    'Evaluación de Propuestas',
    'Apoyo presupuestal',
    'Proceso de implementación/Activación/Entrega',
    'Emisión de Conformidad',
    'Por suscribir contrato',
    'Contratado',
    'En ejecución',
    'Ejecutado', 'Culminado', 'Vigente',
    'Para reformulación', 'Desistido', 'No corresponde atención OGTI'
  ];

  const defaultSettings = {
    req_estados: JSON.stringify(defaultReqEstados),
    req_flow_enabled: 'false',
    req_flow_order: JSON.stringify(defaultReqFlowOrder),
    tramite_url: '',
    smtp_enabled: 'false',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from_email: '',
    smtp_from_name: 'RenovaMEF',
    last_check_date: '',
    twilio_enabled: 'false',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_from_number: '',
    twilio_to_number: '',
    telegram_enabled: 'false',
    telegram_bot_token: '',
    telegram_chat_id: '',
    vapid_public_key: '',
    vapid_private_key: '',
    vapid_subject: '',
  };

  Object.entries(defaultSettings).forEach(([key, value]) => {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  });

  // Migración 2026-08: si la lista de estados y el flujo guardados son EXACTAMENTE
  // los anteriores por defecto (es decir, el admin no los personalizó), se actualizan
  // con los 9 estados reales faltantes para que aparezcan sin configuración manual.
  // ---- Migraciones de estados de requerimientos (en orden cronológico) ----

  // 1) Ampliación con los 9 estados reales faltantes (2026-08): se aplica solo si
  //    la lista guardada es EXACTAMENTE la anterior por defecto (sin personalizar).
  const oldDefaultEstados = JSON.stringify([
    'En trámite', 'En tramite', 'Ejecutado', 'Culminado', 'Vigente',
    'Proceso de implementación/Activación/Entrega', 'Emisión de Conformidad',
    'Apoyo presupuestal', 'Para reformulación', 'Desistido', 'No corresponde atención OGTI'
  ]);
  const oldDefaultFlow = JSON.stringify([
    'En trámite',
    'Apoyo presupuestal',
    'Proceso de implementación/Activación/Entrega',
    'Emisión de Conformidad',
    'Ejecutado', 'Culminado', 'Vigente',
    'Para reformulación', 'Desistido', 'No corresponde atención OGTI'
  ]);
  const storedEstados = queryOne("SELECT value FROM settings WHERE key = 'req_estados'");
  const storedFlow = queryOne("SELECT value FROM settings WHERE key = 'req_flow_order'");
  if (storedEstados && storedEstados.value === oldDefaultEstados) {
    db.run("UPDATE settings SET value = ? WHERE key = 'req_estados'", [JSON.stringify(defaultReqEstados)]);
    console.log('Migración: estados de requerimientos ampliados a la nueva lista por defecto');
  }
  if (storedFlow && storedFlow.value === oldDefaultFlow) {
    db.run("UPDATE settings SET value = ? WHERE key = 'req_flow_order'", [JSON.stringify(defaultReqFlowOrder)]);
    console.log('Migración: flujo de estados ampliado a la nueva lista por defecto');
  }

  // 2) Normalización de acentos (2026-08): 'En tramite' → 'En trámite' en la lista
  //    de estados, en el flujo y en los items/historial ya guardados. Evita que la
  //    variante sin tilde duplique filtros, chips y desplegables.
  const normMap = {}; // forma sin acentos (minúsculas) → forma canónica
  const addNorm = (canonical) => {
    const key = String(canonical).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (key && !normMap[key]) normMap[key] = String(canonical);
  };
  defaultReqEstados.forEach(addNorm);
  // Estados que solo existen en datos ya guardados (fuera de la lista por defecto)
  ['Por vencer', 'Vigente_por vencer'].forEach(addNorm);

  const normalizeList = (arr) => {
    if (!Array.isArray(arr)) return arr;
    const seen = new Set();
    const out = [];
    for (const raw of arr) {
      const s = String(raw).trim();
      const key = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const canonical = normMap[key] || s;
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      out.push(canonical);
    }
    return out;
  };

  if (storedEstados) {
    let parsed = null;
    try { parsed = JSON.parse(storedEstados.value); } catch (e) { parsed = null; }
    const normalized = normalizeList(parsed);
    if (normalized && JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      db.run("UPDATE settings SET value = ? WHERE key = 'req_estados'", [JSON.stringify(normalized)]);
      console.log('Migración: estados normalizados por acentos (sin duplicados)');
    }
  }
  if (storedFlow) {
    let parsed = null;
    try { parsed = JSON.parse(storedFlow.value); } catch (e) { parsed = null; }
    const normalized = normalizeList(parsed);
    if (normalized && JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      db.run("UPDATE settings SET value = ? WHERE key = 'req_flow_order'", [JSON.stringify(normalized)]);
      console.log('Migración: flujo de estados normalizado por acentos');
    }
  }

  // Normalizar el campo "Estado" en las notas de items ya guardados
  // (solo la línea 'Estado:', no 'Estado servicio:').
  const normItems = queryAll('SELECT id, notes FROM items');
  for (const row of normItems) {
    const notes = row.notes || '';
    if (!/\bEn tramite\b/.test(notes)) continue;
    const fixed = notes.replace(/(^|\n)Estado:\s*En tramite\s*(\n|$)/gi, (m, p1, p2) => p1 + 'Estado: En trámite' + p2);
    if (fixed !== notes) {
      db.run('UPDATE items SET notes = ? WHERE id = ?', [fixed, row.id]);
    }
  }
  // Normalizar el historial de cambios de estado guardado
  db.run("UPDATE item_history SET from_estado = REPLACE(from_estado, 'En tramite', 'En trámite') WHERE from_estado = 'En tramite'");
  db.run("UPDATE item_history SET to_estado = REPLACE(to_estado, 'En tramite', 'En trámite') WHERE to_estado = 'En tramite'");

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

  let req_estados = [];
  try { req_estados = JSON.parse(settings.req_estados || '[]'); } catch (e) { req_estados = []; }
  if (!Array.isArray(req_estados)) req_estados = [];

  let req_flow_order = [];
  try { req_flow_order = JSON.parse(settings.req_flow_order || '[]'); } catch (e) { req_flow_order = []; }
  if (!Array.isArray(req_flow_order)) req_flow_order = [];

  return {
    req_estados,
    req_flow_enabled: settings.req_flow_enabled === 'true',
    req_flow_order,
    smtp_enabled: settings.smtp_enabled === 'true',
    smtp_host: settings.smtp_host || '',
    smtp_port: settings.smtp_port || '587',
    smtp_user: settings.smtp_user || '',
    smtp_pass: settings.smtp_pass || '',
    smtp_from_email: settings.smtp_from_email || '',
    smtp_from_name: settings.smtp_from_name || 'RenovaMEF',
    last_check_date: settings.last_check_date || '',
    twilio_enabled: settings.twilio_enabled === 'true',
    twilio_account_sid: settings.twilio_account_sid || '',
    twilio_auth_token: settings.twilio_auth_token || '',
    twilio_from_number: settings.twilio_from_number || '',
    twilio_to_number: settings.twilio_to_number || '',
    telegram_enabled: settings.telegram_enabled === 'true',
    telegram_bot_token: settings.telegram_bot_token || '',
    telegram_chat_id: settings.telegram_chat_id || '',
    vapid_public_key: settings.vapid_public_key || '',
    vapid_private_key: settings.vapid_private_key || '',
    vapid_subject: settings.vapid_subject || '',
  };
}

// ---- Push Subscriptions ----

function getPushSubscriptions() {
  return queryAll('SELECT endpoint, subscription FROM push_subscriptions ORDER BY created_at ASC');
}

function addPushSubscription(subscription) {
  if (!subscription || !subscription.endpoint) return null;
  run(
    'INSERT INTO push_subscriptions (endpoint, subscription) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription',
    [subscription.endpoint, JSON.stringify(subscription)]
  );
  return subscription;
}

function removePushSubscription(endpoint) {
  if (!endpoint) return false;
  run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  return true;
}

function updateSettings(newSettings) {
  Object.entries(newSettings).forEach(([key, value]) => {
    run('UPDATE settings SET value = ? WHERE key = ?', [String(value), key]);
  });
}

// ---- Historial de estados (auditoría) ----

function addItemHistory({ itemId, username, fromEstado, toEstado }) {
  run(
    'INSERT INTO item_history (item_id, username, from_estado, to_estado, created_at) VALUES (?, ?, ?, ?, ?)',
    [itemId, username || 'sistema', fromEstado || '', toEstado || '', new Date().toISOString()]
  );
}

function getItemHistory(itemId) {
  return queryAll('SELECT * FROM item_history WHERE item_id = ? ORDER BY id ASC', [itemId]);
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

function createUser(username, hashedPassword, role = 'analyst') {
  run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role]);
  return getUserByUsername(username);
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
  getPushSubscriptions,
  addPushSubscription,
  removePushSubscription,
  addItemHistory,
  getItemHistory,
  getUserByUsername,
  createUser,
  updatePassword,
  closeDb,
};

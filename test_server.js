/* ==========================================
   CENTRO DE RENOVACIONES - Suite de pruebas
   Se ejecuta con:  cd server && npm test
   (o directamente:  node test_server.js)

   Usa el runner nativo de Node (node:test) + node:assert.
   Arranca el servidor en un puerto de pruebas con una base
   de datos temporal, ejecuta los tests y lo detiene al final.
   ========================================== */

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createRequest, waitForServer } = require('./test_helpers');

const SERVER_DIR = path.join(__dirname, 'server');
const TEST_PORT = Number(process.env.TEST_PORT || 3210);
const TEST_DB = path.join(os.tmpdir(), `centro-test-${Date.now()}.db`);
const TEST_SECRET = 'test-secret-centro-renovaciones';

let serverProcess = null;
let authToken = null;
let serverOutput = '';   // stderr del servidor, para diagnosticar fallos de arranque
let serverError = null;  // error de spawn (p. ej. node no encontrado)

// ---- HTTP helper (módulo compartido) ----
const request = createRequest(TEST_PORT);

// Devuelve un Error descriptivo si el proceso del servidor murió antes de
// arrancar (p. ej. puerto ocupado); null si sigue vivo. Lo usa waitForServer.
function checkServerDeath() {
  if (serverProcess.exitCode !== null) {
    return new Error(
      `El servidor de pruebas terminó antes de arrancar (exit code ${serverProcess.exitCode}). ` +
      `¿Está ocupado el puerto ${TEST_PORT}? Usa TEST_PORT para cambiarlo.` +
      (serverOutput.trim() ? `\nSalida del servidor:\n${serverOutput.trim()}` : '')
    );
  }
  if (serverError) {
    return new Error(`No se pudo lanzar el servidor de pruebas: ${serverError}`);
  }
  return null;
}

// ---- Hooks ----
before(async () => {
  serverProcess = spawn('node', ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      DB_PATH: TEST_DB,
      JWT_SECRET: TEST_SECRET,
    },
    stdio: ['ignore', 'ignore', 'pipe'], // capturar stderr para diagnosticar fallos
  });
  serverProcess.stderr.on('data', (c) => { serverOutput += c; });
  serverProcess.on('error', (err) => { serverError = err.message; });

  // Lanza al instante si el proceso muere (puerto ocupado) o no responde a tiempo
  await waitForServer(request, { maxWait: 15000, checkDeath: checkServerDeath });

  // Login único para tests autenticados
  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
  assert.equal(login.status, 200, 'Login debe devolver 200');
  assert.equal(login.data.success, true, 'Login debe ser exitoso');
  authToken = login.data.data.token;
  assert.ok(authToken, 'Debe existir un token JWT');
});

after(async () => {
  if (serverProcess) {
    serverProcess.kill();
    // Esperar a que el proceso hijo termine antes de borrar la BD (evita EBUSY en Windows)
    await new Promise((resolve) => {
      if (serverProcess.exitCode !== null) return resolve();
      serverProcess.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
  }
  // Limpiar la base de datos temporal
  try { fs.unlinkSync(TEST_DB); } catch (e) { /* ya no existe */ }
});

// ---- Tests ----
test('Health check devuelve 200 ok', async () => {
  const r = await request('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'ok');
});

test('Login con contraseña incorrecta es rechazado (401)', async () => {
  const r = await request('POST', '/api/auth/login', { username: 'admin', password: 'incorrecta' });
  assert.equal(r.status, 401);
});

test('Acceso a /api/items sin token es rechazado (401)', async () => {
  const r = await request('GET', '/api/items');
  assert.equal(r.status, 401);
});

test('GET /api/items devuelve la lista con token', async () => {
  const r = await request('GET', '/api/items', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.ok(Array.isArray(r.data.data));
});

test('Verify token devuelve el usuario admin', async () => {
  const r = await request('GET', '/api/auth/verify', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.equal(r.data.data.username, 'admin');
});

test('CRUD de items: crear, leer, actualizar y eliminar', async () => {
  // Crear
  const created = await request('POST', '/api/items', {
    name: 'Item de prueba',
    category: 'domain',
    expiryDate: '2099-12-31',
    cost: 99.5,
    provider: 'test.com',
    notes: 'creado por la suite',
    alertEmail: true,
    alertWhatsApp: false,
    alertTelegram: true,
  }, authToken);
  assert.equal(created.status, 201, 'Crear debe devolver 201');
  assert.equal(created.data.success, true);
  const itemId = created.data.data.id;
  assert.ok(itemId);
  assert.equal(created.data.data.alertTelegram, true);

  // Leer por id
  const got = await request('GET', `/api/items/${itemId}`, null, authToken);
  assert.equal(got.status, 200);
  assert.equal(got.data.data.name, 'Item de prueba');

  // Actualizar
  const updated = await request('PUT', `/api/items/${itemId}`, { name: 'Item editado', cost: 120 }, authToken);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.data.name, 'Item editado');
  assert.equal(updated.data.data.cost, 120);

  // Eliminar
  const deleted = await request('DELETE', `/api/items/${itemId}`, null, authToken);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.success, true);

  // Confirmar 404 tras eliminar
  const gone = await request('GET', `/api/items/${itemId}`, null, authToken);
  assert.equal(gone.status, 404);
});

test('Crear item sin nombre devuelve 400', async () => {
  const r = await request('POST', '/api/items', { category: 'domain', expiryDate: '2099-01-01' }, authToken);
  assert.equal(r.status, 400);
});

test('Seed carga datos demo', async () => {
  const r = await request('POST', '/api/items/seed', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.ok(r.data.data.length >= 10, 'Debe cargar al menos 10 items de ejemplo');
});

test('POST /api/items/import importa items válidos', async () => {
  const r = await request('POST', '/api/items/import', {
    items: [
      { name: 'Dominio Importado', category: 'domain', expiryDate: '2099-06-30', cost: 12.5, provider: 'importer.test' },
      { name: 'SSL Importado', category: 'ssl', expiryDate: '2099-07-01', cost: 0, alertEmail: true },
    ],
  }, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  // La respuesta incluye todos los items de la BD (seed + importados), no solo los nuevos
  const names = r.data.data.map((i) => i.name);
  assert.ok(names.includes('Dominio Importado'), 'Debe importarse el dominio');
  assert.ok(names.includes('SSL Importado'), 'Debe importarse el SSL');
  // El mensaje confirma la cantidad importada
  assert.ok(r.data.message.includes('2'), 'El mensaje debe indicar 2 items importados');
});

test('POST /api/items/import rechaza datos inválidos (400)', async () => {
  // Sin array de items
  const noItems = await request('POST', '/api/items/import', {}, authToken);
  assert.equal(noItems.status, 400);

  // Array vacío
  const empty = await request('POST', '/api/items/import', { items: [] }, authToken);
  assert.equal(empty.status, 400);

  // Items inválidos: categoría desconocida y fecha mal formada
  const bad = await request('POST', '/api/items/import', {
    items: [
      { name: 'Inválido', category: 'noexiste', expiryDate: '2099-01-01' },
      { name: 'Fecha mala', category: 'domain', expiryDate: '01/02/2099' },
    ],
  }, authToken);
  assert.equal(bad.status, 400, 'Debe rechazarse si no hay items válidos');
});

test('DELETE /api/items borra todos los items', async () => {
  // Verificar que hay items (de seed + import)
  const before = await request('GET', '/api/items', null, authToken);
  assert.ok(before.data.data.length > 0, 'Debe haber items antes del borrado');

  const r = await request('DELETE', '/api/items', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);

  // La lista debe quedar vacía
  const after = await request('GET', '/api/items', null, authToken);
  assert.equal(after.status, 200);
  assert.equal(after.data.data.length, 0, 'La lista debe quedar vacía tras el borrado total');
});

test('GET /api/settings enmascara secretos', async () => {
  const r = await request('GET', '/api/items/settings', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  // El secreto privado de VAPID nunca debe salir del servidor
  assert.ok(!('vapid_private_key' in r.data.data), 'vapid_private_key no debe exponerse');
  // El bot token de Telegram debe estar enmascarado o vacío
  assert.ok(r.data.data.telegram_bot_token === '' || r.data.data.telegram_bot_token === '********');
});

test('PUT /api/settings guarda configuración', async () => {
  const r = await request('PUT', '/api/items/settings', {
    smtp_enabled: true,
    smtp_host: 'smtp.test.com',
    smtp_port: 587,
    smtp_user: 'test@test.com',
    smtp_pass: '********',
    telegram_enabled: true,
    telegram_chat_id: '12345',
  }, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.equal(r.data.data.smtp_host, 'smtp.test.com');
  assert.equal(r.data.data.telegram_chat_id, '12345');
});

test('GET /api/settings/vapid-public-key genera clave VAPID', async () => {
  const r = await request('GET', '/api/items/settings/vapid-public-key', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.ok(r.data.data.publicKey && r.data.data.publicKey.length > 10, 'Clave VAPID pública debe generarse');
});

test('Suscripción push: register y unregister', async () => {
  const endpoint = `https://example.com/push/${Date.now()}`;
  const subscription = { endpoint, keys: { p256dh: 'a', auth: 'b' } };

  const sub = await request('POST', '/api/items/push/subscribe', { subscription }, authToken);
  assert.equal(sub.status, 200);
  assert.equal(sub.data.success, true);

  const unsub = await request('POST', '/api/items/push/unsubscribe', { endpoint }, authToken);
  assert.equal(unsub.status, 200);
  assert.equal(unsub.data.success, true);
});

test('POST /api/items/notify/check responde correctamente', async () => {
  const r = await request('POST', '/api/items/notify/check', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.ok(typeof r.data.data.sent === 'number');
  assert.ok(typeof r.data.data.errors === 'number');
});

test('El frontend se sirve en /', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 200);
  assert.ok(r.raw && r.raw.includes('Centro de Renovaciones'), 'El HTML debe contener el título');
});

test('El service worker sw.js se sirve', async () => {
  const r = await request('GET', '/sw.js');
  assert.equal(r.status, 200);
  assert.ok(r.raw && r.raw.includes('push'), 'sw.js debe manejar push');
});

test('Cambio de contraseña con contraseña actual incorrecta es rechazado (401)', async () => {
  const r = await request('PUT', '/api/auth/password', {
    currentPassword: 'incorrecta',
    newPassword: 'nueva1234',
  }, authToken);
  assert.equal(r.status, 401);
});

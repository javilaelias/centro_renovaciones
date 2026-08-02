/* ==========================================
   RENOVAMEF - Suite de pruebas
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

// Cargar opcionalmente .env.test (permite fijar TEST_PORT sin export del shell,
// p. ej. en Windows). No afecta al servidor bajo prueba: este recibe PORT,
// DB_PATH y JWT_SECRET explícitos al hacer spawn. Si .env.test no existe,
// dotenv.config() simplemente no inyecta nada y se usan los valores por defecto.
require(path.join(SERVER_DIR, 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '.env.test'), quiet: true });

const TEST_PORT = Number(process.env.TEST_PORT || 3210);
const TEST_DB = path.join(os.tmpdir(), `centro-test-${Date.now()}.db`);
const TEST_SECRET = 'test-secret-renovamef';

let serverProcess = null;
let authToken = null;
let serverOutput = '';   // stderr del servidor, para diagnosticar fallos de arranque
let serverError = null;  // error de spawn (p. ej. node no encontrado)

// ---- HTTP helper (módulo compartido) ----
const request = createRequest(TEST_PORT);

// Helper para enviar cuerpos HTTP crudos (sin JSON.stringify), necesario para
// probar el manejo de JSON malformado por parte del servidor.
function rawRequest(method, urlPath, rawBody, token) {
  return new Promise((resolve, reject) => {
    const http = require('node:http');
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: urlPath,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    if (rawBody) options.headers['Content-Length'] = Buffer.byteLength(rawBody);
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, raw: d }); }
      });
    });
    req.on('error', reject);
    if (rawBody) req.write(rawBody);
    req.end();
  });
}

// ---- Helpers de reset (independencia del orden de ejecución) ----

// Baseline limpio para la configuración de canales de notificación.
const CLEAN_SETTINGS = {
  smtp_enabled: false, smtp_host: '', smtp_port: '587', smtp_user: '',
  smtp_pass: '', smtp_from_email: '', smtp_from_name: '',
  twilio_enabled: false, twilio_account_sid: '', twilio_auth_token: '',
  twilio_from_number: '', twilio_to_number: '',
  telegram_enabled: false, telegram_bot_token: '', telegram_chat_id: '',
};

/**
 * Restablece la configuración de canales a un baseline limpio para que los
 * tests de settings/notify/check no dependan de lo que hayan dejado otros.
 * Nota: last_check_date no se puede limpiar vía PUT /settings (el handler no
 * lo acepta); los tests de notify/check lo sobrescriben a "hoy" al llamar al
 * check, así que siempre deben dispararlo ellos mismos antes de verificar.
 */
async function resetSettings() {
  const r = await request('PUT', '/api/items/settings', CLEAN_SETTINGS, authToken);
  if (r.status !== 200) {
    throw new Error(`resetSettings falló (status ${r.status})`);
  }
  return r;
}

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

test('Token expirado es rechazado (401) en rutas protegidas', async () => {
  // Firma un token ya vencido con el mismo secreto del servidor de pruebas.
  const jwt = require(path.join(SERVER_DIR, 'node_modules', 'jsonwebtoken'));
  const expired = jwt.sign({ username: 'admin' }, TEST_SECRET, { expiresIn: '-10s' });
  const r = await request('GET', '/api/items', null, expired);
  assert.equal(r.status, 401);
  assert.equal(r.data.success, false);
});

test('Token expirado es rechazado (401) en /api/auth/verify', async () => {
  const jwt = require(path.join(SERVER_DIR, 'node_modules', 'jsonwebtoken'));
  const expired = jwt.sign({ username: 'admin' }, TEST_SECRET, { expiresIn: '-10s' });
  const r = await request('GET', '/api/auth/verify', null, expired);
  assert.equal(r.status, 401);
  assert.equal(r.data.success, false);
});

test('Token firmado con secreto incorrecto es rechazado (401)', async () => {
  const jwt = require(path.join(SERVER_DIR, 'node_modules', 'jsonwebtoken'));
  const badSecret = jwt.sign({ username: 'admin' }, 'secreto-incorrecto-xyz', { expiresIn: '1h' });
  const r = await request('GET', '/api/items', null, badSecret);
  assert.equal(r.status, 401);
  assert.equal(r.data.success, false);
});

test('Token malformado es rechazado (401)', async () => {
  const r = await request('GET', '/api/items', null, 'esto-no-es-un-token');
  assert.equal(r.status, 401);
  assert.equal(r.data.success, false);
});

test('JSON malformado en el body dispara el handler de errores (500 genérico)', async () => {
  // El parser express.json() falla con un SyntaxError; el middleware global de
  // errores del servidor lo convierte en 500 con mensaje genérico.
  const r = await rawRequest('POST', '/api/auth/login', '{"username": "admin",');
  assert.equal(r.status, 500);
  assert.equal(r.data.success, false);
  assert.match(r.data.error, /Error interno/);
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

test('POST /api/items sin fecha crea un item pendiente (201)', async () => {
  // Los items sin fecha de vencimiento se permiten (estado "Pendiente").
  const r = await request('POST', '/api/items', {
    name: 'Item Pendiente',
    category: 'subscription',
    cost: 10,
  }, authToken);
  assert.equal(r.status, 201, 'Debe crearse sin fecha');
  assert.equal(r.data.success, true);
  assert.equal(r.data.data.expiryDate, '', 'expiryDate debe quedar vacío');

  // Limpiar
  await request('DELETE', `/api/items/${r.data.data.id}`, null, authToken);
});

test('POST /api/items/import acepta items sin fecha (pendiente)', async () => {
  const r = await request('POST', '/api/items/import', {
    items: [
      { name: 'Importado Pendiente', category: 'warranty' },
    ],
  }, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  const names = r.data.data.map((i) => i.name);
  assert.ok(names.includes('Importado Pendiente'), 'Debe importarse el item sin fecha');
  const item = r.data.data.find((i) => i.name === 'Importado Pendiente');
  assert.equal(item.expiryDate, '', 'El item sin fecha debe quedar con expiryDate vacío');

  // Limpiar
  await request('DELETE', `/api/items/${item.id}`, null, authToken);
});

test('PUT /api/items permite dejar la fecha vacía (Pendiente)', async () => {
  const created = await request('POST', '/api/items', {
    name: 'Item con fecha',
    category: 'license',
    expiryDate: '2099-12-31',
  }, authToken);
  assert.equal(created.status, 201);
  const id = created.data.data.id;

  const updated = await request('PUT', `/api/items/${id}`, {
    name: 'Item con fecha',
    category: 'license',
    expiryDate: '',
  }, authToken);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.data.expiryDate, '', 'La fecha debe poder limpiarse (pasar a Pendiente)');

  await request('DELETE', `/api/items/${id}`, null, authToken);
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
  // La respuesta incluye todos los items de la BD (incluidos los importados), no solo los nuevos
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

test('POST /api/items/import con items mixtos importa solo los válidos', async () => {
  // El endpoint filtra en silencio los items inválidos y solo importa los que
  // pasan la validación (nombre, categoría, fecha ISO y costo no negativo).
  const r = await request('POST', '/api/items/import', {
    items: [
      { name: 'Mixto Válido', category: 'domain', expiryDate: '2099-03-15', cost: 9.99, provider: 'mixto.test' },
      { name: '', category: 'domain', expiryDate: '2099-03-15' },                    // sin nombre
      { name: 'Inválido Categoría', category: 'noexiste', expiryDate: '2099-03-15' }, // categoría inválida
      { name: 'Inválido Fecha', category: 'domain', expiryDate: '15/03/2099' },       // fecha mal formada
      { name: 'Inválido Costo', category: 'domain', expiryDate: '2099-03-15', cost: -5 }, // costo negativo
    ],
  }, authToken);
  assert.equal(r.status, 200, 'Con al menos un item válido debe devolver 200');
  assert.equal(r.data.success, true);
  assert.ok(r.data.message.includes('1'), 'El mensaje debe indicar 1 item importado');

  const names = r.data.data.map((i) => i.name);
  assert.ok(names.includes('Mixto Válido'), 'El item válido debe importarse');
  assert.ok(!names.includes('Inválido Categoría'), 'La categoría inválida no debe importarse');
  assert.ok(!names.includes('Inválido Fecha'), 'La fecha mal formada no debe importarse');
  assert.ok(!names.includes('Inválido Costo'), 'El costo negativo no debe importarse');

  // Limpiar el item importado de prueba
  const imported = r.data.data.find((i) => i.name === 'Mixto Válido');
  if (imported) {
    await request('DELETE', `/api/items/${imported.id}`, null, authToken);
  }
});

test('Exportación: el API entrega todos los campos que consumen los export JSON/CSV/PDF', async () => {
  // La exportación del frontend (exportData/exportCsv/exportPdf) se alimenta de
  // GET /api/items (no hay endpoint de exportación en el backend), así que el
  // contrato de datos debe incluir todo lo que los export necesitan.
  const created = await request('POST', '/api/items', {
    name: 'Item Export Test',
    category: 'subscription',
    expiryDate: '2099-12-31',
    cost: 42.5,
    provider: 'export.provider',
    notes: 'campo de notas',
    alertEmail: true,
    alertWhatsApp: true,
    alertTelegram: false,
  }, authToken);
  assert.equal(created.status, 201);
  const itemId = created.data.data.id;

  const list = await request('GET', '/api/items', null, authToken);
  const item = list.data.data.find((i) => i.id === itemId);
  assert.ok(item, 'El item creado debe estar en la lista');

  assert.ok(item.id, 'id presente');
  assert.equal(item.name, 'Item Export Test');
  assert.equal(item.category, 'subscription');
  assert.equal(item.expiryDate, '2099-12-31');
  assert.equal(item.cost, 42.5);
  assert.equal(item.provider, 'export.provider');
  assert.equal(item.notes, 'campo de notas');
  assert.equal(item.alertEmail, true);
  assert.equal(item.alertWhatsApp, true);
  assert.equal(item.alertTelegram, false);
  assert.ok(item.createdAt, 'createdAt presente (lo usan los export para ordenar)');

  // Limpiar el item de prueba
  const del = await request('DELETE', `/api/items/${itemId}`, null, authToken);
  assert.equal(del.status, 200);
});

test('DELETE /api/items borra todos los items', async () => {
  // Verificar que hay items (de los tests de import)
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
  await resetSettings(); // parte de un baseline limpio
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

test('notify/check sin canales realmente capaces responde 0 enviados y 0 errores', async () => {
  // Baseline limpio: el test es autocontenido e independiente del orden.
  await resetSettings();

  const r = await request('POST', '/api/items/notify/check', null, authToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.equal(r.data.data.sent, 0);
  assert.equal(r.data.data.errors, 0);
  assert.equal(r.data.data.message, 'Sin alertas pendientes');
});

test('notify/check registra last_check_date de hoy (evita envíos duplicados)', async () => {
  await resetSettings(); // baseline limpio antes de disparar el check
  await request('POST', '/api/items/notify/check', null, authToken);
  const r = await request('GET', '/api/items/settings', null, authToken);
  assert.equal(r.status, 200);
  const today = new Date().toISOString().split('T')[0];
  assert.equal(r.data.data.last_check_date, today, 'last_check_date debe ser hoy');
});

test('test-telegram sin token configurado devuelve error (400)', async () => {
  await resetSettings(); // garantiza que no haya token almacenado
  const r = await request('POST', '/api/items/settings/test-telegram', {}, authToken);
  assert.equal(r.status, 400);
  assert.equal(r.data.success, false);
  assert.match(r.data.error, /Token de bot y chat ID requeridos/);
});

test('test-sms sin Twilio configurado devuelve error (400)', async () => {
  await resetSettings(); // garantiza que no haya credenciales Twilio
  const r = await request('POST', '/api/items/settings/test-sms', {}, authToken);
  assert.equal(r.status, 400);
  assert.equal(r.data.success, false);
  assert.match(r.data.error, /No se pudo inicializar Twilio/);
});

test('test-push sin suscripción devuelve error (400)', async () => {
  const r = await request('POST', '/api/items/settings/test-push', {}, authToken);
  assert.equal(r.status, 400);
  assert.equal(r.data.success, false);
  assert.ok(r.data.error.includes('Suscripción'), 'Debe pedir una suscripción');
});

test('El frontend se sirve en /', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 200);
  assert.ok(r.raw && r.raw.includes('RenovaMEF'), 'El HTML debe contener el título');
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

test('Cambio de contraseña exitoso: actualiza, invalida la vieja y permite la nueva', async () => {
  const NEW_PASS = 'nueva-segura-42';

  // 1. Cambiar con la contraseña actual correcta
  const change = await request('PUT', '/api/auth/password', {
    currentPassword: 'admin',
    newPassword: NEW_PASS,
  }, authToken);
  assert.equal(change.status, 200, 'Cambio con contraseña correcta debe devolver 200');
  assert.equal(change.data.success, true);
  assert.equal(change.data.message, 'Contraseña actualizada');

  // 2. La contraseña anterior ya no debe servir para login
  const oldLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
  assert.equal(oldLogin.status, 401, 'La contraseña anterior debe ser rechazada');

  // 3. La nueva contraseña debe funcionar
  const newLogin = await request('POST', '/api/auth/login', { username: 'admin', password: NEW_PASS });
  assert.equal(newLogin.status, 200, 'La nueva contraseña debe permitir login');
  assert.equal(newLogin.data.success, true);
  assert.ok(newLogin.data.data.token, 'El login con la nueva contraseña debe devolver token');

  // 4. Restaurar la contraseña original para no dejar estado modificado
  const restore = await request('PUT', '/api/auth/password', {
    currentPassword: NEW_PASS,
    newPassword: 'admin',
  }, authToken);
  assert.equal(restore.status, 200, 'Debe poder restaurarse la contraseña original');

  // 5. Confirmar que admin/admin vuelve a funcionar
  const adminLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
  assert.equal(adminLogin.status, 200, 'La contraseña original debe quedar restaurada');
});

test('Cambio de contraseña con nueva contraseña corta es rechazado (400)', async () => {
  const r = await request('PUT', '/api/auth/password', {
    currentPassword: 'admin',
    newPassword: 'abc', // menos de 4 caracteres
  }, authToken);
  assert.equal(r.status, 400, 'La nueva contraseña debe tener al menos 4 caracteres');
});

test('El módulo scheduler expone startScheduler y stopScheduler', () => {
  // Verifica la interfaz que usa server/src/index.js. El disparo real del cron
  // (8:00 AM) no es testeable de forma fiable, pero el comportamiento de
  // checkAndNotify —el trabajo que ejecuta el cron— se cubre en los tests de
  // notify/check anteriores. Requerir el módulo no tiene efectos secundarios
  // (no arranca cron ni conecta a la BD).
  const scheduler = require('./server/src/scheduler');
  assert.equal(typeof scheduler.startScheduler, 'function');
  assert.equal(typeof scheduler.stopScheduler, 'function');
});

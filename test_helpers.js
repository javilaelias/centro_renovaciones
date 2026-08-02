/* ==========================================
   RENOVAMEF - Helpers de prueba
   Módulo compartido entre test_server.js y start_and_test.js.
   Elimina la duplicación de request() y waitForServer().
   ========================================== */

'use strict';

const http = require('http');

/**
 * Crea una función request() conectada a un puerto concreto.
 * Resuelve { status, data } si el cuerpo es JSON, o { status, raw } si no.
 */
function createRequest(port) {
  return function request(method, urlPath, body, token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port,
        path: urlPath,
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (token) options.headers['Authorization'] = 'Bearer ' + token;

      const data = body ? JSON.stringify(body) : null;
      if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

      const req = http.request(options, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
          catch (e) { resolve({ status: res.statusCode, raw: d }); }
        });
      });
      req.on('error', (e) => reject(e));
      if (data) req.write(data);
      req.end();
    });
  };
}

/**
 * Espera a que el servidor responda 200 en /api/health.
 *
 * @param {Function} request - función request() creada con createRequest().
 * @param {object}   options
 *   - maxWait:  ms máximos de espera (por defecto 15000).
 *   - checkDeath: función que devuelve un Error (o null) si el proceso del
 *     servidor murió antes de arrancar (p. ej. puerto ocupado). Si devuelve
 *     un Error, waitForServer falla al instante con ese mensaje claro.
 *
 * @throws {Error} si el servidor no responde a tiempo o muere temprano.
 * @returns {Promise<true>} cuando /api/health responde 200.
 */
async function waitForServer(request, options = {}) {
  const maxWait = options.maxWait || 15000;
  const checkDeath = options.checkDeath || (() => null);
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    // Muerte temprana del proceso (p. ej. puerto ocupado): fallar al instante
    const deathErr = checkDeath();
    if (deathErr) throw deathErr;

    try {
      const r = await request('GET', '/api/health');
      if (r.status === 200) return true;
    } catch (e) { /* aún no listo */ }

    await new Promise((r) => setTimeout(r, 300));
  }

  // Última comprobación por si el proceso murió justo al agotarse el tiempo
  const deathErr = checkDeath();
  if (deathErr) throw deathErr;

  throw new Error(`El servidor no respondió en ${maxWait}ms`);
}

module.exports = { createRequest, waitForServer };

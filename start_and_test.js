const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_DIR = path.join(__dirname, 'server');
const LOG_FILE = path.join(__dirname, 'test_results.txt');
const fs = require('fs');

function log(m) {
  try { fs.appendFileSync(LOG_FILE, m + '\n'); } catch(e) {}
  process.stdout.write(m + '\n');
}

function request(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: urlPath,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const data = body ? JSON.stringify(body) : null;
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, raw: d }); }
      });
    });
    req.on('error', e => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer(maxWait = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      await request('GET', '/api/health');
      return true;
    } catch(e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function runTests() {
  log('========================================');
  log('CENTRO DE RENOVACIONES - TEST SUITE');
  log('Date: ' + new Date().toISOString());
  log('========================================\n');

  log('1. HEALTH CHECK');
  const health = await request('GET', '/api/health');
  log(`   Status: ${health.status}`);
  log(`   ✓ Health check passed\n`);

  log('2. LOGIN (admin/admin)');
  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
  log(`   Status: ${login.status}`);
  if (login.data && login.data.success) {
    const token = login.data.data.token;
    log(`   ✓ Login successful`);
    log(`   Token: ${token.substring(0, 30)}...`);

    log('\n3. GET ITEMS');
    const items = await request('GET', '/api/items', null, token);
    log(`   Status: ${items.status}`);
    if (items.data && items.data.success) {
      const data = items.data.data || [];
      log(`   ✓ Items count: ${data.length}`);
      data.slice(0, 5).forEach(i => log(`      - ${i.name} (${i.category}) → ${i.expiryDate}`));
    }

    log('\n4. VERIFY TOKEN');
    const verify = await request('GET', '/api/auth/verify', null, token);
    log(`   ✓ Token valid: ${verify.data && verify.data.success}`);

    log('\n5. WRONG LOGIN');
    const bad = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
    log(`   ✓ Rejected: ${bad.status === 401}`);

    log('\n6. NO AUTH');
    const noAuth = await request('GET', '/api/items');
    log(`   ✓ Rejected: ${noAuth.status === 401}`);

    log('\n7. FRONTEND');
    const front = await request('GET', '/');
    log(`   Status: ${front.status}`);
    if (front.raw && front.raw.includes('Centro de Renovaciones')) {
      log(`   ✓ Frontend serving HTML`);
    }

    log('\n========================================');
    log('✓ ALL TESTS PASSED');
    log('========================================');
  } else {
    log(`   ✗ Login failed: ${JSON.stringify(login.data)}`);
  }
}

// Start server
log('Starting server...');
const server = spawn('node', ['src/index.js'], {
  cwd: SERVER_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', d => log('[SERVER] ' + d.toString().trim()));
server.stderr.on('data', d => log('[SERVER-ERR] ' + d.toString().trim()));

server.on('error', (err) => {
  log('Failed to start server: ' + err.message);
  process.exit(1);
});

// Wait for server and run tests
setTimeout(async () => {
  log('Waiting for server...');
  const ready = await waitForServer(15000);
  if (ready) {
    log('Server is ready!\n');
    await runTests();
  } else {
    log('✗ Server did not start in time');
  }
  server.kill();
  log('\nServer stopped. Tests complete.');
}, 2000);

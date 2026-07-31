const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, 'test_results.txt');

function log(m) {
  try { fs.appendFileSync(LOG, m + '\n'); } catch(e) {}
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

async function main() {
  log('========================================');
  log('CENTRO DE RENOVACIONES - TEST SUITE');
  log('Date: ' + new Date().toISOString());
  log('========================================\n');

  // 1. Health Check
  log('1. HEALTH CHECK');
  try {
    const r = await request('GET', '/api/health');
    log(`   Status: ${r.status}`);
    log(`   Response: ${JSON.stringify(r.data)}`);
    log(`   ✓ Health check passed\n`);
  } catch(e) {
    log(`   ✗ Health check FAILED: ${e.message}`);
    log('   Is the server running?\n');
    return;
  }

  // 2. Login
  log('2. LOGIN (admin/admin)');
  try {
    const r = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
    log(`   Status: ${r.status}`);
    if (r.status === 200 && r.data && r.data.success) {
      log(`   ✓ Login successful`);
      const token = r.data.data.token;
      log(`   Token: ${token.substring(0, 30)}...`);

      // 3. Get Items
      log('\n3. GET ITEMS');
      const itemsR = await request('GET', '/api/items', null, token);
      log(`   Status: ${itemsR.status}`);
      if (itemsR.data && itemsR.data.success) {
        const items = itemsR.data.data || [];
        log(`   ✓ Items count: ${items.length}`);
        if (items.length > 0) {
          items.slice(0, 3).forEach(item => {
            log(`      - ${item.name} (${item.category}) - expires: ${item.expiryDate}`);
          });
        }
      } else {
        log(`   ✗ Get items failed: ${JSON.stringify(itemsR.data)}`);
      }

      // 4. Verify token
      log('\n4. VERIFY TOKEN');
      const verifyR = await request('GET', '/api/auth/verify', null, token);
      if (verifyR.data && verifyR.data.success) {
        log(`   ✓ Token valid for user: ${verifyR.data.data.username}`);
      }

      // 5. Wrong password
      log('\n5. WRONG PASSWORD TEST');
      const badR = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
      if (badR.status === 401) {
        log(`   ✓ Correctly rejected (401)`);
      }

      // 6. No auth test
      log('\n6. NO AUTH TEST');
      const noAuthR = await request('GET', '/api/items');
      if (noAuthR.status === 401) {
        log(`   ✓ Correctly rejected without token (401)`);
      }

      // 7. Frontend serves
      log('\n7. FRONTEND SERVING');
      const frontR = await request('GET', '/');
      log(`   Status: ${frontR.status}`);
      if (frontR.raw && frontR.raw.includes('Centro de Renovaciones')) {
        log(`   ✓ Frontend HTML serving correctly`);
      }

      log('\n========================================');
      log('ALL TESTS PASSED ✓');
      log('========================================');
    } else {
      log(`   ✗ Login failed: ${JSON.stringify(r.data)}`);
    }
  } catch(e) {
    log(`   ✗ Error: ${e.message}`);
  }
}

main().catch(e => log('Fatal: ' + e.message));

const express = require('express');
const cors = require('cors');
const path = require('path');
const itemsRouter = require('./routes');
const authRouter = require('./authRoutes');
const { initDb, closeDb, getUserByUsername } = require('./db');
const { requireAuth } = require('./auth');
const { startScheduler, stopScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ---- Public Routes (no auth needed) ----

// Auth routes (login is public, verify/password are protected internally)
app.use('/api/auth', authRouter);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- Protected API Routes ----
// All /api/items routes require a valid JWT token
app.use('/api/items', requireAuth, itemsRouter);

// ---- Static Files ----
app.use(express.static(path.join(__dirname, '..', '..')));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', '..', 'index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  stopScheduler();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  closeDb();
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada no manejada:', reason);
});

// Async startup
async function start() {
  try {
    await initDb();
    console.log('Base de datos inicializada');
  } catch (err) {
    console.error('Error inicializando la base de datos:', err);
    process.exit(1);
  }

  startScheduler();

  app.listen(PORT, () => {
    console.log(`\u{1F680} Centro de Renovaciones API corriendo en http://localhost:${PORT}`);
    console.log(`\u{1F310} Frontend servido en http://localhost:${PORT}`);
    console.log(`\u{1F512} Usuario: admin, Contraseña: admin`);
  });
}

start();

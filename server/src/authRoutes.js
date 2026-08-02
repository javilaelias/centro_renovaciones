const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { generateToken, requireAuth } = require('./auth');

const router = express.Router();

const SALT_ROUNDS = 10;

// POST /api/auth/login - Login with username + password
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
  }

  const token = generateToken(username, user.role);
  res.json({ success: true, data: { token, username, role: user.role } });
});

// POST /api/auth/register - Register a new user with a Gmail account
router.post('/register', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Correo y contraseña requeridos' });
  }

  // Normalizar: minúsculas y sin espacios
  const username = String(email).trim().toLowerCase();

  // Solo cuentas Gmail (el cliente lo valida también, aquí por seguridad)
  if (!/^[a-z0-9._%+\-]+@gmail\.com$/i.test(username)) {
    return res.status(400).json({ success: false, error: 'Solo se permiten cuentas Gmail (@gmail.com)' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const existing = db.getUserByUsername(username);
  if (existing) {
    return res.status(409).json({ success: false, error: 'Ese correo ya está registrado. Inicia sesión.' });
  }

  const hashed = bcrypt.hashSync(password, SALT_ROUNDS);
  db.createUser(username, hashed, 'analyst');

  const token = generateToken(username, 'analyst');
  res.status(201).json({ success: true, data: { token, username, role: 'analyst' } });
});

// GET /api/auth/verify - Verify current token is valid
router.get('/verify', requireAuth, (req, res) => {
  // Rol vigente desde la BD (no solo del claim del token)
  const user = db.getUserByUsername(req.user.username);
  const role = (user && user.role) || req.user.role || 'analyst';
  res.json({ success: true, data: { username: req.user.username, role } });
});

// PUT /api/auth/password - Change password (requires auth + old password)
router.put('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Contraseña actual y nueva requeridas' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' });
  }

  const user = db.getUserByUsername(req.user.username);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
  }

  const valid = bcrypt.compareSync(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
  }

  const hashed = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  db.updatePassword(req.user.username, hashed);

  res.json({ success: true, message: 'Contraseña actualizada' });
});

module.exports = router;

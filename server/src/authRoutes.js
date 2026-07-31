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

  const token = generateToken(username);
  res.json({ success: true, data: { token, username } });
});

// GET /api/auth/verify - Verify current token is valid
router.get('/verify', requireAuth, (req, res) => {
  res.json({ success: true, data: { username: req.user.username } });
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

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT_SECRET must come from the environment. If it's missing, generate a
// random one at startup (sessions will be invalidated on restart) and warn.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[Auth] ⚠️ JWT_SECRET no está definido en tu entorno. Se generó un secreto aleatorio: las sesiones se invalidarán al reiniciar el servidor. Define JWT_SECRET (por ejemplo, en la variable de entorno de tu hosting) para mantener las sesiones activas.');
}
const JWT_EXPIRES_IN = '30d';

/**
 * Generate a JWT token for a user
 * @param {string} username
 * @param {string} [role] - 'admin' o 'analyst'
 */
function generateToken(username, role) {
  return jwt.sign({ username, role: role || 'analyst' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT token and return the payload
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: require a valid JWT token to access protected routes.
 * Reads the token from the Authorization header (Bearer <token>).
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Se requiere autenticación' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}

/**
 * Express middleware: requiere rol 'admin'. Se consulta la base de datos para
 * obtener el rol vigente (no depende solo del claim del token, que puede
 * estar desactualizado o faltar en tokens antiguos).
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ success: false, error: 'Se requiere autenticación' });
  }

  const db = require('./db');
  const user = db.getUserByUsername(req.user.username);
  // Fail-closed: si el usuario no existe o no es admin, se niega (403)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Acción permitida solo para administradores' });
  }

  req.userRole = user.role;
  next();
}

module.exports = { generateToken, verifyToken, requireAuth, requireAdmin };

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
 */
function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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

module.exports = { generateToken, verifyToken, requireAuth };

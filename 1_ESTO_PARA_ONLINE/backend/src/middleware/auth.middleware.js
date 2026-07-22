import { verifyToken } from '../utils/auth.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
  }

  req.user = payload;
  next();
}

import { Router } from 'express';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }
  const result = await authService.login(String(usuario).trim(), String(password));
  res.json(result);
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
  res.json(user);
}));

export default router;

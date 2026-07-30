import { Router } from 'express';
import * as livesService from '../services/lives.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await livesService.listarLives(req.query));
}));

router.get('/resumen', asyncHandler(async (req, res) => {
  res.json(await livesService.resumenLives());
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const live = await livesService.obtenerLive(Number(req.params.id));
  if (!live) return res.status(404).json({ error: 'Live no encontrado' });
  res.json(live);
}));

router.post('/', asyncHandler(async (req, res) => {
  const live = await livesService.crearLive(req.body);
  res.status(201).json(live);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const live = await livesService.actualizarLive(Number(req.params.id), req.body);
  if (!live) return res.status(404).json({ error: 'Live no encontrado' });
  res.json(live);
}));

router.post('/:id/sincronizar', asyncHandler(async (req, res) => {
  const live = await livesService.sincronizarLive(Number(req.params.id));
  if (!live) return res.status(404).json({ error: 'Live no encontrado' });
  res.json(live);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await livesService.eliminarLive(Number(req.params.id));
  if (!result) return res.status(404).json({ error: 'Live no encontrado' });
  res.json(result);
}));

export default router;

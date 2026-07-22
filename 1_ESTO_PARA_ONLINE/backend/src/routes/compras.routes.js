import { Router } from 'express';
import * as comprasService from '../services/compras.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await comprasService.listarCompras(req.query));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const compra = await comprasService.obtenerCompra(Number(req.params.id));
  if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
  res.json(compra);
}));

router.post('/', asyncHandler(async (req, res) => {
  const compra = await comprasService.crearCompra(req.body);
  res.status(201).json(compra);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const compra = await comprasService.actualizarCompra(Number(req.params.id), req.body);
  if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
  res.json(compra);
}));

router.post('/:id/recibir', asyncHandler(async (req, res) => {
  const compra = await comprasService.marcarRecibida(Number(req.params.id));
  if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
  res.json(compra);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await comprasService.eliminarCompra(Number(req.params.id));
  res.json({ ok: true });
}));

export default router;

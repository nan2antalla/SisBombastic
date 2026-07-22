import { Router } from 'express';
import * as gastosService from '../services/gastos.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await gastosService.listarGastos(req.query));
}));

router.post('/', asyncHandler(async (req, res) => {
  const gasto = await gastosService.crearGasto(req.body);
  res.status(201).json(gasto);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await gastosService.eliminarGasto(Number(req.params.id));
  res.json({ ok: true });
}));

export default router;

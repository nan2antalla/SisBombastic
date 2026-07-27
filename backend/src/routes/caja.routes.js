import { Router } from 'express';
import * as cajaService from '../services/caja.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/efectivo', asyncHandler(async (req, res) => {
  res.json(await cajaService.resumenEfectivo());
}));

router.get('/saldo', asyncHandler(async (req, res) => {
  res.json({ saldo: await cajaService.saldoActual() });
}));

router.get('/movimientos', asyncHandler(async (req, res) => {
  res.json(await cajaService.listarMovimientos(req.query));
}));

router.get('/resumen/:fecha', asyncHandler(async (req, res) => {
  res.json(await cajaService.resumenCaja(req.params.fecha));
}));

router.get('/cierres', asyncHandler(async (req, res) => {
  res.json(await cajaService.listarCierres());
}));

router.post('/movimientos', asyncHandler(async (req, res) => {
  const mov = await cajaService.registrarMovimiento(req.body);
  res.status(201).json(mov);
}));

router.post('/cerrar', asyncHandler(async (req, res) => {
  const cierre = await cajaService.cerrarCaja(req.body.fecha, req.body.notas);
  res.json(cierre);
}));

export default router;

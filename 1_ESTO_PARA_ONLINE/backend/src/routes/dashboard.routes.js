import { Router } from 'express';
import * as dashboardService from '../services/dashboard.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await dashboardService.obtenerDashboardDecisiones());
}));

router.get('/decisiones', asyncHandler(async (req, res) => {
  res.json(await dashboardService.obtenerDashboardDecisiones());
}));

router.get('/cajas', asyncHandler(async (req, res) => {
  res.json(await dashboardService.rentabilidadPorCaja());
}));

router.get('/proveedores', asyncHandler(async (req, res) => {
  res.json(await dashboardService.rentabilidadPorProveedor());
}));

router.get('/reporte', asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Se requieren fechas desde y hasta' });
  }
  res.json(await dashboardService.obtenerReporte(desde, hasta));
}));

export default router;

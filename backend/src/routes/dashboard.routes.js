import { Router } from 'express';
import * as dashboardService from '../services/dashboard.service.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    res.json(dashboardService.obtenerDashboardDecisiones());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/decisiones', (req, res) => {
  try {
    res.json(dashboardService.obtenerDashboardDecisiones());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cajas', (req, res) => {
  try {
    res.json(dashboardService.rentabilidadPorCaja());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/proveedores', (req, res) => {
  try {
    res.json(dashboardService.rentabilidadPorProveedor());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reporte', (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Se requieren fechas desde y hasta' });
  }
  try {
    res.json(dashboardService.obtenerReporte(desde, hasta));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

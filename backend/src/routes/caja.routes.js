import { Router } from 'express';
import * as cajaService from '../services/caja.service.js';

const router = Router();

router.get('/saldo', (req, res) => {
  res.json({ saldo: cajaService.saldoActual() });
});

router.get('/movimientos', (req, res) => {
  res.json(cajaService.listarMovimientos(req.query));
});

router.get('/resumen/:fecha', (req, res) => {
  res.json(cajaService.resumenCaja(req.params.fecha));
});

router.get('/cierres', (req, res) => {
  res.json(cajaService.listarCierres());
});

router.post('/movimientos', (req, res) => {
  try {
    const mov = cajaService.registrarMovimiento(req.body);
    res.status(201).json(mov);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/cerrar', (req, res) => {
  try {
    const cierre = cajaService.cerrarCaja(req.body.fecha, req.body.notas);
    res.json(cierre);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import * as gastosService from '../services/gastos.service.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const gastos = gastosService.listarGastos(req.query);
    res.json(gastos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const gasto = gastosService.crearGasto(req.body);
    res.status(201).json(gasto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  gastosService.eliminarGasto(Number(req.params.id));
  res.json({ ok: true });
});

export default router;

import { Router } from 'express';
import * as comprasService from '../services/compras.service.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const compras = comprasService.listarCompras(req.query);
    res.json(compras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const compra = comprasService.obtenerCompra(Number(req.params.id));
  if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
  res.json(compra);
});

router.post('/', (req, res) => {
  try {
    const compra = comprasService.crearCompra(req.body);
    res.status(201).json(compra);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const compra = comprasService.actualizarCompra(Number(req.params.id), req.body);
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
    res.json(compra);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/recibir', (req, res) => {
  try {
    const compra = comprasService.marcarRecibida(Number(req.params.id));
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
    res.json(compra);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    comprasService.eliminarCompra(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

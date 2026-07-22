import { Router } from 'express';
import * as ventasService from '../services/ventas.service.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const ventas = ventasService.listarVentas(req.query);
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/top-productos', (req, res) => {
  res.json(ventasService.topProductos(
    Number(req.query.limite) || 10,
    req.query.desde,
    req.query.hasta
  ));
});

router.get('/:id', (req, res) => {
  const venta = ventasService.obtenerVenta(Number(req.params.id));
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(venta);
});

router.post('/', (req, res) => {
  try {
    const venta = ventasService.crearVenta(req.body);
    res.status(201).json(venta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/recalcular-utilidades', (req, res) => {
  try {
    res.json(ventasService.recalcularUtilidades());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/items/:itemId', (req, res) => {
  try {
    const venta = ventasService.actualizarItemVenta(Number(req.params.itemId), req.body);
    if (!venta) return res.status(404).json({ error: 'Ítem de venta no encontrado' });
    res.json(venta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/cancelar', (req, res) => {
  const venta = ventasService.cancelarVenta(Number(req.params.id));
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(venta);
});

export default router;

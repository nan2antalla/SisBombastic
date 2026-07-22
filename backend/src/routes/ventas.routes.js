import { Router } from 'express';
import * as ventasService from '../services/ventas.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await ventasService.listarVentas(req.query));
}));

router.get('/top-productos', asyncHandler(async (req, res) => {
  res.json(await ventasService.topProductos(
    Number(req.query.limite) || 10, req.query.desde, req.query.hasta
  ));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const venta = await ventasService.obtenerVenta(Number(req.params.id));
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(venta);
}));

router.post('/', asyncHandler(async (req, res) => {
  const venta = await ventasService.crearVenta(req.body);
  res.status(201).json(venta);
}));

router.post('/recalcular-utilidades', asyncHandler(async (req, res) => {
  const result = await ventasService.recalcularUtilidades();
  res.json(result);
}));

router.put('/items/:itemId', asyncHandler(async (req, res) => {
  const venta = await ventasService.actualizarItemVenta(Number(req.params.itemId), req.body);
  if (!venta) return res.status(404).json({ error: 'Ítem de venta no encontrado' });
  res.json(venta);
}));

router.post('/:id/cancelar', asyncHandler(async (req, res) => {
  const venta = await ventasService.cancelarVenta(Number(req.params.id));
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(venta);
}));

export default router;

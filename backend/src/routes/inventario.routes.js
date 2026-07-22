import { Router } from 'express';
import * as inventarioService from '../services/inventario.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await inventarioService.listarInventario(req.query));
}));

router.get('/valor', asyncHandler(async (req, res) => {
  res.json({ valor: await inventarioService.valorTotalInventario() });
}));

router.get('/baja-rotacion', asyncHandler(async (req, res) => {
  res.json(await inventarioService.productosBajaRotacion(Number(req.query.limite) || 10));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const item = await inventarioService.obtenerItem(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });
  res.json(item);
}));

router.post('/', asyncHandler(async (req, res) => {
  const item = await inventarioService.crearItem(req.body);
  res.status(201).json(item);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const item = await inventarioService.actualizarItem(Number(req.params.id), req.body);
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });
  res.json(item);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = await inventarioService.eliminarItem(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Item no encontrado' });
  res.json({ ok: true });
}));

router.post('/:id/abrir-caja', asyncHandler(async (req, res) => {
  const result = await inventarioService.abrirCaja(
    Number(req.params.id),
    req.body.autos || [],
    {
      nombre: req.body.nombre,
      nombre_lote: req.body.nombre_lote,
      cantidad: req.body.cantidad,
    }
  );
  res.json(result);
}));

export default router;

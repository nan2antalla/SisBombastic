import { Router } from 'express';
import * as inventarioService from '../services/inventario.service.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const items = inventarioService.listarInventario(req.query);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/valor', (req, res) => {
  res.json({ valor: inventarioService.valorTotalInventario() });
});

router.get('/baja-rotacion', (req, res) => {
  res.json(inventarioService.productosBajaRotacion(Number(req.query.limite) || 10));
});

router.get('/:id', (req, res) => {
  const item = inventarioService.obtenerItem(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });
  res.json(item);
});

router.post('/', (req, res) => {
  try {
    const item = inventarioService.crearItem(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const item = inventarioService.actualizarItem(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const ok = inventarioService.eliminarItem(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Item no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/abrir-caja', (req, res) => {
  try {
    const result = inventarioService.abrirCaja(Number(req.params.id), req.body.autos || []);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { getAll } from '../db/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const TABLAS = [
  'proveedores', 'compras', 'inventario', 'clientes', 'ventas', 'venta_items',
  'gastos', 'caja_movimientos', 'caja_cierres', 'lives', 'empleados',
];

router.get('/backup', asyncHandler(async (req, res) => {
  const backup = { exportado: new Date().toISOString(), tablas: {} };

  for (const tabla of TABLAS) {
    backup.tablas[tabla] = await getAll(`SELECT * FROM ${tabla} ORDER BY id`);
  }

  const nombre = `bombastic-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.send(JSON.stringify(backup, null, 2));
}));

router.get('/export/:tabla', asyncHandler(async (req, res) => {
  const tabla = req.params.tabla;
  const permitidas = ['compras', 'inventario', 'ventas', 'venta_items', 'gastos', 'caja_movimientos', 'clientes'];

  if (!permitidas.includes(tabla)) {
    return res.status(400).json({ error: 'Tabla no permitida' });
  }

  const rows = await getAll(`SELECT * FROM ${tabla} ORDER BY id`);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${tabla}.csv"`);
  res.send('\uFEFF' + csv);
}));

export default router;

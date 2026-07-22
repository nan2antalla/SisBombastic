import { Router } from 'express';
import { getDbPath } from '../db/database.js';
import { resetDatabase } from '../services/reset.service.js';

const router = Router();

router.get('/backup', (req, res) => {
  try {
    const dbPath = getDbPath();
    const backupName = `bombastic-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    res.download(dbPath, backupName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset', (req, res) => {
  const clave = req.body?.clave || req.query?.clave;
  if (clave !== 'bombastic-reset') {
    return res.status(403).json({ error: 'Clave incorrecta. Usa: bombastic-reset' });
  }
  try {
    resetDatabase();
    res.json({ ok: true, mensaje: 'Base de datos reiniciada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/:tabla', (req, res) => {
  const tablasPermitidas = ['compras', 'inventario', 'ventas', 'venta_items', 'gastos', 'caja_movimientos', 'clientes'];
  const tabla = req.params.tabla;

  if (!tablasPermitidas.includes(tabla)) {
    return res.status(400).json({ error: 'Tabla no permitida' });
  }

  import('../db/database.js').then(({ default: db }) => {
    const rows = db.prepare(`SELECT * FROM ${tabla}`).all();
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${tabla}.csv"`);
    res.send('\uFEFF' + csv);
  });
});

export default router;

import { Router } from 'express';
import { query } from '../db/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const TABLAS = [
  'venta_items',
  'ventas',
  'caja_movimientos',
  'caja_cierres',
  'gastos',
  'inventario',
  'compras',
  'clientes',
  'proveedores',
  'lives',
  'empleados',
];

router.post('/reset', asyncHandler(async (req, res) => {
  const clave = req.body?.clave || req.query?.clave;
  if (clave !== 'bombastic-reset') {
    return res.status(403).json({ error: 'Clave incorrecta. Usa: bombastic-reset' });
  }

  await query('BEGIN');
  try {
    for (const tabla of TABLAS) {
      await query(`TRUNCATE TABLE ${tabla} RESTART IDENTITY CASCADE`);
    }
    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }

  res.json({
    ok: true,
    mensaje: 'Base de datos reiniciada. Todas las tablas están vacías.',
  });
}));

// También por GET para poder abrirlo fácil en el navegador
router.get('/reset', asyncHandler(async (req, res) => {
  const clave = req.query?.clave;
  if (clave !== 'bombastic-reset') {
    return res.status(403).json({
      error: 'Agrega ?clave=bombastic-reset a la URL para confirmar el borrado',
    });
  }

  await query('BEGIN');
  try {
    for (const tabla of TABLAS) {
      await query(`TRUNCATE TABLE ${tabla} RESTART IDENTITY CASCADE`);
    }
    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }

  res.json({
    ok: true,
    mensaje: 'Base de datos reiniciada. Todas las tablas están vacías.',
  });
}));

export default router;

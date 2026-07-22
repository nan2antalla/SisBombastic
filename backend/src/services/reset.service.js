import db from '../db/database.js';

/** Borra todos los datos de prueba y reinicia los IDs. */
export function resetDatabase() {
  const tablas = [
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

  const run = db.transaction(() => {
    db.exec('PRAGMA foreign_keys = OFF');
    for (const tabla of tablas) {
      db.prepare(`DELETE FROM ${tabla}`).run();
      try {
        db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(tabla);
      } catch {
        // tabla sin autoincrement
      }
    }
    db.exec('PRAGMA foreign_keys = ON');
  });

  run();
  return true;
}

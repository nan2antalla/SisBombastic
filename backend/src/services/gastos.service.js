import db from '../db/database.js';
import * as cajaService from './caja.service.js';

export function listarGastos(filtros = {}) {
  let sql = 'SELECT * FROM gastos WHERE 1=1';
  const params = [];

  if (filtros.desde) {
    sql += ' AND fecha >= ?';
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    sql += ' AND fecha <= ?';
    params.push(filtros.hasta);
  }
  if (filtros.categoria) {
    sql += ' AND categoria = ?';
    params.push(filtros.categoria);
  }

  sql += ' ORDER BY fecha DESC, id DESC';
  return db.prepare(sql).all(...params);
}

export function crearGasto(data) {
  const result = db.prepare(`
    INSERT INTO gastos (fecha, categoria, descripcion, monto, metodo_pago, relacion_tipo, relacion_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.fecha,
    data.categoria,
    data.descripcion,
    data.monto,
    data.metodo_pago || 'efectivo',
    data.relacion_tipo || 'general',
    data.relacion_id || null
  );

  cajaService.registrarSalidaGasto(result.lastInsertRowid, data.monto, data.fecha, data.descripcion);

  return db.prepare('SELECT * FROM gastos WHERE id = ?').get(result.lastInsertRowid);
}

export function eliminarGasto(id) {
  db.prepare('DELETE FROM gastos WHERE id = ?').run(id);
  return true;
}

export function gastosDelPeriodo(desde, hasta) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) as total, COUNT(*) as cantidad
    FROM gastos
    WHERE fecha >= ? AND fecha <= ?
  `).get(desde, hasta);
  return row;
}

export function gastosPorCategoria(desde, hasta) {
  return db.prepare(`
    SELECT categoria, SUM(monto) as total
    FROM gastos
    WHERE fecha >= ? AND fecha <= ?
    GROUP BY categoria
    ORDER BY total DESC
  `).all(desde, hasta);
}

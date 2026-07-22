import { getOne, getAll, query } from '../db/database.js';
import * as cajaService from './caja.service.js';

export async function listarGastos(filtros = {}) {
  let sql = 'SELECT * FROM gastos WHERE 1=1';
  const params = [];
  let i = 1;
  if (filtros.desde) { sql += ` AND fecha >= $${i++}`; params.push(filtros.desde); }
  if (filtros.hasta) { sql += ` AND fecha <= $${i++}`; params.push(filtros.hasta); }
  if (filtros.categoria) { sql += ` AND categoria = $${i++}`; params.push(filtros.categoria); }
  sql += ' ORDER BY fecha DESC, id DESC';
  return getAll(sql, params);
}

export async function crearGasto(data) {
  const res = await query(`
    INSERT INTO gastos (fecha, categoria, descripcion, monto, metodo_pago, relacion_tipo, relacion_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [
    data.fecha, data.categoria, data.descripcion, data.monto,
    data.metodo_pago || 'efectivo', data.relacion_tipo || 'general', data.relacion_id || null,
  ]);

  await cajaService.registrarSalidaGasto(res.rows[0].id, data.monto, data.fecha, data.descripcion);
  return getOne('SELECT * FROM gastos WHERE id = $1', [res.rows[0].id]);
}

export async function eliminarGasto(id) {
  await query('DELETE FROM gastos WHERE id = $1', [id]);
  return true;
}

export async function gastosDelPeriodo(desde, hasta) {
  return getOne(`
    SELECT COALESCE(SUM(monto),0) as total, COUNT(*) as cantidad
    FROM gastos WHERE fecha >= $1 AND fecha <= $2
  `, [desde, hasta]);
}

export async function gastosPorCategoria(desde, hasta) {
  return getAll(`
    SELECT categoria, SUM(monto) as total FROM gastos
    WHERE fecha >= $1 AND fecha <= $2 GROUP BY categoria ORDER BY total DESC
  `, [desde, hasta]);
}

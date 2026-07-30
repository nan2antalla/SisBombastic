import { getOne, getAll, query } from '../db/database.js';

function n(v) {
  return Number(v || 0);
}

export async function listarLives(filtros = {}) {
  let sql = 'SELECT * FROM lives WHERE 1=1';
  const params = [];
  let i = 1;
  if (filtros.desde) { sql += ` AND fecha >= $${i++}`; params.push(filtros.desde); }
  if (filtros.hasta) { sql += ` AND fecha <= $${i++}`; params.push(filtros.hasta); }
  if (filtros.estado) { sql += ` AND estado = $${i++}`; params.push(filtros.estado); }
  sql += ' ORDER BY fecha DESC, id DESC';
  return getAll(sql, params);
}

export async function obtenerLive(id) {
  const live = await getOne('SELECT * FROM lives WHERE id = $1', [id]);
  if (!live) return null;
  const ventas = await getAll(`
    SELECT * FROM ventas
    WHERE live_id = $1 AND estado != 'cancelado'
    ORDER BY fecha DESC, id DESC
  `, [id]);
  const gastos = await getAll(`
    SELECT * FROM gastos
    WHERE relacion_tipo = 'live' AND relacion_id = $1
    ORDER BY fecha DESC, id DESC
  `, [id]);
  return { ...live, ventas, gastos };
}

export async function crearLive(data) {
  if (!data.fecha) {
    throw Object.assign(new Error('La fecha es obligatoria'), { status: 400 });
  }
  const res = await query(`
    INSERT INTO lives (
      fecha, titulo, plataforma, estado, hora_inicio, hora_fin,
      autos_vendidos, ventas_totales, costo_productos,
      premios_entregados, costo_premios, gastos_live, utilidad_neta, observaciones
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING id
  `, [
    data.fecha,
    data.titulo || null,
    data.plataforma || 'tiktok',
    data.estado || 'programado',
    data.hora_inicio || null,
    data.hora_fin || null,
    Number(data.autos_vendidos || 0),
    Number(data.ventas_totales || 0),
    Number(data.costo_productos || 0),
    Number(data.premios_entregados || 0),
    Number(data.costo_premios || 0),
    Number(data.gastos_live || 0),
    Number(data.utilidad_neta || 0),
    data.observaciones || null,
  ]);
  return obtenerLive(res.rows[0].id);
}

export async function actualizarLive(id, data) {
  const actual = await getOne('SELECT * FROM lives WHERE id = $1', [id]);
  if (!actual) return null;

  await query(`
    UPDATE lives SET
      fecha=$1, titulo=$2, plataforma=$3, estado=$4, hora_inicio=$5, hora_fin=$6,
      premios_entregados=$7, costo_premios=$8, gastos_live=$9, observaciones=$10
    WHERE id=$11
  `, [
    data.fecha ?? actual.fecha,
    data.titulo !== undefined ? data.titulo : actual.titulo,
    data.plataforma ?? actual.plataforma,
    data.estado ?? actual.estado,
    data.hora_inicio !== undefined ? data.hora_inicio : actual.hora_inicio,
    data.hora_fin !== undefined ? data.hora_fin : actual.hora_fin,
    data.premios_entregados != null ? Number(data.premios_entregados) : Number(actual.premios_entregados || 0),
    data.costo_premios != null ? Number(data.costo_premios) : Number(actual.costo_premios || 0),
    data.gastos_live != null ? Number(data.gastos_live) : Number(actual.gastos_live || 0),
    data.observaciones !== undefined ? data.observaciones : actual.observaciones,
    id,
  ]);

  // Recalcular utilidad con premios/gastos actualizados + ventas vinculadas
  return sincronizarLive(id);
}

export async function eliminarLive(id) {
  const live = await getOne('SELECT id FROM lives WHERE id = $1', [id]);
  if (!live) return null;
  await query('UPDATE ventas SET live_id = NULL WHERE live_id = $1', [id]);
  await query('DELETE FROM lives WHERE id = $1', [id]);
  return { ok: true };
}

/**
 * Recalcula métricas del live desde ventas vinculadas (live_id)
 * y gastos con relacion_tipo=live. Conserva premios manuales.
 */
export async function sincronizarLive(id) {
  const live = await getOne('SELECT * FROM lives WHERE id = $1', [id]);
  if (!live) return null;

  const ventasAgg = await getOne(`
    SELECT
      COALESCE(SUM(v.total_venta), 0) AS ventas_totales,
      COALESCE(SUM(v.total_costo), 0) AS costo_productos,
      COALESCE((
        SELECT SUM(vi.cantidad) FROM venta_items vi
        JOIN ventas vx ON vx.id = vi.venta_id
        WHERE vx.live_id = $1 AND vx.estado != 'cancelado'
      ), 0) AS autos_vendidos
    FROM ventas v
    WHERE v.live_id = $1 AND v.estado != 'cancelado'
  `, [id]);

  const gastosAgg = await getOne(`
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM gastos
    WHERE relacion_tipo = 'live' AND relacion_id = $1
  `, [id]);

  const ventasTotales = n(ventasAgg?.ventas_totales);
  const costoProductos = n(ventasAgg?.costo_productos);
  const autosVendidos = Math.round(n(ventasAgg?.autos_vendidos));
  const gastosDeTabla = n(gastosAgg?.total);
  // Si hay gastos vinculados en tabla, usan esos; si no, el campo manual
  const gastosLive = gastosDeTabla > 0 ? gastosDeTabla : n(live.gastos_live);
  const costoPremios = n(live.costo_premios);
  const utilidadNeta = ventasTotales - costoProductos - costoPremios - gastosLive;

  await query(`
    UPDATE lives SET
      autos_vendidos=$1, ventas_totales=$2, costo_productos=$3,
      gastos_live=$4, utilidad_neta=$5
    WHERE id=$6
  `, [autosVendidos, ventasTotales, costoProductos, gastosLive, utilidadNeta, id]);

  return obtenerLive(id);
}

export async function resumenLives() {
  const rows = await getAll(`
    SELECT * FROM lives
    WHERE estado != 'cancelado'
    ORDER BY utilidad_neta DESC NULLS LAST
    LIMIT 10
  `);
  const tot = await getOne(`
    SELECT
      COUNT(*) AS cantidad,
      COALESCE(SUM(ventas_totales), 0) AS ventas,
      COALESCE(SUM(utilidad_neta), 0) AS utilidad,
      COALESCE(SUM(autos_vendidos), 0) AS autos
    FROM lives WHERE estado != 'cancelado'
  `);
  return {
    top: rows,
    resumen: {
      cantidad: n(tot?.cantidad),
      ventas: n(tot?.ventas),
      utilidad: n(tot?.utilidad),
      autos: n(tot?.autos),
    },
  };
}

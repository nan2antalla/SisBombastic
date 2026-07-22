import { getOne, getAll, query } from '../db/database.js';

export async function listarMovimientos(filtros = {}) {
  let sql = 'SELECT * FROM caja_movimientos WHERE 1=1';
  const params = [];
  let i = 1;
  if (filtros.desde) { sql += ` AND fecha >= $${i++}`; params.push(filtros.desde); }
  if (filtros.hasta) { sql += ` AND fecha <= $${i++}`; params.push(filtros.hasta); }
  sql += ' ORDER BY fecha DESC, id DESC';
  return getAll(sql, params);
}

export async function saldoActual() {
  const row = await getOne(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo IN ('entrada_venta','inversion') THEN monto ELSE 0 END),0) -
      COALESCE(SUM(CASE WHEN tipo IN ('salida_compra','salida_gasto','retiro_personal','ajuste') THEN monto ELSE 0 END),0)
      as saldo FROM caja_movimientos
  `);
  return Number(row?.saldo || 0);
}

export async function registrarEntradaVenta(ventaId, monto, fecha, client = null) {
  const run = client ? (t, p) => client.query(t, p) : query;
  await run(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES ($1,'entrada_venta',$2,$3,'venta',$4)
  `, [fecha, monto, `Venta #${ventaId}`, ventaId]);
}

export async function registrarSalidaGasto(gastoId, monto, fecha, descripcion, client = null) {
  const run = client ? (t, p) => client.query(t, p) : query;
  await run(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES ($1,'salida_gasto',$2,$3,'gasto',$4)
  `, [fecha, monto, descripcion || `Gasto #${gastoId}`, gastoId]);
}

export async function registrarMovimiento(data) {
  const res = await query(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [
    data.fecha, data.tipo, data.monto, data.descripcion || null,
    data.referencia_tipo || null, data.referencia_id || null,
  ]);
  return getOne('SELECT * FROM caja_movimientos WHERE id = $1', [res.rows[0].id]);
}

export async function resumenCaja(fecha) {
  const movimientos = await getAll('SELECT * FROM caja_movimientos WHERE fecha = $1 ORDER BY id', [fecha]);
  const entradas = movimientos.filter((m) => ['entrada_venta', 'inversion'].includes(m.tipo)).reduce((s, m) => s + Number(m.monto), 0);
  const salidas = movimientos.filter((m) => ['salida_compra', 'salida_gasto', 'retiro_personal', 'ajuste'].includes(m.tipo)).reduce((s, m) => s + Number(m.monto), 0);
  const cierreAnterior = await getOne('SELECT saldo_final FROM caja_cierres WHERE fecha < $1 ORDER BY fecha DESC LIMIT 1', [fecha]);
  const saldoInicial = Number(cierreAnterior?.saldo_final || 0);

  return { fecha, saldo_inicial: saldoInicial, entradas, salidas, saldo_final: saldoInicial + entradas - salidas, movimientos };
}

export async function cerrarCaja(fecha, notas) {
  const resumen = await resumenCaja(fecha);
  const existente = await getOne('SELECT id FROM caja_cierres WHERE fecha = $1', [fecha]);

  if (existente) {
    await query(`
      UPDATE caja_cierres SET saldo_inicial=$1, entradas=$2, salidas=$3, saldo_final=$4, notas=$5 WHERE fecha=$6
    `, [resumen.saldo_inicial, resumen.entradas, resumen.salidas, resumen.saldo_final, notas || null, fecha]);
  } else {
    await query(`
      INSERT INTO caja_cierres (fecha, saldo_inicial, entradas, salidas, saldo_final, notas)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [fecha, resumen.saldo_inicial, resumen.entradas, resumen.salidas, resumen.saldo_final, notas || null]);
  }

  return getOne('SELECT * FROM caja_cierres WHERE fecha = $1', [fecha]);
}

export async function listarCierres() {
  return getAll('SELECT * FROM caja_cierres ORDER BY fecha DESC');
}

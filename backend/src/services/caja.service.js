import { getOne, getAll, query } from '../db/database.js';
import * as inventarioService from './inventario.service.js';

export async function listarMovimientos(filtros = {}) {
  let sql = 'SELECT * FROM caja_movimientos WHERE 1=1';
  const params = [];
  let i = 1;
  if (filtros.desde) { sql += ` AND fecha >= $${i++}`; params.push(filtros.desde); }
  if (filtros.hasta) { sql += ` AND fecha <= $${i++}`; params.push(filtros.hasta); }
  if (filtros.tipo) { sql += ` AND tipo = $${i++}`; params.push(filtros.tipo); }
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
  const get = client
    ? async (t, p) => (await client.query(t, p)).rows[0]
    : getOne;

  const existente = await get(
    `SELECT id FROM caja_movimientos WHERE referencia_tipo = 'venta' AND referencia_id = $1 AND tipo = 'entrada_venta'`,
    [ventaId]
  );

  if (existente) {
    await run(`
      UPDATE caja_movimientos
      SET fecha = $1, monto = $2, descripcion = $3
      WHERE id = $4
    `, [fecha, monto, `Venta #${ventaId}`, existente.id]);
    return;
  }

  await run(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES ($1,'entrada_venta',$2,$3,'venta',$4)
  `, [fecha, monto, `Venta #${ventaId}`, ventaId]);
}

export async function eliminarEntradaVenta(ventaId, client = null) {
  const run = client ? (t, p) => client.query(t, p) : query;
  await run(
    `DELETE FROM caja_movimientos WHERE referencia_tipo = 'venta' AND referencia_id = $1 AND tipo = 'entrada_venta'`,
    [ventaId]
  );
}

export async function registrarSalidaGasto(gastoId, monto, fecha, descripcion, client = null) {
  const run = client ? (t, p) => client.query(t, p) : query;
  await run(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES ($1,'salida_gasto',$2,$3,'gasto',$4)
  `, [fecha, monto, descripcion || `Gasto #${gastoId}`, gastoId]);
}

export async function registrarSalidaCompra(compraId, monto, fecha, descripcion, client = null) {
  const run = client ? (t, p) => client.query(t, p) : query;
  const get = client
    ? async (t, p) => (await client.query(t, p)).rows[0]
    : getOne;

  const existente = await get(
    `SELECT id FROM caja_movimientos WHERE referencia_tipo = 'compra' AND referencia_id = $1 AND tipo = 'salida_compra'`,
    [compraId]
  );

  if (existente) {
    await run(`
      UPDATE caja_movimientos
      SET fecha = $1, monto = $2, descripcion = $3
      WHERE id = $4
    `, [fecha, monto, descripcion || `Reinversión compra #${compraId}`, existente.id]);
    return;
  }

  await run(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES ($1,'salida_compra',$2,$3,'compra',$4)
  `, [fecha, monto, descripcion || `Reinversión compra #${compraId}`, compraId]);
}

export async function eliminarSalidaCompra(compraId, client = null) {
  const run = client ? (t, p) => client.query(t, p) : query;
  await run(
    `DELETE FROM caja_movimientos WHERE referencia_tipo = 'compra' AND referencia_id = $1 AND tipo = 'salida_compra'`,
    [compraId]
  );
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

/**
 * Cuánto dinero deberías tener en banco/caja, con desglose explicativo.
 */
export async function resumenEfectivo() {
  const tot = await getOne(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'entrada_venta' THEN monto ELSE 0 END), 0) AS ventas,
      COALESCE(SUM(CASE WHEN tipo = 'inversion' THEN monto ELSE 0 END), 0) AS inversiones,
      COALESCE(SUM(CASE WHEN tipo = 'salida_compra' THEN monto ELSE 0 END), 0) AS reinversiones,
      COALESCE(SUM(CASE WHEN tipo = 'salida_gasto' THEN monto ELSE 0 END), 0) AS gastos,
      COALESCE(SUM(CASE WHEN tipo = 'retiro_personal' THEN monto ELSE 0 END), 0) AS retiros,
      COALESCE(SUM(CASE WHEN tipo = 'ajuste' THEN monto ELSE 0 END), 0) AS ajustes
    FROM caja_movimientos
  `);

  const ventas = Number(tot?.ventas || 0);
  const inversiones = Number(tot?.inversiones || 0);
  const reinversiones = Number(tot?.reinversiones || 0);
  const gastos = Number(tot?.gastos || 0);
  const retiros = Number(tot?.retiros || 0);
  const ajustes = Number(tot?.ajustes || 0);

  const totalEntradas = ventas + inversiones;
  const totalSalidas = reinversiones + gastos + retiros + ajustes;
  const dineroEsperado = totalEntradas - totalSalidas;

  const valorInventario = await inventarioService.valorTotalInventario();

  const comprasExt = await getOne(`
    SELECT COALESCE(SUM(costo_total), 0) AS total
    FROM compras
    WHERE pagado_desde_caja = FALSE
  `);
  const comprasExternas = Number(comprasExt?.total || 0);

  const historico = await getAll(`
    SELECT fecha, tipo, monto, descripcion, referencia_tipo, referencia_id, created_at
    FROM caja_movimientos
    ORDER BY fecha DESC, id DESC
    LIMIT 50
  `);

  const porMes = await getAll(`
    SELECT
      TO_CHAR(fecha, 'YYYY-MM') AS periodo,
      COALESCE(SUM(CASE WHEN tipo IN ('entrada_venta','inversion') THEN monto ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN tipo IN ('salida_compra','salida_gasto','retiro_personal','ajuste') THEN monto ELSE 0 END), 0) AS salidas,
      COALESCE(SUM(CASE WHEN tipo = 'salida_compra' THEN monto ELSE 0 END), 0) AS reinversiones
    FROM caja_movimientos
    GROUP BY TO_CHAR(fecha, 'YYYY-MM')
    ORDER BY periodo DESC
    LIMIT 12
  `);

  return {
    dinero_esperado_banco: dineroEsperado,
    valor_inventario: Number(valorInventario || 0),
    patrimonio_aproximado: dineroEsperado + Number(valorInventario || 0),
    desglose: {
      ventas,
      inversiones_externas: inversiones,
      reinversiones_compras: reinversiones,
      compras_externas: comprasExternas,
      gastos,
      retiros_personales: retiros,
      ajustes,
      total_entradas: totalEntradas,
      total_salidas: totalSalidas,
    },
    formula: 'Ventas + Inversión externa − Reinversiones (compras de la caja) − Gastos − Retiros − Ajustes',
    explicacion: [
      'Dinero esperado en banco/caja = lo que entró menos lo que salió del efectivo.',
      'Las ventas SUMAN (plata que cobraste).',
      'Inversión externa SUMAN solo si la registras en Caja como “Inversión recibida” (plata nueva que metiste).',
      'Reinversión: compra pagada con plata de la caja → RESTA del banco (aunque siga siendo capital en inventario).',
      'Inversión externa en compra: pagaste con plata de afuera → NO resta de la caja.',
      'Gastos y retiros personales también RESTAN.',
      'Inventario = capital en productos. Patrimonio ≈ banco + inventario.',
    ],
    historico,
    por_mes: porMes.map((r) => ({
      periodo: r.periodo,
      entradas: Number(r.entradas || 0),
      salidas: Number(r.salidas || 0),
      reinversiones: Number(r.reinversiones || 0),
      neto: Number(r.entradas || 0) - Number(r.salidas || 0),
    })),
  };
}

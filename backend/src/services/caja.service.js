import db from '../db/database.js';

export function listarMovimientos(filtros = {}) {
  let sql = 'SELECT * FROM caja_movimientos WHERE 1=1';
  const params = [];

  if (filtros.desde) {
    sql += ' AND fecha >= ?';
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    sql += ' AND fecha <= ?';
    params.push(filtros.hasta);
  }

  sql += ' ORDER BY fecha DESC, id DESC';
  return db.prepare(sql).all(...params);
}

export function saldoActual() {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo IN ('entrada_venta', 'inversion') THEN monto ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tipo IN ('salida_compra', 'salida_gasto', 'retiro_personal', 'ajuste') THEN monto ELSE 0 END), 0)
      as saldo
    FROM caja_movimientos
  `).get();
  return row.saldo;
}

export function registrarEntradaVenta(ventaId, monto, fecha) {
  db.prepare(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES (?, 'entrada_venta', ?, ?, 'venta', ?)
  `).run(fecha, monto, `Venta #${ventaId}`, ventaId);
}

export function registrarSalidaGasto(gastoId, monto, fecha, descripcion) {
  db.prepare(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES (?, 'salida_gasto', ?, ?, 'gasto', ?)
  `).run(fecha, monto, descripcion || `Gasto #${gastoId}`, gastoId);
}

export function registrarSalidaCompra(compraId, monto, fecha, descripcion) {
  db.prepare(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES (?, 'salida_compra', ?, ?, 'compra', ?)
  `).run(fecha, monto, descripcion || `Compra #${compraId}`, compraId);
}

export function registrarMovimiento(data) {
  const result = db.prepare(`
    INSERT INTO caja_movimientos (fecha, tipo, monto, descripcion, referencia_tipo, referencia_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.fecha,
    data.tipo,
    data.monto,
    data.descripcion || null,
    data.referencia_tipo || null,
    data.referencia_id || null
  );

  return db.prepare('SELECT * FROM caja_movimientos WHERE id = ?').get(result.lastInsertRowid);
}

export function resumenCaja(fecha) {
  const movimientos = db.prepare(`
    SELECT * FROM caja_movimientos WHERE fecha = ? ORDER BY id
  `).all(fecha);

  const entradas = movimientos
    .filter((m) => ['entrada_venta', 'inversion'].includes(m.tipo))
    .reduce((s, m) => s + m.monto, 0);

  const salidas = movimientos
    .filter((m) => ['salida_compra', 'salida_gasto', 'retiro_personal', 'ajuste'].includes(m.tipo))
    .reduce((s, m) => s + m.monto, 0);

  const cierreAnterior = db.prepare(`
    SELECT saldo_final FROM caja_cierres WHERE fecha < ? ORDER BY fecha DESC LIMIT 1
  `).get(fecha);

  const saldoInicial = cierreAnterior?.saldo_final ?? 0;

  return {
    fecha,
    saldo_inicial: saldoInicial,
    entradas,
    salidas,
    saldo_final: saldoInicial + entradas - salidas,
    movimientos,
  };
}

export function cerrarCaja(fecha, notas) {
  const resumen = resumenCaja(fecha);

  const existente = db.prepare('SELECT id FROM caja_cierres WHERE fecha = ?').get(fecha);
  if (existente) {
    db.prepare(`
      UPDATE caja_cierres SET saldo_inicial = ?, entradas = ?, salidas = ?, saldo_final = ?, notas = ?
      WHERE fecha = ?
    `).run(resumen.saldo_inicial, resumen.entradas, resumen.salidas, resumen.saldo_final, notas || null, fecha);
  } else {
    db.prepare(`
      INSERT INTO caja_cierres (fecha, saldo_inicial, entradas, salidas, saldo_final, notas)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fecha, resumen.saldo_inicial, resumen.entradas, resumen.salidas, resumen.saldo_final, notas || null);
  }

  return db.prepare('SELECT * FROM caja_cierres WHERE fecha = ?').get(fecha);
}

export function listarCierres() {
  return db.prepare('SELECT * FROM caja_cierres ORDER BY fecha DESC').all();
}

import db from '../db/database.js';
import { calcularCostoTotal, calcularCostoUnitario, generarCodigoInterno } from '../utils/calculos.js';

const TIPOS_COMPRA_A_CATEGORIA = {
  mainline: 'mainline',
  premium: 'premium',
  rlc: 'rlc',
  protector: 'protector',
  sticker: 'sticker',
  tarjeta: 'tarjeta',
  accesorio: 'accesorio',
  otro: 'otro',
};

export function listarCompras(filtros = {}) {
  let sql = 'SELECT * FROM compras WHERE 1=1';
  const params = [];

  if (filtros.estado) {
    sql += ' AND estado = ?';
    params.push(filtros.estado);
  }
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

export function obtenerCompra(id) {
  return db.prepare('SELECT * FROM compras WHERE id = ?').get(id);
}

export function crearCompra(data) {
  const costoTotal = calcularCostoTotal(
    data.costo_producto,
    data.transporte,
    data.impuestos,
    data.otros_gastos
  );
  const costoUnitario = calcularCostoUnitario(costoTotal, data.cantidad);

  const stmt = db.prepare(`
    INSERT INTO compras (
      fecha, proveedor_id, proveedor_nombre, tipo_compra, descripcion, cantidad,
      costo_producto, transporte, impuestos, otros_gastos, costo_total, costo_unitario, es_caja, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const estado = data.estado || 'en_camino';

  const result = stmt.run(
    data.fecha,
    data.proveedor_id || null,
    data.proveedor_nombre || null,
    data.tipo_compra,
    data.descripcion,
    data.cantidad,
    data.costo_producto || 0,
    data.transporte || 0,
    data.impuestos || 0,
    data.otros_gastos || 0,
    costoTotal,
    costoUnitario,
    data.es_caja === false ? 0 : 1,
    estado
  );

  const compraId = result.lastInsertRowid;

  if (estado === 'recibido') {
    ingresarCompraAInventario(compraId);
  }

  return obtenerCompra(compraId);
}

export function actualizarCompra(id, data) {
  const actual = obtenerCompra(id);
  if (!actual) return null;

  const merged = { ...actual, ...data };
  const costoTotal = calcularCostoTotal(
    merged.costo_producto,
    merged.transporte,
    merged.impuestos,
    merged.otros_gastos
  );
  const costoUnitario = calcularCostoUnitario(costoTotal, merged.cantidad);

  const estadoAnterior = actual.estado;
  const nuevoEstado = merged.estado;

  db.prepare(`
    UPDATE compras SET
      fecha = ?, proveedor_id = ?, proveedor_nombre = ?, tipo_compra = ?, descripcion = ?,
      cantidad = ?, costo_producto = ?, transporte = ?, impuestos = ?, otros_gastos = ?,
      costo_total = ?, costo_unitario = ?, es_caja = ?, estado = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    merged.fecha,
    merged.proveedor_id || null,
    merged.proveedor_nombre || null,
    merged.tipo_compra,
    merged.descripcion,
    merged.cantidad,
    merged.costo_producto,
    merged.transporte,
    merged.impuestos,
    merged.otros_gastos,
    costoTotal,
    costoUnitario,
    merged.es_caja === false || merged.es_caja === 0 ? 0 : 1,
    nuevoEstado,
    id
  );

  if (estadoAnterior !== 'recibido' && nuevoEstado === 'recibido') {
    ingresarCompraAInventario(id);
  }

  return obtenerCompra(id);
}

function ingresarCompraAInventario(compraId) {
  const compra = obtenerCompra(compraId);
  if (!compra) return;

  const existe = db.prepare('SELECT id FROM inventario WHERE compra_id = ?').get(compraId);
  if (existe) return;

  const categoria = TIPOS_COMPRA_A_CATEGORIA[compra.tipo_compra] || 'otro';
  const esCaja = compra.tipo_compra === 'mainline' && compra.es_caja !== 0;
  const tipoItem = esCaja ? 'caja_cerrada' : (compra.tipo_compra === 'accesorio' || compra.tipo_compra === 'protector' || compra.tipo_compra === 'sticker' || compra.tipo_compra === 'tarjeta' ? 'accesorio' : 'auto_individual');

  db.prepare(`
    INSERT INTO inventario (
      codigo_interno, nombre, categoria, tipo_item, cantidad, costo_unitario,
      estado, fecha_ingreso, proveedor_id, proveedor_nombre, compra_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?, ?, ?, ?)
  `).run(
    generarCodigoInterno(),
    compra.descripcion,
    categoria,
    tipoItem,
    compra.cantidad,
    compra.costo_unitario,
    compra.fecha,
    compra.proveedor_id,
    compra.proveedor_nombre,
    compra.id
  );
}

export function eliminarCompra(id) {
  const compra = obtenerCompra(id);
  if (!compra) return false;
  if (compra.estado === 'recibido') {
    throw new Error('No se puede eliminar una compra ya recibida en inventario');
  }
  db.prepare('DELETE FROM compras WHERE id = ?').run(id);
  return true;
}

export function marcarRecibida(id) {
  return actualizarCompra(id, { estado: 'recibido' });
}

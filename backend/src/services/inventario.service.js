import db from '../db/database.js';
import { generarCodigoInterno } from '../utils/calculos.js';

export function listarInventario(filtros = {}) {
  let sql = 'SELECT * FROM inventario WHERE 1=1';
  const params = [];

  if (filtros.estado) {
    sql += ' AND estado = ?';
    params.push(filtros.estado);
  }
  if (filtros.categoria) {
    sql += ' AND categoria = ?';
    params.push(filtros.categoria);
  }
  if (filtros.busqueda) {
    sql += ' AND (nombre LIKE ? OR codigo_interno LIKE ? OR serie LIKE ?)';
    const q = `%${filtros.busqueda}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY fecha_ingreso DESC, id DESC';
  return db.prepare(sql).all(...params);
}

export function obtenerItem(id) {
  return db.prepare('SELECT * FROM inventario WHERE id = ?').get(id);
}

export function crearItem(data) {
  const codigo = data.codigo_interno || generarCodigoInterno();

  const result = db.prepare(`
    INSERT INTO inventario (
      codigo_interno, nombre, categoria, tipo_item, serie, anio, case_code,
      cantidad, costo_unitario, precio_sugerido, estado, ubicacion,
      fecha_ingreso, proveedor_id, proveedor_nombre, notas
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    codigo,
    data.nombre,
    data.categoria,
    data.tipo_item || 'auto_individual',
    data.serie || null,
    data.anio || null,
    data.case_code || null,
    data.cantidad || 1,
    data.costo_unitario || 0,
    data.precio_sugerido || null,
    data.estado || 'disponible',
    data.ubicacion || null,
    data.fecha_ingreso,
    data.proveedor_id || null,
    data.proveedor_nombre || null,
    data.notas || null
  );

  return obtenerItem(result.lastInsertRowid);
}

export function actualizarItem(id, data) {
  const actual = obtenerItem(id);
  if (!actual) return null;

  const merged = { ...actual, ...data };

  db.prepare(`
    UPDATE inventario SET
      nombre = ?, categoria = ?, tipo_item = ?, serie = ?, anio = ?, case_code = ?,
      cantidad = ?, costo_unitario = ?, precio_sugerido = ?, estado = ?,
      ubicacion = ?, notas = ?, proveedor_nombre = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    merged.nombre,
    merged.categoria,
    merged.tipo_item,
    merged.serie,
    merged.anio,
    merged.case_code,
    merged.cantidad,
    merged.costo_unitario,
    merged.precio_sugerido,
    merged.estado,
    merged.ubicacion,
    merged.notas,
    merged.proveedor_nombre || null,
    id
  );

  return obtenerItem(id);
}

export function eliminarItem(id) {
  const item = obtenerItem(id);
  if (!item) return false;
  db.prepare('DELETE FROM inventario WHERE id = ?').run(id);
  return true;
}

/**
 * Abre UNA caja del stock (resta 1).
 * Costo de cada auto = costo_unitario de la caja / cantidad de autos ingresados.
 */
export function abrirCaja(cajaId, autos) {
  const autosValidos = (autos || []).filter((a) => a?.nombre?.trim());
  if (autosValidos.length === 0) {
    throw new Error('Debes ingresar al menos un auto');
  }

  const caja = obtenerItem(cajaId);
  if (!caja) throw new Error('Caja no encontrada');
  if (caja.tipo_item !== 'caja_cerrada') throw new Error('El item no es una caja cerrada');
  if (caja.estado !== 'disponible') throw new Error('La caja no está disponible');
  if (caja.cantidad < 1) throw new Error('No hay cajas disponibles para abrir');

  const abrir = db.transaction(() => {
    const nuevaCantidad = caja.cantidad - 1;
    const nuevoEstado = nuevaCantidad <= 0 ? 'vendido' : 'disponible';

    db.prepare(`
      UPDATE inventario SET cantidad = ?, estado = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(nuevaCantidad, nuevoEstado, cajaId);

    const costoPorAuto = Number(caja.costo_unitario) / autosValidos.length;
    const itemsCreados = [];

    for (const auto of autosValidos) {
      const result = db.prepare(`
        INSERT INTO inventario (
          codigo_interno, nombre, categoria, tipo_item, serie, anio, case_code,
          cantidad, costo_unitario, precio_sugerido, estado, ubicacion,
          fecha_ingreso, proveedor_id, proveedor_nombre, parent_id, notas
        ) VALUES (?, ?, ?, 'auto_individual', ?, ?, ?, 1, ?, ?, 'disponible', ?, ?, ?, ?, ?, ?)
      `).run(
        auto.codigo_interno || generarCodigoInterno(),
        auto.nombre.trim(),
        caja.categoria,
        auto.serie || caja.serie,
        auto.anio || caja.anio,
        auto.case_code || caja.case_code,
        auto.costo_unitario != null && auto.costo_unitario !== ''
          ? Number(auto.costo_unitario)
          : costoPorAuto,
        auto.precio_sugerido || caja.precio_sugerido,
        auto.ubicacion || caja.ubicacion,
        caja.fecha_ingreso,
        caja.proveedor_id,
        caja.proveedor_nombre,
        cajaId,
        auto.notas || null
      );
      itemsCreados.push(obtenerItem(result.lastInsertRowid));
    }

    return {
      cajas_restantes: nuevaCantidad,
      costo_por_auto: costoPorAuto,
      items: itemsCreados,
    };
  });

  return abrir();
}

export function descontarStock(inventarioId, cantidad) {
  const item = obtenerItem(inventarioId);
  if (!item) throw new Error('Producto no encontrado en inventario');
  if (item.estado !== 'disponible' && item.estado !== 'reservado') {
    throw new Error(`Producto no disponible (estado: ${item.estado})`);
  }
  if (item.cantidad < cantidad) {
    throw new Error(`Stock insuficiente. Disponible: ${item.cantidad}`);
  }

  const nuevaCantidad = item.cantidad - cantidad;
  const nuevoEstado = nuevaCantidad <= 0 ? 'vendido' : item.estado;

  db.prepare(`
    UPDATE inventario SET cantidad = ?, estado = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(nuevaCantidad, nuevoEstado, inventarioId);

  return obtenerItem(inventarioId);
}

export function valorTotalInventario() {
  const row = db.prepare(`
    SELECT COALESCE(SUM(cantidad * costo_unitario), 0) as valor
    FROM inventario
    WHERE estado IN ('disponible', 'reservado')
  `).get();
  return row.valor;
}

export function productosBajaRotacion(limite = 10) {
  return db.prepare(`
    SELECT i.*, COALESCE(SUM(vi.cantidad), 0) as vendidos
    FROM inventario i
    LEFT JOIN venta_items vi ON vi.inventario_id = i.id
    WHERE i.estado = 'disponible'
    GROUP BY i.id
    ORDER BY vendidos ASC, i.fecha_ingreso ASC
    LIMIT ?
  `).all(limite);
}

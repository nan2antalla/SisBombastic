import { getOne, getAll, query, withTransaction } from '../db/database.js';
import { generarCodigoInterno } from '../utils/calculos.js';

function normalizeCaja(row) {
  if (!row) return row;
  return {
    ...row,
    cantidad: Number(row.cantidad),
    costo_unitario: Number(row.costo_unitario),
    precio_sugerido: row.precio_sugerido != null ? Number(row.precio_sugerido) : null,
  };
}

export async function listarInventario(filtros = {}) {
  let sql = 'SELECT * FROM inventario WHERE 1=1';
  const params = [];
  let i = 1;

  if (filtros.estado) { sql += ` AND estado = $${i++}`; params.push(filtros.estado); }
  if (filtros.categoria) { sql += ` AND categoria = $${i++}`; params.push(filtros.categoria); }
  if (filtros.busqueda) {
    sql += ` AND (nombre ILIKE $${i} OR codigo_interno ILIKE $${i} OR serie ILIKE $${i})`;
    params.push(`%${filtros.busqueda}%`);
    i++;
  }

  sql += ' ORDER BY fecha_ingreso DESC, id DESC';
  return getAll(sql, params);
}

export async function obtenerItem(id) {
  return getOne('SELECT * FROM inventario WHERE id = $1', [id]);
}

export async function crearItem(data) {
  const codigo = data.codigo_interno || generarCodigoInterno();
  const res = await query(`
    INSERT INTO inventario (
      codigo_interno, nombre, categoria, tipo_item, serie, anio, case_code,
      cantidad, costo_unitario, precio_sugerido, estado, ubicacion,
      fecha_ingreso, proveedor_id, proveedor_nombre, notas
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id
  `, [
    codigo, data.nombre, data.categoria, data.tipo_item || 'auto_individual',
    data.serie || null, data.anio || null, data.case_code || null,
    data.cantidad || 1, data.costo_unitario || 0, data.precio_sugerido || null,
    data.estado || 'disponible', data.ubicacion || null, data.fecha_ingreso,
    data.proveedor_id || null, data.proveedor_nombre || null, data.notas || null,
  ]);
  return obtenerItem(res.rows[0].id);
}

export async function actualizarItem(id, data) {
  const actual = await obtenerItem(id);
  if (!actual) return null;
  const merged = { ...actual, ...data };

  await query(`
    UPDATE inventario SET
      nombre=$1, categoria=$2, tipo_item=$3, serie=$4, anio=$5, case_code=$6,
      cantidad=$7, costo_unitario=$8, precio_sugerido=$9, estado=$10,
      ubicacion=$11, notas=$12, proveedor_nombre=$13, updated_at=NOW()
    WHERE id=$14
  `, [
    merged.nombre, merged.categoria, merged.tipo_item, merged.serie, merged.anio, merged.case_code,
    merged.cantidad, merged.costo_unitario, merged.precio_sugerido, merged.estado,
    merged.ubicacion, merged.notas, merged.proveedor_nombre || null, id,
  ]);

  return obtenerItem(id);
}

export async function eliminarItem(id) {
  const item = await obtenerItem(id);
  if (!item) return false;
  await query('DELETE FROM inventario WHERE id = $1', [id]);
  return true;
}

/**
 * Abre UNA caja del stock (resta 1).
 *
 * Modos:
 * A) autos = [{nombre}, ...] → un registro por nombre
 * B) nombreLote + cantidad → crea N autos individuales (cantidad=1 cada uno)
 *    Ej: nombre "99ABCDE Autos", cantidad 72 → 72 filas individuales
 *
 * Costo de cada auto = costo_unitario de la caja / cantidad de autos.
 */
export async function abrirCaja(cajaId, autos, opciones = {}) {
  let autosValidos = (autos || []).filter((a) => a?.nombre?.trim());

  const nombreLote = String(opciones.nombre || opciones.nombre_lote || '').trim();
  const cantidadLote = Number(opciones.cantidad || 0);

  if (nombreLote && cantidadLote > 0) {
    if (cantidadLote > 500) {
      throw new Error('Máximo 500 autos por apertura de caja');
    }
    autosValidos = Array.from({ length: cantidadLote }, () => ({ nombre: nombreLote }));
  }

  if (autosValidos.length === 0) {
    throw new Error('Debes ingresar al menos un auto, o un nombre con cantidad');
  }

  return withTransaction(async (client) => {
    const cajaRes = await client.query('SELECT * FROM inventario WHERE id = $1 FOR UPDATE', [cajaId]);
    const caja = normalizeCaja(cajaRes.rows[0]);
    if (!caja) throw new Error('Caja no encontrada');
    if (caja.tipo_item !== 'caja_cerrada') throw new Error('El item no es una caja cerrada');
    if (caja.estado !== 'disponible') throw new Error('La caja no está disponible');
    if (caja.cantidad < 1) throw new Error('No hay cajas disponibles para abrir');

    const nuevaCantidad = caja.cantidad - 1;
    const nuevoEstado = nuevaCantidad <= 0 ? 'vendido' : 'disponible';

    await client.query(
      `UPDATE inventario SET cantidad=$1, estado=$2, updated_at=NOW() WHERE id=$3`,
      [nuevaCantidad, nuevoEstado, cajaId]
    );

    const costoPorAuto = Number(caja.costo_unitario) / autosValidos.length;
    const itemsCreados = [];

    for (const auto of autosValidos) {
      const res = await client.query(`
        INSERT INTO inventario (
          codigo_interno, nombre, categoria, tipo_item, serie, anio, case_code,
          cantidad, costo_unitario, precio_sugerido, estado, ubicacion,
          fecha_ingreso, proveedor_id, proveedor_nombre, parent_id, notas
        ) VALUES ($1,$2,$3,'auto_individual',$4,$5,$6,1,$7,$8,'disponible',$9,$10,$11,$12,$13,$14)
        RETURNING *
      `, [
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
        auto.notas || null,
      ]);
      itemsCreados.push(res.rows[0]);
    }

    return {
      cajas_restantes: nuevaCantidad,
      costo_por_auto: costoPorAuto,
      cantidad_creada: itemsCreados.length,
      items: itemsCreados,
    };
  });
}

export async function descontarStock(inventarioId, cantidad, client = null) {
  const run = client ? (t, p) => client.query(t, p) : query;
  const res = await run('SELECT * FROM inventario WHERE id = $1', [inventarioId]);
  const row = res.rows[0];

  if (!row) throw new Error('Producto no encontrado en inventario');
  if (row.estado !== 'disponible' && row.estado !== 'reservado') {
    throw new Error(`Producto no disponible (estado: ${row.estado})`);
  }
  if (Number(row.cantidad) < cantidad) {
    throw new Error(`Stock insuficiente. Disponible: ${row.cantidad}`);
  }

  const nuevaCantidad = Number(row.cantidad) - cantidad;
  const nuevoEstado = nuevaCantidad <= 0 ? 'vendido' : row.estado;

  await run('UPDATE inventario SET cantidad=$1, estado=$2, updated_at=NOW() WHERE id=$3', [nuevaCantidad, nuevoEstado, inventarioId]);

  const updated = await run('SELECT * FROM inventario WHERE id = $1', [inventarioId]);
  return updated.rows[0];
}

export async function valorTotalInventario() {
  const row = await getOne(`
    SELECT COALESCE(SUM(cantidad * costo_unitario), 0) as valor
    FROM inventario WHERE estado IN ('disponible', 'reservado')
  `);
  return Number(row?.valor || 0);
}

export async function productosBajaRotacion(limite = 10) {
  return getAll(`
    SELECT i.*, COALESCE(SUM(vi.cantidad), 0) as vendidos
    FROM inventario i
    LEFT JOIN venta_items vi ON vi.inventario_id = i.id
    WHERE i.estado = 'disponible'
    GROUP BY i.id
    ORDER BY vendidos ASC, i.fecha_ingreso ASC
    LIMIT $1
  `, [limite]);
}

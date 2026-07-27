import { getOne, getAll, query } from '../db/database.js';
import { calcularCostoTotal, calcularCostoUnitario, generarCodigoInterno } from '../utils/calculos.js';
import * as proveedoresService from './proveedores.service.js';
import * as cajaService from './caja.service.js';

const TIPOS_COMPRA_A_CATEGORIA = {
  mainline: 'mainline', premium: 'premium', rlc: 'rlc', protector: 'protector',
  sticker: 'sticker', tarjeta: 'tarjeta', accesorio: 'accesorio', otro: 'otro',
};

function esPagadoDesdeCaja(data) {
  return data.pagado_desde_caja !== false && data.pagado_desde_caja !== 0 && data.pagado_desde_caja !== '0';
}

async function resolverProveedor(data) {
  let proveedorId = data.proveedor_id || null;
  let proveedorNombre = data.proveedor_nombre || null;

  if (proveedorId) {
    const p = await getOne('SELECT * FROM proveedores WHERE id = $1', [proveedorId]);
    if (p) {
      proveedorNombre = p.nombre;
      return { proveedorId: p.id, proveedorNombre: p.nombre };
    }
  }

  if (proveedorNombre) {
    const p = await proveedoresService.obtenerOCrearPorNombre(proveedorNombre);
    if (p) return { proveedorId: p.id, proveedorNombre: p.nombre };
  }

  return { proveedorId: null, proveedorNombre: null };
}

async function sincronizarCajaCompra(compra) {
  if (!compra) return;
  if (esPagadoDesdeCaja(compra)) {
    await cajaService.registrarSalidaCompra(
      compra.id,
      Number(compra.costo_total || 0),
      compra.fecha,
      `Reinversión: ${compra.descripcion || `compra #${compra.id}`}`
    );
  } else {
    await cajaService.eliminarSalidaCompra(compra.id);
  }
}

export async function listarCompras(filtros = {}) {
  let sql = 'SELECT * FROM compras WHERE 1=1';
  const params = [];
  let i = 1;

  if (filtros.estado) { sql += ` AND estado = $${i++}`; params.push(filtros.estado); }
  if (filtros.desde) { sql += ` AND fecha >= $${i++}`; params.push(filtros.desde); }
  if (filtros.hasta) { sql += ` AND fecha <= $${i++}`; params.push(filtros.hasta); }

  sql += ' ORDER BY fecha DESC, id DESC';
  return getAll(sql, params);
}

export async function obtenerCompra(id) {
  return getOne('SELECT * FROM compras WHERE id = $1', [id]);
}

export async function crearCompra(data) {
  const costoTotal = calcularCostoTotal(data.costo_producto, data.transporte, data.impuestos, data.otros_gastos);
  const costoUnitario = calcularCostoUnitario(costoTotal, data.cantidad);
  const { proveedorId, proveedorNombre } = await resolverProveedor(data);
  const estado = data.estado || 'en_camino';
  const pagadoDesdeCaja = esPagadoDesdeCaja(data);

  const res = await query(`
    INSERT INTO compras (
      fecha, proveedor_id, proveedor_nombre, tipo_compra, descripcion, cantidad,
      costo_producto, transporte, impuestos, otros_gastos, costo_total, costo_unitario,
      es_caja, pagado_desde_caja, estado
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id
  `, [
    data.fecha, proveedorId, proveedorNombre,
    data.tipo_compra, data.descripcion, data.cantidad,
    data.costo_producto || 0, data.transporte || 0, data.impuestos || 0, data.otros_gastos || 0,
    costoTotal, costoUnitario, data.es_caja !== false, pagadoDesdeCaja, estado,
  ]);

  const compraId = res.rows[0].id;

  if (estado === 'recibido') {
    await ingresarCompraAInventario(compraId);
  }

  const compra = await obtenerCompra(compraId);
  await sincronizarCajaCompra(compra);
  return compra;
}

export async function actualizarCompra(id, data) {
  const actual = await obtenerCompra(id);
  if (!actual) return null;

  const merged = { ...actual, ...data };
  const costoTotal = calcularCostoTotal(merged.costo_producto, merged.transporte, merged.impuestos, merged.otros_gastos);
  const costoUnitario = calcularCostoUnitario(costoTotal, merged.cantidad);
  const estadoAnterior = actual.estado;
  const nuevoEstado = merged.estado;
  const pagadoDesdeCaja = esPagadoDesdeCaja(merged);

  await query(`
    UPDATE compras SET
      fecha=$1, proveedor_id=$2, proveedor_nombre=$3, tipo_compra=$4, descripcion=$5,
      cantidad=$6, costo_producto=$7, transporte=$8, impuestos=$9, otros_gastos=$10,
      costo_total=$11, costo_unitario=$12, es_caja=$13, pagado_desde_caja=$14, estado=$15, updated_at=NOW()
    WHERE id=$16
  `, [
    merged.fecha, merged.proveedor_id || null, merged.proveedor_nombre || null,
    merged.tipo_compra, merged.descripcion, merged.cantidad,
    merged.costo_producto, merged.transporte, merged.impuestos, merged.otros_gastos,
    costoTotal, costoUnitario,
    merged.es_caja !== false && merged.es_caja !== 0,
    pagadoDesdeCaja,
    nuevoEstado, id,
  ]);

  if (estadoAnterior !== 'recibido' && nuevoEstado === 'recibido') {
    await ingresarCompraAInventario(id);
  }

  const compra = await obtenerCompra(id);
  await sincronizarCajaCompra(compra);
  return compra;
}

async function ingresarCompraAInventario(compraId) {
  const compra = await obtenerCompra(compraId);
  if (!compra) return;

  const existe = await getOne('SELECT id FROM inventario WHERE compra_id = $1', [compraId]);
  if (existe) return;

  const categoria = TIPOS_COMPRA_A_CATEGORIA[compra.tipo_compra] || 'otro';
  const esCaja = compra.tipo_compra === 'mainline' && compra.es_caja !== false;
  const accesorio = ['accesorio', 'protector', 'sticker', 'tarjeta'].includes(compra.tipo_compra);
  const tipoItem = esCaja ? 'caja_cerrada' : (accesorio ? 'accesorio' : 'auto_individual');

  await query(`
    INSERT INTO inventario (
      codigo_interno, nombre, categoria, tipo_item, cantidad, costo_unitario,
      estado, fecha_ingreso, proveedor_id, proveedor_nombre, compra_id
    ) VALUES ($1,$2,$3,$4,$5,$6,'disponible',$7,$8,$9,$10)
  `, [
    generarCodigoInterno(), compra.descripcion, categoria, tipoItem,
    compra.cantidad, compra.costo_unitario, compra.fecha,
    compra.proveedor_id, compra.proveedor_nombre, compra.id,
  ]);
}

export async function eliminarCompra(id) {
  const compra = await obtenerCompra(id);
  if (!compra) return false;
  if (compra.estado === 'recibido') {
    throw new Error('No se puede eliminar una compra ya recibida en inventario');
  }
  await cajaService.eliminarSalidaCompra(id);
  await query('DELETE FROM compras WHERE id = $1', [id]);
  return true;
}

export async function marcarRecibida(id) {
  return actualizarCompra(id, { estado: 'recibido' });
}

import db from '../db/database.js';
import { calcularUtilidadBruta } from '../utils/calculos.js';
import * as inventarioService from './inventario.service.js';
import * as cajaService from './caja.service.js';

export function listarVentas(filtros = {}) {
  let sql = 'SELECT * FROM ventas WHERE 1=1';
  const params = [];

  if (filtros.desde) {
    sql += ' AND fecha >= ?';
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    sql += ' AND fecha <= ?';
    params.push(filtros.hasta);
  }
  if (filtros.estado) {
    sql += ' AND estado = ?';
    params.push(filtros.estado);
  }

  sql += ' ORDER BY fecha DESC, id DESC';
  const ventas = db.prepare(sql).all(...params);

  return ventas.map((v) => ({
    ...v,
    items: db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(v.id),
  }));
}

export function obtenerVenta(id) {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
  if (!venta) return null;
  return {
    ...venta,
    items: db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(id),
  };
}

export function crearVenta(data) {
  const crear = db.transaction(() => {
    let totalVenta = 0;
    let totalCosto = 0;
    const itemsProcesados = [];

    for (const item of data.items) {
      let costoUnitario = item.costo_unitario;
      let nombreProducto = item.producto_nombre;

      if (item.inventario_id) {
        const inv = inventarioService.obtenerItem(item.inventario_id);
        if (!inv) throw new Error(`Producto inventario #${item.inventario_id} no encontrado`);
        costoUnitario = inv.costo_unitario;
        nombreProducto = inv.nombre;
        inventarioService.descontarStock(item.inventario_id, item.cantidad);
      }

      const utilidad = calcularUtilidadBruta(item.precio_venta, costoUnitario, item.cantidad);
      const subtotal = Number(item.precio_venta) * Number(item.cantidad);

      totalVenta += subtotal;
      totalCosto += costoUnitario * item.cantidad;

      itemsProcesados.push({
        inventario_id: item.inventario_id || null,
        producto_nombre: nombreProducto,
        cantidad: item.cantidad,
        precio_venta: item.precio_venta,
        costo_unitario: costoUnitario,
        utilidad,
      });
    }

    totalVenta += Number(data.delivery || 0);
    const utilidadBruta = totalVenta - Number(data.delivery || 0) - totalCosto;

    const result = db.prepare(`
      INSERT INTO ventas (
        fecha, cliente_id, cliente_nombre, metodo_pago, canal, delivery,
        estado, total_venta, total_costo, utilidad_bruta, live_id, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.fecha,
      data.cliente_id || null,
      data.cliente_nombre || null,
      data.metodo_pago || 'efectivo',
      data.canal || 'presencial',
      data.delivery || 0,
      data.estado || 'pagado',
      totalVenta,
      totalCosto,
      utilidadBruta,
      data.live_id || null,
      data.notas || null
    );

    const ventaId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO venta_items (venta_id, inventario_id, producto_nombre, cantidad, precio_venta, costo_unitario, utilidad)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of itemsProcesados) {
      insertItem.run(
        ventaId,
        item.inventario_id,
        item.producto_nombre,
        item.cantidad,
        item.precio_venta,
        item.costo_unitario,
        item.utilidad
      );
    }

    if (data.estado !== 'cancelado' && data.estado !== 'pendiente') {
      cajaService.registrarEntradaVenta(ventaId, totalVenta, data.fecha);
    }

    actualizarClienteStats(data.cliente_id, data.cliente_nombre, totalVenta, data.fecha);

    return obtenerVenta(ventaId);
  });

  return crear();
}

function actualizarClienteStats(clienteId, clienteNombre, monto, fecha) {
  if (clienteId) {
    db.prepare(`
      UPDATE clientes SET
        total_comprado = COALESCE(total_comprado, 0) + ?,
        cantidad_compras = COALESCE(cantidad_compras, 0) + 1,
        ultima_compra = ?
      WHERE id = ?
    `).run(monto, fecha, clienteId);
  } else if (clienteNombre) {
    const existente = db.prepare('SELECT id FROM clientes WHERE nombre = ?').get(clienteNombre);
    if (existente) {
      db.prepare(`
        UPDATE clientes SET
          total_comprado = COALESCE(total_comprado, 0) + ?,
          cantidad_compras = COALESCE(cantidad_compras, 0) + 1,
          ultima_compra = ?
        WHERE id = ?
      `).run(monto, fecha, existente.id);
    }
  }
}

export function cancelarVenta(id) {
  const venta = obtenerVenta(id);
  if (!venta) return null;
  if (venta.estado === 'cancelado') return venta;

  db.prepare(`UPDATE ventas SET estado = 'cancelado' WHERE id = ?`).run(id);
  return obtenerVenta(id);
}

/**
 * Recalcula costos y utilidades usando el costo actual del inventario.
 */
export function recalcularUtilidades() {
  const ventas = db.prepare(`SELECT id FROM ventas WHERE estado != 'cancelado'`).all();
  let ventasActualizadas = 0;
  let itemsActualizados = 0;

  const run = db.transaction(() => {
    for (const venta of ventas) {
      const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id);
      let cambió = false;

      for (const item of items) {
        let nuevoCosto = Number(item.costo_unitario);

        if (item.inventario_id) {
          const inv = db.prepare('SELECT costo_unitario FROM inventario WHERE id = ?').get(item.inventario_id);
          if (inv) nuevoCosto = Number(inv.costo_unitario);
        } else if (item.producto_nombre) {
          const inv = db.prepare(`
            SELECT costo_unitario FROM inventario
            WHERE nombre = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          `).get(item.producto_nombre);
          if (inv) nuevoCosto = Number(inv.costo_unitario);
        }

        const utilidad = (Number(item.precio_venta) - nuevoCosto) * Number(item.cantidad);

        if (nuevoCosto !== Number(item.costo_unitario) || utilidad !== Number(item.utilidad)) {
          db.prepare('UPDATE venta_items SET costo_unitario = ?, utilidad = ? WHERE id = ?')
            .run(nuevoCosto, utilidad, item.id);
          itemsActualizados += 1;
          cambió = true;
        }
      }

      const itemsFresh = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id);
      let totalCostoFinal = 0;
      let utilidadItems = 0;
      for (const it of itemsFresh) {
        totalCostoFinal += Number(it.costo_unitario) * Number(it.cantidad);
        utilidadItems += Number(it.utilidad);
      }

      db.prepare('UPDATE ventas SET total_costo = ?, utilidad_bruta = ? WHERE id = ?')
        .run(totalCostoFinal, utilidadItems, venta.id);

      if (cambió) ventasActualizadas += 1;
    }
  });

  run();

  return {
    ok: true,
    ventas_actualizadas: ventasActualizadas,
    items_actualizados: itemsActualizados,
    mensaje: `Se recalcularon ${itemsActualizados} ítems en ${ventasActualizadas} ventas.`,
  };
}

export function actualizarItemVenta(itemId, data) {
  const item = db.prepare('SELECT * FROM venta_items WHERE id = ?').get(itemId);
  if (!item) return null;

  const precio = data.precio_venta != null ? Number(data.precio_venta) : Number(item.precio_venta);
  const costo = data.costo_unitario != null ? Number(data.costo_unitario) : Number(item.costo_unitario);
  const cantidad = data.cantidad != null ? Number(data.cantidad) : Number(item.cantidad);
  const utilidad = (precio - costo) * cantidad;

  db.prepare(`
    UPDATE venta_items SET precio_venta = ?, costo_unitario = ?, cantidad = ?, utilidad = ?
    WHERE id = ?
  `).run(precio, costo, cantidad, utilidad, itemId);

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(item.venta_id);
  const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(item.venta_id);

  let totalCosto = 0;
  let utilidadBruta = 0;
  let totalProductos = 0;
  for (const it of items) {
    totalCosto += Number(it.costo_unitario) * Number(it.cantidad);
    utilidadBruta += Number(it.utilidad);
    totalProductos += Number(it.precio_venta) * Number(it.cantidad);
  }

  const delivery = Number(venta.delivery || 0);
  db.prepare(`
    UPDATE ventas SET total_venta = ?, total_costo = ?, utilidad_bruta = ? WHERE id = ?
  `).run(totalProductos + delivery, totalCosto, utilidadBruta, item.venta_id);

  return obtenerVenta(item.venta_id);
}

export function topProductos(limite = 10, desde, hasta) {
  let sql = `
    SELECT producto_nombre, SUM(cantidad) as total_vendido, SUM(precio_venta * cantidad) as ingresos, SUM(utilidad) as utilidad
    FROM venta_items vi
    JOIN ventas v ON v.id = vi.venta_id
    WHERE v.estado != 'cancelado'
  `;
  const params = [];

  if (desde) {
    sql += ' AND v.fecha >= ?';
    params.push(desde);
  }
  if (hasta) {
    sql += ' AND v.fecha <= ?';
    params.push(hasta);
  }

  sql += ' GROUP BY producto_nombre ORDER BY total_vendido DESC LIMIT ?';
  params.push(limite);

  return db.prepare(sql).all(...params);
}

export function ventasDelPeriodo(desde, hasta) {
  return db.prepare(`
    SELECT COALESCE(SUM(total_venta), 0) as total,
           COALESCE(SUM(utilidad_bruta), 0) as utilidad_bruta,
           COALESCE(SUM(total_costo), 0) as total_costo,
           COUNT(*) as cantidad
    FROM ventas
    WHERE estado != 'cancelado' AND fecha >= ? AND fecha <= ?
  `).get(desde, hasta);
}

export function autosVendidos(desde, hasta) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(vi.cantidad), 0) as total
    FROM venta_items vi
    JOIN ventas v ON v.id = vi.venta_id
    WHERE v.estado != 'cancelado' AND v.fecha >= ? AND v.fecha <= ?
  `).get(desde, hasta);
  return row.total;
}

export function ventasPorDia(desde, hasta) {
  return db.prepare(`
    SELECT fecha,
           COALESCE(SUM(total_venta), 0) AS ventas,
           COALESCE(SUM(utilidad_bruta), 0) AS utilidad,
           COUNT(*) AS cantidad
    FROM ventas
    WHERE estado != 'cancelado' AND fecha >= ? AND fecha <= ?
    GROUP BY fecha
    ORDER BY fecha ASC
  `).all(desde, hasta);
}

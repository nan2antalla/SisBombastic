import { getOne, getAll, query, withTransaction } from '../db/database.js';
import { calcularUtilidadBruta, inicioMes, finMes, ultimosMeses } from '../utils/calculos.js';
import { SQL_CATEGORIA_VENTA, SQL_JOIN_VENTA_ITEMS } from '../utils/ventasClasificacion.js';
import * as inventarioService from './inventario.service.js';
import * as cajaService from './caja.service.js';

export async function listarVentas(filtros = {}) {
  let sql = 'SELECT * FROM ventas WHERE 1=1';
  const params = [];
  let i = 1;

  if (filtros.desde) { sql += ` AND fecha >= $${i++}`; params.push(filtros.desde); }
  if (filtros.hasta) { sql += ` AND fecha <= $${i++}`; params.push(filtros.hasta); }
  if (filtros.estado) { sql += ` AND estado = $${i++}`; params.push(filtros.estado); }

  sql += ' ORDER BY fecha DESC, id DESC';
  const ventas = await getAll(sql, params);

  return Promise.all(ventas.map(async (v) => ({
    ...v,
    items: await getAll('SELECT * FROM venta_items WHERE venta_id = $1', [v.id]),
  })));
}

export async function obtenerVenta(id) {
  const venta = await getOne('SELECT * FROM ventas WHERE id = $1', [id]);
  if (!venta) return null;
  return {
    ...venta,
    items: await getAll('SELECT * FROM venta_items WHERE venta_id = $1', [id]),
  };
}

export async function crearVenta(data) {
  if (!data.cliente_nombre && !data.cliente_id) {
    throw Object.assign(new Error('El cliente es obligatorio'), { status: 400 });
  }
  if (!data.metodo_pago) {
    throw Object.assign(new Error('El método de pago es obligatorio'), { status: 400 });
  }
  if (!data.canal) {
    throw Object.assign(new Error('El canal es obligatorio'), { status: 400 });
  }

  const { obtenerOCrearPorNombre } = await import('./clientes.service.js');
  let clienteId = data.cliente_id || null;
  let clienteNombre = data.cliente_nombre || null;

  if (clienteId) {
    const c = await getOne('SELECT * FROM clientes WHERE id = $1', [clienteId]);
    if (c) {
      clienteNombre = c.nombre;
    }
  } else if (clienteNombre) {
    const c = await obtenerOCrearPorNombre(clienteNombre);
    if (c) {
      clienteId = c.id;
      clienteNombre = c.nombre;
    }
  }

  return withTransaction(async (client) => {
    let totalVenta = 0;
    let totalCosto = 0;
    const itemsProcesados = [];

    for (const item of data.items) {
      let costoUnitario = item.costo_unitario;
      let nombreProducto = item.producto_nombre;

      if (item.inventario_id) {
        const invRes = await client.query('SELECT * FROM inventario WHERE id = $1', [item.inventario_id]);
        const inv = invRes.rows[0];
        if (!inv) throw new Error(`Producto inventario #${item.inventario_id} no encontrado`);
        costoUnitario = inv.costo_unitario;
        nombreProducto = inv.nombre;
        await inventarioService.descontarStock(item.inventario_id, item.cantidad, client);
      }

      const utilidad = calcularUtilidadBruta(item.precio_venta, costoUnitario, item.cantidad);
      const subtotal = Number(item.precio_venta) * Number(item.cantidad);
      totalVenta += subtotal;
      totalCosto += Number(costoUnitario) * Number(item.cantidad);

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

    const ventaRes = await client.query(`
      INSERT INTO ventas (
        fecha, cliente_id, cliente_nombre, metodo_pago, canal, delivery,
        estado, total_venta, total_costo, utilidad_bruta, live_id, notas
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id
    `, [
      data.fecha, clienteId, clienteNombre,
      data.metodo_pago, data.canal, data.delivery || 0,
      data.estado || 'pagado', totalVenta, totalCosto, utilidadBruta,
      data.live_id || null, data.notas || null,
    ]);

    const ventaId = ventaRes.rows[0].id;

    for (const item of itemsProcesados) {
      await client.query(`
        INSERT INTO venta_items (venta_id, inventario_id, producto_nombre, cantidad, precio_venta, costo_unitario, utilidad)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [ventaId, item.inventario_id, item.producto_nombre, item.cantidad, item.precio_venta, item.costo_unitario, item.utilidad]);
    }

    if (data.estado !== 'cancelado' && data.estado !== 'pendiente') {
      await cajaService.registrarEntradaVenta(ventaId, totalVenta, data.fecha, client);
    }

    await actualizarClienteStats(clienteId, clienteNombre, totalVenta, data.fecha, client);

    const ventaCreada = await obtenerVenta(ventaId);
    return ventaCreada;
  }).then(async (venta) => {
    if (venta?.live_id) {
      try {
        const { sincronizarLive } = await import('./lives.service.js');
        await sincronizarLive(venta.live_id);
      } catch { /* opcional */ }
    }
    return venta;
  });
}

async function actualizarClienteStats(clienteId, clienteNombre, monto, fecha, client) {
  const run = (t, p) => client.query(t, p);
  if (clienteId) {
    await run(`
      UPDATE clientes SET total_comprado = COALESCE(total_comprado,0)+$1,
        cantidad_compras = COALESCE(cantidad_compras,0)+1, ultima_compra=$2 WHERE id=$3
    `, [monto, fecha, clienteId]);
  } else if (clienteNombre) {
    const ex = await run('SELECT id FROM clientes WHERE nombre = $1', [clienteNombre]);
    if (ex.rows[0]) {
      await run(`
        UPDATE clientes SET total_comprado = COALESCE(total_comprado,0)+$1,
          cantidad_compras = COALESCE(cantidad_compras,0)+1, ultima_compra=$2 WHERE id=$3
      `, [monto, fecha, ex.rows[0].id]);
    }
  }
}

export async function cancelarVenta(id) {
  return withTransaction(async (client) => {
    const ventaRes = await client.query('SELECT * FROM ventas WHERE id = $1 FOR UPDATE', [id]);
    const venta = ventaRes.rows[0];
    if (!venta) return null;
    if (venta.estado === 'cancelado') {
      return obtenerVenta(id);
    }

    const itemsRes = await client.query('SELECT * FROM venta_items WHERE venta_id = $1', [id]);
    for (const item of itemsRes.rows) {
      if (item.inventario_id) {
        await inventarioService.devolverStock(item.inventario_id, Number(item.cantidad), client);
      }
    }

    await cajaService.eliminarEntradaVenta(id, client);
    await client.query(`UPDATE ventas SET estado = 'cancelado' WHERE id = $1`, [id]);

    if (venta.cliente_id) {
      await client.query(`
        UPDATE clientes SET
          total_comprado = GREATEST(COALESCE(total_comprado,0) - $1, 0),
          cantidad_compras = GREATEST(COALESCE(cantidad_compras,0) - 1, 0)
        WHERE id = $2
      `, [Number(venta.total_venta || 0), venta.cliente_id]);
    }

    return obtenerVenta(id);
  });
}

function ventaAfectaCaja(estado) {
  return estado !== 'cancelado' && estado !== 'pendiente';
}

function toDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function sincronizarCajaDeVenta(venta, client = null) {
  if (!venta) return;
  if (ventaAfectaCaja(venta.estado)) {
    await cajaService.registrarEntradaVenta(
      venta.id,
      Number(venta.total_venta || 0),
      toDateOnly(venta.fecha) || venta.fecha,
      client
    );
  } else {
    await cajaService.eliminarEntradaVenta(venta.id, client);
  }
}

/**
 * Edita datos de la venta (estado, cliente, pago, canal, etc.)
 * y mantiene caja sincronizada.
 */
export async function actualizarVenta(id, data) {
  const actual = await obtenerVenta(id);
  if (!actual) return null;
  if (actual.estado === 'cancelado') {
    throw Object.assign(new Error('No se puede editar una venta cancelada'), { status: 400 });
  }
  if (data.estado === 'cancelado') {
    return cancelarVenta(id);
  }

  const { obtenerOCrearPorNombre } = await import('./clientes.service.js');
  let clienteId = data.cliente_id !== undefined ? (data.cliente_id || null) : actual.cliente_id;
  let clienteNombre = data.cliente_nombre !== undefined ? data.cliente_nombre : actual.cliente_nombre;

  if (clienteId) {
    const c = await getOne('SELECT * FROM clientes WHERE id = $1', [clienteId]);
    if (c) clienteNombre = c.nombre;
  } else if (data.cliente_nombre) {
    const c = await obtenerOCrearPorNombre(data.cliente_nombre);
    if (c) {
      clienteId = c.id;
      clienteNombre = c.nombre;
    }
  }

  const fecha = toDateOnly(data.fecha ?? actual.fecha);
  if (!fecha) {
    throw Object.assign(new Error('La fecha es inválida'), { status: 400 });
  }

  const metodoPago = data.metodo_pago ?? actual.metodo_pago;
  const canal = data.canal ?? actual.canal;
  const deliveryRaw = data.delivery != null ? Number(data.delivery) : Number(actual.delivery || 0);
  const delivery = Number.isFinite(deliveryRaw) ? deliveryRaw : 0;
  const estado = data.estado ?? actual.estado;
  const notas = data.notas !== undefined ? data.notas : actual.notas;
  let liveId = data.live_id !== undefined ? (data.live_id || null) : actual.live_id;
  if (canal !== 'live') liveId = null;

  if (!metodoPago) throw Object.assign(new Error('El método de pago es obligatorio'), { status: 400 });
  if (!canal) throw Object.assign(new Error('El canal es obligatorio'), { status: 400 });

  // Recalcular totales con delivery nuevo
  let totalProductos = 0;
  let totalCosto = 0;
  let utilidadBruta = 0;
  for (const it of actual.items || []) {
    totalProductos += Number(it.precio_venta) * Number(it.cantidad);
    totalCosto += Number(it.costo_unitario) * Number(it.cantidad);
    utilidadBruta += Number(it.utilidad);
  }
  const totalVenta = totalProductos + delivery;

  await query(`
    UPDATE ventas SET
      fecha=$1, cliente_id=$2, cliente_nombre=$3, metodo_pago=$4, canal=$5,
      delivery=$6, estado=$7, notas=$8, total_venta=$9, total_costo=$10, utilidad_bruta=$11, live_id=$12
    WHERE id=$13
  `, [
    fecha,
    clienteId || null,
    clienteNombre || null,
    metodoPago,
    canal,
    delivery,
    estado,
    notas || null,
    totalVenta,
    totalCosto,
    utilidadBruta,
    liveId,
    id,
  ]);

  const venta = await obtenerVenta(id);
  await sincronizarCajaDeVenta(venta);

  // Refrescar métricas del live anterior y del nuevo
  try {
    const { sincronizarLive } = await import('./lives.service.js');
    if (actual.live_id) await sincronizarLive(actual.live_id);
    if (liveId && liveId !== actual.live_id) await sincronizarLive(liveId);
  } catch { /* live opcional */ }

  return venta;
}

/**
 * Recalcula costos y utilidades de ventas usando el costo actual del inventario.
 * Corrige ventas hechas cuando el costo de la caja aún estaba mal.
 */
export async function recalcularUtilidades() {
  return withTransaction(async (client) => {
    const ventasRes = await client.query(`SELECT id, delivery FROM ventas WHERE estado != 'cancelado'`);
    let ventasActualizadas = 0;
    let itemsActualizados = 0;

    for (const venta of ventasRes.rows) {
      const itemsRes = await client.query('SELECT * FROM venta_items WHERE venta_id = $1', [venta.id]);
      let cambió = false;

      for (const item of itemsRes.rows) {
        let nuevoCosto = Number(item.costo_unitario);

        if (item.inventario_id) {
          const inv = await client.query('SELECT costo_unitario FROM inventario WHERE id = $1', [item.inventario_id]);
          if (inv.rows[0]) {
            nuevoCosto = Number(inv.rows[0].costo_unitario);
          }
        } else if (item.producto_nombre) {
          const inv = await client.query(
            `SELECT costo_unitario FROM inventario
             WHERE nombre = $1
             ORDER BY updated_at DESC NULLS LAST, id DESC
             LIMIT 1`,
            [item.producto_nombre]
          );
          if (inv.rows[0]) {
            nuevoCosto = Number(inv.rows[0].costo_unitario);
          }
        }

        const utilidad = (Number(item.precio_venta) - nuevoCosto) * Number(item.cantidad);

        if (nuevoCosto !== Number(item.costo_unitario) || utilidad !== Number(item.utilidad)) {
          await client.query(
            `UPDATE venta_items SET costo_unitario = $1, utilidad = $2 WHERE id = $3`,
            [nuevoCosto, utilidad, item.id]
          );
          itemsActualizados += 1;
          cambió = true;
        }
      }

      const itemsFresh = await client.query('SELECT * FROM venta_items WHERE venta_id = $1', [venta.id]);
      let totalCostoFinal = 0;
      let utilidadItems = 0;
      for (const it of itemsFresh.rows) {
        totalCostoFinal += Number(it.costo_unitario) * Number(it.cantidad);
        utilidadItems += Number(it.utilidad);
      }

      await client.query(
        `UPDATE ventas SET total_costo = $1, utilidad_bruta = $2 WHERE id = $3`,
        [totalCostoFinal, utilidadItems, venta.id]
      );

      if (cambió) ventasActualizadas += 1;
    }

    return {
      ok: true,
      ventas_actualizadas: ventasActualizadas,
      items_actualizados: itemsActualizados,
      mensaje: `Se recalcularon ${itemsActualizados} ítems en ${ventasActualizadas} ventas.`,
    };
  });
}

/**
 * Actualiza costo/precio de un ítem de venta y recalcula la utilidad de esa venta.
 */
export async function actualizarItemVenta(itemId, data) {
  const item = await getOne('SELECT * FROM venta_items WHERE id = $1', [itemId]);
  if (!item) return null;

  const ventaCheck = await getOne('SELECT estado FROM ventas WHERE id = $1', [item.venta_id]);
  if (ventaCheck?.estado === 'cancelado') {
    throw Object.assign(new Error('No se puede editar una venta cancelada'), { status: 400 });
  }

  const precio = data.precio_venta != null ? Number(data.precio_venta) : Number(item.precio_venta);
  const costo = data.costo_unitario != null ? Number(data.costo_unitario) : Number(item.costo_unitario);
  const cantidad = data.cantidad != null ? Number(data.cantidad) : Number(item.cantidad);
  const utilidad = (precio - costo) * cantidad;

  await query(
    `UPDATE venta_items SET precio_venta=$1, costo_unitario=$2, cantidad=$3, utilidad=$4 WHERE id=$5`,
    [precio, costo, cantidad, utilidad, itemId]
  );

  const ventaId = item.venta_id;
  const items = await getAll('SELECT * FROM venta_items WHERE venta_id = $1', [ventaId]);
  const venta = await getOne('SELECT * FROM ventas WHERE id = $1', [ventaId]);

  let totalCosto = 0;
  let utilidadBruta = 0;
  let totalProductos = 0;
  for (const it of items) {
    totalCosto += Number(it.costo_unitario) * Number(it.cantidad);
    utilidadBruta += Number(it.utilidad);
    totalProductos += Number(it.precio_venta) * Number(it.cantidad);
  }

  const delivery = Number(venta.delivery || 0);
  await query(
    `UPDATE ventas SET total_venta=$1, total_costo=$2, utilidad_bruta=$3 WHERE id=$4`,
    [totalProductos + delivery, totalCosto, utilidadBruta, ventaId]
  );

  const ventaFresh = await obtenerVenta(ventaId);
  await sincronizarCajaDeVenta(ventaFresh);
  return ventaFresh;
}

export async function topProductos(limite = 10, desde, hasta) {
  let sql = `
    SELECT producto_nombre, SUM(cantidad) as total_vendido,
           SUM(precio_venta * cantidad) as ingresos, SUM(utilidad) as utilidad
    FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
    WHERE v.estado != 'cancelado'
  `;
  const params = [];
  let i = 1;
  if (desde) { sql += ` AND v.fecha >= $${i++}`; params.push(desde); }
  if (hasta) { sql += ` AND v.fecha <= $${i++}`; params.push(hasta); }
  sql += ` GROUP BY producto_nombre ORDER BY total_vendido DESC LIMIT $${i}`;
  params.push(limite);
  return getAll(sql, params);
}

export async function ventasDelPeriodo(desde, hasta) {
  return getOne(`
    SELECT COALESCE(SUM(total_venta),0) as total, COALESCE(SUM(utilidad_bruta),0) as utilidad_bruta,
           COALESCE(SUM(total_costo),0) as total_costo, COUNT(*) as cantidad
    FROM ventas WHERE estado != 'cancelado' AND fecha >= $1 AND fecha <= $2
  `, [desde, hasta]);
}

export async function metricasPorCategoria(desde, hasta) {
  const rows = await getAll(`
    SELECT
      ${SQL_CATEGORIA_VENTA} AS categoria,
      COALESCE(SUM(vi.cantidad), 0) AS unidades,
      COALESCE(SUM(vi.precio_venta * vi.cantidad), 0) AS ingresos,
      COALESCE(SUM(vi.costo_unitario * vi.cantidad), 0) AS costo,
      COALESCE(SUM(vi.utilidad), 0) AS utilidad
    ${SQL_JOIN_VENTA_ITEMS}
      AND v.fecha >= $1 AND v.fecha <= $2
    GROUP BY 1
  `, [desde, hasta]);

  const map = { auto_caja: {}, otro_item: {}, manual: {} };
  for (const r of rows) {
    map[r.categoria] = {
      unidades: Number(r.unidades || 0),
      ingresos: Number(r.ingresos || 0),
      costo: Number(r.costo || 0),
      utilidad: Number(r.utilidad || 0),
    };
  }
  for (const k of ['auto_caja', 'otro_item', 'manual']) {
    if (!map[k].unidades && map[k].unidades !== 0) {
      map[k] = { unidades: 0, ingresos: 0, costo: 0, utilidad: 0 };
    }
  }

  const inventario = {
    unidades: map.auto_caja.unidades + map.otro_item.unidades,
    ingresos: map.auto_caja.ingresos + map.otro_item.ingresos,
    costo: map.auto_caja.costo + map.otro_item.costo,
    utilidad: map.auto_caja.utilidad + map.otro_item.utilidad,
  };

  return {
    auto_caja: map.auto_caja,
    otro_item: map.otro_item,
    manual: map.manual,
    inventario,
  };
}

export async function autosVendidos(desde, hasta) {
  const m = await metricasPorCategoria(desde, hasta);
  return m.auto_caja.unidades;
}

export async function otrosItemsVendidos(desde, hasta) {
  const m = await metricasPorCategoria(desde, hasta);
  return m.otro_item.unidades;
}

/** @deprecated usar otrosItemsVendidos — cajas cerradas ya están en otro_item */
export async function cajasCerradasVendidas(desde, hasta) {
  const row = await getOne(`
    SELECT COALESCE(SUM(vi.cantidad),0) as total
    ${SQL_JOIN_VENTA_ITEMS}
      AND v.fecha >= $1 AND v.fecha <= $2
      AND i.tipo_item = 'caja_cerrada'
  `, [desde, hasta]);
  return Number(row?.total || 0);
}

export async function ventasPorMesResumen(cantidadMeses = 6) {
  const meses = ultimosMeses(cantidadMeses);
  const desde = meses[meses.length - 1]?.desde || inicioMes();
  return getAll(`
    SELECT
      TO_CHAR(v.fecha, 'YYYY-MM') AS periodo,
      ${SQL_CATEGORIA_VENTA} AS categoria,
      COALESCE(SUM(vi.cantidad), 0) AS unidades,
      COALESCE(SUM(vi.precio_venta * vi.cantidad), 0) AS ingresos,
      COALESCE(SUM(vi.utilidad), 0) AS utilidad
    ${SQL_JOIN_VENTA_ITEMS}
      AND v.fecha >= $1
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `, [desde]);
}

export async function ventasPorTipoItem(desde, hasta) {
  return getAll(`
    SELECT
      COALESCE(i.tipo_item, 'auto_individual') AS tipo_item,
      COALESCE(SUM(vi.cantidad), 0) AS unidades,
      COALESCE(SUM(vi.precio_venta * vi.cantidad), 0) AS ingresos,
      COALESCE(SUM(vi.utilidad), 0) AS utilidad
    FROM venta_items vi
    JOIN ventas v ON v.id = vi.venta_id
    LEFT JOIN inventario i ON i.id = vi.inventario_id
    WHERE v.estado != 'cancelado'
      AND v.fecha >= $1 AND v.fecha <= $2
    GROUP BY 1
    ORDER BY unidades DESC
  `, [desde, hasta]);
}

export async function ventasPorDia(desde, hasta) {
  return getAll(`
    SELECT fecha,
           COALESCE(SUM(total_venta), 0) AS ventas,
           COALESCE(SUM(utilidad_bruta), 0) AS utilidad,
           COUNT(*) AS cantidad
    FROM ventas
    WHERE estado != 'cancelado' AND fecha >= $1 AND fecha <= $2
    GROUP BY fecha
    ORDER BY fecha ASC
  `, [desde, hasta]);
}

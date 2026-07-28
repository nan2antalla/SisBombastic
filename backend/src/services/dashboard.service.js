import { getAll, getOne } from '../db/database.js';
import * as ventasService from './ventas.service.js';
import * as gastosService from './gastos.service.js';
import * as inventarioService from './inventario.service.js';
import * as cajaService from './caja.service.js';
import { hoy, inicioMes, finMes, calcularMargen, haceDias } from '../utils/calculos.js';

function n(v) {
  return Number(v || 0);
}

function recomendacionProveedor({ margen, dias_promedio_venta, utilidad, stock_valor }) {
  if (utilidad <= 0 && stock_valor > 0) return { nivel: 'malo', texto: 'Revisar: poca o nula utilidad' };
  if (margen >= 35 && (dias_promedio_venta == null || dias_promedio_venta <= 21)) {
    return { nivel: 'excelente', texto: 'Seguir comprando' };
  }
  if (margen >= 20 && (dias_promedio_venta == null || dias_promedio_venta <= 45)) {
    return { nivel: 'bueno', texto: 'Mantener con cuidado' };
  }
  if (margen < 15 || (dias_promedio_venta != null && dias_promedio_venta > 60)) {
    return { nivel: 'malo', texto: 'Reducir o dejar de comprar' };
  }
  return { nivel: 'regular', texto: 'Observar más tiempo' };
}

export async function rentabilidadPorCaja() {
  // Cajas abiertas (tienen hijos) o cajas cerradas con stock
  const rows = await getAll(`
    WITH hijos AS (
      SELECT
        parent_id,
        COUNT(*) AS autos_totales,
        COUNT(*) FILTER (WHERE estado = 'vendido' OR cantidad = 0) AS autos_agotados,
        COUNT(*) FILTER (WHERE estado IN ('disponible','reservado') AND cantidad > 0) AS autos_stock,
        COALESCE(SUM(costo_unitario), 0) AS costo_autos,
        COALESCE(SUM(CASE WHEN estado IN ('disponible','reservado') THEN cantidad * costo_unitario ELSE 0 END), 0) AS valor_stock
      FROM inventario
      WHERE parent_id IS NOT NULL
      GROUP BY parent_id
    ),
    ventas_hijos AS (
      SELECT
        i.parent_id,
        COALESCE(SUM(vi.precio_venta * vi.cantidad), 0) AS ingresos,
        COALESCE(SUM(vi.costo_unitario * vi.cantidad), 0) AS costo_vendido,
        COALESCE(SUM(vi.utilidad), 0) AS utilidad,
        COALESCE(SUM(vi.cantidad), 0) AS unidades_vendidas,
        AVG( (v.fecha::date - i.fecha_ingreso::date) ) AS dias_promedio
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'cancelado'
      JOIN inventario i ON i.id = vi.inventario_id
      WHERE i.parent_id IS NOT NULL
      GROUP BY i.parent_id
    )
    SELECT
      c.id,
      c.codigo_interno,
      c.nombre,
      c.proveedor_nombre,
      c.fecha_ingreso,
      c.costo_unitario AS costo_caja,
      c.cantidad AS cajas_restantes,
      c.estado,
      COALESCE(h.autos_totales, 0) AS autos_totales,
      COALESCE(h.autos_stock, 0) AS autos_en_stock,
      COALESCE(vh.unidades_vendidas, 0) AS unidades_vendidas,
      COALESCE(vh.ingresos, 0) AS ingresos,
      COALESCE(vh.costo_vendido, 0) AS costo_vendido,
      COALESCE(vh.utilidad, 0) AS utilidad,
      COALESCE(h.valor_stock, 0) AS valor_stock,
      vh.dias_promedio
    FROM inventario c
    LEFT JOIN hijos h ON h.parent_id = c.id
    LEFT JOIN ventas_hijos vh ON vh.parent_id = c.id
    WHERE c.tipo_item = 'caja_cerrada'
       OR h.parent_id IS NOT NULL
    ORDER BY utilidad DESC NULLS LAST, c.fecha_ingreso DESC
  `);

  return rows.map((r) => {
    const ingresos = n(r.ingresos);
    const costoCaja = n(r.costo_caja);
    const utilidad = n(r.utilidad);
    const margen = calcularMargen(utilidad, ingresos);
    const roi = costoCaja > 0 ? (utilidad / costoCaja) * 100 : 0;
    const autosTotales = n(r.autos_totales);
    const vendidos = n(r.unidades_vendidas);
    const pctVendido = autosTotales > 0 ? (vendidos / autosTotales) * 100 : 0;

    return {
      ...r,
      costo_caja: costoCaja,
      ingresos,
      utilidad,
      margen,
      roi,
      pct_vendido: pctVendido,
      dias_promedio_venta: r.dias_promedio != null ? Math.round(n(r.dias_promedio)) : null,
      recuperado: ingresos >= costoCaja,
      generacion_neta: utilidad, // lo que generó esa caja
    };
  });
}

export async function rentabilidadPorProveedor() {
  const rows = await getAll(`
    WITH nombres AS (
      SELECT DISTINCT COALESCE(proveedor_nombre, 'Sin proveedor') AS proveedor FROM compras
      UNION
      SELECT DISTINCT COALESCE(proveedor_nombre, 'Sin proveedor') FROM inventario
      UNION
      SELECT DISTINCT COALESCE(i.proveedor_nombre, 'Sin proveedor')
      FROM venta_items vi
      LEFT JOIN inventario i ON i.id = vi.inventario_id
    ),
    compras_prov AS (
      SELECT
        COALESCE(proveedor_nombre, 'Sin proveedor') AS proveedor,
        COALESCE(SUM(costo_total), 0) AS total_comprado,
        COUNT(*) AS num_compras,
        MIN(fecha) AS primera_compra,
        MAX(fecha) AS ultima_compra
      FROM compras
      GROUP BY 1
    ),
    inv_prov AS (
      SELECT
        COALESCE(proveedor_nombre, 'Sin proveedor') AS proveedor,
        COALESCE(SUM(CASE WHEN estado IN ('disponible','reservado') THEN cantidad * costo_unitario ELSE 0 END), 0) AS valor_stock,
        COALESCE(SUM(CASE WHEN estado IN ('disponible','reservado') THEN cantidad ELSE 0 END), 0) AS unidades_stock
      FROM inventario
      GROUP BY 1
    ),
    ventas_prov AS (
      SELECT
        COALESCE(i.proveedor_nombre, 'Sin proveedor') AS proveedor,
        COALESCE(SUM(vi.precio_venta * vi.cantidad), 0) AS ingresos,
        COALESCE(SUM(vi.costo_unitario * vi.cantidad), 0) AS costo_vendido,
        COALESCE(SUM(vi.utilidad), 0) AS utilidad,
        COALESCE(SUM(vi.cantidad), 0) AS unidades_vendidas,
        AVG( (v.fecha::date - i.fecha_ingreso::date) ) AS dias_promedio,
        MIN(v.fecha) AS primera_venta,
        MAX(v.fecha) AS ultima_venta
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'cancelado'
      LEFT JOIN inventario i ON i.id = vi.inventario_id
      GROUP BY 1
    )
    SELECT
      n.proveedor,
      COALESCE(c.total_comprado, 0) AS total_comprado,
      COALESCE(c.num_compras, 0) AS num_compras,
      c.primera_compra,
      c.ultima_compra,
      COALESCE(i.valor_stock, 0) AS valor_stock,
      COALESCE(i.unidades_stock, 0) AS unidades_stock,
      COALESCE(v.ingresos, 0) AS ingresos,
      COALESCE(v.costo_vendido, 0) AS costo_vendido,
      COALESCE(v.utilidad, 0) AS utilidad,
      COALESCE(v.unidades_vendidas, 0) AS unidades_vendidas,
      v.dias_promedio,
      v.primera_venta,
      v.ultima_venta
    FROM nombres n
    LEFT JOIN compras_prov c ON c.proveedor = n.proveedor
    LEFT JOIN inv_prov i ON i.proveedor = n.proveedor
    LEFT JOIN ventas_prov v ON v.proveedor = n.proveedor
    ORDER BY utilidad DESC NULLS LAST
  `);

  return rows.map((r) => {
    const ingresos = n(r.ingresos);
    const utilidad = n(r.utilidad);
    const totalComprado = n(r.total_comprado);
    const margen = calcularMargen(utilidad, ingresos);
    const roi = totalComprado > 0 ? (utilidad / totalComprado) * 100 : 0;
    const dias = r.dias_promedio != null ? Math.round(n(r.dias_promedio)) : null;
    const rec = recomendacionProveedor({
      margen,
      dias_promedio_venta: dias,
      utilidad,
      stock_valor: n(r.valor_stock),
    });

    return {
      proveedor: r.proveedor,
      total_comprado: totalComprado,
      num_compras: n(r.num_compras),
      valor_stock: n(r.valor_stock),
      unidades_stock: n(r.unidades_stock),
      ingresos,
      utilidad,
      unidades_vendidas: n(r.unidades_vendidas),
      margen,
      roi,
      dias_promedio_venta: dias,
      primera_compra: r.primera_compra,
      ultima_compra: r.ultima_compra,
      primera_venta: r.primera_venta,
      ultima_venta: r.ultima_venta,
      recomendacion: rec,
    };
  });
}

export async function velocidadVentas() {
  const [promedio, masRapidos, masLentos, porCanal, porPago, ticket] = await Promise.all([
    getOne(`
      SELECT
        AVG( (v.fecha::date - i.fecha_ingreso::date) ) AS dias_promedio,
        MIN( (v.fecha::date - i.fecha_ingreso::date) ) AS dias_min,
        MAX( (v.fecha::date - i.fecha_ingreso::date) ) AS dias_max,
        COUNT(*) AS ventas_con_inventario
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'cancelado'
      JOIN inventario i ON i.id = vi.inventario_id
      WHERE i.fecha_ingreso IS NOT NULL
    `),
    getAll(`
      SELECT
        vi.producto_nombre,
        AVG( (v.fecha::date - i.fecha_ingreso::date) ) AS dias,
        SUM(vi.cantidad) AS vendidos,
        SUM(vi.utilidad) AS utilidad
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'cancelado'
      JOIN inventario i ON i.id = vi.inventario_id
      GROUP BY vi.producto_nombre
      HAVING COUNT(*) >= 1
      ORDER BY dias ASC NULLS LAST
      LIMIT 8
    `),
    getAll(`
      SELECT
        vi.producto_nombre,
        AVG( (v.fecha::date - i.fecha_ingreso::date) ) AS dias,
        SUM(vi.cantidad) AS vendidos,
        SUM(vi.utilidad) AS utilidad
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'cancelado'
      JOIN inventario i ON i.id = vi.inventario_id
      GROUP BY vi.producto_nombre
      HAVING COUNT(*) >= 1
      ORDER BY dias DESC NULLS LAST
      LIMIT 8
    `),
    getAll(`
      SELECT canal, COUNT(*) AS ventas, COALESCE(SUM(total_venta),0) AS total, COALESCE(SUM(utilidad_bruta),0) AS utilidad
      FROM ventas WHERE estado != 'cancelado'
      GROUP BY canal ORDER BY total DESC
    `),
    getAll(`
      SELECT metodo_pago, COUNT(*) AS ventas, COALESCE(SUM(total_venta),0) AS total, COALESCE(SUM(utilidad_bruta),0) AS utilidad
      FROM ventas WHERE estado != 'cancelado'
      GROUP BY metodo_pago ORDER BY total DESC
    `),
    getOne(`
      SELECT
        COALESCE(AVG(total_venta),0) AS ticket_promedio,
        COALESCE(AVG(utilidad_bruta),0) AS utilidad_promedio,
        COUNT(*) AS num_ventas
      FROM ventas WHERE estado != 'cancelado'
    `),
  ]);

  return {
    dias_promedio: promedio?.dias_promedio != null ? Math.round(n(promedio.dias_promedio)) : null,
    dias_min: promedio?.dias_min != null ? Math.round(n(promedio.dias_min)) : null,
    dias_max: promedio?.dias_max != null ? Math.round(n(promedio.dias_max)) : null,
    mas_rapidos: masRapidos.map((r) => ({
      ...r,
      dias: r.dias != null ? Math.round(n(r.dias)) : null,
      vendidos: n(r.vendidos),
      utilidad: n(r.utilidad),
    })),
    mas_lentos: masLentos.map((r) => ({
      ...r,
      dias: r.dias != null ? Math.round(n(r.dias)) : null,
      vendidos: n(r.vendidos),
      utilidad: n(r.utilidad),
    })),
    por_canal: porCanal,
    por_pago: porPago,
    ticket_promedio: n(ticket?.ticket_promedio),
    utilidad_promedio: n(ticket?.utilidad_promedio),
    num_ventas: n(ticket?.num_ventas),
  };
}

export async function productosRentables() {
  const [mejores, peores] = await Promise.all([
    getAll(`
      SELECT
        producto_nombre,
        SUM(cantidad) AS vendidos,
        SUM(precio_venta * cantidad) AS ingresos,
        SUM(costo_unitario * cantidad) AS costo,
        SUM(utilidad) AS utilidad,
        CASE WHEN SUM(precio_venta * cantidad) > 0
          THEN (SUM(utilidad) / SUM(precio_venta * cantidad)) * 100 ELSE 0 END AS margen
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'cancelado'
      GROUP BY producto_nombre
      ORDER BY utilidad DESC
      LIMIT 10
    `),
    getAll(`
      SELECT
        producto_nombre,
        SUM(cantidad) AS vendidos,
        SUM(precio_venta * cantidad) AS ingresos,
        SUM(costo_unitario * cantidad) AS costo,
        SUM(utilidad) AS utilidad,
        CASE WHEN SUM(precio_venta * cantidad) > 0
          THEN (SUM(utilidad) / SUM(precio_venta * cantidad)) * 100 ELSE 0 END AS margen
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'cancelado'
      GROUP BY producto_nombre
      ORDER BY utilidad ASC
      LIMIT 10
    `),
  ]);
  return { mejores, peores };
}

export async function stockCritico() {
  return getAll(`
    SELECT
      i.id,
      i.nombre,
      i.cantidad,
      i.costo_unitario,
      i.precio_sugerido,
      i.fecha_ingreso,
      i.proveedor_nombre,
      (CURRENT_DATE - i.fecha_ingreso::date) AS dias_en_stock,
      COALESCE(SUM(vi.cantidad), 0) AS veces_vendido
    FROM inventario i
    LEFT JOIN venta_items vi ON vi.inventario_id = i.id
    WHERE i.estado IN ('disponible', 'reservado') AND i.cantidad > 0
    GROUP BY i.id
    ORDER BY dias_en_stock DESC, veces_vendido ASC
    LIMIT 15
  `);
}

export async function analiticaClientes() {
  const rows = await getAll(`
    WITH base AS (
      SELECT
        COALESCE(v.cliente_id, 0) AS cliente_id,
        COALESCE(NULLIF(TRIM(v.cliente_nombre), ''), 'Cliente sin nombre') AS cliente_nombre,
        COUNT(DISTINCT v.id) AS num_compras,
        COALESCE(SUM(v.total_venta), 0) AS total_comprado,
        COALESCE(SUM(v.total_costo), 0) AS total_costo,
        COALESCE(SUM(v.utilidad_bruta), 0) AS utilidad_total,
        COALESCE(AVG(v.total_venta), 0) AS ticket_promedio,
        MIN(v.fecha) AS primera_compra,
        MAX(v.fecha) AS ultima_compra
      FROM ventas v
      WHERE v.estado != 'cancelado'
      GROUP BY 1, 2
    ),
    items AS (
      SELECT
        COALESCE(v.cliente_id, 0) AS cliente_id,
        COALESCE(NULLIF(TRIM(v.cliente_nombre), ''), 'Cliente sin nombre') AS cliente_nombre,
        COALESCE(SUM(vi.cantidad), 0) AS unidades,
        COALESCE(SUM(vi.precio_venta * vi.cantidad), 0) AS ingresos_productos,
        COALESCE(SUM(vi.utilidad), 0) AS utilidad_items,
        COUNT(vi.id) AS lineas
      FROM ventas v
      JOIN venta_items vi ON vi.venta_id = v.id
      WHERE v.estado != 'cancelado'
      GROUP BY 1, 2
    )
    SELECT
      b.cliente_id,
      b.cliente_nombre,
      b.num_compras,
      b.total_comprado,
      b.total_costo,
      b.utilidad_total,
      b.ticket_promedio,
      b.primera_compra,
      b.ultima_compra,
      COALESCE(i.unidades, 0) AS unidades,
      COALESCE(i.lineas, 0) AS lineas,
      CASE
        WHEN b.total_comprado > 0 THEN (b.utilidad_total / b.total_comprado) * 100
        ELSE 0
      END AS margen_promedio,
      CASE
        WHEN COALESCE(i.unidades, 0) > 0 THEN COALESCE(i.ingresos_productos, 0) / i.unidades
        ELSE 0
      END AS precio_promedio_unidad,
      CASE
        WHEN b.num_compras > 0 THEN COALESCE(i.unidades, 0) / b.num_compras
        ELSE 0
      END AS unidades_por_compra
    FROM base b
    LEFT JOIN items i
      ON i.cliente_id = b.cliente_id AND i.cliente_nombre = b.cliente_nombre
    ORDER BY b.total_comprado DESC
  `);

  const normalizados = rows.map((r) => {
    const utilidad = n(r.utilidad_total);
    const total = n(r.total_comprado);
    const margen = n(r.margen_promedio);
    const unidades = n(r.unidades);
    const precioUnit = n(r.precio_promedio_unidad);
    return {
      ...r,
      cliente_id: n(r.cliente_id),
      num_compras: n(r.num_compras),
      total_comprado: total,
      total_costo: n(r.total_costo),
      utilidad_total: utilidad,
      margen_promedio: margen,
      ticket_promedio: n(r.ticket_promedio),
      unidades,
      lineas: n(r.lineas),
      precio_promedio_unidad: precioUnit,
      unidades_por_compra: n(r.unidades_por_compra),
      es_perdida: utilidad < 0,
      alerta:
        utilidad < 0
          ? 'Genera pérdida'
          : margen < 10 && total > 0
            ? 'Margen muy bajo'
            : precioUnit > 0 && precioUnit < 25 && unidades >= 3
              ? 'Compra barato'
              : null,
    };
  });

  const topCompran = [...normalizados].sort((a, b) => b.total_comprado - a.total_comprado).slice(0, 12);
  const topUtilidad = [...normalizados].sort((a, b) => b.utilidad_total - a.utilidad_total).slice(0, 12);
  const mejorMargen = [...normalizados]
    .filter((c) => c.num_compras >= 2 && c.total_comprado > 0)
    .sort((a, b) => b.margen_promedio - a.margen_promedio)
    .slice(0, 12);

  const peoresUtilidad = [...normalizados]
    .sort((a, b) => a.utilidad_total - b.utilidad_total)
    .slice(0, 12);

  const peoresMargen = [...normalizados]
    .filter((c) => c.num_compras >= 1 && c.total_comprado > 0)
    .sort((a, b) => a.margen_promedio - b.margen_promedio)
    .slice(0, 12);

  const compranBarato = [...normalizados]
    .filter((c) => c.unidades >= 2)
    .sort((a, b) => a.precio_promedio_unidad - b.precio_promedio_unidad)
    .slice(0, 12);

  const topUnidades = [...normalizados]
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 12);

  const activos = normalizados.length;
  const compradoresRecurrentes = normalizados.filter((c) => c.num_compras >= 2).length;
  const conPerdida = normalizados.filter((c) => c.utilidad_total < 0).length;
  const totalVentasClientes = normalizados.reduce((acc, c) => acc + c.total_comprado, 0);
  const totalUtilidadClientes = normalizados.reduce((acc, c) => acc + c.utilidad_total, 0);
  const numComprasTotal = normalizados.reduce((acc, c) => acc + c.num_compras, 0);
  const totalUnidades = normalizados.reduce((acc, c) => acc + c.unidades, 0);
  const clienteMasUnidades = topUnidades[0] || null;
  const clientePeorUtilidad = peoresUtilidad[0] || null;

  return {
    clientes_top_compras: topCompran,
    clientes_top_utilidad: topUtilidad,
    clientes_mejor_margen: mejorMargen,
    clientes_peores_utilidad: peoresUtilidad,
    clientes_peores_margen: peoresMargen,
    clientes_compran_barato: compranBarato,
    clientes_top_unidades: topUnidades,
    resumen: {
      activos,
      compradores_recurrentes: compradoresRecurrentes,
      con_perdida: conPerdida,
      recurrencia_pct: activos > 0 ? (compradoresRecurrentes / activos) * 100 : 0,
      ticket_promedio: numComprasTotal > 0 ? totalVentasClientes / numComprasTotal : 0,
      margen_global: totalVentasClientes > 0 ? (totalUtilidadClientes / totalVentasClientes) * 100 : 0,
      unidades_totales: totalUnidades,
      unidades_promedio_cliente: activos > 0 ? totalUnidades / activos : 0,
      cliente_mas_unidades: clienteMasUnidades
        ? { nombre: clienteMasUnidades.cliente_nombre, unidades: clienteMasUnidades.unidades }
        : null,
      cliente_peor: clientePeorUtilidad
        ? {
            nombre: clientePeorUtilidad.cliente_nombre,
            utilidad: clientePeorUtilidad.utilidad_total,
          }
        : null,
    },
  };
}

export async function obtenerDashboardDecisiones() {
  const fechaHoy = hoy();
  const desdeMes = inicioMes();
  const hastaMes = finMes();

  const [
    ventasHoy,
    ventasMes,
    gastosMes,
    dineroCaja,
    valorInventario,
    autosVendidos,
    topProductos,
    bajaRotacion,
    cajas,
    proveedores,
    velocidad,
    rentables,
    stockCriticoRows,
    ventasPorDia,
    gastosPorCat,
    efectivo,
    clientesAnalitica,
  ] = await Promise.all([
    ventasService.ventasDelPeriodo(fechaHoy, fechaHoy),
    ventasService.ventasDelPeriodo(desdeMes, hastaMes),
    gastosService.gastosDelPeriodo(desdeMes, hastaMes),
    cajaService.saldoActual(),
    inventarioService.valorTotalInventario(),
    ventasService.autosVendidos(desdeMes, hastaMes),
    ventasService.topProductos(8, desdeMes, hastaMes),
    inventarioService.productosBajaRotacion(8),
    rentabilidadPorCaja(),
    rentabilidadPorProveedor(),
    velocidadVentas(),
    productosRentables(),
    stockCritico(),
    ventasService.ventasPorDia(haceDias(29), fechaHoy),
    gastosService.gastosPorCategoria(desdeMes, hastaMes),
    cajaService.resumenEfectivo(),
    analiticaClientes(),
  ]);

  const utilidadNetaMes = n(ventasMes?.utilidad_bruta) - n(gastosMes?.total);
  const margenMes = calcularMargen(n(ventasMes?.utilidad_bruta), n(ventasMes?.total));

  const mejoresCajas = [...cajas].sort((a, b) => b.utilidad - a.utilidad).slice(0, 8);
  const peoresCajas = [...cajas].filter((c) => c.autos_totales > 0).sort((a, b) => a.utilidad - b.utilidad).slice(0, 5);

  const capitalInventario = valorInventario;
  const utilidadTotalHist = await getOne(`
    SELECT COALESCE(SUM(utilidad_bruta),0) AS u FROM ventas WHERE estado != 'cancelado'
  `);

  return {
    // KPIs principales
    ventas_hoy: n(ventasHoy?.total),
    ventas_mes: n(ventasMes?.total),
    utilidad_bruta_mes: n(ventasMes?.utilidad_bruta),
    utilidad_neta_mes: utilidadNetaMes,
    dinero_caja: dineroCaja,
    valor_inventario: capitalInventario,
    efectivo,
    autos_vendidos_mes: autosVendidos,
    margen_promedio: margenMes,
    gastos_mes: n(gastosMes?.total),
    ticket_promedio: velocidad.ticket_promedio,
    utilidad_promedio_venta: velocidad.utilidad_promedio,
    dias_promedio_venta: velocidad.dias_promedio,
    utilidad_historica: n(utilidadTotalHist?.u),

    // Decisiones
    top_productos: topProductos,
    baja_rotacion: bajaRotacion,
    cajas: mejoresCajas,
    cajas_todas: cajas,
    peores_cajas: peoresCajas,
    proveedores,
    velocidad,
    productos_mejores: rentables.mejores,
    productos_peores: rentables.peores,
    stock_critico: stockCriticoRows,
    clientes: clientesAnalitica,
    lives_rentables: [],
    graficos: {
      ventas_por_dia: ventasPorDia.map((r) => ({
        fecha: r.fecha,
        ventas: n(r.ventas),
        utilidad: n(r.utilidad),
        cantidad: n(r.cantidad),
      })),
      gastos_por_categoria: gastosPorCat.map((r) => ({
        categoria: r.categoria,
        total: n(r.total),
      })),
      top_productos: topProductos.map((r) => ({
        nombre: r.producto_nombre,
        vendidos: n(r.total_vendido),
        ingresos: n(r.ingresos),
        utilidad: n(r.utilidad),
      })),
      por_canal: (velocidad.por_canal || []).map((r) => ({
        canal: r.canal || 'Sin canal',
        total: n(r.total),
        utilidad: n(r.utilidad),
        ventas: n(r.ventas),
      })),
      por_pago: (velocidad.por_pago || []).map((r) => ({
        metodo: r.metodo_pago || 'Sin método',
        total: n(r.total),
        utilidad: n(r.utilidad),
        ventas: n(r.ventas),
      })),
      proveedores: proveedores.slice(0, 8).map((p) => ({
        proveedor: p.proveedor,
        utilidad: n(p.utilidad),
        ingresos: n(p.ingresos),
        comprado: n(p.total_comprado),
      })),
    },

    resumen_decisiones: {
      proveedores_seguir: proveedores.filter((p) => p.recomendacion?.nivel === 'excelente' || p.recomendacion?.nivel === 'bueno').length,
      proveedores_revisar: proveedores.filter((p) => p.recomendacion?.nivel === 'malo' || p.recomendacion?.nivel === 'regular').length,
      cajas_recuperadas: cajas.filter((c) => c.recuperado).length,
      cajas_en_proceso: cajas.filter((c) => !c.recuperado && n(c.autos_totales) > 0).length,
    },
  };
}

// Mantener API anterior
export async function obtenerDashboard() {
  return obtenerDashboardDecisiones();
}

export async function obtenerReporte(desde, hasta) {
  const [ventas, gastos, gastosCat, valorInventario, topProductos, proveedores] = await Promise.all([
    ventasService.ventasDelPeriodo(desde, hasta),
    gastosService.gastosDelPeriodo(desde, hasta),
    gastosService.gastosPorCategoria(desde, hasta),
    inventarioService.valorTotalInventario(),
    ventasService.topProductos(10, desde, hasta),
    rentabilidadPorProveedor(),
  ]);

  return {
    periodo: { desde, hasta },
    ventas: n(ventas?.total),
    utilidad_bruta: n(ventas?.utilidad_bruta),
    utilidad_neta: n(ventas?.utilidad_bruta) - n(gastos?.total),
    gastos: n(gastos?.total),
    gastos_por_categoria: gastosCat,
    valor_inventario: valorInventario,
    top_productos: topProductos,
    proveedores,
    productos_menos_rentables: [],
    clientes_principales: [],
  };
}

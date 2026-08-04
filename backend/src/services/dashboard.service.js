import { getAll, getOne } from '../db/database.js';
import * as ventasService from './ventas.service.js';
import * as gastosService from './gastos.service.js';
import * as inventarioService from './inventario.service.js';
import * as cajaService from './caja.service.js';
import * as livesService from './lives.service.js';
import { hoy, calcularMargen, haceDias, periodoDesdeMes, mesAnterior, ultimosMeses } from '../utils/calculos.js';
import { SQL_CATEGORIA_VENTA } from '../utils/ventasClasificacion.js';

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

export async function roiYPredicciones(desdeMes, hastaMes, esMesActual = false) {
  const fechaHoy = hoy();
  const diaRef = esMesActual ? Number(fechaHoy.slice(8, 10)) : Number(hastaMes.slice(8, 10));
  const diasMes = Number(hastaMes.slice(8, 10));
  const diasRestantes = esMesActual ? Math.max(0, diasMes - diaRef) : 0;
  const diasTranscurridos = Math.max(1, esMesActual ? diaRef : diasMes);

  const [
    gastosMes,
    comprasMes,
    reinversionesMes,
    valorInventario,
    porMesRaw,
    ventas30,
    metricas,
  ] = await Promise.all([
    getOne(`
      SELECT COALESCE(SUM(monto),0) AS total FROM gastos
      WHERE fecha >= $1 AND fecha <= $2
    `, [desdeMes, hastaMes]),
    getOne(`
      SELECT COALESCE(SUM(costo_total),0) AS total FROM compras
      WHERE fecha >= $1 AND fecha <= $2
    `, [desdeMes, hastaMes]),
    getOne(`
      SELECT COALESCE(SUM(monto),0) AS total FROM caja_movimientos
      WHERE tipo = 'salida_compra' AND fecha >= $1 AND fecha <= $2
    `, [desdeMes, hastaMes]),
    inventarioService.valorTotalInventario(),
    ventasService.ventasPorMesResumen(6),
    esMesActual
      ? getAll(`
          SELECT fecha::text AS fecha,
                 COALESCE(SUM(vi.precio_venta * vi.cantidad),0) AS ventas,
                 COALESCE(SUM(vi.utilidad),0) AS utilidad,
                 COUNT(DISTINCT v.id) AS cantidad
          FROM ventas v
          JOIN venta_items vi ON vi.venta_id = v.id
          LEFT JOIN inventario i ON i.id = vi.inventario_id
          WHERE v.estado != 'cancelado' AND v.fecha >= $1 AND v.fecha <= $2
            AND NOT (
              vi.inventario_id IS NULL
              OR (COALESCE(vi.costo_unitario, 0) <= 0 AND COALESCE(i.costo_unitario, 0) <= 0)
            )
          GROUP BY fecha
          ORDER BY fecha
        `, [haceDias(29), fechaHoy])
      : Promise.resolve([]),
    ventasService.metricasPorCategoria(desdeMes, hastaMes),
  ]);

  const gastosPorMes = await getAll(`
    SELECT TO_CHAR(fecha, 'YYYY-MM') AS periodo, COALESCE(SUM(monto),0) AS gastos
    FROM gastos
    WHERE fecha >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months')
    GROUP BY 1
  `);
  const comprasPorMes = await getAll(`
    SELECT TO_CHAR(fecha, 'YYYY-MM') AS periodo, COALESCE(SUM(costo_total),0) AS comprado
    FROM compras
    WHERE fecha >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months')
    GROUP BY 1
  `);
  const gastosMap = Object.fromEntries(gastosPorMes.map((r) => [r.periodo, n(r.gastos)]));
  const comprasMap = Object.fromEntries(comprasPorMes.map((r) => [r.periodo, n(r.comprado)]));

  const ventasInventario = metricas.inventario;
  const ventasManual = metricas.manual;
  const utilidadBrutaReal = ventasInventario.utilidad;
  const utilidadNetaMes = utilidadBrutaReal - n(gastosMes?.total);
  const capitalInvertidoMes = Math.max(n(comprasMes?.total), n(reinversionesMes?.total), 0);
  const capitalTrabajo = capitalInvertidoMes > 0
    ? capitalInvertidoMes
    : Math.max(n(valorInventario), ventasInventario.costo, 1);

  const roiSobreInversion = capitalTrabajo > 0 ? (utilidadNetaMes / capitalTrabajo) * 100 : 0;
  const roiSobreInventario = n(valorInventario) > 0 ? (utilidadNetaMes / n(valorInventario)) * 100 : 0;
  const roiSobreVentas = ventasInventario.ingresos > 0 ? (utilidadNetaMes / ventasInventario.ingresos) * 100 : 0;

  const porPeriodo = {};
  for (const r of porMesRaw) {
    if (!porPeriodo[r.periodo]) {
      porPeriodo[r.periodo] = {
        periodo: r.periodo,
        ventas_inventario: 0,
        utilidad_inventario: 0,
        ventas_manual: 0,
        utilidad_manual: 0,
        autos: 0,
        otros_items: 0,
      };
    }
    const p = porPeriodo[r.periodo];
    if (r.categoria === 'manual') {
      p.ventas_manual += n(r.ingresos);
      p.utilidad_manual += n(r.utilidad);
    } else {
      p.ventas_inventario += n(r.ingresos);
      p.utilidad_inventario += n(r.utilidad);
      if (r.categoria === 'auto_caja') p.autos += n(r.unidades);
      else p.otros_items += n(r.unidades);
    }
  }

  const historicoRoi = Object.values(porPeriodo)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((m) => {
      const utilidadNeta = m.utilidad_inventario - (gastosMap[m.periodo] || 0);
      const capital = Math.max(comprasMap[m.periodo] || 0, 1);
      return {
        periodo: m.periodo,
        ventas: m.ventas_inventario,
        ventas_manual: m.ventas_manual,
        utilidad_bruta: m.utilidad_inventario,
        utilidad_neta: utilidadNeta,
        capital_invertido: comprasMap[m.periodo] || 0,
        autos: m.autos,
        otros_items: m.otros_items,
        roi: (utilidadNeta / capital) * 100,
      };
    });

  const diasVentana = 30;
  const sumVentas = ventas30.reduce((a, r) => a + n(r.ventas), 0);
  const sumUtilidad = ventas30.reduce((a, r) => a + n(r.utilidad), 0);
  const sumTickets = ventas30.reduce((a, r) => a + n(r.cantidad), 0);
  const promedioDiarioVentas = esMesActual ? sumVentas / diasVentana : ventasInventario.ingresos / diasTranscurridos;
  const promedioDiarioUtilidad = esMesActual ? sumUtilidad / diasVentana : utilidadBrutaReal / diasTranscurridos;
  const promedioDiarioTickets = esMesActual ? sumTickets / diasVentana : 0;

  const recientes = ventas30.slice(-14);
  const anteriores = ventas30.slice(0, Math.max(0, ventas30.length - 14));
  const avgRec = recientes.length
    ? recientes.reduce((a, r) => a + n(r.ventas), 0) / recientes.length
    : promedioDiarioVentas;
  const avgAnt = anteriores.length
    ? anteriores.reduce((a, r) => a + n(r.ventas), 0) / anteriores.length
    : promedioDiarioVentas;
  const tendenciaPct = avgAnt > 0 ? ((avgRec - avgAnt) / avgAnt) * 100 : 0;
  const factorTendencia = 1 + Math.max(-0.35, Math.min(0.35, tendenciaPct / 100));

  const autosMes = metricas.auto_caja.unidades;
  const proyeccionMesVentas = ventasInventario.ingresos + promedioDiarioVentas * factorTendencia * diasRestantes;
  const proyeccionMesUtilidad = utilidadNetaMes + promedioDiarioUtilidad * factorTendencia * diasRestantes;
  const proyeccionMesAutos = autosMes + (autosMes / diasTranscurridos) * factorTendencia * diasRestantes;

  let interpretacion = 'Estable';
  if (tendenciaPct >= 15) interpretacion = 'Al alza';
  else if (tendenciaPct <= -15) interpretacion = 'A la baja';

  return {
    roi: {
      mes_actual: {
        utilidad_neta: utilidadNetaMes,
        utilidad_bruta_inventario: utilidadBrutaReal,
        ventas_inventario: ventasInventario.ingresos,
        ventas_manuales: ventasManual.ingresos,
        unidades_manuales: ventasManual.unidades,
        autos_de_caja: autosMes,
        otros_items: metricas.otro_item.unidades,
        capital_invertido: capitalInvertidoMes,
        capital_usado: capitalTrabajo,
        valor_inventario: n(valorInventario),
        roi_sobre_inversion: roiSobreInversion,
        roi_sobre_inventario: roiSobreInventario,
        roi_sobre_ventas: roiSobreVentas,
        reinversiones: n(reinversionesMes?.total),
        compras_del_mes: n(comprasMes?.total),
        gastos_mes: n(gastosMes?.total),
        formula: 'ROI = Utilidad neta (solo inventario con costo) / Capital invertido del mes. Ventas manuales sin inversión no entran.',
      },
      historico: historicoRoi,
    },
    predicciones: esMesActual ? {
      dias_restantes_mes: diasRestantes,
      dias_transcurridos: diasTranscurridos,
      tendencia_pct: tendenciaPct,
      interpretacion,
      promedio_diario_ventas: promedioDiarioVentas,
      promedio_diario_utilidad: promedioDiarioUtilidad,
      proyeccion_cierre_mes: {
        ventas: proyeccionMesVentas,
        utilidad_neta: proyeccionMesUtilidad,
        autos: proyeccionMesAutos,
      },
      proximos_7_dias: {
        ventas: promedioDiarioVentas * factorTendencia * 7,
        utilidad: promedioDiarioUtilidad * factorTendencia * 7,
        tickets: promedioDiarioTickets * factorTendencia * 7,
      },
      nota: 'Basado en ventas con inventario (sin manuales). Promedio 30 días ajustado por tendencia.',
    } : {
      dias_restantes_mes: 0,
      dias_transcurridos: diasTranscurridos,
      tendencia_pct: null,
      interpretacion: 'Mes cerrado',
      promedio_diario_ventas: ventasInventario.ingresos / diasTranscurridos,
      promedio_diario_utilidad: utilidadBrutaReal / diasTranscurridos,
      proyeccion_cierre_mes: {
        ventas: ventasInventario.ingresos,
        utilidad_neta: utilidadNetaMes,
        autos: autosMes,
      },
      proximos_7_dias: null,
      nota: 'Mes histórico seleccionado: se muestran totales reales, sin proyección.',
    },
  };
}

export async function analiticaClientes(desde, hasta) {
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
        AND v.fecha >= $1 AND v.fecha <= $2
      GROUP BY 1, 2
    ),
    items AS (
      SELECT
        COALESCE(v.cliente_id, 0) AS cliente_id,
        COALESCE(NULLIF(TRIM(v.cliente_nombre), ''), 'Cliente sin nombre') AS cliente_nombre,
        COALESCE(SUM(vi.cantidad), 0) AS unidades,
        COALESCE(SUM(vi.precio_venta * vi.cantidad), 0) AS ingresos_productos,
        COALESCE(SUM(vi.utilidad), 0) AS utilidad_items,
        COUNT(vi.id) AS lineas,
        COALESCE(SUM(vi.cantidad) FILTER (WHERE ${SQL_CATEGORIA_VENTA.replace(/\n/g, ' ')} = 'auto_caja'), 0) AS autos_caja,
        COALESCE(SUM(vi.cantidad) FILTER (WHERE ${SQL_CATEGORIA_VENTA.replace(/\n/g, ' ')} = 'otro_item'), 0) AS otros_items,
        COALESCE(SUM(vi.cantidad) FILTER (WHERE ${SQL_CATEGORIA_VENTA.replace(/\n/g, ' ')} = 'manual'), 0) AS manual_unidades,
        COALESCE(SUM(vi.precio_venta * vi.cantidad) FILTER (WHERE ${SQL_CATEGORIA_VENTA.replace(/\n/g, ' ')} = 'auto_caja'), 0) AS ingresos_autos,
        COALESCE(SUM(vi.precio_venta * vi.cantidad) FILTER (WHERE ${SQL_CATEGORIA_VENTA.replace(/\n/g, ' ')} = 'otro_item'), 0) AS ingresos_otros,
        COALESCE(SUM(vi.precio_venta * vi.cantidad) FILTER (WHERE ${SQL_CATEGORIA_VENTA.replace(/\n/g, ' ')} = 'manual'), 0) AS ingresos_manual,
        COALESCE(SUM(vi.utilidad) FILTER (WHERE ${SQL_CATEGORIA_VENTA.replace(/\n/g, ' ')} != 'manual'), 0) AS utilidad_inventario
      FROM ventas v
      JOIN venta_items vi ON vi.venta_id = v.id
      LEFT JOIN inventario i ON i.id = vi.inventario_id
      WHERE v.estado != 'cancelado'
        AND v.fecha >= $1 AND v.fecha <= $2
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
      COALESCE(i.autos_caja, 0) AS autos_caja,
      COALESCE(i.otros_items, 0) AS otros_items,
      COALESCE(i.manual_unidades, 0) AS manual_unidades,
      COALESCE(i.ingresos_autos, 0) AS ingresos_autos,
      COALESCE(i.ingresos_otros, 0) AS ingresos_otros,
      COALESCE(i.ingresos_manual, 0) AS ingresos_manual,
      COALESCE(i.utilidad_inventario, 0) AS utilidad_inventario,
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
  `, [desde, hasta]);

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
      autos_caja: n(r.autos_caja),
      otros_items: n(r.otros_items),
      manual_unidades: n(r.manual_unidades),
      ingresos_autos: n(r.ingresos_autos),
      ingresos_otros: n(r.ingresos_otros),
      ingresos_manual: n(r.ingresos_manual),
      utilidad_inventario: n(r.utilidad_inventario),
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
  const totalAutosCaja = normalizados.reduce((acc, c) => acc + c.autos_caja, 0);
  const totalOtrosItems = normalizados.reduce((acc, c) => acc + c.otros_items, 0);
  const totalManual = normalizados.reduce((acc, c) => acc + c.manual_unidades, 0);
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
      autos_caja_totales: totalAutosCaja,
      otros_items_totales: totalOtrosItems,
      manual_totales: totalManual,
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

export async function obtenerDashboardDecisiones(opts = {}) {
  const mesActual = periodoDesdeMes().mes;
  const periodo = periodoDesdeMes(opts.mes || mesActual);
  const periodoPrev = periodoDesdeMes(mesAnterior(periodo.mes));
  const esMesActual = periodo.mes === mesActual;
  const fechaHoy = hoy();
  const { desde: desdeMes, hasta: hastaMes } = periodo;
  const { desde: desdePrev, hasta: hastaPrev } = periodoPrev;

  const [
    ventasHoy,
    metricasMes,
    metricasPrev,
    gastosMes,
    gastosPrev,
    dineroCaja,
    valorInventario,
    topProductos,
    bajaRotacion,
    cajas,
    proveedores,
    velocidad,
    rentables,
    stockCriticoRows,
    ventasPorDia,
    ventasPorDiaPrev,
    gastosPorCat,
    efectivo,
    clientesAnalitica,
    roiPred,
    livesResumen,
    comparativoRaw,
    cajasCerradasMes,
  ] = await Promise.all([
    ventasService.ventasDelPeriodo(fechaHoy, fechaHoy),
    ventasService.metricasPorCategoria(desdeMes, hastaMes),
    ventasService.metricasPorCategoria(desdePrev, hastaPrev),
    gastosService.gastosDelPeriodo(desdeMes, hastaMes),
    gastosService.gastosDelPeriodo(desdePrev, hastaPrev),
    cajaService.saldoActual(),
    inventarioService.valorTotalInventario(),
    ventasService.topProductos(8, desdeMes, hastaMes),
    inventarioService.productosBajaRotacion(8),
    rentabilidadPorCaja(),
    rentabilidadPorProveedor(),
    velocidadVentas(),
    productosRentables(),
    stockCritico(),
    getAll(`
      SELECT v.fecha::text AS fecha,
             COALESCE(SUM(vi.precio_venta * vi.cantidad),0) AS ventas,
             COALESCE(SUM(vi.utilidad),0) AS utilidad,
             COALESCE(SUM(vi.cantidad),0) AS cantidad
      FROM ventas v
      JOIN venta_items vi ON vi.venta_id = v.id
      LEFT JOIN inventario i ON i.id = vi.inventario_id
      WHERE v.estado != 'cancelado'
        AND v.fecha >= $1 AND v.fecha <= $2
        AND NOT (
          vi.inventario_id IS NULL
          OR (COALESCE(vi.costo_unitario, 0) <= 0 AND COALESCE(i.costo_unitario, 0) <= 0)
        )
      GROUP BY v.fecha
      ORDER BY v.fecha
    `, [desdeMes, hastaMes]),
    getAll(`
      SELECT v.fecha::text AS fecha,
             COALESCE(SUM(vi.precio_venta * vi.cantidad),0) AS ventas,
             COALESCE(SUM(vi.utilidad),0) AS utilidad,
             COALESCE(SUM(vi.cantidad),0) AS cantidad
      FROM ventas v
      JOIN venta_items vi ON vi.venta_id = v.id
      LEFT JOIN inventario i ON i.id = vi.inventario_id
      WHERE v.estado != 'cancelado'
        AND v.fecha >= $1 AND v.fecha <= $2
        AND NOT (
          vi.inventario_id IS NULL
          OR (COALESCE(vi.costo_unitario, 0) <= 0 AND COALESCE(i.costo_unitario, 0) <= 0)
        )
      GROUP BY v.fecha
      ORDER BY v.fecha
    `, [desdePrev, hastaPrev]),
    gastosService.gastosPorCategoria(desdeMes, hastaMes),
    cajaService.resumenEfectivo(),
    analiticaClientes(desdeMes, hastaMes),
    roiYPredicciones(desdeMes, hastaMes, esMesActual),
    livesService.resumenLives(),
    ventasService.ventasPorMesResumen(6),
    ventasService.cajasCerradasVendidas(desdeMes, hastaMes),
  ]);

  const inv = metricasMes.inventario;
  const manual = metricasMes.manual;
  const invPrev = metricasPrev.inventario;
  const manualPrev = metricasPrev.manual;

  const utilidadNetaMes = inv.utilidad - n(gastosMes?.total);
  const utilidadNetaPrev = invPrev.utilidad - n(gastosPrev?.total);
  const margenMes = calcularMargen(inv.utilidad, inv.ingresos);

  const variacion = (actual, anterior) => {
    if (!anterior) return actual ? 100 : 0;
    return ((actual - anterior) / anterior) * 100;
  };

  const comparativoMesesMap = {};
  for (const r of comparativoRaw) {
    if (!comparativoMesesMap[r.periodo]) {
      comparativoMesesMap[r.periodo] = {
        periodo: r.periodo,
        label: periodoDesdeMes(r.periodo).label,
        ventas_inventario: 0,
        utilidad_inventario: 0,
        ventas_manual: 0,
        autos: 0,
        otros_items: 0,
      };
    }
    const p = comparativoMesesMap[r.periodo];
    if (r.categoria === 'manual') {
      p.ventas_manual += n(r.ingresos);
    } else {
      p.ventas_inventario += n(r.ingresos);
      p.utilidad_inventario += n(r.utilidad);
      if (r.categoria === 'auto_caja') p.autos += n(r.unidades);
      else p.otros_items += n(r.unidades);
    }
  }
  const comparativo_meses = Object.values(comparativoMesesMap).sort((a, b) => a.periodo.localeCompare(b.periodo));

  const mejoresCajas = [...cajas].sort((a, b) => b.utilidad - a.utilidad).slice(0, 8);
  const peoresCajas = [...cajas].filter((c) => c.autos_totales > 0).sort((a, b) => a.utilidad - b.utilidad).slice(0, 5);

  const capitalInventario = valorInventario;
  const utilidadTotalHist = await getOne(`
    SELECT COALESCE(SUM(vi.utilidad),0) AS u
    FROM venta_items vi
    JOIN ventas v ON v.id = vi.venta_id
    LEFT JOIN inventario i ON i.id = vi.inventario_id
    WHERE v.estado != 'cancelado'
      AND NOT (
        vi.inventario_id IS NULL
        OR (COALESCE(vi.costo_unitario, 0) <= 0 AND COALESCE(i.costo_unitario, 0) <= 0)
      )
  `);

  return {
    periodo: {
      mes: periodo.mes,
      label: periodo.label,
      desde: desdeMes,
      hasta: hastaMes,
      es_mes_actual: esMesActual,
      mes_anterior: periodoPrev.mes,
      mes_anterior_label: periodoPrev.label,
      opciones: ultimosMeses(12).map((m) => ({ mes: m.mes, label: m.label })),
    },
    comparacion: {
      mes_anterior: {
        ventas_inventario: invPrev.ingresos,
        utilidad_inventario: invPrev.utilidad,
        utilidad_neta: utilidadNetaPrev,
        autos: metricasPrev.auto_caja.unidades,
        otros_items: metricasPrev.otro_item.unidades,
        manual_ingresos: manualPrev.ingresos,
      },
      variacion: {
        ventas_pct: variacion(inv.ingresos, invPrev.ingresos),
        utilidad_pct: variacion(inv.utilidad, invPrev.utilidad),
        utilidad_neta_pct: variacion(utilidadNetaMes, utilidadNetaPrev),
        autos_pct: variacion(metricasMes.auto_caja.unidades, metricasPrev.auto_caja.unidades),
        otros_pct: variacion(metricasMes.otro_item.unidades, metricasPrev.otro_item.unidades),
      },
    },

    // KPIs principales (datos reales con inventario)
    ventas_hoy: n(ventasHoy?.total),
    ventas_mes: inv.ingresos,
    ventas_mes_total: inv.ingresos + manual.ingresos,
    ventas_manuales_mes: manual.ingresos,
    utilidad_bruta_mes: inv.utilidad,
    utilidad_neta_mes: utilidadNetaMes,
    dinero_caja: dineroCaja,
    valor_inventario: capitalInventario,
    efectivo,
    autos_vendidos_mes: metricasMes.auto_caja.unidades,
    otros_items_vendidos_mes: metricasMes.otro_item.unidades,
    manual_unidades_mes: manual.unidades,
    cajas_cerradas_vendidas_mes: cajasCerradasMes,
    metricas_categoria: metricasMes,
    margen_promedio: margenMes,
    gastos_mes: n(gastosMes?.total),
    ticket_promedio: velocidad.ticket_promedio,
    utilidad_promedio_venta: velocidad.utilidad_promedio,
    dias_promedio_venta: velocidad.dias_promedio,
    utilidad_historica: n(utilidadTotalHist?.u),
    roi_mensual: roiPred.roi,
    predicciones: roiPred.predicciones,

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
    lives_rentables: livesResumen.top || [],
    lives_resumen: livesResumen.resumen || {},
    graficos: {
      ventas_por_dia: ventasPorDia.map((r) => ({
        fecha: r.fecha,
        ventas: n(r.ventas),
        utilidad: n(r.utilidad),
        cantidad: n(r.cantidad),
      })),
      ventas_por_dia_anterior: ventasPorDiaPrev.map((r) => ({
        fecha: r.fecha,
        ventas: n(r.ventas),
        utilidad: n(r.utilidad),
        cantidad: n(r.cantidad),
      })),
      comparativo_meses,
      mes_vs_anterior: {
        actual: {
          label: periodo.label,
          ventas: inv.ingresos,
          utilidad: inv.utilidad,
          autos: metricasMes.auto_caja.unidades,
          otros: metricasMes.otro_item.unidades,
        },
        anterior: {
          label: periodoPrev.label,
          ventas: invPrev.ingresos,
          utilidad: invPrev.utilidad,
          autos: metricasPrev.auto_caja.unidades,
          otros: metricasPrev.otro_item.unidades,
        },
      },
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

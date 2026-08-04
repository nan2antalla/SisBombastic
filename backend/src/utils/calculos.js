export function calcularCostoTotal(costoProducto, transporte, impuestos, otrosGastos) {
  return Number(costoProducto) + Number(transporte) + Number(impuestos) + Number(otrosGastos);
}

export function calcularCostoUnitario(costoTotal, cantidad) {
  const qty = Number(cantidad) || 1;
  return qty > 0 ? Number(costoTotal) / qty : 0;
}

export function calcularUtilidadBruta(precioVenta, costoUnitario, cantidad = 1) {
  return (Number(precioVenta) - Number(costoUnitario)) * Number(cantidad);
}

export function calcularMargen(utilidad, venta) {
  if (!venta || venta === 0) return 0;
  return (utilidad / venta) * 100;
}

export function hoy() {
  return new Date().toISOString().split('T')[0];
}

export function inicioMes(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

export function finMes(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = fecha.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function haceDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}

/** mes = 'YYYY-MM' → { desde, hasta, mes, label } */
export function periodoDesdeMes(mes) {
  const [y, m] = String(mes).split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    const h = new Date();
    return {
      mes: `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`,
      desde: inicioMes(h),
      hasta: finMes(h),
      label: h.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }),
    };
  }
  const fecha = new Date(y, m - 1, 1);
  const mesStr = `${y}-${String(m).padStart(2, '0')}`;
  return {
    mes: mesStr,
    desde: inicioMes(fecha),
    hasta: finMes(fecha),
    label: fecha.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }),
  };
}

export function mesAnterior(mes) {
  const [y, m] = String(mes).split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ultimosMeses(cantidad = 12) {
  const out = [];
  const h = new Date();
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      mes,
      label: d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' }),
      ...periodoDesdeMes(mes),
    });
  }
  return out;
}

export function generarCodigoInterno(prefix = 'BD') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

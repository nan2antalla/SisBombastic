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

export function generarCodigoInterno(prefix = 'BD') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

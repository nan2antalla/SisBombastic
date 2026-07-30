const API = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'bombastic_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    const msg =
      data?.error ||
      (res.status === 404
        ? 'La API no reconoce esta acción. Espera a que Render termine de desplegar o haz Manual Deploy del backend.'
        : res.status >= 500
          ? `Error del servidor (${res.status}). Reintenta en unos segundos.`
          : `Error en la solicitud (${res.status})`);
    throw new Error(msg);
  }
  return data;
}

export const api = {
  auth: {
    login: (usuario, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) }),
    me: () => request('/auth/me'),
  },

  dashboard: () => request('/dashboard'),
  reporte: (desde, hasta) => request(`/dashboard/reporte?desde=${desde}&hasta=${hasta}`),

  proveedores: {
    list: () => request('/proveedores'),
    create: (data) => request('/proveedores', { method: 'POST', body: JSON.stringify(data) }),
  },

  clientes: {
    list: () => request('/clientes'),
    create: (data) => request('/clientes', { method: 'POST', body: JSON.stringify(data) }),
  },

  lives: {
    list: (params = {}) => request(`/lives?${new URLSearchParams(params)}`),
    resumen: () => request('/lives/resumen'),
    get: (id) => request(`/lives/${id}`),
    create: (data) => request('/lives', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/lives/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    sincronizar: (id) => request(`/lives/${id}/sincronizar`, { method: 'POST' }),
    delete: (id) => request(`/lives/${id}`, { method: 'DELETE' }),
  },

  compras: {
    list: (params = {}) => request(`/compras?${new URLSearchParams(params)}`),
    get: (id) => request(`/compras/${id}`),
    create: (data) => request('/compras', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/compras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    recibir: (id) => request(`/compras/${id}/recibir`, { method: 'POST' }),
    delete: (id) => request(`/compras/${id}`, { method: 'DELETE' }),
  },

  inventario: {
    list: (params = {}) => request(`/inventario?${new URLSearchParams(params)}`),
    get: (id) => request(`/inventario/${id}`),
    create: (data) => request('/inventario', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/inventario/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/inventario/${id}`, { method: 'DELETE' }),
    abrirCaja: (id, payload) =>
      request(`/inventario/${id}/abrir-caja`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  ventas: {
    list: (params = {}) => request(`/ventas?${new URLSearchParams(params)}`),
    get: (id) => request(`/ventas/${id}`),
    create: (data) => request('/ventas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/ventas/${id}/actualizar`, { method: 'POST', body: JSON.stringify(data) }),
    cancelar: (id) => request(`/ventas/${id}/cancelar`, { method: 'POST' }),
    recalcularUtilidades: () => request('/ventas/recalcular-utilidades', { method: 'POST' }),
    updateItem: (itemId, data) => request(`/ventas/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  gastos: {
    list: (params = {}) => request(`/gastos?${new URLSearchParams(params)}`),
    create: (data) => request('/gastos', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/gastos/${id}`, { method: 'DELETE' }),
  },

  caja: {
    saldo: () => request('/caja/saldo'),
    efectivo: () => request('/caja/efectivo'),
    movimientos: (params = {}) => request(`/caja/movimientos?${new URLSearchParams(params)}`),
    resumen: (fecha) => request(`/caja/resumen/${fecha}`),
    cierres: () => request('/caja/cierres'),
    movimiento: (data) => request('/caja/movimientos', { method: 'POST', body: JSON.stringify(data) }),
    cerrar: (data) => request('/caja/cerrar', { method: 'POST', body: JSON.stringify(data) }),
  },

  backup: () => {
    const token = getToken();
    const url = `${API}/backup/backup${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    // Para download con auth usamos fetch + blob
    fetch(`${API}/backup/backup`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `bombastic-backup-${Date.now()}.json`;
        a.click();
      })
      .catch((e) => alert(e.message));
  },
  exportCsv: (tabla) => window.open(`${API}/backup/export/${tabla}`, '_blank'),
};

export function moneyTone(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return 'zero';
  return v > 0 ? 'pos' : 'neg';
}

export function moneyClass(n) {
  const t = moneyTone(n);
  if (t === 'pos') return 'money-pos';
  if (t === 'neg') return 'money-neg';
  return 'money-zero';
}

export function formatMoney(n, opts = {}) {
  const v = Number(n || 0);
  const formatted = new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(v);
  if (opts.signed && v > 0) return `+${formatted}`;
  return formatted;
}

export function formatPercent(n, opts = {}) {
  const v = Number(n || 0);
  const txt = `${v.toFixed(1)}%`;
  if (opts.signed && v > 0) return `+${txt}`;
  return txt;
}

export function formatDate(d) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function hoy() {
  return new Date().toISOString().split('T')[0];
}

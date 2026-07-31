import { useEffect, useState } from 'react';
import { api, formatMoney, formatDate, hoy } from '../api/client';
import { METODOS_PAGO, CANALES, ESTADOS_VENTA, labelOf, badgeClass } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import Money from '../components/Money';
import { usePagination } from '../hooks/usePagination';

const emptyItem = { inventario_id: '', producto_nombre: '', cantidad: 1, precio_venta: '', costo_unitario: '' };

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [lives, setLives] = useState([]);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [nuevoClienteModal, setNuevoClienteModal] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', whatsapp: '', ciudad: '' });
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [form, setForm] = useState({
    fecha: hoy(),
    cliente_id: '',
    cliente_nombre: '',
    metodo_pago: '',
    canal: '',
    delivery: '',
    estado: 'pagado',
    notas: '',
    live_id: '',
    items: [{ ...emptyItem }],
  });
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({
    estado: '',
    desde: '',
    hasta: '',
    busqueda: '',
  });

  const load = (params = {}) => api.ventas.list(params).then(setVentas).catch(console.error);
  const loadClientes = () => api.clientes.list().then(setClientes).catch(console.error);
  const loadLives = () => api.lives.list().then(setLives).catch(console.error);

  useEffect(() => {
    load();
    loadClientes();
    loadLives();
    api.inventario.list({ estado: 'disponible' }).then(setInventario).catch(console.error);
  }, []);

  const openNew = () => {
    setForm({
      fecha: hoy(),
      cliente_id: '',
      cliente_nombre: '',
      metodo_pago: '',
      canal: '',
      delivery: '',
      estado: 'pagado',
      notas: '',
      live_id: '',
      items: [{ ...emptyItem }],
    });
    setError('');
    setModal(true);
  };

  const selectProducto = (index, inventarioId) => {
    const item = inventario.find((i) => i.id === Number(inventarioId));
    const items = [...form.items];
    if (item) {
      items[index] = {
        inventario_id: item.id,
        producto_nombre: item.nombre,
        cantidad: 1,
        precio_venta: item.precio_sugerido || '',
        costo_unitario: item.costo_unitario,
      };
    } else {
      items[index] = { ...emptyItem, inventario_id: '' };
    }
    setForm({ ...form, items });
  };

  const quitarItem = (index) => {
    if (form.items.length <= 1) {
      setForm({ ...form, items: [{ ...emptyItem }] });
      return;
    }
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const opcionesInventario = (index) => {
    const usados = new Set(
      form.items
        .map((it, i) => (i !== index && it.inventario_id ? Number(it.inventario_id) : null))
        .filter(Boolean)
    );
    return inventario.filter((inv) => !usados.has(Number(inv.id)));
  };

  const calcUtilidad = (item) => {
    const pv = Number(item.precio_venta) || 0;
    const cu = Number(item.costo_unitario) || 0;
    const qty = Number(item.cantidad) || 1;
    return (pv - cu) * qty;
  };

  const totalVenta = form.items.reduce((s, i) => s + (Number(i.precio_venta) || 0) * (Number(i.cantidad) || 1), 0) + (Number(form.delivery) || 0);
  const totalUtilidad = form.items.reduce((s, i) => s + calcUtilidad(i), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.cliente_id) {
      setError('Debes seleccionar un cliente');
      return;
    }
    if (!form.metodo_pago) {
      setError('Debes seleccionar el método de pago');
      return;
    }
    if (!form.canal) {
      setError('Debes seleccionar el canal');
      return;
    }
    try {
      const cliente = clientes.find((c) => String(c.id) === String(form.cliente_id));
      await api.ventas.create({
        ...form,
        cliente_id: Number(form.cliente_id),
        cliente_nombre: cliente?.nombre || form.cliente_nombre,
        delivery: Number(form.delivery || 0),
        live_id: form.canal === 'live' && form.live_id ? Number(form.live_id) : null,
        items: form.items.map((i) => ({
          inventario_id: i.inventario_id ? Number(i.inventario_id) : null,
          producto_nombre: i.producto_nombre,
          cantidad: Number(i.cantidad),
          precio_venta: Number(i.precio_venta),
          costo_unitario: Number(i.costo_unitario || 0),
        })),
      });
      setModal(false);
      load();
      loadClientes();
      loadLives();
      if (form.live_id) {
        api.lives.sincronizar(Number(form.live_id)).catch(() => {});
      }
      api.inventario.list({ estado: 'disponible' }).then(setInventario);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCrearCliente = async (e) => {
    e.preventDefault();
    try {
      const c = await api.clientes.create(nuevoCliente);
      await loadClientes();
      setForm({ ...form, cliente_id: String(c.id), cliente_nombre: c.nombre });
      setNuevoCliente({ nombre: '', whatsapp: '', ciudad: '' });
      setNuevoClienteModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRecalcular = async () => {
    if (!confirm('¿Recalcular utilidades de todas las ventas con el costo actual del inventario?')) return;
    setRecalcLoading(true);
    try {
      const result = await api.ventas.recalcularUtilidades();
      alert(result.mensaje || 'Utilidades recalculadas');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setRecalcLoading(false);
    }
  };

  const toDateInput = (f) => {
    if (!f) return '';
    const s = String(f);
    return s.length >= 10 ? s.slice(0, 10) : s;
  };

  const openDetalle = (v) => {
    setDetalle(v);
    setEditError('');
    setEditForm({
      fecha: toDateInput(v.fecha),
      cliente_id: v.cliente_id ? String(v.cliente_id) : '',
      cliente_nombre: v.cliente_nombre || '',
      metodo_pago: v.metodo_pago || '',
      canal: v.canal || '',
      delivery: v.delivery ?? '',
      estado: v.estado || 'pagado',
      notas: v.notas || '',
      live_id: v.live_id ? String(v.live_id) : '',
    });
  };

  const handleUpdateItem = async (itemId, field, value) => {
    try {
      const updated = await api.ventas.updateItem(itemId, { [field]: Number(value) });
      setDetalle(updated);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGuardarVenta = async (e) => {
    e.preventDefault();
    if (!detalle || !editForm) return;
    setEditError('');
    setEditSaving(true);
    try {
      const cliente = clientes.find((c) => String(c.id) === String(editForm.cliente_id));
      const updated = await api.ventas.update(detalle.id, {
        fecha: editForm.fecha,
        cliente_id: editForm.cliente_id ? Number(editForm.cliente_id) : null,
        cliente_nombre: cliente?.nombre || editForm.cliente_nombre,
        metodo_pago: editForm.metodo_pago,
        canal: editForm.canal,
        delivery: Number(editForm.delivery || 0),
        estado: editForm.estado,
        notas: editForm.notas,
        live_id: editForm.canal === 'live' && editForm.live_id ? Number(editForm.live_id) : null,
      });
      setDetalle(updated);
      setEditForm({
        fecha: toDateInput(updated.fecha),
        cliente_id: updated.cliente_id ? String(updated.cliente_id) : '',
        cliente_nombre: updated.cliente_nombre || '',
        metodo_pago: updated.metodo_pago || '',
        canal: updated.canal || '',
        delivery: updated.delivery ?? '',
        estado: updated.estado || 'pagado',
        notas: updated.notas || '',
        live_id: updated.live_id ? String(updated.live_id) : '',
      });
      load();
      loadLives();
      api.inventario.list({ estado: 'disponible' }).then(setInventario);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelarVenta = async () => {
    if (!detalle) return;
    if (!confirm('¿Cancelar esta venta? Se devolverá el stock al inventario y se quitará el ingreso de caja.')) return;
    setEditSaving(true);
    setEditError('');
    try {
      const updated = await api.ventas.cancelar(detalle.id);
      setDetalle(updated);
      setEditForm((prev) => (prev ? { ...prev, estado: 'cancelado' } : prev));
      load();
      api.inventario.list({ estado: 'disponible' }).then(setInventario);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const ventasFiltradas = ventas.filter((v) => {
    const q = filtros.busqueda.trim().toLowerCase();
    if (!q) return true;
    const productos = (v.items || []).map((i) => i.producto_nombre).join(' ').toLowerCase();
    return (
      String(v.cliente_nombre || '').toLowerCase().includes(q) ||
      String(v.metodo_pago || '').toLowerCase().includes(q) ||
      String(v.canal || '').toLowerCase().includes(q) ||
      productos.includes(q)
    );
  });
  const pager = usePagination(ventasFiltradas, 10);
  const ventaCancelada = detalle?.estado === 'cancelado';

  const aplicarFiltros = () => {
    const params = {};
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.desde) params.desde = filtros.desde;
    if (filtros.hasta) params.hasta = filtros.hasta;
    load(params);
  };

  const limpiarFiltros = () => {
    setFiltros({ estado: '', desde: '', hasta: '', busqueda: '' });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Registra ventas y descuenta inventario automáticamente"
        action={
          <>
            <button className="btn-secondary" onClick={handleRecalcular} disabled={recalcLoading}>
              {recalcLoading ? 'Recalculando...' : 'Recalcular utilidades'}
            </button>
            <button className="btn-primary" onClick={openNew}>+ Nueva venta</button>
          </>
        }
      />

      <div className="card">
        <div className="grid md:grid-cols-5 gap-2 mb-4">
          <input
            placeholder="Buscar cliente, producto, canal o pago..."
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
          />
          <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos los estados</option>
            {ESTADOS_VENTA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
          <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary w-full" onClick={aplicarFiltros}>Filtrar</button>
            <button type="button" className="btn-secondary w-full" onClick={limpiarFiltros}>Limpiar</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Productos</th>
              <th>Total</th>
              <th>Costo</th>
              <th>Utilidad</th>
              <th>Pago</th>
              <th>Canal</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((v) => (
              <tr key={v.id}>
                <td>{formatDate(v.fecha)}</td>
                <td>{v.cliente_nombre || '-'}</td>
                <td>{v.items?.map((i) => i.producto_nombre).join(', ')}</td>
                <td>{formatMoney(v.total_venta)}</td>
                <td>{formatMoney(v.total_costo)}</td>
                <td><Money value={v.utilidad_bruta} signed /></td>
                <td>{labelOf(METODOS_PAGO, v.metodo_pago)}</td>
                <td>{labelOf(CANALES, v.canal)}</td>
                <td><Badge label={labelOf(ESTADOS_VENTA, v.estado)} colorClass={badgeClass(ESTADOS_VENTA, v.estado)} /></td>
                <td>
                  <button className="btn-secondary text-xs py-1" onClick={() => openDetalle(v)}>Ver / Editar</button>
                </td>
              </tr>
            ))}
            {ventasFiltradas.length === 0 && (
              <tr><td colSpan={10} className="text-center text-gray-400 py-8">No hay ventas registradas</td></tr>
            )}
          </tbody>
          </table>
        </div>
        <Pagination {...pager} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva venta" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="form-grid">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cliente *</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={form.cliente_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const c = clientes.find((x) => String(x.id) === id);
                    setForm({ ...form, cliente_id: id, cliente_nombre: c?.nombre || '' });
                  }}
                  required
                >
                  <option value="">Seleccione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setNuevoClienteModal(true)}>
                  + Nuevo
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago *</label>
              <select
                value={form.metodo_pago}
                onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}
                required
              >
                <option value="">Seleccione...</option>
                {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Canal *</label>
              <select
                value={form.canal}
                onChange={(e) => setForm({ ...form, canal: e.target.value, live_id: e.target.value === 'live' ? form.live_id : '' })}
                required
              >
                <option value="">Seleccione...</option>
                {CANALES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {form.canal === 'live' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Live TikTok</label>
                <select
                  value={form.live_id}
                  onChange={(e) => setForm({ ...form, live_id: e.target.value })}
                >
                  <option value="">Sin vincular...</option>
                  {lives.map((l) => (
                    <option key={l.id} value={l.id}>
                      {formatDate(l.fecha)} — {l.titulo || `Live #${l.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery</label>
              <input type="number" min="0" step="0.01" value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_VENTA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div className="border rounded-lg p-3 sm:p-4 space-y-3 border-[#2a2a2a]">
            <h4 className="font-medium text-sm text-[#ffcc00]">Productos</h4>
            {form.items.map((item, idx) => (
              <div key={idx} className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-end border-b border-[#2a2a2a] pb-3 last:border-0 pr-10">
                <button
                  type="button"
                  className="absolute top-0 right-0 text-gray-500 hover:text-red-400 text-xl leading-none min-h-[36px] min-w-[36px] flex items-center justify-center"
                  onClick={() => quitarItem(idx)}
                  title="Quitar producto"
                  aria-label="Quitar producto"
                >
                  ×
                </button>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Del inventario</label>
                  <select value={item.inventario_id} onChange={(e) => selectProducto(idx, e.target.value)}>
                    <option value="">Manual...</option>
                    {opcionesInventario(idx).map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.tipo_item === 'caja_cerrada' ? '📦 ' : ''}
                        {inv.nombre}
                        {inv.tipo_item === 'caja_cerrada' ? ' [CAJA CERRADA]' : ''}
                        {' '}(stock: {inv.cantidad})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                  <input value={item.producto_nombre} onChange={(e) => {
                    const items = [...form.items];
                    items[idx].producto_nombre = e.target.value;
                    setForm({ ...form, items });
                  }} required />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cant.</label>
                  <input type="number" min="1" value={item.cantidad} onChange={(e) => {
                    const items = [...form.items];
                    items[idx].cantidad = e.target.value;
                    setForm({ ...form, items });
                  }} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio</label>
                  <input type="number" min="0" step="0.01" value={item.precio_venta} onChange={(e) => {
                    const items = [...form.items];
                    items[idx].precio_venta = e.target.value;
                    setForm({ ...form, items });
                  }} required />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary text-sm w-full sm:w-auto"
              onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}
            >
              + Agregar producto
            </button>
          </div>

          <div className="panel-muted">
            <p><strong>Total venta:</strong> {formatMoney(totalVenta)}</p>
            <p>
              <strong>Utilidad bruta:</strong>{' '}
              <Money value={totalUtilidad} signed className="text-base" />
              {totalUtilidad < 0 && (
                <span className="ml-2 text-xs money-neg-bg money-neg">Pérdida</span>
              )}
            </p>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar venta</button>
          </div>
        </form>
      </Modal>

      <Modal open={nuevoClienteModal} onClose={() => setNuevoClienteModal(false)} title="Nuevo cliente">
        <form onSubmit={handleCrearCliente} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input
              value={nuevoCliente.nombre}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
            <input
              value={nuevoCliente.whatsapp}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, whatsapp: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
            <input
              value={nuevoCliente.ciudad}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, ciudad: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setNuevoClienteModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Agregar</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!detalle}
        onClose={() => { setDetalle(null); setEditForm(null); setEditError(''); }}
        title={`Venta #${detalle?.id || ''}`}
        wide
      >
        {detalle && editForm && (
          <form className="space-y-4" onSubmit={handleGuardarVenta}>
            {editError && <p className="text-red-600 text-sm">{editError}</p>}
            {ventaCancelada && (
              <p className="text-sm money-neg">Esta venta está cancelada. No se puede editar.</p>
            )}

            <div className="form-grid">
              <div>
                <label>Fecha</label>
                <input
                  type="date"
                  required
                  disabled={ventaCancelada}
                  value={editForm.fecha}
                  onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                />
              </div>
              <div>
                <label>Cliente</label>
                <select
                  required
                  disabled={ventaCancelada}
                  value={editForm.cliente_id}
                  onChange={(e) => setEditForm({ ...editForm, cliente_id: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Método de pago</label>
                <select
                  required
                  disabled={ventaCancelada}
                  value={editForm.metodo_pago}
                  onChange={(e) => setEditForm({ ...editForm, metodo_pago: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {METODOS_PAGO.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Canal</label>
                <select
                  required
                  disabled={ventaCancelada}
                  value={editForm.canal}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    canal: e.target.value,
                    live_id: e.target.value === 'live' ? editForm.live_id : '',
                  })}
                >
                  <option value="">Seleccionar...</option>
                  {CANALES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              {editForm.canal === 'live' && (
                <div>
                  <label>Live TikTok</label>
                  <select
                    disabled={ventaCancelada}
                    value={editForm.live_id || ''}
                    onChange={(e) => setEditForm({ ...editForm, live_id: e.target.value })}
                  >
                    <option value="">Sin vincular...</option>
                    {lives.map((l) => (
                      <option key={l.id} value={l.id}>
                        {formatDate(l.fecha)} — {l.titulo || `Live #${l.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label>Estado</label>
                <select
                  disabled={ventaCancelada}
                  value={editForm.estado}
                  onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
                >
                  {ESTADOS_VENTA.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Delivery (Bs)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={ventaCancelada}
                  value={editForm.delivery}
                  onChange={(e) => setEditForm({ ...editForm, delivery: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label>Notas</label>
                <input
                  disabled={ventaCancelada}
                  value={editForm.notas}
                  onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid text-sm">
              <p><strong>Total:</strong> {formatMoney(detalle.total_venta)}</p>
              <p>
                <strong>Utilidad:</strong>{' '}
                <Money value={detalle.utilidad_bruta} signed />
                {Number(detalle.utilidad_bruta) < 0 && (
                  <span className="ml-2 text-xs money-neg-bg money-neg">Pérdida</span>
                )}
              </p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Costo</th>
                    <th>Utilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items?.map((item) => (
                    <tr key={item.id}>
                      <td>{item.producto_nombre}</td>
                      <td>{item.cantidad}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full max-w-24"
                          disabled={ventaCancelada}
                          defaultValue={item.precio_venta}
                          key={`p-${item.id}-${item.precio_venta}`}
                          onBlur={(e) => {
                            if (ventaCancelada) return;
                            if (Number(e.target.value) !== Number(item.precio_venta)) {
                              handleUpdateItem(item.id, 'precio_venta', e.target.value);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full max-w-24"
                          disabled={ventaCancelada}
                          defaultValue={item.costo_unitario}
                          key={`c-${item.id}-${item.costo_unitario}`}
                          onBlur={(e) => {
                            if (ventaCancelada) return;
                            if (Number(e.target.value) !== Number(item.costo_unitario)) {
                              handleUpdateItem(item.id, 'costo_unitario', e.target.value);
                            }
                          }}
                        />
                      </td>
                      <td><Money value={item.utilidad} signed /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setDetalle(null); setEditForm(null); }}
              >
                Cerrar
              </button>
              {!ventaCancelada && (
                <>
                  <button
                    type="button"
                    className="btn-secondary text-red-400"
                    disabled={editSaving}
                    onClick={handleCancelarVenta}
                  >
                    Cancelar venta
                  </button>
                  <button type="submit" className="btn-primary" disabled={editSaving}>
                    {editSaving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

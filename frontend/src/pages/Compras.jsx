import { useEffect, useState } from 'react';
import { api, formatMoney, formatDate, hoy } from '../api/client';
import { TIPOS_COMPRA, ESTADOS_COMPRA, labelOf, badgeClass } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

const emptyForm = {
  fecha: hoy(),
  proveedor_id: '',
  proveedor_nombre: '',
  tipo_compra: 'mainline',
  descripcion: '',
  cantidad: 1,
  costo_producto: '',
  transporte: '',
  impuestos: '',
  otros_gastos: '',
  estado: 'en_camino',
  es_caja: true,
  pagado_desde_caja: true,
};

export default function Compras() {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [modal, setModal] = useState(false);
  const [nuevoProvModal, setNuevoProvModal] = useState(false);
  const [nuevoProvNombre, setNuevoProvNombre] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({
    estado: '',
    desde: '',
    hasta: '',
    busqueda: '',
  });

  const load = (params = {}) => api.compras.list(params).then(setCompras).catch(console.error);
  const loadProveedores = () => api.proveedores.list().then(setProveedores).catch(console.error);

  useEffect(() => {
    load();
    loadProveedores();
  }, []);

  const costoTotal = Number(form.costo_producto || 0) + Number(form.transporte || 0) + Number(form.impuestos || 0) + Number(form.otros_gastos || 0);
  const costoUnitario = form.cantidad > 0 ? costoTotal / form.cantidad : 0;

  const openNew = () => { setForm(emptyForm); setEditId(null); setError(''); setModal(true); };
  const openEdit = (c) => {
    setForm({
      ...emptyForm,
      ...c,
      proveedor_id: c.proveedor_id || '',
      es_caja: c.es_caja !== false && c.es_caja !== 0,
      pagado_desde_caja: c.pagado_desde_caja !== false && c.pagado_desde_caja !== 0,
    });
    setEditId(c.id);
    setError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.proveedor_id && !form.proveedor_nombre) {
      setError('Selecciona o agrega un proveedor');
      return;
    }
    try {
      const proveedor = proveedores.find((p) => String(p.id) === String(form.proveedor_id));
      const data = {
        ...form,
        proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
        proveedor_nombre: proveedor?.nombre || form.proveedor_nombre || null,
        cantidad: Number(form.cantidad),
        costo_producto: Number(form.costo_producto),
        transporte: Number(form.transporte || 0),
        impuestos: Number(form.impuestos || 0),
        otros_gastos: Number(form.otros_gastos || 0),
        pagado_desde_caja: !!form.pagado_desde_caja,
      };
      if (editId) await api.compras.update(editId, data);
      else await api.compras.create(data);
      setModal(false);
      load();
      loadProveedores();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRecibir = async (id) => {
    try {
      await api.compras.recibir(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCrearProveedor = async (e) => {
    e.preventDefault();
    try {
      const p = await api.proveedores.create({ nombre: nuevoProvNombre.trim() });
      await loadProveedores();
      setForm({ ...form, proveedor_id: String(p.id), proveedor_nombre: p.nombre });
      setNuevoProvNombre('');
      setNuevoProvModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const comprasFiltradas = compras.filter((c) => {
    const q = filtros.busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      String(c.proveedor_nombre || '').toLowerCase().includes(q) ||
      String(c.descripcion || '').toLowerCase().includes(q) ||
      String(c.tipo_compra || '').toLowerCase().includes(q)
    );
  });
  const pager = usePagination(comprasFiltradas, 10);

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
        title="Compras"
        subtitle="Registra compras de productos y accesorios"
        action={<button className="btn-primary" onClick={openNew}>+ Nueva compra</button>}
      />

      <div className="card">
        <div className="grid md:grid-cols-5 gap-2 mb-4">
          <input
            placeholder="Buscar proveedor/descripcion/tipo..."
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
          />
          <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos los estados</option>
            {ESTADOS_COMPRA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
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
              <th>Proveedor</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Cant.</th>
              <th>Costo total</th>
              <th>Unitario</th>
              <th>Pago</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((c) => (
              <tr key={c.id}>
                <td>{formatDate(c.fecha)}</td>
                <td>{c.proveedor_nombre || '-'}</td>
                <td>{labelOf(TIPOS_COMPRA, c.tipo_compra)}</td>
                <td>{c.descripcion}</td>
                <td>{c.cantidad}</td>
                <td>{formatMoney(c.costo_total)}</td>
                <td>{formatMoney(c.costo_unitario)}</td>
                <td>
                  {c.pagado_desde_caja !== false && c.pagado_desde_caja !== 0
                    ? <span className="badge bg-[#ffcc00]/20 text-[#ffcc00]">Reinversión (caja)</span>
                    : <span className="badge bg-sky-500/15 text-sky-300">Inversión externa</span>}
                </td>
                <td><Badge label={labelOf(ESTADOS_COMPRA, c.estado)} colorClass={badgeClass(ESTADOS_COMPRA, c.estado)} /></td>
                <td className="space-x-2 whitespace-nowrap">
                  <button className="btn-secondary text-xs py-1" onClick={() => openEdit(c)}>Editar</button>
                  {c.estado === 'en_camino' && (
                    <button className="btn-primary text-xs py-1" onClick={() => handleRecibir(c.id)}>Recibir</button>
                  )}
                </td>
              </tr>
            ))}
            {comprasFiltradas.length === 0 && (
              <tr><td colSpan={10} className="text-center text-gray-400 py-8">No hay compras registradas</td></tr>
            )}
          </tbody>
          </table>
        </div>
        <Pagination {...pager} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar compra' : 'Nueva compra'} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="form-grid">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={set('fecha')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={form.proveedor_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const p = proveedores.find((x) => String(x.id) === id);
                    setForm({
                      ...form,
                      proveedor_id: id,
                      proveedor_nombre: p?.nombre || '',
                    });
                  }}
                  required
                >
                  <option value="">Seleccione...</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setNuevoProvModal(true)}>
                  + Nuevo
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.tipo_compra} onChange={set('tipo_compra')}>
                {TIPOS_COMPRA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select value={form.estado} onChange={set('estado')}>
                {ESTADOS_COMPRA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <input value={form.descripcion} onChange={set('descripcion')} required placeholder="Ej: Case A 2025" />
          </div>
          {form.tipo_compra === 'mainline' && (
            <label className="flex items-center gap-2 text-sm min-h-[44px]">
              <input type="checkbox" className="!min-h-0 w-4 h-4" checked={form.es_caja} onChange={(e) => setForm({ ...form, es_caja: e.target.checked })} />
              Es caja cerrada (case)
            </label>
          )}
          <div className="panel-muted space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">¿Con qué dinero pagas esta compra? *</label>
              <select
                value={form.pagado_desde_caja ? 'caja' : 'externo'}
                onChange={(e) => setForm({ ...form, pagado_desde_caja: e.target.value === 'caja' })}
                required
              >
                <option value="caja">Reinversión — sale de la caja/banco</option>
                <option value="externo">Inversión externa — plata de afuera (NO sale de la caja)</option>
              </select>
            </div>
            <p className="text-xs text-gray-400">
              {form.pagado_desde_caja
                ? 'Esta compra se restará del dinero esperado en banco/caja (reutilizas lo que ya ganaste o tenías).'
                : 'Esta compra NO resta de la caja. Úsala si pagaste con capital personal/externo que nunca estuvo en la caja.'}
            </p>
          </div>
          <div className="form-grid">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
              <input type="number" min="1" step="1" value={form.cantidad} onChange={set('cantidad')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Costo producto</label>
              <input type="number" min="0" step="0.01" value={form.costo_producto} onChange={set('costo_producto')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Transporte</label>
              <input type="number" min="0" step="0.01" value={form.transporte} onChange={set('transporte')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Impuestos</label>
              <input type="number" min="0" step="0.01" value={form.impuestos} onChange={set('impuestos')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Otros gastos</label>
              <input type="number" min="0" step="0.01" value={form.otros_gastos} onChange={set('otros_gastos')} />
            </div>
          </div>
          <div className="panel-muted">
            <p><strong>Costo total:</strong> {formatMoney(costoTotal)}</p>
            <p><strong>Costo unitario:</strong> {formatMoney(costoUnitario)}</p>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <Modal open={nuevoProvModal} onClose={() => setNuevoProvModal(false)} title="Nuevo proveedor">
        <form onSubmit={handleCrearProveedor} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input value={nuevoProvNombre} onChange={(e) => setNuevoProvNombre(e.target.value)} required autoFocus />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setNuevoProvModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Agregar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

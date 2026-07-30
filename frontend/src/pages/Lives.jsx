import { useEffect, useState } from 'react';
import { api, formatMoney, formatDate, hoy } from '../api/client';
import { ESTADOS_LIVE, labelOf, badgeClass } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import Money from '../components/Money';
import { usePagination } from '../hooks/usePagination';

const emptyForm = {
  fecha: hoy(),
  titulo: '',
  plataforma: 'tiktok',
  estado: 'programado',
  hora_inicio: '',
  hora_fin: '',
  premios_entregados: '',
  costo_premios: '',
  gastos_live: '',
  observaciones: '',
};

export default function Lives() {
  const [lives, setLives] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ estado: '', desde: '', hasta: '', busqueda: '' });

  const load = (params = {}) => {
    api.lives.list(params).then(setLives).catch(console.error);
    api.lives.resumen().then(setResumen).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const livesFiltrados = lives.filter((l) => {
    const q = filtros.busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      String(l.titulo || '').toLowerCase().includes(q) ||
      String(l.observaciones || '').toLowerCase().includes(q) ||
      String(l.plataforma || '').toLowerCase().includes(q)
    );
  });
  const pager = usePagination(livesFiltrados, 10);

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setError('');
    setModal(true);
  };

  const openEdit = (l) => {
    setForm({
      fecha: String(l.fecha).slice(0, 10),
      titulo: l.titulo || '',
      plataforma: l.plataforma || 'tiktok',
      estado: l.estado || 'finalizado',
      hora_inicio: l.hora_inicio || '',
      hora_fin: l.hora_fin || '',
      premios_entregados: l.premios_entregados ?? '',
      costo_premios: l.costo_premios ?? '',
      gastos_live: l.gastos_live ?? '',
      observaciones: l.observaciones || '',
    });
    setEditId(l.id);
    setError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = {
        ...form,
        premios_entregados: Number(form.premios_entregados || 0),
        costo_premios: Number(form.costo_premios || 0),
        gastos_live: Number(form.gastos_live || 0),
      };
      if (editId) await api.lives.update(editId, data);
      else await api.lives.create(data);
      setModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSync = async (id) => {
    try {
      await api.lives.sincronizar(id);
      load();
      if (detalle?.id === id) {
        const fresh = await api.lives.get(id);
        setDetalle(fresh);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este live? Las ventas vinculadas quedarán sin live.')) return;
    try {
      await api.lives.delete(id);
      setDetalle(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const openDetalle = async (l) => {
    try {
      const fresh = await api.lives.get(l.id);
      setDetalle(fresh);
    } catch (err) {
      alert(err.message);
    }
  };

  const aplicarFiltros = () => {
    const params = {};
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.desde) params.desde = filtros.desde;
    if (filtros.hasta) params.hasta = filtros.hasta;
    load(params);
  };

  return (
    <div>
      <PageHeader
        title="Lives TikTok"
        subtitle="Registra cada live, sincroniza ventas y mira la utilidad real"
        action={<button className="btn-primary" onClick={openNew}>+ Nuevo live</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card">
          <p className="stat-label">Lives registrados</p>
          <p className="text-2xl font-bold">{resumen?.resumen?.cantidad ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Ventas en lives</p>
          <p className="text-2xl font-bold">{formatMoney(resumen?.resumen?.ventas)}</p>
        </div>
        <div className="card">
          <p className="stat-label">Utilidad lives</p>
          <p className="text-2xl font-bold"><Money value={resumen?.resumen?.utilidad} signed /></p>
        </div>
        <div className="card">
          <p className="stat-label">Autos vendidos</p>
          <p className="text-2xl font-bold text-[#ffcc00]">{resumen?.resumen?.autos ?? 0}</p>
        </div>
      </div>

      <div className="card">
        <div className="grid md:grid-cols-5 gap-2 mb-4">
          <input
            placeholder="Buscar título u observaciones..."
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
          />
          <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos los estados</option>
            {ESTADOS_LIVE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
          <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
          <button type="button" className="btn-primary" onClick={aplicarFiltros}>Filtrar</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Título</th>
                <th>Horario</th>
                <th>Autos</th>
                <th>Ventas</th>
                <th>Utilidad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((l) => (
                <tr key={l.id}>
                  <td>{formatDate(l.fecha)}</td>
                  <td>
                    <div className="font-medium">{l.titulo || `Live #${l.id}`}</div>
                    <div className="text-xs text-gray-500">{l.plataforma || 'tiktok'}</div>
                  </td>
                  <td className="text-xs">{[l.hora_inicio, l.hora_fin].filter(Boolean).join(' – ') || '—'}</td>
                  <td>{l.autos_vendidos}</td>
                  <td>{formatMoney(l.ventas_totales)}</td>
                  <td><Money value={l.utilidad_neta} signed /></td>
                  <td><Badge label={labelOf(ESTADOS_LIVE, l.estado)} colorClass={badgeClass(ESTADOS_LIVE, l.estado)} /></td>
                  <td className="space-x-1 whitespace-nowrap">
                    <button className="btn-secondary text-xs py-1" onClick={() => openDetalle(l)}>Ver</button>
                    <button className="btn-secondary text-xs py-1" onClick={() => openEdit(l)}>Editar</button>
                    <button className="btn-secondary text-xs py-1" onClick={() => handleSync(l.id)}>Sync</button>
                  </td>
                </tr>
              ))}
              {livesFiltrados.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">No hay lives registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pager} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar live' : 'Nuevo live'} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="form-grid">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Fecha *</label>
              <input type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Título</label>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Live case A sábado" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_LIVE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Plataforma</label>
              <input value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Hora inicio</label>
              <input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Hora fin</label>
              <input type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Premios entregados</label>
              <input type="number" min="0" value={form.premios_entregados} onChange={(e) => setForm({ ...form, premios_entregados: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Costo premios (Bs)</label>
              <input type="number" min="0" step="0.01" value={form.costo_premios} onChange={(e) => setForm({ ...form, costo_premios: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Gastos del live (Bs)</label>
              <input type="number" min="0" step="0.01" value={form.gastos_live} onChange={(e) => setForm({ ...form, gastos_live: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Observaciones</label>
              <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Las ventas se calculan al sincronizar o al vincular ventas con este live desde Ventas (canal Live).
          </p>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle?.titulo || `Live #${detalle?.id || ''}`} wide>
        {detalle && (
          <div className="space-y-4">
            <div className="form-grid text-sm">
              <p><strong>Fecha:</strong> {formatDate(detalle.fecha)}</p>
              <p><strong>Estado:</strong> {labelOf(ESTADOS_LIVE, detalle.estado)}</p>
              <p><strong>Ventas:</strong> {formatMoney(detalle.ventas_totales)}</p>
              <p><strong>Costo productos:</strong> {formatMoney(detalle.costo_productos)}</p>
              <p><strong>Premios:</strong> {detalle.premios_entregados} ({formatMoney(detalle.costo_premios)})</p>
              <p><strong>Gastos live:</strong> {formatMoney(detalle.gastos_live)}</p>
              <p><strong>Autos:</strong> {detalle.autos_vendidos}</p>
              <p><strong>Utilidad neta:</strong> <Money value={detalle.utilidad_neta} signed /></p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-[#ffcc00] mb-2">Ventas vinculadas ({detalle.ventas?.length || 0})</h4>
              {(detalle.ventas || []).length === 0 ? (
                <p className="text-sm text-gray-400">Sin ventas. En Ventas elige canal Live y selecciona este live.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Cliente</th><th>Total</th><th>Utilidad</th><th>Pago</th></tr></thead>
                    <tbody>
                      {detalle.ventas.map((v) => (
                        <tr key={v.id}>
                          <td>{v.cliente_nombre}</td>
                          <td>{formatMoney(v.total_venta)}</td>
                          <td><Money value={v.utilidad_bruta} signed /></td>
                          <td>{v.metodo_pago}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
              <button type="button" className="btn-secondary" onClick={() => handleSync(detalle.id)}>Sincronizar ventas</button>
              <button type="button" className="btn-secondary text-red-400" onClick={() => handleDelete(detalle.id)}>Eliminar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

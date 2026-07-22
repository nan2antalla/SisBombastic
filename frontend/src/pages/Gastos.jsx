import { useEffect, useState } from 'react';
import { api, formatMoney, formatDate, hoy } from '../api/client';
import { CATEGORIAS_GASTO, labelOf } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

const emptyForm = {
  fecha: hoy(),
  categoria: 'transporte',
  descripcion: '',
  monto: '',
  metodo_pago: 'efectivo',
  relacion_tipo: 'general',
};

export default function Gastos() {
  const [gastos, setGastos] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => api.gastos.list().then(setGastos).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.gastos.create({ ...form, monto: Number(form.monto) });
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const total = gastos.reduce((s, g) => s + g.monto, 0);
  const pager = usePagination(gastos, 10);

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle="Registra todos los gastos del negocio"
        action={<button className="btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>+ Nuevo gasto</button>}
      />

      <div className="stat-card mb-4 w-full sm:w-auto sm:inline-flex">
        <span className="stat-label">Total gastos registrados</span>
        <span className="stat-value negative">{formatMoney(total)}</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Pago</th>
                <th>Relación</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((g) => (
                <tr key={g.id}>
                  <td>{formatDate(g.fecha)}</td>
                  <td>{labelOf(CATEGORIAS_GASTO, g.categoria)}</td>
                  <td>{g.descripcion}</td>
                  <td className="text-red-400 font-medium">{formatMoney(g.monto)}</td>
                  <td>{g.metodo_pago}</td>
                  <td>{g.relacion_tipo}</td>
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No hay gastos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pager} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo gasto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS_GASTO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Monto</label>
            <input type="number" min="0" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Método de pago</label>
            <input value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

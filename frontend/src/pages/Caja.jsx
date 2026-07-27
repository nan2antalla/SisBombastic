import { useEffect, useState } from 'react';
import { api, formatMoney, formatDate, hoy } from '../api/client';
import { TIPOS_CAJA } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import Money from '../components/Money';
import { usePagination } from '../hooks/usePagination';

export default function Caja() {
  const [saldo, setSaldo] = useState(0);
  const [efectivo, setEfectivo] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cierres, setCierres] = useState([]);
  const [fecha, setFecha] = useState(hoy());
  const [modal, setModal] = useState(false);
  const [movForm, setMovForm] = useState({ fecha: hoy(), tipo: 'retiro_personal', monto: '', descripcion: '' });
  const [notasCierre, setNotasCierre] = useState('');

  const load = () => {
    api.caja.saldo().then((d) => setSaldo(d.saldo)).catch(console.error);
    api.caja.efectivo().then(setEfectivo).catch(console.error);
    api.caja.resumen(fecha).then(setResumen).catch(console.error);
    api.caja.cierres().then(setCierres).catch(console.error);
  };

  useEffect(() => { load(); }, [fecha]);

  const handleMovimiento = async (e) => {
    e.preventDefault();
    try {
      await api.caja.movimiento({ ...movForm, monto: Number(movForm.monto) });
      setModal(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCerrar = async () => {
    try {
      await api.caja.cerrar({ fecha, notas: notasCierre });
      setNotasCierre('');
      load();
      alert('Caja cerrada correctamente');
    } catch (err) {
      alert(err.message);
    }
  };

  const tipoLabel = (tipo) => {
    const map = {
      entrada_venta: 'Entrada venta',
      salida_compra: 'Reinversión (compra)',
      salida_gasto: 'Salida gasto',
      retiro_personal: 'Retiro personal',
      inversion: 'Inversión externa',
      ajuste: 'Ajuste',
    };
    return map[tipo] || tipo;
  };

  const movPager = usePagination(resumen?.movimientos || [], 10);
  const cierrePager = usePagination(cierres, 10);
  const histPager = usePagination(efectivo?.historico || [], 10);
  const d = efectivo?.desglose || {};

  return (
    <div>
      <PageHeader
        title="Caja / Banco"
        subtitle="Cuánto dinero deberías tener y de dónde salió o entró"
        action={
          <>
            <button className="btn-secondary" onClick={() => setModal(true)}>Movimiento manual</button>
            <button className="btn-primary" onClick={handleCerrar}>Cerrar caja del día</button>
          </>
        }
      />

      <div className="card border-[#ffcc00]/40 mb-6">
        <p className="stat-label">Dinero esperado en banco / caja</p>
        <p className="text-4xl font-bold mt-2">
          <Money value={efectivo?.dinero_esperado_banco ?? saldo} signed />
        </p>
        <p className="text-xs text-gray-400 mt-2">
          {efectivo?.formula || 'Ventas + Inversión − Reinversiones − Gastos − Retiros'}
        </p>
        <p className="text-sm text-gray-300 mt-3">
          Inventario (no es efectivo): <strong>{formatMoney(efectivo?.valor_inventario)}</strong>
          {' · '}
          Patrimonio aprox.: <strong><Money value={efectivo?.patrimonio_aproximado} signed /></strong>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <div className="stat-card">
          <span className="stat-label">(+) Ventas</span>
          <span className="stat-value positive">{formatMoney(d.ventas)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">(+) Inversión externa</span>
          <span className="stat-value">{formatMoney(d.inversiones_externas)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">(−) Reinversiones</span>
          <span className="stat-value negative">{formatMoney(d.reinversiones_compras)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Compras externas</span>
          <span className="stat-value">{formatMoney(d.compras_externas)}</span>
          <span className="text-xs text-gray-500">No restan del banco</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">(−) Gastos</span>
          <span className="stat-value negative">{formatMoney(d.gastos)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">(−) Retiros</span>
          <span className="stat-value negative">{formatMoney(d.retiros_personales)}</span>
        </div>
      </div>

      <div className="filters-bar mb-4">
        <label className="text-sm text-gray-400 flex items-center gap-2 w-full sm:w-auto">
          Ver día:
          <input type="date" className="flex-1 sm:max-w-[200px]" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <input
          className="w-full sm:max-w-xs"
          placeholder="Notas de cierre..."
          value={notasCierre}
          onChange={(e) => setNotasCierre(e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="card">
          <h3 className="font-semibold mb-4 text-[#ffcc00]">Movimientos del día</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {movPager.pageItems.map((m) => (
                  <tr key={m.id}>
                    <td>{tipoLabel(m.tipo)}</td>
                    <td>{m.descripcion || '-'}</td>
                    <td className={m.tipo.startsWith('entrada') || m.tipo === 'inversion' ? 'text-emerald-400' : 'text-red-400'}>
                      {formatMoney(m.monto)}
                    </td>
                  </tr>
                ))}
                {(!resumen?.movimientos || resumen.movimientos.length === 0) && (
                  <tr><td colSpan={3} className="text-center text-gray-400 py-6">Sin movimientos</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination {...movPager} />
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4 text-[#ffcc00]">Histórico de efectivo</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {histPager.pageItems.map((m, i) => {
                  const entrada = m.tipo === 'entrada_venta' || m.tipo === 'inversion';
                  return (
                    <tr key={`${m.fecha}-${i}`}>
                      <td>{formatDate(String(m.fecha).slice(0, 10))}</td>
                      <td>{tipoLabel(m.tipo)}</td>
                      <td className="max-w-[180px] truncate">{m.descripcion || '-'}</td>
                      <td className={entrada ? 'text-emerald-400' : 'text-red-400'}>
                        {entrada ? '+' : '−'}{formatMoney(m.monto)}
                      </td>
                    </tr>
                  );
                })}
                {(!efectivo?.historico || efectivo.historico.length === 0) && (
                  <tr><td colSpan={4} className="text-center text-gray-400 py-6">Sin historial</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination {...histPager} />
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="font-semibold mb-4 text-[#ffcc00]">Historial de cierres</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Inicial</th>
                <th>Entradas</th>
                <th>Salidas</th>
                <th>Final</th>
              </tr>
            </thead>
            <tbody>
              {cierrePager.pageItems.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.fecha)}</td>
                  <td>{formatMoney(c.saldo_inicial)}</td>
                  <td className="text-emerald-400">{formatMoney(c.entradas)}</td>
                  <td className="text-red-400">{formatMoney(c.salidas)}</td>
                  <td className="font-medium"><Money value={c.saldo_final} signed /></td>
                </tr>
              ))}
              {cierres.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-6">Sin cierres registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...cierrePager} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Movimiento manual">
        <form onSubmit={handleMovimiento} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Fecha</label>
            <input type="date" value={movForm.fecha} onChange={(e) => setMovForm({ ...movForm, fecha: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
            <select value={movForm.tipo} onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}>
              {TIPOS_CAJA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Usa “Inversión externa” solo si metes plata nueva (no de las ventas).
              Las reinversiones se registran al marcar la compra como pagada desde caja.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Monto</label>
            <input type="number" min="0" step="0.01" value={movForm.monto} onChange={(e) => setMovForm({ ...movForm, monto: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
            <input value={movForm.descripcion} onChange={(e) => setMovForm({ ...movForm, descripcion: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

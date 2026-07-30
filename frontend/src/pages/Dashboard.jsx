import { useEffect, useState } from 'react';
import { api, formatMoney, moneyTone } from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import DashboardCharts from '../components/DashboardCharts';
import Money from '../components/Money';
import { usePagination } from '../hooks/usePagination';

function StatCard({ label, value, amount, positive, negative, hint }) {
  const tone = amount != null ? moneyTone(amount) : null;
  const cls = tone
    ? (tone === 'pos' ? 'positive' : tone === 'neg' ? 'negative' : '')
    : (positive ? 'positive' : negative ? 'negative' : '');
  const cardTone = tone === 'neg' ? 'is-negative' : tone === 'pos' ? 'is-positive' : '';
  return (
    <div className={`stat-card ${cardTone}`}>
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${cls}`}>{value}</span>
      {hint && <span className="text-xs text-gray-400 mt-1">{hint}</span>}
      {tone === 'neg' && <span className="text-[10px] uppercase tracking-wide text-red-400 mt-1">Pérdida / negativo</span>}
    </div>
  );
}

function BadgeRec({ rec }) {
  if (!rec) return null;
  const colors = {
    excelente: 'bg-emerald-500/15 text-emerald-300',
    bueno: 'bg-[#ffcc00]/20 text-[#ffcc00]',
    regular: 'bg-amber-500/15 text-amber-300',
    malo: 'bg-red-500/15 text-red-300',
  };
  return <span className={`badge ${colors[rec.nivel] || 'bg-white/10 text-gray-400'}`}>{rec.texto}</span>;
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="font-semibold text-[#ffcc00]">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('resumen');
  const [buscaCaja, setBuscaCaja] = useState('');
  const [buscaProveedor, setBuscaProveedor] = useState('');
  const [buscaCliente, setBuscaCliente] = useState('');

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cajasFiltradas = (data?.cajas_todas || []).filter((c) => {
    const q = buscaCaja.toLowerCase();
    return (
      String(c.nombre || '').toLowerCase().includes(q) ||
      String(c.codigo_interno || '').toLowerCase().includes(q) ||
      String(c.proveedor_nombre || '').toLowerCase().includes(q)
    );
  });
  const proveedoresFiltrados = (data?.proveedores || []).filter((p) => {
    const q = buscaProveedor.toLowerCase();
    return String(p.proveedor || '').toLowerCase().includes(q);
  });
  const cajasPager = usePagination(cajasFiltradas, 10);
  const provPager = usePagination(proveedoresFiltrados, 10);
  const clientesTopCompras = (data?.clientes?.clientes_top_compras || []).filter((c) =>
    String(c.cliente_nombre || '').toLowerCase().includes(buscaCliente.toLowerCase())
  );
  const clientesTopUtilidad = (data?.clientes?.clientes_top_utilidad || []).filter((c) =>
    String(c.cliente_nombre || '').toLowerCase().includes(buscaCliente.toLowerCase())
  );
  const clientesMejorMargen = (data?.clientes?.clientes_mejor_margen || []).filter((c) =>
    String(c.cliente_nombre || '').toLowerCase().includes(buscaCliente.toLowerCase())
  );
  const clientesPeoresUtilidad = (data?.clientes?.clientes_peores_utilidad || []).filter((c) =>
    String(c.cliente_nombre || '').toLowerCase().includes(buscaCliente.toLowerCase())
  );
  const clientesPeoresMargen = (data?.clientes?.clientes_peores_margen || []).filter((c) =>
    String(c.cliente_nombre || '').toLowerCase().includes(buscaCliente.toLowerCase())
  );
  const clientesCompranBarato = (data?.clientes?.clientes_compran_barato || []).filter((c) =>
    String(c.cliente_nombre || '').toLowerCase().includes(buscaCliente.toLowerCase())
  );
  const clientesTopUnidades = (data?.clientes?.clientes_top_unidades || []).filter((c) =>
    String(c.cliente_nombre || '').toLowerCase().includes(buscaCliente.toLowerCase())
  );

  if (loading) return <p className="text-gray-500">Cargando métricas de decisión...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return <p className="text-red-500">Error al cargar datos</p>;

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'roi', label: 'ROI mensual' },
    { id: 'predicciones', label: 'Predicciones' },
    { id: 'banco', label: 'Dinero / Banco' },
    { id: 'graficos', label: 'Gráficos' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'cajas', label: 'Por caja' },
    { id: 'proveedores', label: 'Proveedores' },
    { id: 'velocidad', label: 'Velocidad de venta' },
    { id: 'productos', label: 'Productos' },
    { id: 'lives', label: 'Lives' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard de decisiones"
        subtitle="Métricas para saber qué comprar, qué vende y qué te genera dinero"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`text-sm !min-h-0 !py-2 ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="Ventas hoy" value={formatMoney(data.ventas_hoy)} amount={data.ventas_hoy} />
            <StatCard label="Ventas del mes" value={formatMoney(data.ventas_mes)} amount={data.ventas_mes} />
            <StatCard
              label="Utilidad bruta mes"
              value={<Money value={data.utilidad_bruta_mes} signed />}
              amount={data.utilidad_bruta_mes}
            />
            <StatCard
              label="Utilidad neta mes"
              value={<Money value={data.utilidad_neta_mes} signed />}
              amount={data.utilidad_neta_mes}
            />
            <StatCard
              label="Dinero esperado (banco)"
              value={<Money value={data.efectivo?.dinero_esperado_banco ?? data.dinero_caja} signed />}
              amount={data.efectivo?.dinero_esperado_banco ?? data.dinero_caja}
              hint="Lo que deberías tener en efectivo"
            />
            <StatCard label="Capital en inventario" value={formatMoney(data.valor_inventario)} hint="Dinero trabado en stock" />
            <StatCard label="Autos vendidos (mes)" value={data.autos_vendidos_mes} />
            <StatCard
              label="Margen promedio"
              value={<Money value={data.margen_promedio} percent signed />}
              amount={data.margen_promedio}
            />
            <StatCard label="Ticket promedio" value={formatMoney(data.ticket_promedio)} />
            <StatCard
              label="Días promedio a vender"
              value={data.dias_promedio_venta != null ? `${data.dias_promedio_venta} días` : '—'}
              hint="Desde ingreso a inventario hasta venta"
            />
            <StatCard label="Gastos del mes" value={formatMoney(data.gastos_mes)} negative />
            <StatCard
              label="Utilidad histórica"
              value={<Money value={data.utilidad_historica} signed />}
              amount={data.utilidad_historica}
            />
            <StatCard
              label="ROI del mes"
              value={<Money value={data.roi_mensual?.mes_actual?.roi_sobre_inversion} percent signed />}
              amount={data.roi_mensual?.mes_actual?.roi_sobre_inversion}
              hint="Utilidad neta / capital invertido"
            />
            <StatCard
              label="Proyección ventas mes"
              value={formatMoney(data.predicciones?.proyeccion_cierre_mes?.ventas)}
              hint={`Tendencia: ${data.predicciones?.interpretacion || '—'}`}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="stat-label">Proveedores a seguir</p>
              <p className="text-3xl font-bold text-emerald-400">{data.resumen_decisiones?.proveedores_seguir ?? 0}</p>
            </div>
            <div className="card">
              <p className="stat-label">Proveedores a revisar</p>
              <p className="text-3xl font-bold text-red-400">{data.resumen_decisiones?.proveedores_revisar ?? 0}</p>
            </div>
            <div className="card">
              <p className="stat-label">Cajas que ya recuperaron costo</p>
              <p className="text-3xl font-bold text-[#ffcc00]">
                {data.resumen_decisiones?.cajas_recuperadas ?? 0}
                <span className="text-sm text-gray-400 font-normal"> / {(data.cajas_todas || []).length}</span>
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Section title="Top productos del mes" subtitle="Por cantidad vendida">
              {(data.top_productos || []).length === 0 ? (
                <p className="text-gray-400 text-sm">Sin ventas</p>
              ) : (
                <table>
                  <thead>
                    <tr><th>Producto</th><th>Cant.</th><th>Ingresos</th><th>Utilidad</th></tr>
                  </thead>
                  <tbody>
                    {data.top_productos.map((p, i) => (
                      <tr key={i}>
                        <td>{p.producto_nombre}</td>
                        <td>{p.total_vendido}</td>
                        <td>{formatMoney(p.ingresos)}</td>
                        <td><Money value={p.utilidad} signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="Stock crítico / estancado" subtitle="Más días en inventario y poca venta">
              {(data.stock_critico || []).length === 0 ? (
                <p className="text-gray-400 text-sm">Sin stock</p>
              ) : (
                <table>
                  <thead>
                    <tr><th>Producto</th><th>Días</th><th>Stock</th><th>Proveedor</th></tr>
                  </thead>
                  <tbody>
                    {data.stock_critico.slice(0, 8).map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>{p.dias_en_stock}</td>
                        <td>{p.cantidad}</td>
                        <td>{p.proveedor_nombre || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>
        </>
      )}

      {tab === 'roi' && (() => {
        const r = data.roi_mensual?.mes_actual || {};
        const hist = data.roi_mensual?.historico || [];
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="ROI sobre inversión"
                value={<Money value={r.roi_sobre_inversion} percent signed />}
                amount={r.roi_sobre_inversion}
                hint="Principal del mes"
              />
              <StatCard
                label="ROI sobre inventario"
                value={<Money value={r.roi_sobre_inventario} percent signed />}
                amount={r.roi_sobre_inventario}
              />
              <StatCard
                label="ROI sobre ventas"
                value={<Money value={r.roi_sobre_ventas} percent signed />}
                amount={r.roi_sobre_ventas}
              />
              <StatCard
                label="Utilidad neta mes"
                value={<Money value={r.utilidad_neta} signed />}
                amount={r.utilidad_neta}
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard label="Compras del mes" value={formatMoney(r.compras_del_mes)} />
              <StatCard label="Reinversiones (caja)" value={formatMoney(r.reinversiones)} negative />
              <StatCard label="Capital usado en ROI" value={formatMoney(r.capital_usado)} hint="Base del cálculo" />
            </div>
            <Section title="Cómo se calcula" subtitle={r.formula}>
              <p className="text-sm text-gray-400">
                Si este mes no hubo compras, se usa el valor del inventario o el costo de lo vendido como base.
              </p>
            </Section>
            <Section title="ROI histórico (últimos meses)" subtitle="Utilidad neta / capital del mes">
              {hist.length === 0 ? (
                <p className="text-sm text-gray-400">Sin histórico aún</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Ventas</th>
                        <th>Utilidad neta</th>
                        <th>Capital</th>
                        <th>ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist.map((h) => (
                        <tr key={h.periodo}>
                          <td>{h.periodo}</td>
                          <td>{formatMoney(h.ventas)}</td>
                          <td><Money value={h.utilidad_neta} signed /></td>
                          <td>{formatMoney(h.capital_invertido)}</td>
                          <td><Money value={h.roi} percent signed /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        );
      })()}

      {tab === 'predicciones' && (() => {
        const p = data.predicciones || {};
        const cierre = p.proyeccion_cierre_mes || {};
        const prox = p.proximos_7_dias || {};
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Tendencia"
                value={p.interpretacion || '—'}
                hint={p.tendencia_pct != null ? `${Number(p.tendencia_pct).toFixed(1)}% vs quincena anterior` : ''}
              />
              <StatCard label="Días restantes del mes" value={p.dias_restantes_mes ?? '—'} />
              <StatCard label="Promedio diario ventas" value={formatMoney(p.promedio_diario_ventas)} />
              <StatCard label="Promedio diario utilidad" value={<Money value={p.promedio_diario_utilidad} signed />} amount={p.promedio_diario_utilidad} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Section title="Proyección cierre de mes" subtitle="Lo actual + proyección de días restantes">
                <div className="grid grid-cols-1 gap-3">
                  <StatCard label="Ventas proyectadas" value={formatMoney(cierre.ventas)} amount={cierre.ventas} />
                  <StatCard label="Utilidad neta proyectada" value={<Money value={cierre.utilidad_neta} signed />} amount={cierre.utilidad_neta} />
                  <StatCard label="Autos proyectados" value={Number(cierre.autos || 0).toFixed(0)} />
                </div>
              </Section>
              <Section title="Próximos 7 días" subtitle="Estimación a ritmo actual">
                <div className="grid grid-cols-1 gap-3">
                  <StatCard label="Ventas estimadas" value={formatMoney(prox.ventas)} amount={prox.ventas} />
                  <StatCard label="Utilidad estimada" value={<Money value={prox.utilidad} signed />} amount={prox.utilidad} />
                  <StatCard label="Tickets estimados" value={Number(prox.tickets || 0).toFixed(1)} />
                </div>
              </Section>
            </div>
            <p className="text-xs text-gray-500">{p.nota}</p>
          </div>
        );
      })()}

      {tab === 'banco' && (() => {
        const e = data.efectivo || {};
        const d = e.desglose || {};
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="card border-[#ffcc00]/40">
              <p className="stat-label">Dinero que deberías tener en el banco / caja</p>
              <p className="text-4xl sm:text-5xl font-bold mt-2">
                <Money value={e.dinero_esperado_banco} signed />
              </p>
              <p className="text-sm text-gray-400 mt-3">
                Fórmula: <span className="text-gray-300">{e.formula}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Patrimonio aproximado (banco + inventario):{' '}
                <strong><Money value={e.patrimonio_aproximado} signed /></strong>
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <StatCard label="(+) Ventas" value={formatMoney(d.ventas)} amount={d.ventas} />
              <StatCard label="(+) Inversión externa (caja)" value={formatMoney(d.inversiones_externas)} amount={d.inversiones_externas} hint="Capital nuevo registrado en Caja" />
              <StatCard label="(−) Reinversiones" value={formatMoney(d.reinversiones_compras)} negative hint="Compras pagadas con plata de la caja" />
              <StatCard label="Compras externas" value={formatMoney(d.compras_externas)} hint="Pagadas afuera: no restan del banco" />
              <StatCard label="(−) Gastos" value={formatMoney(d.gastos)} negative />
              <StatCard label="(−) Retiros personales" value={formatMoney(d.retiros_personales)} negative />
              <StatCard label="Capital en inventario" value={formatMoney(e.valor_inventario)} hint="No es efectivo, es stock" />
              <StatCard
                label="Patrimonio aprox."
                value={<Money value={e.patrimonio_aproximado} signed />}
                amount={e.patrimonio_aproximado}
                hint="Banco + inventario"
              />
            </div>

            <Section title="Cómo leerlo" subtitle="Para no confundir utilidad con efectivo">
              <ul className="space-y-2 text-sm text-gray-300">
                {(e.explicacion || []).map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[#ffcc00]">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <Section title="Histórico mensual" subtitle="Entradas vs salidas por mes">
                {(e.por_mes || []).length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin movimientos aún</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th>Entradas</th>
                          <th>Salidas</th>
                          <th>Reinversión</th>
                          <th>Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.por_mes.map((m) => (
                          <tr key={m.periodo}>
                            <td>{m.periodo}</td>
                            <td className="text-emerald-400">{formatMoney(m.entradas)}</td>
                            <td className="text-red-400">{formatMoney(m.salidas)}</td>
                            <td>{formatMoney(m.reinversiones)}</td>
                            <td><Money value={m.neto} signed /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="Últimos movimientos" subtitle="Historial reciente de efectivo">
                {(e.historico || []).length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin movimientos</p>
                ) : (
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
                        {e.historico.slice(0, 15).map((m, i) => {
                          const entrada = m.tipo === 'entrada_venta' || m.tipo === 'inversion';
                          const tipoTxt = {
                            entrada_venta: 'Venta',
                            inversion: 'Inversión externa',
                            salida_compra: 'Reinversión',
                            salida_gasto: 'Gasto',
                            retiro_personal: 'Retiro',
                            ajuste: 'Ajuste',
                          }[m.tipo] || m.tipo;
                          return (
                            <tr key={i}>
                              <td>{String(m.fecha).slice(0, 10)}</td>
                              <td>{tipoTxt}</td>
                              <td className="max-w-[160px] truncate">{m.descripcion || '-'}</td>
                              <td className={entrada ? 'text-emerald-400' : 'text-red-400'}>
                                {entrada ? '+' : '−'}{formatMoney(m.monto)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>
          </div>
        );
      })()}

      {tab === 'graficos' && <DashboardCharts graficos={data.graficos} />}

      {tab === 'clientes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="card">
              <p className="stat-label">Clientes activos</p>
              <p className="text-2xl font-bold">{data.clientes?.resumen?.activos ?? 0}</p>
            </div>
            <div className="card">
              <p className="stat-label">Recurrentes</p>
              <p className="text-2xl font-bold text-[#ffcc00]">{data.clientes?.resumen?.compradores_recurrentes ?? 0}</p>
            </div>
            <div className="card">
              <p className="stat-label">Con pérdida</p>
              <p className="text-2xl font-bold text-red-400">{data.clientes?.resumen?.con_perdida ?? 0}</p>
            </div>
            <div className="card">
              <p className="stat-label">Unidades vendidas</p>
              <p className="text-2xl font-bold">{data.clientes?.resumen?.unidades_totales ?? 0}</p>
            </div>
            <div className="card">
              <p className="stat-label">Más se lleva</p>
              <p className="text-sm font-semibold mt-1 truncate">
                {data.clientes?.resumen?.cliente_mas_unidades?.nombre || '—'}
              </p>
              <p className="text-xs text-gray-400">
                {data.clientes?.resumen?.cliente_mas_unidades
                  ? `${data.clientes.resumen.cliente_mas_unidades.unidades} und.`
                  : ''}
              </p>
            </div>
            <div className="card">
              <p className="stat-label">Peor utilidad</p>
              <p className="text-sm font-semibold mt-1 truncate">
                {data.clientes?.resumen?.cliente_peor?.nombre || '—'}
              </p>
              <p className="text-xs">
                {data.clientes?.resumen?.cliente_peor
                  ? <Money value={data.clientes.resumen.cliente_peor.utilidad} signed />
                  : null}
              </p>
            </div>
          </div>

          <div className="card">
            <input
              placeholder="Buscar cliente en todas las tablas..."
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Section title="Top clientes por compra" subtitle="Los que más dinero compran">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Und.</th><th>Total</th><th>Ticket</th></tr></thead>
                  <tbody>
                    {clientesTopCompras.map((c, i) => (
                      <tr key={`tc-${c.cliente_id}-${i}`}>
                        <td>{c.cliente_nombre}</td>
                        <td>{c.unidades}</td>
                        <td>{formatMoney(c.total_comprado)}</td>
                        <td>{formatMoney(c.ticket_promedio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Top por utilidad" subtitle="Los que más ganancia dejan">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Utilidad</th><th>Und.</th><th>Margen</th></tr></thead>
                  <tbody>
                    {clientesTopUtilidad.map((c, i) => (
                      <tr key={`tu-${c.cliente_id}-${i}`}>
                        <td>{c.cliente_nombre}</td>
                        <td><Money value={c.utilidad_total} signed /></td>
                        <td>{c.unidades}</td>
                        <td><Money value={c.margen_promedio} percent signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Quién más se lleva" subtitle="Clientes con más unidades compradas">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Und.</th><th>Und/compra</th><th>Total</th></tr></thead>
                  <tbody>
                    {clientesTopUnidades.map((c, i) => (
                      <tr key={`un-${c.cliente_id}-${i}`}>
                        <td>{c.cliente_nombre}</td>
                        <td className="font-semibold text-[#ffcc00]">{c.unidades}</td>
                        <td>{Number(c.unidades_por_compra || 0).toFixed(1)}</td>
                        <td>{formatMoney(c.total_comprado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Section title="Peores por utilidad" subtitle="Pérdidas o menor ganancia total">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Utilidad</th><th>Und.</th><th>Alerta</th></tr></thead>
                  <tbody>
                    {clientesPeoresUtilidad.map((c, i) => (
                      <tr key={`pu-${c.cliente_id}-${i}`}>
                        <td>{c.cliente_nombre}</td>
                        <td><Money value={c.utilidad_total} signed /></td>
                        <td>{c.unidades}</td>
                        <td>
                          {c.alerta
                            ? <span className="badge bg-red-500/15 text-red-300">{c.alerta}</span>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Peores por margen" subtitle="Pagan poco vs. el costo">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Margen</th><th>Utilidad</th><th>Total</th></tr></thead>
                  <tbody>
                    {clientesPeoresMargen.map((c, i) => (
                      <tr key={`pm-${c.cliente_id}-${i}`}>
                        <td>{c.cliente_nombre}</td>
                        <td><Money value={c.margen_promedio} percent signed /></td>
                        <td><Money value={c.utilidad_total} signed /></td>
                        <td>{formatMoney(c.total_comprado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Compran más barato" subtitle="Menor precio promedio por unidad">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Bs/und</th><th>Und.</th><th>Utilidad</th></tr></thead>
                  <tbody>
                    {clientesCompranBarato.map((c, i) => (
                      <tr key={`cb-${c.cliente_id}-${i}`}>
                        <td>{c.cliente_nombre}</td>
                        <td>{formatMoney(c.precio_promedio_unidad)}</td>
                        <td>{c.unidades}</td>
                        <td><Money value={c.utilidad_total} signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <Section title="Mejor margen por cliente" subtitle="Solo clientes con 2+ compras">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Compras</th>
                    <th>Und.</th>
                    <th>Margen</th>
                    <th>Utilidad</th>
                    <th>Bs/und</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesMejorMargen.map((c, i) => (
                    <tr key={`mm-${c.cliente_id}-${i}`}>
                      <td>{c.cliente_nombre}</td>
                      <td>{c.num_compras}</td>
                      <td>{c.unidades}</td>
                      <td><Money value={c.margen_promedio} percent signed /></td>
                      <td><Money value={c.utilidad_total} signed /></td>
                      <td>{formatMoney(c.precio_promedio_unidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {tab === 'cajas' && (
        <Section
          title="Rentabilidad por caja"
          subtitle="Cuánto generó cada caja: costo vs ventas de los autos que salieron de ella"
        >
          {(data.cajas_todas || []).length === 0 ? (
            <p className="text-gray-400 text-sm">Aún no hay cajas abiertas con ventas asociadas. Abre cajas desde Inventario y vende esos autos.</p>
          ) : (
            <>
              <div className="mb-4">
                <input
                  placeholder="Buscar caja, código o proveedor..."
                  value={buscaCaja}
                  onChange={(e) => setBuscaCaja(e.target.value)}
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Caja</th>
                      <th>Proveedor</th>
                      <th>Costo caja</th>
                      <th>Autos</th>
                      <th>Vendidos</th>
                      <th>% vendido</th>
                      <th>Ingresos</th>
                      <th>Utilidad</th>
                      <th>Margen</th>
                      <th>ROI</th>
                      <th>Días prom.</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajasPager.pageItems.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="font-medium">{c.nombre}</div>
                          <div className="text-xs text-gray-400">{c.codigo_interno}</div>
                        </td>
                        <td>{c.proveedor_nombre || '-'}</td>
                        <td>{formatMoney(c.costo_caja)}</td>
                        <td>{c.autos_totales}</td>
                        <td>{c.unidades_vendidas}</td>
                        <td>{Number(c.pct_vendido || 0).toFixed(0)}%</td>
                        <td>{formatMoney(c.ingresos)}</td>
                        <td><Money value={c.utilidad} signed /></td>
                        <td><Money value={c.margen} percent signed /></td>
                        <td><Money value={c.roi} percent signed /></td>
                        <td>{c.dias_promedio_venta != null ? `${c.dias_promedio_venta}d` : '—'}</td>
                        <td>
                          {c.recuperado
                            ? <span className="badge bg-emerald-500/15 text-emerald-300">Recuperó costo</span>
                            : <span className="badge bg-[#ffcc00]/20 text-[#ffcc00]">En proceso</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...cajasPager} />
            </>
          )}
        </Section>
      )}

      {tab === 'proveedores' && (
        <Section
          title="Rentabilidad por proveedor"
          subtitle="Para decidir si seguir comprando: utilidad, margen, ROI y velocidad de venta"
        >
          {(data.proveedores || []).length === 0 ? (
            <p className="text-gray-400 text-sm">Sin datos de proveedores aún</p>
          ) : (
            <>
              <div className="mb-4">
                <input
                  placeholder="Buscar proveedor..."
                  value={buscaProveedor}
                  onChange={(e) => setBuscaProveedor(e.target.value)}
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Comprado</th>
                      <th>Stock $</th>
                      <th>Vendidos</th>
                      <th>Ingresos</th>
                      <th>Utilidad</th>
                      <th>Margen</th>
                      <th>ROI</th>
                      <th>Días a vender</th>
                      <th>Decisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provPager.pageItems.map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium">{p.proveedor}</td>
                        <td>{formatMoney(p.total_comprado)}</td>
                        <td>{formatMoney(p.valor_stock)}</td>
                        <td>{p.unidades_vendidas}</td>
                        <td>{formatMoney(p.ingresos)}</td>
                        <td><Money value={p.utilidad} signed /></td>
                        <td><Money value={p.margen} percent signed /></td>
                        <td><Money value={p.roi} percent signed /></td>
                        <td>{p.dias_promedio_venta != null ? `${p.dias_promedio_venta} días` : '—'}</td>
                        <td><BadgeRec rec={p.recomendacion} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...provPager} />
            </>
          )}
        </Section>
      )}

      {tab === 'velocidad' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Section title="Velocidad general" subtitle="Tiempo desde que entra al inventario hasta que se vende">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatCard label="Promedio" value={data.velocidad?.dias_promedio != null ? `${data.velocidad.dias_promedio}d` : '—'} />
              <StatCard label="Más rápido" value={data.velocidad?.dias_min != null ? `${data.velocidad.dias_min}d` : '—'} positive />
              <StatCard label="Más lento" value={data.velocidad?.dias_max != null ? `${data.velocidad.dias_max}d` : '—'} negative />
            </div>
            <h4 className="text-sm font-medium mb-2">Por canal</h4>
            <table>
              <thead><tr><th>Canal</th><th>Ventas</th><th>Total</th><th>Utilidad</th></tr></thead>
              <tbody>
                {(data.velocidad?.por_canal || []).map((c, i) => (
                  <tr key={i}>
                    <td>{c.canal}</td>
                    <td>{c.ventas}</td>
                    <td>{formatMoney(c.total)}</td>
                    <td><Money value={c.utilidad} signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Qué se vende más rápido / lento">
            <h4 className="text-sm font-medium mb-2 text-emerald-400">Más rápidos</h4>
            <table className="mb-4">
              <thead><tr><th>Producto</th><th>Días</th><th>Vendidos</th></tr></thead>
              <tbody>
                {(data.velocidad?.mas_rapidos || []).map((p, i) => (
                  <tr key={i}>
                    <td>{p.producto_nombre}</td>
                    <td>{p.dias ?? '—'}d</td>
                    <td>{p.vendidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4 className="text-sm font-medium mb-2 text-red-400">Más lentos</h4>
            <table>
              <thead><tr><th>Producto</th><th>Días</th><th>Vendidos</th></tr></thead>
              <tbody>
                {(data.velocidad?.mas_lentos || []).map((p, i) => (
                  <tr key={i}>
                    <td>{p.producto_nombre}</td>
                    <td>{p.dias ?? '—'}d</td>
                    <td>{p.vendidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      )}

      {tab === 'productos' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Section title="Productos más rentables" subtitle="Mayor utilidad total">
            <table>
              <thead><tr><th>Producto</th><th>Vend.</th><th>Utilidad</th><th>Margen</th></tr></thead>
              <tbody>
                {(data.productos_mejores || []).map((p, i) => (
                  <tr key={i}>
                    <td>{p.producto_nombre}</td>
                    <td>{p.vendidos}</td>
                    <td><Money value={p.utilidad} signed /></td>
                    <td><Money value={p.margen} percent signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="Productos menos rentables" subtitle="Candidatos a bajar de precio o no reponer">
            <table>
              <thead><tr><th>Producto</th><th>Vend.</th><th>Utilidad</th><th>Margen</th></tr></thead>
              <tbody>
                {(data.productos_peores || []).map((p, i) => (
                  <tr key={i}>
                    <td>{p.producto_nombre}</td>
                    <td>{p.vendidos}</td>
                    <td><Money value={p.utilidad} signed /></td>
                    <td><Money value={p.margen} percent signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      )}

      {tab === 'lives' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Lives" value={data.lives_resumen?.cantidad ?? 0} />
            <StatCard label="Ventas en lives" value={formatMoney(data.lives_resumen?.ventas)} amount={data.lives_resumen?.ventas} />
            <StatCard
              label="Utilidad lives"
              value={<Money value={data.lives_resumen?.utilidad} signed />}
              amount={data.lives_resumen?.utilidad}
            />
            <StatCard label="Autos en lives" value={data.lives_resumen?.autos ?? 0} />
          </div>
          <Section title="Lives más rentables" subtitle="Detalle completo en el módulo Lives TikTok">
            {(data.lives_rentables || []).length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay lives. Créalos en el menú Lives TikTok.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Título</th>
                      <th>Autos</th>
                      <th>Ventas</th>
                      <th>Utilidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lives_rentables.map((l) => (
                      <tr key={l.id}>
                        <td>{String(l.fecha).slice(0, 10)}</td>
                        <td>{l.titulo || `Live #${l.id}`}</td>
                        <td>{l.autos_vendidos}</td>
                        <td>{formatMoney(l.ventas_totales)}</td>
                        <td><Money value={l.utilidad_neta} signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

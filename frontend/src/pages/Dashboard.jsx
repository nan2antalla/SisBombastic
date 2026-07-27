import { useEffect, useState } from 'react';
import { api, formatMoney } from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import DashboardCharts from '../components/DashboardCharts';
import { usePagination } from '../hooks/usePagination';

function StatCard({ label, value, positive, negative, hint }) {
  const cls = positive ? 'positive' : negative ? 'negative' : '';
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${cls}`}>{value}</span>
      {hint && <span className="text-xs text-gray-400 mt-1">{hint}</span>}
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

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cajasPager = usePagination(data?.cajas_todas || [], 10);
  const provPager = usePagination(data?.proveedores || [], 10);

  if (loading) return <p className="text-gray-500">Cargando métricas de decisión...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return <p className="text-red-500">Error al cargar datos</p>;

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'banco', label: 'Dinero / Banco' },
    { id: 'graficos', label: 'Gráficos' },
    { id: 'cajas', label: 'Por caja' },
    { id: 'proveedores', label: 'Proveedores' },
    { id: 'velocidad', label: 'Velocidad de venta' },
    { id: 'productos', label: 'Productos' },
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
            <StatCard label="Ventas hoy" value={formatMoney(data.ventas_hoy)} />
            <StatCard label="Ventas del mes" value={formatMoney(data.ventas_mes)} />
            <StatCard label="Utilidad bruta mes" value={formatMoney(data.utilidad_bruta_mes)} positive />
            <StatCard
              label="Utilidad neta mes"
              value={formatMoney(data.utilidad_neta_mes)}
              positive={data.utilidad_neta_mes >= 0}
              negative={data.utilidad_neta_mes < 0}
            />
            <StatCard label="Dinero esperado (banco)" value={formatMoney(data.efectivo?.dinero_esperado_banco ?? data.dinero_caja)} hint="Lo que deberías tener en efectivo" />
            <StatCard label="Capital en inventario" value={formatMoney(data.valor_inventario)} hint="Dinero trabado en stock" />
            <StatCard label="Autos vendidos (mes)" value={data.autos_vendidos_mes} />
            <StatCard label="Margen promedio" value={`${Number(data.margen_promedio || 0).toFixed(1)}%`} positive />
            <StatCard label="Ticket promedio" value={formatMoney(data.ticket_promedio)} />
            <StatCard
              label="Días promedio a vender"
              value={data.dias_promedio_venta != null ? `${data.dias_promedio_venta} días` : '—'}
              hint="Desde ingreso a inventario hasta venta"
            />
            <StatCard label="Gastos del mes" value={formatMoney(data.gastos_mes)} negative />
            <StatCard label="Utilidad histórica" value={formatMoney(data.utilidad_historica)} positive />
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
                        <td className="text-emerald-400">{formatMoney(p.utilidad)}</td>
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

      {tab === 'banco' && (() => {
        const e = data.efectivo || {};
        const d = e.desglose || {};
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="card border-[#ffcc00]/40">
              <p className="stat-label">Dinero que deberías tener en el banco / caja</p>
              <p className={`text-4xl sm:text-5xl font-bold mt-2 ${Number(e.dinero_esperado_banco) >= 0 ? 'text-[#ffcc00]' : 'text-red-400'}`}>
                {formatMoney(e.dinero_esperado_banco)}
              </p>
              <p className="text-sm text-gray-400 mt-3">
                Fórmula: <span className="text-gray-300">{e.formula}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Patrimonio aproximado (banco + inventario): <strong className="text-white">{formatMoney(e.patrimonio_aproximado)}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <StatCard label="(+) Ventas" value={formatMoney(d.ventas)} positive />
              <StatCard label="(+) Inversión externa" value={formatMoney(d.inversiones_externas)} hint="Capital nuevo que metiste" />
              <StatCard label="(−) Reinversiones" value={formatMoney(d.reinversiones_compras)} negative hint="Compras pagadas con plata de la caja" />
              <StatCard label="(−) Gastos" value={formatMoney(d.gastos)} negative />
              <StatCard label="(−) Retiros personales" value={formatMoney(d.retiros_personales)} negative />
              <StatCard label="Capital en inventario" value={formatMoney(e.valor_inventario)} hint="No es efectivo, es stock" />
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
                            <td className={m.neto >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatMoney(m.neto)}</td>
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

      {tab === 'cajas' && (
        <Section
          title="Rentabilidad por caja"
          subtitle="Cuánto generó cada caja: costo vs ventas de los autos que salieron de ella"
        >
          {(data.cajas_todas || []).length === 0 ? (
            <p className="text-gray-400 text-sm">Aún no hay cajas abiertas con ventas asociadas. Abre cajas desde Inventario y vende esos autos.</p>
          ) : (
            <>
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
                        <td className={c.utilidad >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatMoney(c.utilidad)}</td>
                        <td>{Number(c.margen || 0).toFixed(1)}%</td>
                        <td>{Number(c.roi || 0).toFixed(1)}%</td>
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
                        <td className={p.utilidad >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatMoney(p.utilidad)}</td>
                        <td>{Number(p.margen || 0).toFixed(1)}%</td>
                        <td>{Number(p.roi || 0).toFixed(1)}%</td>
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
                    <td className="text-emerald-400">{formatMoney(c.utilidad)}</td>
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
                    <td className="text-emerald-400">{formatMoney(p.utilidad)}</td>
                    <td>{Number(p.margen || 0).toFixed(1)}%</td>
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
                    <td className={Number(p.utilidad) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatMoney(p.utilidad)}</td>
                    <td>{Number(p.margen || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      )}
    </div>
  );
}

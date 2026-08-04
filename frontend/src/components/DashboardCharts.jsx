import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatMoney } from '../api/client';
import { labelOf, CATEGORIAS_GASTO, CANALES, METODOS_PAGO } from '../utils/constants';

const BRAND = '#ffcc00';
const GREEN = '#86efac';
const RED = '#fca5a5';
const GRAY = '#6b7280';
const COLORS = ['#ffcc00', '#86efac', '#60a5fa', '#c084fc', '#f97316', '#f472b6', '#34d399', '#fbbf24'];

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="card">
      <div className="mb-3">
        <h3 className="font-semibold text-[#ffcc00]">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {empty ? (
        <p className="text-gray-500 text-sm py-10 text-center">Sin datos aún</p>
      ) : (
        <div className="h-64 sm:h-72 w-full">{children}</div>
      )}
    </div>
  );
}

function moneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => {
        const metrica = payload[0]?.payload?.metrica;
        const isUnitMetric = metrica === 'Autos caja' || metrica === 'Otros ítems';
        const isCount = ['vendidos', 'cantidad', 'ventas_count', 'autos', 'otros_items'].includes(p.dataKey)
          || (isUnitMetric && (p.dataKey === 'actual' || p.dataKey === 'anterior'));
        const neg = !isCount && Number(p.value) < 0;
        return (
          <p key={p.dataKey} style={{ color: neg ? RED : (p.color || BRAND) }}>
            {p.name}: {isCount ? p.value : formatMoney(p.value)}
            {neg ? ' (pérdida)' : ''}
          </p>
        );
      })}
    </div>
  );
}

function shortDate(fecha) {
  if (!fecha) return '';
  const s = String(fecha).slice(5, 10);
  return s;
}

export default function DashboardCharts({ graficos, periodo }) {
  const g = graficos || {};
  const ventasDia = (g.ventas_por_dia || []).map((r) => ({
    ...r,
    label: shortDate(r.fecha),
  }));
  const ventasDiaPrev = (g.ventas_por_dia_anterior || []).map((r) => ({
    ...r,
    label: shortDate(r.fecha),
  }));
  const comparativoMeses = (g.comparativo_meses || []).map((r) => ({
    ...r,
    label: r.label || r.periodo,
  }));
  const mesVsAnt = g.mes_vs_anterior || {};
  const comparativoBarras = mesVsAnt.actual ? [
    {
      metrica: 'Ventas',
      actual: mesVsAnt.actual.ventas,
      anterior: mesVsAnt.anterior?.ventas,
    },
    {
      metrica: 'Utilidad',
      actual: mesVsAnt.actual.utilidad,
      anterior: mesVsAnt.anterior?.utilidad,
    },
    {
      metrica: 'Autos caja',
      actual: mesVsAnt.actual.autos,
      anterior: mesVsAnt.anterior?.autos,
    },
    {
      metrica: 'Otros ítems',
      actual: mesVsAnt.actual.otros,
      anterior: mesVsAnt.anterior?.otros,
    },
  ] : [];
  const topProductos = (g.top_productos || []).map((r) => ({
    ...r,
    nombreCorto: (r.nombre || '').length > 18 ? `${(r.nombre || '').slice(0, 16)}…` : r.nombre,
  }));
  const gastosCat = (g.gastos_por_categoria || []).map((r) => ({
    ...r,
    label: labelOf(CATEGORIAS_GASTO, r.categoria),
  }));
  const porCanal = (g.por_canal || []).map((r) => ({
    ...r,
    label: labelOf(CANALES, r.canal) || r.canal,
  }));
  const porPago = (g.por_pago || []).map((r) => ({
    ...r,
    label: labelOf(METODOS_PAGO, r.metodo) || r.metodo,
  }));
  const proveedores = (g.proveedores || []).map((r) => ({
    ...r,
    nombreCorto: (r.proveedor || '').length > 14 ? `${(r.proveedor || '').slice(0, 12)}…` : r.proveedor,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard
          title={`Mes vs mes anterior`}
          subtitle={`${mesVsAnt.actual?.label || periodo?.label || 'Actual'} vs ${mesVsAnt.anterior?.label || 'anterior'}`}
          empty={comparativoBarras.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparativoBarras} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="metrica" tick={{ fill: GRAY, fontSize: 11 }} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} width={50} />
              <Tooltip content={moneyTooltip} />
              <Legend />
              <Bar dataKey="actual" name="Mes seleccionado" fill={BRAND} radius={[4, 4, 0, 0]} />
              <Bar dataKey="anterior" name="Mes anterior" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Evolución últimos 6 meses"
          subtitle="Ventas con inventario vs utilidad"
          empty={comparativoMeses.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparativoMeses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="label" tick={{ fill: GRAY, fontSize: 10 }} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} width={50} />
              <Tooltip content={moneyTooltip} />
              <Legend />
              <Bar dataKey="ventas_inventario" name="Ventas inv." fill={BRAND} radius={[4, 4, 0, 0]} />
              <Bar dataKey="utilidad_inventario" name="Utilidad" radius={[4, 4, 0, 0]}>
                {comparativoMeses.map((p, i) => (
                  <Cell key={i} fill={Number(p.utilidad_inventario) >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Unidades por mes"
          subtitle="Autos de caja vs otros ítems"
          empty={comparativoMeses.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparativoMeses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="label" tick={{ fill: GRAY, fontSize: 10 }} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} width={40} />
              <Tooltip content={moneyTooltip} />
              <Legend />
              <Bar dataKey="autos" name="Autos caja" fill={BRAND} stackId="u" />
              <Bar dataKey="otros_items" name="Otros ítems" fill="#60a5fa" stackId="u" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard
          title={`Ventas diarias — ${periodo?.label || 'mes seleccionado'}`}
          subtitle="Solo inventario con costo (sin manuales)"
          empty={ventasDia.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ventasDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillUtil" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="label" tick={{ fill: GRAY, fontSize: 11 }} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} width={50} />
              <Tooltip content={moneyTooltip} />
              <Legend />
              <Area type="monotone" dataKey="ventas" name="Ventas" stroke={BRAND} fill="url(#fillVentas)" strokeWidth={2} />
              <Area type="monotone" dataKey="utilidad" name="Utilidad" stroke={GREEN} fill="url(#fillUtil)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`Mes anterior — ${mesVsAnt.anterior?.label || 'comparación'}`}
          subtitle="Misma métrica, período previo"
          empty={ventasDiaPrev.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ventasDiaPrev} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillVentasPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="label" tick={{ fill: GRAY, fontSize: 11 }} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} width={50} />
              <Tooltip content={moneyTooltip} />
              <Legend />
              <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#60a5fa" fill="url(#fillVentasPrev)" strokeWidth={2} />
              <Area type="monotone" dataKey="utilidad" name="Utilidad" stroke={GREEN} fill="url(#fillUtil)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top productos del mes"
          subtitle="Por cantidad vendida"
          empty={topProductos.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProductos} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis type="number" tick={{ fill: GRAY, fontSize: 11 }} />
              <YAxis type="category" dataKey="nombreCorto" width={90} tick={{ fill: GRAY, fontSize: 10 }} />
              <Tooltip content={moneyTooltip} />
              <Bar dataKey="vendidos" name="Vendidos" fill={BRAND} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Gastos por categoría"
          subtitle="Mes actual"
          empty={gastosCat.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gastosCat}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={48}
                paddingAngle={2}
              >
                {gastosCat.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={moneyTooltip} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Ventas por canal"
          subtitle="Histórico"
          empty={porCanal.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porCanal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="label" tick={{ fill: GRAY, fontSize: 11 }} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} width={50} />
              <Tooltip content={moneyTooltip} />
              <Legend />
              <Bar dataKey="total" name="Ingresos" fill={BRAND} radius={[4, 4, 0, 0]} />
              <Bar dataKey="utilidad" name="Utilidad" radius={[4, 4, 0, 0]}>
                {porCanal.map((p, i) => (
                  <Cell key={i} fill={Number(p.utilidad) >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Métodos de pago"
          subtitle="Distribución de ingresos"
          empty={porPago.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={porPago}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={90}
              >
                {porPago.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={moneyTooltip} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Utilidad por proveedor"
          subtitle="Top proveedores"
          empty={proveedores.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={proveedores} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="nombreCorto" tick={{ fill: GRAY, fontSize: 10 }} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} width={50} />
              <Tooltip content={moneyTooltip} />
              <Bar dataKey="utilidad" name="Utilidad" radius={[4, 4, 0, 0]}>
                {proveedores.map((p, i) => (
                  <Cell key={i} fill={Number(p.utilidad) >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

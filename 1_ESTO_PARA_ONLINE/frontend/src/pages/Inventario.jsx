import { useEffect, useMemo, useState } from 'react';
import { api, formatMoney, hoy } from '../api/client';
import { CATEGORIAS, ESTADOS_INVENTARIO, TIPOS_ITEM, labelOf, badgeClass } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

const emptyForm = {
  nombre: '',
  categoria: 'mainline',
  tipo_item: 'auto_individual',
  serie: '',
  anio: '',
  case_code: '',
  cantidad: 1,
  costo_unitario: '',
  precio_sugerido: '',
  estado: 'disponible',
  ubicacion: '',
  fecha_ingreso: hoy(),
  proveedor_nombre: '',
  notas: '',
};

function itemToForm(item) {
  return {
    nombre: item.nombre || '',
    categoria: item.categoria || 'mainline',
    tipo_item: item.tipo_item || 'auto_individual',
    serie: item.serie || '',
    anio: item.anio || '',
    case_code: item.case_code || '',
    cantidad: item.cantidad ?? 1,
    costo_unitario: item.costo_unitario ?? '',
    precio_sugerido: item.precio_sugerido ?? '',
    estado: item.estado || 'disponible',
    ubicacion: item.ubicacion || '',
    fecha_ingreso: item.fecha_ingreso || hoy(),
    proveedor_nombre: item.proveedor_nombre || '',
    notas: item.notas || '',
  };
}

export default function Inventario() {
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [cajaModal, setCajaModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [modoAbrir, setModoAbrir] = useState('lote'); // lote | lista
  const [loteNombre, setLoteNombre] = useState('');
  const [loteCantidad, setLoteCantidad] = useState(72);
  const [autosAbrir, setAutosAbrir] = useState([{ nombre: '' }]);
  const [error, setError] = useState('');

  const load = () => {
    const params = {};
    if (busqueda) params.busqueda = busqueda;
    if (filtroEstado) params.estado = filtroEstado;
    api.inventario.list(params).then(setItems).catch(console.error);
  };

  useEffect(() => { load(); }, [busqueda, filtroEstado]);

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setError('');
    setModal(true);
  };

  const openEdit = (item) => {
    setForm(itemToForm(item));
    setEditId(item.id);
    setError('');
    setModal(true);
  };

  const openCaja = (item) => {
    setCajaModal(item);
    setModoAbrir('lote');
    setLoteNombre(item.nombre || '');
    setLoteCantidad(72);
    setAutosAbrir([{ nombre: '' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        cantidad: Number(form.cantidad),
        costo_unitario: Number(form.costo_unitario),
        precio_sugerido: form.precio_sugerido !== '' ? Number(form.precio_sugerido) : null,
        anio: form.anio !== '' ? Number(form.anio) : null,
      };
      if (editId) await api.inventario.update(editId, payload);
      else await api.inventario.create(payload);
      setModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`¿Eliminar "${item.nombre}" del inventario?`)) return;
    try {
      await api.inventario.delete(item.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const autosValidos = useMemo(
    () => autosAbrir.filter((a) => a.nombre.trim()),
    [autosAbrir]
  );

  const cantidadPreview = modoAbrir === 'lote' ? Number(loteCantidad) || 0 : autosValidos.length;

  const costoPorAuto = useMemo(() => {
    if (!cajaModal || cantidadPreview <= 0) return 0;
    return Number(cajaModal.costo_unitario || 0) / cantidadPreview;
  }, [cajaModal, cantidadPreview]);

  const handleAbrirCaja = async () => {
    try {
      let result;
      if (modoAbrir === 'lote') {
        if (!loteNombre.trim()) return alert('Escribe el nombre del auto');
        if (!loteCantidad || Number(loteCantidad) < 1) return alert('Indica la cantidad');
        result = await api.inventario.abrirCaja(cajaModal.id, {
          nombre: loteNombre.trim(),
          cantidad: Number(loteCantidad),
        });
      } else {
        if (autosValidos.length === 0) return alert('Agrega al menos un auto');
        result = await api.inventario.abrirCaja(cajaModal.id, { autos: autosValidos });
      }

      const restantes = result?.cajas_restantes ?? 0;
      alert(
        `Se abrió 1 caja.\n` +
        `Autos individuales creados: ${result?.cantidad_creada ?? cantidadPreview}\n` +
        `Costo por auto: ${formatMoney(result?.costo_por_auto ?? costoPorAuto)}\n` +
        `Cajas restantes: ${restantes}`
      );
      setCajaModal(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const pager = usePagination(items, 10);

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle="Control de stock: cajas, autos y accesorios"
        action={<button className="btn-primary" onClick={openNew}>+ Agregar item</button>}
      />

      <div className="filters-bar">
        <input
          className="w-full"
          placeholder="Buscar por nombre, código o serie..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select className="w-full sm:max-w-[200px]" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_INVENTARIO.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Tipo</th>
              <th>Stock</th>
              <th>Costo</th>
              <th>Precio sug.</th>
              <th>Estado</th>
              <th>Ubicación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((item) => (
              <tr key={item.id}>
                <td className="font-mono text-xs">{item.codigo_interno}</td>
                <td>{item.nombre}</td>
                <td>{labelOf(CATEGORIAS, item.categoria)}</td>
                <td>{labelOf(TIPOS_ITEM, item.tipo_item)}</td>
                <td>{item.cantidad}</td>
                <td>{formatMoney(item.costo_unitario)}</td>
                <td>{item.precio_sugerido ? formatMoney(item.precio_sugerido) : '-'}</td>
                <td><Badge label={labelOf(ESTADOS_INVENTARIO, item.estado)} colorClass={badgeClass(ESTADOS_INVENTARIO, item.estado)} /></td>
                <td>{item.ubicacion || '-'}</td>
                <td className="whitespace-nowrap space-x-1">
                  <button className="btn-secondary text-xs py-1" onClick={() => openEdit(item)}>Editar</button>
                  {item.tipo_item === 'caja_cerrada' && item.estado === 'disponible' && Number(item.cantidad) > 0 && (
                    <button
                      className="btn-primary text-xs py-1"
                      onClick={() => openCaja(item)}
                    >
                      Abrir 1 caja
                    </button>
                  )}
                  <button className="btn-danger text-xs py-1" onClick={() => handleDelete(item)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={10} className="text-center text-gray-400 py-8">Inventario vacío</td></tr>
            )}
          </tbody>
          </table>
        </div>
        <Pagination {...pager} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar item' : 'Agregar al inventario'} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="form-grid">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input value={form.nombre} onChange={set('nombre')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
              <select value={form.categoria} onChange={set('categoria')}>
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.tipo_item} onChange={set('tipo_item')}>
                {TIPOS_ITEM.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Serie</label>
              <input value={form.serie} onChange={set('serie')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
              <input type="number" value={form.anio} onChange={set('anio')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Case</label>
              <input value={form.case_code} onChange={set('case_code')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad / Stock</label>
              <input type="number" min="0" step="1" value={form.cantidad} onChange={set('cantidad')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Costo unitario</label>
              <input type="number" min="0" step="0.01" value={form.costo_unitario} onChange={set('costo_unitario')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Precio sugerido</label>
              <input type="number" min="0" step="0.01" value={form.precio_sugerido} onChange={set('precio_sugerido')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select value={form.estado} onChange={set('estado')}>
                {ESTADOS_INVENTARIO.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ubicación</label>
              <input value={form.ubicacion} onChange={set('ubicacion')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
              <input value={form.proveedor_nombre} onChange={set('proveedor_nombre')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha ingreso</label>
              <input type="date" value={form.fecha_ingreso} onChange={set('fecha_ingreso')} required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
              <input value={form.notas} onChange={set('notas')} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">{editId ? 'Guardar cambios' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!cajaModal} onClose={() => setCajaModal(null)} title={`Abrir 1 caja: ${cajaModal?.nombre}`} wide>
        <div className="panel-muted mb-4 space-y-1">
          <p><strong>Cajas disponibles:</strong> {cajaModal?.cantidad}</p>
          <p><strong>Costo por caja:</strong> {formatMoney(cajaModal?.costo_unitario)}</p>
          <p><strong>Autos a crear:</strong> {cantidadPreview || '—'}</p>
          <p>
            <strong>Costo por auto:</strong>{' '}
            {cantidadPreview > 0 ? formatMoney(costoPorAuto) : '—'}
          </p>
          <p className="text-xs text-gray-500">
            Se crean autos individuales (cada uno cantidad 1). Solo se abre 1 caja.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <button
            type="button"
            className={modoAbrir === 'lote' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setModoAbrir('lote')}
          >
            Nombre + cantidad
          </button>
          <button
            type="button"
            className={modoAbrir === 'lista' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setModoAbrir('lista')}
          >
            Lista de nombres
          </button>
        </div>

        {modoAbrir === 'lote' ? (
          <div className="form-grid mb-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del auto</label>
              <input
                value={loteNombre}
                onChange={(e) => setLoteNombre(e.target.value)}
                placeholder="Ej: 99ABCDE Autos"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad de autos</label>
              <input
                type="number"
                min="1"
                max="500"
                value={loteCantidad}
                onChange={(e) => setLoteCantidad(e.target.value)}
              />
            </div>
            <div className="flex items-end text-xs text-gray-500 pb-2">
              Se crearán {Number(loteCantidad) || 0} registros individuales
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">Nombres distintos de cada auto:</p>
            {autosAbrir.map((auto, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2">
                <input
                  placeholder={`Auto ${i + 1} - nombre`}
                  value={auto.nombre}
                  onChange={(e) => {
                    const copy = [...autosAbrir];
                    copy[i] = { nombre: e.target.value };
                    setAutosAbrir(copy);
                  }}
                />
                {autosAbrir.length > 1 && (
                  <button
                    type="button"
                    className="btn-danger text-xs"
                    onClick={() => setAutosAbrir(autosAbrir.filter((_, idx) => idx !== i))}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary text-sm mb-4 w-full sm:w-auto"
              onClick={() => setAutosAbrir([...autosAbrir, { nombre: '' }])}
            >
              + Agregar auto
            </button>
          </>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setCajaModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={handleAbrirCaja}>Abrir esta caja</button>
        </div>
      </Modal>
    </div>
  );
}

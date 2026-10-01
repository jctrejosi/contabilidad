import { useEffect, useState } from 'react';
import { fmtCOP } from '../data/mock';
import { listarTerceros } from '../api/terceros';
import TerceroMantenimiento from '../components/TerceroMantenimiento';
import type { Tercero } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface FormTercero {
  nit: string;
  digito: string;
  nombre: string;
  tipo: 'Natural' | 'Jurídica';
  tipoDoc: string;
  direccion: string;
  telefono: string;
  ciudad: string;
  saldo: string;
  cupo: string;
}

function formVacio(): FormTercero {
  return { nit: '', digito: '', nombre: '', tipo: 'Natural', tipoDoc: 'CC', direccion: '', telefono: '', ciudad: '', saldo: '0', cupo: '0' };
}

function formDe(t: Tercero): FormTercero {
  return { nit: t.nit, digito: t.digito, nombre: t.nombre, tipo: t.tipo, tipoDoc: t.tipoDoc, direccion: t.direccion, telefono: t.telefono, ciudad: t.ciudad, saldo: String(t.saldo), cupo: String(t.cupo) };
}

function parseNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const EJEMPLO_IMPORTADOS: Tercero[] = [
  { nit: '45.678.901', digito: '2', nombre: 'Ramos Torres Camila', tipo: 'Natural', tipoDoc: 'CC', direccion: 'Cra 7 # 45-90', telefono: '3112223344', ciudad: 'Medellín', estado: 'Activo', saldo: 0, cupo: 8000000, fechaCreacion: '2026-03-02' },
  { nit: '901.400.500', digito: '1', nombre: 'Distribuidora Andina S.A.S.', tipo: 'Jurídica', tipoDoc: 'NIT', direccion: 'Cl 30 # 20-15', telefono: '6045566778', ciudad: 'Medellín', estado: 'Activo', saldo: 2400000, cupo: 60000000, fechaCreacion: '2026-03-02' },
];

const PROFESIONES_MOCK = ['Contador público', 'Ingeniera industrial', 'Administradora de empresas', 'Comercial', 'Logística', 'Ingeniero de sistemas'];
const ETIQUETAS_MOCK = [['Cliente frecuente', 'VIP'], ['Proveedor clave'], ['Crédito en revisión'], ['Cliente frecuente'], ['Proveedor clave', 'Nuevo'], ['Moroso']];
const CUMPLE_MOCK = ['1985-03-08', '1990-11-21', '1988-07-04', '2005-01-17', '2015-09-30', '1978-12-12'];

export default function TercerosPage() {
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorConexion, setErrorConexion] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [tab, setTab] = useState<'directorio' | 'informes'>('directorio');
  const [informe, setInforme] = useState<'general' | 'cumpleanos' | 'profesiones' | 'etiquetas'>('general');
  const [search, setSearch] = useState('');
  const [searchAplicado, setSearchAplicado] = useState('');
  const [filterEstado, setFilterEstado] = useState<'todos' | 'Activo' | 'Bloqueado'>('todos');
  const [selectedNit, setSelectedNit] = useState<string | null>(null);
  const [maintenanceNit, setMaintenanceNit] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [formNuevo, setFormNuevo] = useState<FormTercero>(formVacio);
  const [erroresNuevo, setErroresNuevo] = useState<{ nit?: string; nombre?: string }>({});

  const [showEdit, setShowEdit] = useState(false);
  const [formEdit, setFormEdit] = useState<FormTercero>(formVacio);
  const [erroresEdit, setErroresEdit] = useState<{ nombre?: string }>({});

  const [showEliminar, setShowEliminar] = useState(false);
  const [showBloqueoEliminar, setShowBloqueoEliminar] = useState<Tercero | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);

  const [showCupos, setShowCupos] = useState(false);
  const [cupos, setCupos] = useState<Record<string, string>>({});

  const [showReasign, setShowReasign] = useState(false);
  const [reasignStep, setReasignStep] = useState(0);
  const [nitActual, setNitActual] = useState('860.050.010');
  const [nitNuevo, setNitNuevo] = useState('');

  useEffect(() => {
    if (maintenanceNit !== null) return;
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'F2') { event.preventDefault(); setMaintenanceNit(''); }
      if (event.key === 'F3' && selectedNit) { event.preventDefault(); setMaintenanceNit(selectedNit); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [maintenanceNit, selectedNit]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPagina(1);
      setSearchAplicado(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorConexion(null);
    void listarTerceros({
      page: pagina,
      search: searchAplicado,
      estado: filterEstado === 'Activo' ? 'activo' : filterEstado === 'Bloqueado' ? 'bloqueado' : 'todos',
    })
      .then(result => {
        if (!vigente) return;
        setTerceros(result.items);
        setTotal(result.total);
        setTotalPaginas(result.pages);
        setSelectedNit(actual => actual && result.items.some(item => item.nit === actual) ? actual : null);
      })
      .catch(error => {
        if (!vigente) return;
        setTerceros([]);
        setErrorConexion(error instanceof Error ? error.message : 'No fue posible consultar los terceros.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => { vigente = false; };
  }, [filterEstado, pagina, searchAplicado, refreshKey]);

  const selected = terceros.find(t => t.nit === selectedNit) || null;

  // El backend ya entrega únicamente la página que coincide con los filtros.
  const filtered = terceros;

  function toggleBloqueo(nit: string) {
    setTerceros(prev => prev.map(t => {
      if (t.nit !== nit) return t;
      const bloqueando = t.estado === 'Activo';
      return { ...t, estado: bloqueando ? 'Bloqueado' : 'Activo', motivoBloqueo: bloqueando ? 'Bloqueado manualmente' : undefined };
    }));
    setAviso({ tipo: 'success', texto: `Tercero ${nit} ${terceros.find(t => t.nit === nit)?.estado === 'Activo' ? 'bloqueado' : 'desbloqueado'}.` });
  }

  function abrirNuevo() {
    setFormNuevo(formVacio());
    setErroresNuevo({});
    setShowNew(true);
  }

  function guardarNuevo() {
    const e: typeof erroresNuevo = {};
    const nit = formNuevo.nit.trim();
    if (!nit) e.nit = 'El NIT es obligatorio.';
    else if (terceros.some(t => t.nit === nit)) e.nit = `Ya existe un tercero con NIT ${nit}.`;
    if (!formNuevo.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    setErroresNuevo(e);
    if (Object.keys(e).length) return;
    setTerceros(prev => [...prev, {
      nit,
      digito: formNuevo.digito.trim(),
      nombre: formNuevo.nombre.trim(),
      tipo: formNuevo.tipo,
      tipoDoc: formNuevo.tipoDoc,
      direccion: formNuevo.direccion.trim(),
      telefono: formNuevo.telefono.trim(),
      ciudad: formNuevo.ciudad.trim(),
      estado: 'Activo',
      saldo: parseNum(formNuevo.saldo),
      cupo: parseNum(formNuevo.cupo),
      fechaCreacion: new Date().toISOString().slice(0, 10),
    }]);
    setShowNew(false);
    setSelectedNit(nit);
    setAviso({ tipo: 'success', texto: `Tercero ${nit} creado.` });
  }

  function abrirEditar(t: Tercero) {
    setFormEdit(formDe(t));
    setErroresEdit({});
    setShowEdit(true);
  }

  function guardarEditar() {
    const e: typeof erroresEdit = {};
    if (!formEdit.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    setErroresEdit(e);
    if (Object.keys(e).length) return;
    setTerceros(prev => prev.map(t => t.nit === formEdit.nit ? {
      ...t,
      digito: formEdit.digito.trim(),
      nombre: formEdit.nombre.trim(),
      tipo: formEdit.tipo,
      tipoDoc: formEdit.tipoDoc,
      direccion: formEdit.direccion.trim(),
      telefono: formEdit.telefono.trim(),
      ciudad: formEdit.ciudad.trim(),
      saldo: parseNum(formEdit.saldo),
      cupo: parseNum(formEdit.cupo),
    } : t));
    setShowEdit(false);
    setAviso({ tipo: 'success', texto: `Tercero ${formEdit.nit} actualizado.` });
  }

  function pedirEliminar(t: Tercero) {
    if (t.saldo !== 0) {
      setShowBloqueoEliminar(t);
      return;
    }
    setSelectedNit(t.nit);
    setShowEliminar(true);
  }

  function confirmarEliminar() {
    if (!selectedNit) return;
    setTerceros(prev => prev.filter(t => t.nit !== selectedNit));
    setShowEliminar(false);
    setSelectedNit(null);
    setAviso({ tipo: 'success', texto: `Tercero ${selectedNit} eliminado.` });
  }

  function abrirCupos() {
    const r: Record<string, string> = {};
    for (const t of terceros) r[t.nit] = String(t.cupo);
    setCupos(r);
    setShowCupos(true);
  }

  function guardarCupos() {
    setTerceros(prev => prev.map(t => (cupos[t.nit] !== undefined ? { ...t, cupo: parseNum(cupos[t.nit]) } : t)));
    setShowCupos(false);
    setAviso({ tipo: 'success', texto: 'Cupos de crédito actualizados.' });
  }

  function importar() {
    const agregados = EJEMPLO_IMPORTADOS.filter(e => !terceros.some(t => t.nit === e.nit));
    if (!agregados.length) {
      setAviso({ tipo: 'error', texto: 'Los terceros de ejemplo ya existen en el directorio.' });
    } else {
      setTerceros(prev => [...prev, ...agregados]);
      setAviso({ tipo: 'success', texto: `Importados ${agregados.length} terceros desde ${archivo?.name || 'el archivo'}.` });
    }
    setShowImport(false);
    setArchivo(null);
  }

  function exportarCSV() {
    const filas = terceros.map(t => [t.nit, t.digito, t.tipo, t.tipoDoc, t.nombre, t.direccion, t.telefono, t.ciudad, t.estado, String(t.saldo), String(t.cupo), t.fechaCreacion].join(';'));
    const csv = ['NIT;Dígito;Tipo;Tipo doc;Nombre;Dirección;Teléfono;Ciudad;Estado;Saldo;Cupo;Fecha creación', ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terceros.csv';
    a.click();
    URL.revokeObjectURL(url);
    setAviso({ tipo: 'success', texto: `Directorio exportado (${terceros.length} terceros).` });
  }

  function cerrarReasign() {
    setShowReasign(false);
    setReasignStep(0);
    setNitNuevo('');
  }

  function finalizarReasign() {
    if (nitNuevo.trim()) {
      setTerceros(prev => prev.map(t => t.nit === nitActual ? { ...t, nit: nitNuevo.trim() } : t));
      setAviso({ tipo: 'success', texto: `NIT reasignado de ${nitActual} a ${nitNuevo.trim()}.` });
    }
    cerrarReasign();
  }

  const REASIGN_STEPS = [
    'NIT actual y nuevo',
    'Módulos afectados',
    'Simulación',
    'Respaldo y confirmación',
    'Progreso',
    'Resultado y auditoría',
  ];

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Terceros</div>
          <h1 className="text-lg font-semibold text-gray-800">Terceros</h1>
          <p className="mt-1 text-xs text-gray-500">Directorio de personas naturales y jurídicas vinculadas a la contabilidad</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${errorConexion ? 'border-red-200 bg-red-50 text-red-700' : cargando ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {errorConexion ? 'Sin conexión' : cargando ? 'Consultando terceros…' : `${total.toLocaleString('es-CO')} terceros`}
          </span>
          <button disabled title="Se habilitará al implementar la importación real" className={`${BUTTON_SECONDARY} cursor-not-allowed opacity-50`}>↑ Importar</button>
          <button onClick={exportarCSV} disabled={cargando || !!errorConexion} className={`${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}>↓ Exportar página</button>
          <button disabled title="Se habilitará con las reglas de cupo de cartera" className={`${BUTTON_SECONDARY} cursor-not-allowed opacity-50`}>Cupos</button>
          <button
            disabled
            title="Requiere actualizar todas las referencias contables del tercero"
            className="cursor-not-allowed rounded border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-400 opacity-60"
          >
            ⚠ Reasignar NIT
          </button>
          <button onClick={() => setMaintenanceNit('')} disabled={!!errorConexion} className={`${BUTTON_PRIMARY} disabled:opacity-50`}>+ Nuevo tercero</button>
        </div>
      </div>

      {aviso && (
        <div role={aviso.tipo === 'error' ? 'alert' : 'status'} className={`flex items-center justify-between rounded border px-4 py-2 text-sm ${aviso.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="text-xs text-gray-400 hover:text-gray-600">×</button>
        </div>
      )}

      {errorConexion && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorConexion} Verifique que el servicio Python esté iniciado.
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([['directorio', 'Directorio'], ['informes', 'Informes']] as const).map(([k, label]) => (
          <button
            key={k}
            disabled={k === 'informes'}
            title={k === 'informes' ? 'Los informes se conectarán después del directorio real' : undefined}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px ${tab === k ? 'border-petroleum-500 text-petroleum-700' : k === 'informes' ? 'cursor-not-allowed border-transparent text-gray-300' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'directorio' ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Buscar por NIT, nombre o ciudad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64"
            />
            {(['todos', 'Activo', 'Bloqueado'] as const).map(e => (
              <button
                key={e}
                onClick={() => { setPagina(1); setFilterEstado(e); }}
                className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${filterEstado === e ? 'bg-petroleum-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {e === 'todos' ? 'Todos' : e}
              </button>
            ))}
            <button onClick={() => window.print()} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
          </div>

          <div className="flex gap-4">
            {/* Table */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="table-fixed-header overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Díg.</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Doc</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Dirección</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Teléfono</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Ciudad</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Cupo</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Creado</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cargando && (
                        <tr><td colSpan={13} className="px-4 py-12 text-center text-sm text-gray-500">Consultando terceros…</td></tr>
                      )}
                      {!cargando && !errorConexion && filtered.length === 0 && (
                        <tr><td colSpan={13} className="px-4 py-12 text-center text-sm text-gray-500">No se encontraron terceros con estos criterios.</td></tr>
                      )}
                      {filtered.map(t => (
                        <tr
                          key={t.nit}
                          className={`hoverable cursor-pointer ${selectedNit === t.nit ? 'bg-blue-50' : ''} ${t.estado === 'Bloqueado' ? 'opacity-70' : ''}`}
                          onClick={() => setSelectedNit(t.nit)}
                        >
                          <td className="px-3 py-2.5 font-mono text-gray-700">{t.nit}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{t.digito}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${t.tipo === 'Jurídica' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                              {t.tipo}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{t.tipoDoc}</td>
                          <td className="px-3 py-2.5 text-gray-800 font-medium max-w-52 truncate">{t.nombre}</td>
                          <td className="px-3 py-2.5 text-gray-500 max-w-40 truncate">{t.direccion}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{t.telefono}</td>
                          <td className="px-3 py-2.5 text-gray-600">{t.ciudad}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {t.estado}
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono ${t.saldo < 0 ? 'text-red-600' : t.saldo > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {t.saldo !== 0 ? fmtCOP(Math.abs(t.saldo)) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                            {t.cupo > 0 ? fmtCOP(t.cupo) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{t.fechaCreacion}</td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button type="button" className="text-xs font-medium text-petroleum-700 hover:underline" onClick={() => setMaintenanceNit(t.nit)}>Modificar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                  <span>Página {pagina} de {totalPaginas} · {filtered.length} de {total.toLocaleString('es-CO')} terceros</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={cargando || pagina <= 1} onClick={() => setPagina(value => Math.max(1, value - 1))} className="rounded border border-gray-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                    <button type="button" disabled={cargando || pagina >= totalPaginas} onClick={() => setPagina(value => Math.min(totalPaginas, value + 1))} className="rounded border border-gray-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Detail */}
            {selected && (
              <div className="w-72 shrink-0">
                <div className="bg-white rounded border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-800 text-sm">{selected.nombre}</div>
                      <div className="font-mono text-xs text-gray-500 mt-0.5">NIT {selected.nit}-{selected.digito}</div>
                    </div>
                    <button onClick={() => setSelectedNit(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>

                  <div className={`text-xs px-2.5 py-1.5 rounded font-medium ${selected.estado === 'Activo' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {selected.estado === 'Bloqueado' ? `⚠ Bloqueado: ${selected.motivoBloqueo || 'sin motivo'}` : '✓ Activo'}
                  </div>

                  <div className="space-y-2 text-xs">
                    {([
                      ['Tipo', selected.tipo],
                      ['Doc. identidad', selected.tipoDoc],
                      ['Dirección', selected.direccion],
                      ['Teléfono', selected.telefono],
                      ['Ciudad', selected.ciudad],
                      ['Creado', selected.fechaCreacion],
                      ['Saldo', `${fmtCOP(Math.abs(selected.saldo))} ${selected.saldo < 0 ? '(por pagar)' : '(por cobrar)'}`],
                      ['Cupo', fmtCOP(selected.cupo)],
                    ] as const).map(([label, val]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <span className="text-gray-400 shrink-0">{label}</span>
                        <span className="text-gray-700 text-right">{val}</span>
                      </div>
                    ))}
                  </div>

                  <button type="button" className={BUTTON_PRIMARY} onClick={() => setMaintenanceNit(selected.nit)}>Modificar ficha</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            {([
              ['general', 'General'],
              ['cumpleanos', 'Cumpleaños'],
              ['profesiones', 'Profesiones'],
              ['etiquetas', 'Etiquetas'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setInforme(k)}
                className={`text-xs px-3 py-1.5 rounded ${informe === k ? 'bg-petroleum-500 text-white font-medium' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => window.print()} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
              <button onClick={exportarCSV} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar XLSX</button>
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                {informe === 'general' && (
                  <>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Ciudad</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Teléfono</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Cupo</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Creado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(t => (
                        <tr key={t.nit} className="hoverable">
                          <td className="px-3 py-2.5 font-mono text-gray-700">{t.nit}-{t.digito}</td>
                          <td className="px-3 py-2.5 text-gray-800 font-medium">{t.nombre}</td>
                          <td className="px-3 py-2.5 text-gray-600">{t.tipo}</td>
                          <td className="px-3 py-2.5 text-gray-600">{t.ciudad}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{t.telefono}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.estado}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">{t.saldo !== 0 ? fmtCOP(Math.abs(t.saldo)) : '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{t.cupo > 0 ? fmtCOP(t.cupo) : '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{t.fechaCreacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                {informe === 'cumpleanos' && (
                  <>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fecha nacimiento</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Edad</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Próximo cumpleaños</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((t, i) => {
                        const nac = CUMPLE_MOCK[i % CUMPLE_MOCK.length];
                        const anio = Number(nac.slice(0, 4));
                        return (
                          <tr key={t.nit} className="hoverable">
                            <td className="px-3 py-2.5 font-mono text-gray-700">{t.nit}</td>
                            <td className="px-3 py-2.5 text-gray-800 font-medium">{t.nombre}</td>
                            <td className="px-3 py-2.5 font-mono text-gray-600">{nac}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-600">{2026 - anio} años</td>
                            <td className="px-3 py-2.5 text-gray-600">{`${nac.slice(5, 7)}/${nac.slice(8, 10)} · ${(i + 1) * 7} días`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                )}
                {informe === 'profesiones' && (
                  <>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Profesión</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Ciudad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((t, i) => (
                        <tr key={t.nit} className="hoverable">
                          <td className="px-3 py-2.5 font-mono text-gray-700">{t.nit}</td>
                          <td className="px-3 py-2.5 text-gray-800 font-medium">{t.nombre}</td>
                          <td className="px-3 py-2.5 text-gray-600">{t.tipo}</td>
                          <td className="px-3 py-2.5 text-gray-600">{PROFESIONES_MOCK[i % PROFESIONES_MOCK.length]}</td>
                          <td className="px-3 py-2.5 text-gray-600">{t.ciudad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                {informe === 'etiquetas' && (
                  <>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Etiquetas</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((t, i) => (
                        <tr key={t.nit} className="hoverable">
                          <td className="px-3 py-2.5 font-mono text-gray-700">{t.nit}</td>
                          <td className="px-3 py-2.5 text-gray-800 font-medium">{t.nombre}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(ETIQUETAS_MOCK[i % ETIQUETAS_MOCK.length] || []).map(e => (
                                <span key={e} className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">{e}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.estado}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              {filtered.length} registro{filtered.length !== 1 ? 's' : ''} — datos derivados de demostración
            </div>
          </div>
        </>
      )}

      {/* Nuevo tercero */}
      {maintenanceNit !== null && <TerceroMantenimiento nit={maintenanceNit || undefined} onClose={() => setMaintenanceNit(null)} onSaved={code => {
        setMaintenanceNit(null);
        setPagina(1);
        setSearch(code);
        setSearchAplicado(code);
        setSelectedNit(code);
        setRefreshKey(value => value + 1);
        setAviso({ tipo: 'success', texto: `Tercero ${code} guardado correctamente.` });
      }} />}
      {showNew && (
        <Modal title="Nuevo tercero" onClose={() => setShowNew(false)}>
          <form noValidate onSubmit={e => { e.preventDefault(); guardarNuevo(); }}>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">NIT / Cédula *</label>
                <input className={`${INPUT} font-mono`} value={formNuevo.nit} placeholder="900.123.456" autoFocus
                  onChange={e => { setFormNuevo({ ...formNuevo, nit: e.target.value }); setErroresNuevo({ ...erroresNuevo, nit: undefined }); }}
                  aria-invalid={!!erroresNuevo.nit} />
                {erroresNuevo.nit && <p className="mt-1 text-xs text-red-600">{erroresNuevo.nit}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dígito de verificación</label>
                <input className={INPUT} value={formNuevo.digito} placeholder="7" maxLength={2}
                  onChange={e => setFormNuevo({ ...formNuevo, digito: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
                <input className={INPUT} value={formNuevo.nombre} placeholder="Nombre empresa o persona"
                  onChange={e => { setFormNuevo({ ...formNuevo, nombre: e.target.value }); setErroresNuevo({ ...erroresNuevo, nombre: undefined }); }}
                  aria-invalid={!!erroresNuevo.nombre} />
                {erroresNuevo.nombre && <p className="mt-1 text-xs text-red-600">{erroresNuevo.nombre}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de persona</label>
                <select className={INPUT} value={formNuevo.tipo} onChange={e => setFormNuevo({ ...formNuevo, tipo: e.target.value as 'Natural' | 'Jurídica' })}>
                  <option value="Natural">Natural</option>
                  <option value="Jurídica">Jurídica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento</label>
                <select className={INPUT} value={formNuevo.tipoDoc} onChange={e => setFormNuevo({ ...formNuevo, tipoDoc: e.target.value })}>
                  <option value="CC">CC — Cédula de ciudadanía</option>
                  <option value="NIT">NIT — Número de identificación tributaria</option>
                  <option value="CE">CE — Cédula de extranjería</option>
                  <option value="PAS">PAS — Pasaporte</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                <input className={INPUT} value={formNuevo.direccion} placeholder="Cra 15 # 80-25"
                  onChange={e => setFormNuevo({ ...formNuevo, direccion: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                <input className={INPUT} value={formNuevo.telefono} placeholder="3001234567"
                  onChange={e => setFormNuevo({ ...formNuevo, telefono: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
                <input className={INPUT} value={formNuevo.ciudad} placeholder="Bogotá D.C."
                  onChange={e => setFormNuevo({ ...formNuevo, ciudad: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Saldo inicial</label>
                <input className={`${INPUT} font-mono text-right`} value={formNuevo.saldo} inputMode="numeric"
                  onChange={e => setFormNuevo({ ...formNuevo, saldo: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Cupo de crédito</label>
                <input className={`${INPUT} font-mono text-right`} value={formNuevo.cupo} inputMode="numeric"
                  onChange={e => setFormNuevo({ ...formNuevo, cupo: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button type="button" onClick={() => setShowNew(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modificar tercero */}
      {showEdit && (
        <Modal title={`Modificar tercero ${formEdit.nit}`} onClose={() => setShowEdit(false)}>
          <form noValidate onSubmit={e => { e.preventDefault(); guardarEditar(); }}>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">NIT</label>
                <input className={`${INPUT} font-mono bg-gray-50 text-gray-500`} value={formEdit.nit} readOnly aria-readonly="true" />
                <p className="mt-1 text-xs text-gray-400">Use «Reasignar NIT» para cambiar la identificación.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dígito de verificación</label>
                <input className={INPUT} value={formEdit.digito} maxLength={2}
                  onChange={e => setFormEdit({ ...formEdit, digito: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
                <input className={INPUT} value={formEdit.nombre} autoFocus
                  onChange={e => { setFormEdit({ ...formEdit, nombre: e.target.value }); setErroresEdit({ ...erroresEdit, nombre: undefined }); }}
                  aria-invalid={!!erroresEdit.nombre} />
                {erroresEdit.nombre && <p className="mt-1 text-xs text-red-600">{erroresEdit.nombre}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de persona</label>
                <select className={INPUT} value={formEdit.tipo} onChange={e => setFormEdit({ ...formEdit, tipo: e.target.value as 'Natural' | 'Jurídica' })}>
                  <option value="Natural">Natural</option>
                  <option value="Jurídica">Jurídica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento</label>
                <select className={INPUT} value={formEdit.tipoDoc} onChange={e => setFormEdit({ ...formEdit, tipoDoc: e.target.value })}>
                  <option value="CC">CC</option>
                  <option value="NIT">NIT</option>
                  <option value="CE">CE</option>
                  <option value="PAS">PAS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                <input className={INPUT} value={formEdit.direccion} onChange={e => setFormEdit({ ...formEdit, direccion: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                <input className={INPUT} value={formEdit.telefono} onChange={e => setFormEdit({ ...formEdit, telefono: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
                <input className={INPUT} value={formEdit.ciudad} onChange={e => setFormEdit({ ...formEdit, ciudad: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Saldo</label>
                <input className={`${INPUT} font-mono text-right`} value={formEdit.saldo} inputMode="numeric"
                  onChange={e => setFormEdit({ ...formEdit, saldo: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Cupo de crédito</label>
                <input className={`${INPUT} font-mono text-right`} value={formEdit.cupo} inputMode="numeric"
                  onChange={e => setFormEdit({ ...formEdit, cupo: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button type="button" onClick={() => setShowEdit(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>Guardar cambios</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Eliminar tercero */}
      {showEliminar && selected && (
        <Modal title="Eliminar tercero" onClose={() => setShowEliminar(false)}>
          <p className="p-5 text-sm text-gray-600">
            ¿Confirma la eliminación del tercero <strong>{selected.nombre}</strong> (NIT {selected.nit}-{selected.digito})? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
            <button onClick={() => setShowEliminar(false)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button onClick={confirmarEliminar} className="rounded bg-red-500 px-5 py-2 text-sm font-medium text-white hover:bg-red-600">Eliminar</button>
          </div>
        </Modal>
      )}

      {/* Bloqueo eliminación por saldo */}
      {showBloqueoEliminar && (
        <Modal title="No se puede eliminar el tercero" onClose={() => setShowBloqueoEliminar(null)}>
          <div className="space-y-3 p-5">
            <p className="text-sm text-gray-600">
              El tercero <strong>{showBloqueoEliminar.nombre}</strong> tiene un saldo pendiente de <strong className="font-mono">{fmtCOP(Math.abs(showBloqueoEliminar.saldo))}</strong> ({showBloqueoEliminar.saldo < 0 ? 'por pagar' : 'por cobrar'}). No puede eliminarse mientras exista saldo.
            </p>
            <p className="text-xs text-gray-400">Concilie o traslade el saldo antes de eliminar el tercero.</p>
          </div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
            <button onClick={() => setShowBloqueoEliminar(null)} className={BUTTON_PRIMARY}>Entendido</button>
          </div>
        </Modal>
      )}

      {/* Importar */}
      {showImport && (
        <Modal title="Importar terceros" onClose={() => setShowImport(false)}>
          <div className="space-y-3 p-5">
            <p className="text-xs text-gray-500">Seleccione un archivo XLS, XLSX o CSV con el directorio de terceros. En esta demostración se importarán 2 terceros de ejemplo.</p>
            <label htmlFor="ter-archivo" className="block text-xs font-medium text-gray-600">Archivo</label>
            <input
              id="ter-archivo"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={e => setArchivo(e.target.files?.[0] || null)}
              className="block w-full text-xs text-gray-500 file:mr-3 file:rounded file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
            />
            {archivo && (
              <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                {archivo.name} — {(archivo.size / 1024).toFixed(1)} KB (simulado)
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
            <button onClick={() => setShowImport(false)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button onClick={importar} className={BUTTON_PRIMARY}>Importar</button>
          </div>
        </Modal>
      )}

      {/* Cupos */}
      {showCupos && (
        <Modal title="Editar cupos de crédito" onClose={() => setShowCupos(false)}>
          <div className="p-5 space-y-2">
            <p className="text-xs text-gray-500">Ajuste el cupo de crédito de cada tercero. Los cambios se aplican al confirmar.</p>
            <div className="max-h-72 overflow-y-auto rounded border border-gray-200 divide-y divide-gray-50">
              {terceros.map(t => (
                <div key={t.nit} className="grid grid-cols-[1fr_9rem] items-center gap-3 px-3 py-2">
                  <div>
                    <div className="text-xs font-medium text-gray-800 truncate">{t.nombre}</div>
                    <div className="text-xs font-mono text-gray-400">{t.nit}-{t.digito}</div>
                  </div>
                  <input
                    aria-label={`Cupo de ${t.nombre}`}
                    className={`${INPUT} font-mono text-right`}
                    inputMode="numeric"
                    value={cupos[t.nit] ?? '0'}
                    onChange={e => setCupos({ ...cupos, [t.nit]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
            <button onClick={() => setShowCupos(false)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button onClick={guardarCupos} className={BUTTON_PRIMARY}>Guardar cupos</button>
          </div>
        </Modal>
      )}

      {/* NIT Reassignment wizard */}
      {showReasign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200" style={{ backgroundColor: '#FEF3C7' }}>
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Asistente de reasignación de NIT</h3>
                <p className="text-xs text-amber-700 mt-0.5">Esta acción afecta también facturación, cartera, inventario y cuentas por pagar</p>
              </div>
              <button onClick={cerrarReasign} className="text-amber-400 hover:text-amber-600 text-lg">×</button>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-0 px-5 py-3 border-b border-gray-200 overflow-x-auto">
              {REASIGN_STEPS.map((s, i) => (
                <div key={s} className="flex items-center shrink-0">
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${i === reasignStep ? 'font-semibold text-white' : i < reasignStep ? 'text-green-600' : 'text-gray-400'}`}
                    style={i === reasignStep ? { backgroundColor: '#0073C0' } : {}}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center ${i < reasignStep ? 'bg-green-100 text-green-700' : i === reasignStep ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {i < reasignStep ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline">{s}</span>
                  </div>
                  {i < REASIGN_STEPS.length - 1 && <span className="text-gray-200 mx-1 text-xs">›</span>}
                </div>
              ))}
            </div>

            <div className="px-5 py-6 min-h-40">
              {reasignStep === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">NIT actual</label>
                    <input value={nitActual} onChange={e => setNitActual(e.target.value)} className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">NIT nuevo</label>
                    <input value={nitNuevo} onChange={e => setNitNuevo(e.target.value)} placeholder="NIT de destino" className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                </div>
              )}
              {reasignStep === 1 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 mb-3">Módulos que serán afectados por la reasignación:</p>
                  {['Contabilidad — movimientos, lotes y saldos', 'Facturación — facturas y notas crédito/débito', 'Cartera — documentos por cobrar', 'Cuentas por pagar — documentos por pagar', 'Inventario — entradas y salidas'].map(m => (
                    <div key={m} className="flex items-center gap-2 text-xs text-gray-700">
                      <input type="checkbox" defaultChecked />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}
              {reasignStep === 2 && (
                <div>
                  <p className="text-xs text-amber-700 font-medium mb-3">Simulación: se afectarían 1,847 registros en contabilidad</p>
                  <div className="space-y-1 text-xs max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                    {['Movimientos contables: 1,204 líneas', 'Lotes con pendientes: 3', 'Tercero en plan de cuentas: 12 cuentas asociadas', 'Posibles duplicados: 0 encontrados'].map(r => (
                      <div key={r} className="text-gray-600">{r}</div>
                    ))}
                  </div>
                </div>
              )}
              {reasignStep === 3 && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ⚠ Esta acción es irreversible. Se ha creado un respaldo automático con ID BAK-2026-0302.
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de la reasignación (obligatorio)</label>
                    <input placeholder="Corrección de NIT erróneo registrado en..." className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Escriba REASIGNAR para confirmar</label>
                    <input placeholder="REASIGNAR" className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                </div>
              )}
              {reasignStep === 4 && (
                <div className="flex flex-col items-center justify-center py-4 gap-3">
                  <div className="text-2xl animate-spin">⟳</div>
                  <div className="text-xs text-gray-600">Procesando reasignación... 847 / 1,847 registros</div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div className="h-full rounded-full" style={{ width: '46%', backgroundColor: '#0073C0' }} />
                  </div>
                </div>
              )}
              {reasignStep === 5 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                    <span className="text-xl">✓</span>
                    Reasignación completada exitosamente
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>NIT {nitActual} → {nitNuevo || '(sin NIT nuevo)'}</div>
                    <div>Registros afectados: 1,847</div>
                    <div>Auditoría registrada con ID AUD-2026-0089</div>
                    <div>Usuario: Laura Gómez · 2026-03-02 {new Date().toLocaleTimeString('es-CO')}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              {reasignStep > 0 && reasignStep < 4 && (
                <button onClick={() => setReasignStep(s => s - 1)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">← Atrás</button>
              )}
              {reasignStep < REASIGN_STEPS.length - 1 && (
                <button onClick={() => setReasignStep(s => s + 1)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
                  {reasignStep === 3 ? 'Ejecutar reasignación' : 'Siguiente →'}
                </button>
              )}
              {reasignStep === REASIGN_STEPS.length - 1 && (
                <button onClick={finalizarReasign} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Cerrar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EMPRESA, PERIODO } from '../data/mock';
import { COMPANIAS_INICIALES, TABLAS_AFECTADAS_LIMPIAR, esCompaniasGuardadas, validarCompania, type CompaniaConfig, type ErroresCompania } from '../data/configCompanias';

const STORAGE_KEY = `contabdsi:companias:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_DANGER = 'rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50';

const TEXTO_LIMPIAR = 'LIMPIAR COMPAÑIA';

function cargar(): CompaniaConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esCompaniasGuardadas(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(COMPANIAS_INICIALES);
}

function guardar(companias: CompaniaConfig[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companias));
    return true;
  } catch {
    return false;
  }
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto w-[calc(100%_-_2rem)] ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

function BarraProgreso({ progreso }: { progreso: number }) {
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-petroleum-500 transition-all duration-300" style={{ width: `${Math.round(progreso)}%` }} />
      </div>
      <div className="mt-1 text-right text-xs font-mono text-gray-500">{Math.round(progreso)}%</div>
    </div>
  );
}

function exportarCSV(companias: CompaniaConfig[]) {
  const filas = [['Código', 'Nombre', 'NIT', 'Estado', 'Año'],
  ...companias.map(c => [c.codigo, c.nombre, c.nit, c.estado, String(c.anio)])];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `companias-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_VACIO: CompaniaConfig = { codigo: '', nombre: '', nit: '', estado: 'Inactiva', anio: PERIODO.anio };

export default function Companias() {
  const [companias, setCompanias] = useState<CompaniaConfig[]>(cargar);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; original?: string } | null>(null);
  const [form, setForm] = useState<CompaniaConfig>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresCompania>({});
  const [eliminar, setEliminar] = useState<CompaniaConfig | null>(null);
  const [trasladar, setTrasladar] = useState<{ compania: CompaniaConfig } | null>(null);
  const [limpiar, setLimpiar] = useState<{ compania: CompaniaConfig } | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  // Traslado de año
  const [trasForm, setTrasForm] = useState({ anioOrigen: 2025, anioDestino: 2026 });
  const [trasError, setTrasError] = useState('');
  const [trasProgreso, setTrasProgreso] = useState(0);
  const [trasEjecutando, setTrasEjecutando] = useState(false);
  const [trasResultado, setTrasResultado] = useState<string | null>(null);

  // Limpieza de compañía
  const [limpMotivo, setLimpMotivo] = useState('');
  const [limpTexto, setLimpTexto] = useState('');
  const [limpErrores, setLimpErrores] = useState<{ motivo?: string; texto?: string }>({});
  const [limpProgreso, setLimpProgreso] = useState(0);
  const [limpEjecutando, setLimpEjecutando] = useState(false);
  const [limpResultado, setLimpResultado] = useState<string | null>(null);

  useEffect(() => {
    if (!trasEjecutando) return;
    const timer = setInterval(() => {
      setTrasProgreso(prev => {
        const next = Math.min(100, prev + 8 + Math.random() * 14);
        if (next >= 100) {
          clearInterval(timer);
          setTrasEjecutando(false);
          setTrasResultado(`Año ${trasForm.anioOrigen} trasladado al año ${trasForm.anioDestino}. Saldos iniciales y comprobantes de cierre copiados; el período ${trasForm.anioDestino}-01 quedó listo para operar.`);
          return 100;
        }
        return next;
      });
    }, 280);
    return () => clearInterval(timer);
  }, [trasEjecutando, trasForm.anioOrigen, trasForm.anioDestino]);

  useEffect(() => {
    if (!limpEjecutando) return;
    const timer = setInterval(() => {
      setLimpProgreso(prev => {
        const next = Math.min(100, prev + 5 + Math.random() * 10);
        if (next >= 100) {
          clearInterval(timer);
          setLimpEjecutando(false);
          setLimpResultado(`Compañía ${limpiar?.compania.codigo} limpiada. Se eliminaron los datos contables de las ${TABLAS_AFECTADAS_LIMPIAR.length} tablas afectadas. La acción quedó registrada en la bitácora con el motivo indicado.`);
          return 100;
        }
        return next;
      });
    }, 300);
    return () => clearInterval(timer);
  }, [limpEjecutando, limpiar]);

  const filtrados = companias.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return c.codigo.includes(q) || c.nombre.toLowerCase().includes(q) || c.nit.includes(q);
  });

  function abrirCrear() {
    setForm(structuredClone(FORM_VACIO));
    setErrores({});
    setModal({ modo: 'crear' });
  }

  function abrirEditar(item: CompaniaConfig) {
    setForm(structuredClone(item));
    setErrores({});
    setModal({ modo: 'editar', original: item.codigo });
  }

  function update(field: keyof CompaniaConfig, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarCompania(form, companias, modal?.original);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar.' });
      return;
    }
    const limpio: CompaniaConfig = { ...form, codigo: form.codigo.trim(), nombre: form.nombre.trim(), nit: form.nit.trim() };
    const siguientes = modal?.modo === 'editar'
      ? companias.map(c => c.codigo === modal.original ? limpio : c)
      : [...companias, limpio];
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setCompanias(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Compañía ${limpio.codigo} actualizada.` : `Compañía ${limpio.codigo} creada.` });
    setModal(null);
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = companias.filter(c => c.codigo !== eliminar.codigo);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó la compañía.' });
      setEliminar(null);
      return;
    }
    setCompanias(siguientes);
    setMensaje({ tipo: 'success', texto: `Compañía ${eliminar.codigo} eliminada.` });
    setEliminar(null);
  }

  function abrirTrasladar(item: CompaniaConfig) {
    setTrasForm({ anioOrigen: Math.max(2000, item.anio - 1), anioDestino: item.anio });
    setTrasError('');
    setTrasProgreso(0);
    setTrasEjecutando(false);
    setTrasResultado(null);
    setTrasladar({ compania: item });
  }

  function ejecutarTraslado(event: FormEvent) {
    event.preventDefault();
    if (!Number.isInteger(trasForm.anioOrigen) || trasForm.anioOrigen < 2000 || trasForm.anioOrigen > 2100) {
      setTrasError('El año origen debe estar entre 2000 y 2100.');
      return;
    }
    if (!Number.isInteger(trasForm.anioDestino) || trasForm.anioDestino < 2000 || trasForm.anioDestino > 2100) {
      setTrasError('El año destino debe estar entre 2000 y 2100.');
      return;
    }
    if (trasForm.anioDestino === trasForm.anioOrigen) {
      setTrasError('El año destino debe ser distinto del año origen.');
      return;
    }
    setTrasError('');
    setTrasEjecutando(true);
  }

  function abrirLimpiar(item: CompaniaConfig) {
    setLimpMotivo('');
    setLimpTexto('');
    setLimpErrores({});
    setLimpProgreso(0);
    setLimpEjecutando(false);
    setLimpResultado(null);
    setLimpiar({ compania: item });
  }

  function ejecutarLimpiar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores: { motivo?: string; texto?: string } = {};
    if (limpMotivo.trim().length < 10) nuevosErrores.motivo = 'El motivo debe tener al menos 10 caracteres.';
    if (limpTexto.trim() !== TEXTO_LIMPIAR) nuevosErrores.texto = `Escriba exactamente "${TEXTO_LIMPIAR}" para confirmar.`;
    setLimpErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) return;
    setLimpEjecutando(true);
  }

  const BADGE_ESTADO: Record<string, string> = {
    'Activa': 'bg-green-100 text-green-700',
    'Inactiva': 'bg-gray-100 text-gray-600',
    'En proceso': 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Compañías</div>
          <h1 className="text-lg font-semibold text-gray-800">Compañías</h1>
          <p className="mt-1 text-xs text-gray-500">Múltiples contabilidades en una misma instalación: creación, traslado de año y limpieza de datos.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por código, nombre o NIT..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
        <span className="text-xs text-gray-500">{companias.filter(c => c.estado === 'Activa').length} compañía(s) activa(s)</span>
        <button onClick={() => exportarCSV(filtrados)} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
        <button onClick={abrirCrear} className={BUTTON_PRIMARY}>+ Crear compañía</button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Año</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(c => (
                <tr key={c.codigo} className="hoverable">
                  <td className="px-3 py-2.5 font-mono font-bold text-gray-800">{c.codigo}{c.codigo === EMPRESA.codigo && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-petroleum-50 text-petroleum-700">Actual</span>}</td>
                  <td className="px-3 py-2.5 text-gray-700">{c.nombre}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">{c.nit}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">{c.anio}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_ESTADO[c.estado] || 'bg-gray-100 text-gray-600'}`}>{c.estado}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <button onClick={() => abrirEditar(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => abrirTrasladar(c)} className="text-xs text-petroleum-600 hover:underline">Trasladar</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => abrirLimpiar(c)} className="text-xs text-amber-600 hover:underline">Limpiar</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => setEliminar(c)} disabled={c.codigo === EMPRESA.codigo} className="text-xs text-red-500 hover:underline disabled:text-gray-300 disabled:no-underline" title={c.codigo === EMPRESA.codigo ? 'No se puede eliminar la compañía activa de la sesión' : 'Eliminar compañía'}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          {filtrados.length} compañía{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {modal && <Modal title={modal.modo === 'crear' ? 'Nueva compañía' : `Editar compañía ${modal.original}`} onClose={() => setModal(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos de la compañía</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cia-codigo" className="text-xs font-medium text-gray-600">Código:</label>
                  <input id="cia-codigo" data-initial-focus className={`${INPUT} font-mono`} value={form.codigo} maxLength={3} inputMode="numeric" onChange={e => update('codigo', e.target.value.replace(/\D/g, ''))} aria-invalid={!!errores.codigo} aria-describedby={errores.codigo ? 'cia-codigo-error' : undefined} />
                  {errores.codigo && <p id="cia-codigo-error" className="text-xs text-red-600 sm:col-start-2">{errores.codigo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cia-nit" className="text-xs font-medium text-gray-600">NIT:</label>
                  <input id="cia-nit" className={`${INPUT} font-mono`} value={form.nit} placeholder="999.999.999-9" onChange={e => update('nit', e.target.value)} aria-invalid={!!errores.nit} aria-describedby={errores.nit ? 'cia-nit-error' : undefined} />
                  {errores.nit && <p id="cia-nit-error" className="text-xs text-red-600 sm:col-start-2">{errores.nit}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cia-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="cia-nombre" className={INPUT} value={form.nombre} onChange={e => update('nombre', e.target.value)} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'cia-nombre-error' : undefined} />
                  {errores.nombre && <p id="cia-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cia-anio" className="text-xs font-medium text-gray-600">Año:</label>
                  <input id="cia-anio" type="number" min={2000} max={2100} className={`${INPUT} font-mono`} value={String(form.anio)} onChange={e => update('anio', Number(e.target.value))} aria-invalid={!!errores.anio} aria-describedby={errores.anio ? 'cia-anio-error' : undefined} />
                  {errores.anio && <p id="cia-anio-error" className="text-xs text-red-600 sm:col-start-2">{errores.anio}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cia-estado" className="text-xs font-medium text-gray-600">Estado:</label>
                  <select id="cia-estado" className={INPUT} value={form.estado} onChange={e => update('estado', e.target.value)}>
                    <option value="Activa">Activa</option>
                    <option value="Inactiva">Inactiva</option>
                    <option value="En proceso">En proceso</option>
                  </select>
                </div>
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setModal(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar</button>
          </div>
        </form>
      </Modal>}

      {eliminar && <Modal title="Eliminar compañía" onClose={() => setEliminar(null)}>
        <p className="p-5 text-sm text-gray-600">¿Está seguro de eliminar la compañía <span className="font-mono font-semibold text-gray-800">{eliminar.codigo}</span> — {eliminar.nombre}? Se eliminarán su plan de cuentas, terceros y movimientos de demostración.</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          <button type="button" onClick={confirmarEliminar} className={BUTTON_DANGER}>Eliminar</button>
        </div>
      </Modal>}

      {trasladar && <Modal title={`Trasladar año — compañía ${trasladar.compania.codigo}`} onClose={() => setTrasladar(null)}>
        {trasResultado ? (
          <div className="space-y-3 p-5">
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">✓ {trasResultado}</div>
            <p className="text-xs text-gray-500">En la versión de producción este proceso copia los saldos finales del año origen como saldos iniciales del año destino y genera los comprobantes de cierre.</p>
          </div>
        ) : (
          <form noValidate onSubmit={ejecutarTraslado}>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1">
                  <label htmlFor="tras-origen" className="text-xs font-medium text-gray-600">Año origen:</label>
                  <input id="tras-origen" data-initial-focus type="number" min={2000} max={2100} className={`${INPUT} font-mono`} value={String(trasForm.anioOrigen)} disabled={trasEjecutando} onChange={e => setTrasForm(prev => ({ ...prev, anioOrigen: Number(e.target.value) }))} />
                </div>
                <div className="grid items-center gap-1">
                  <label htmlFor="tras-destino" className="text-xs font-medium text-gray-600">Año destino:</label>
                  <input id="tras-destino" type="number" min={2000} max={2100} className={`${INPUT} font-mono`} value={String(trasForm.anioDestino)} disabled={trasEjecutando} onChange={e => setTrasForm(prev => ({ ...prev, anioDestino: Number(e.target.value) }))} />
                </div>
              </div>
              {trasError && <p role="alert" className="text-xs text-red-600">{trasError}</p>}
              {trasEjecutando && <BarraProgreso progreso={trasProgreso} />}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setTrasladar(null)} className={BUTTON_SECONDARY} disabled={trasEjecutando}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY} disabled={trasEjecutando}>Iniciar traslado</button>
            </div>
          </form>
        )}
        {trasResultado && <div className="flex justify-end gap-2 border-t border-gray-200 p-4"><button type="button" onClick={() => setTrasladar(null)} className={BUTTON_PRIMARY}>Aceptar</button></div>}
      </Modal>}

      {limpiar && <Modal wide title={`Limpiar compañía ${limpiar.compania.codigo} — acción de alto riesgo`} onClose={() => setLimpiar(null)}>
        {limpResultado ? (
          <div className="space-y-3 p-5">
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">✓ {limpResultado}</div>
          </div>
        ) : (
          <form noValidate onSubmit={ejecutarLimpiar}>
            <div className="space-y-3 p-5">
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
                <strong>Esta operación elimina todos los datos contables de la compañía.</strong> No se puede deshacer. Confirme que cuenta con un respaldo externo antes de continuar.
              </div>
              <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
                <legend className="px-2 text-xs font-semibold text-petroleum-800">Contexto de la operación</legend>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Compañía:</span><span className="font-mono font-semibold text-gray-800">{limpiar.compania.codigo} — {limpiar.compania.nombre}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">NIT:</span><span className="font-mono text-gray-800">{limpiar.compania.nit}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Año:</span><span className="font-mono text-gray-800">{limpiar.compania.anio}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Período actual:</span><span className="font-mono text-gray-800">{PERIODO.nombre}</span></div>
                </div>
              </fieldset>
              <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
                <legend className="px-2 text-xs font-semibold text-petroleum-800">Tablas afectadas ({TABLAS_AFECTADAS_LIMPIAR.length})</legend>
                <ul className="mt-2 space-y-1">
                  {TABLAS_AFECTADAS_LIMPIAR.map(tabla => (
                    <li key={tabla} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-red-500">✕</span><span className="font-mono text-gray-700">{tabla}</span>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <div className="grid items-center gap-1">
                <label htmlFor="limp-motivo" className="text-xs font-medium text-gray-600">Motivo de la limpieza (mínimo 10 caracteres):</label>
                <textarea id="limp-motivo" rows={2} className={INPUT} value={limpMotivo} disabled={limpEjecutando} onChange={e => { setLimpMotivo(e.target.value); setLimpErrores(prev => ({ ...prev, motivo: undefined })); }} aria-invalid={!!limpErrores.motivo} aria-describedby={limpErrores.motivo ? 'limp-motivo-error' : undefined} />
                {limpErrores.motivo && <p id="limp-motivo-error" className="text-xs text-red-600">{limpErrores.motivo}</p>}
              </div>
              <div className="grid items-center gap-1">
                <label htmlFor="limp-texto" className="text-xs font-medium text-gray-600">Escriba <span className="font-mono font-semibold">{TEXTO_LIMPIAR}</span> para confirmar:</label>
                <input id="limp-texto" data-initial-focus className={`${INPUT} font-mono`} value={limpTexto} disabled={limpEjecutando} onChange={e => { setLimpTexto(e.target.value); setLimpErrores(prev => ({ ...prev, texto: undefined })); }} aria-invalid={!!limpErrores.texto} aria-describedby={limpErrores.texto ? 'limp-texto-error' : undefined} />
                {limpErrores.texto && <p id="limp-texto-error" className="text-xs text-red-600">{limpErrores.texto}</p>}
              </div>
              {limpEjecutando && <BarraProgreso progreso={limpProgreso} />}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setLimpiar(null)} className={BUTTON_SECONDARY} disabled={limpEjecutando}>Cancelar</button>
              <button type="submit" className={BUTTON_DANGER} disabled={limpEjecutando || !limpMotivo.trim() || !limpTexto.trim()}>Limpiar compañía</button>
            </div>
          </form>
        )}
        {limpResultado && <div className="flex justify-end gap-2 border-t border-gray-200 p-4"><button type="button" onClick={() => setLimpiar(null)} className={BUTTON_PRIMARY}>Aceptar</button></div>}
      </Modal>}
    </div>
  );
}

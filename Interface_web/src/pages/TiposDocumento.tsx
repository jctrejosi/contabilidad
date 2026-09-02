import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EMPRESA } from '../data/mock';
import { TIPOS_DOCUMENTO_INICIALES, esTiposDocumentoGuardados, validarTipoDocumento, type ErroresTipoDocumento, type TipoDocumentoConfig } from '../data/configTiposDocumento';

const STORAGE_KEY = `contabdsi:tipos-documento:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function cargar(): TipoDocumentoConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esTiposDocumentoGuardados(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(TIPOS_DOCUMENTO_INICIALES);
}

function guardar(tipos: TipoDocumentoConfig[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tipos));
    return true;
  } catch {
    return false;
  }
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

function exportarCSV(tipos: TipoDocumentoConfig[]) {
  const filas = [['Código', 'Nombre', 'Numeración', 'Consecutivo', 'Tercero obligatorio', 'Centro obligatorio'],
  ...tipos.map(t => [t.codigo, t.nombre, t.numeracion === 'AUTOMATICA' ? 'Automática' : 'Manual', t.numeracion === 'AUTOMATICA' ? String(t.consecutivo) : '—', t.terceroObligatorio ? 'Sí' : 'No', t.centroObligatorio ? 'Sí' : 'No'])];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `tipos-documento-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_VACIO: TipoDocumentoConfig = { codigo: '', nombre: '', numeracion: 'MANUAL', consecutivo: 0, terceroObligatorio: false, centroObligatorio: false };

export default function TiposDocumento() {
  const [tipos, setTipos] = useState<TipoDocumentoConfig[]>(cargar);
  const [busqueda, setBusqueda] = useState('');
  const [filtroNumeracion, setFiltroNumeracion] = useState<'todas' | 'MANUAL' | 'AUTOMATICA'>('todas');
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; original?: string } | null>(null);
  const [form, setForm] = useState<TipoDocumentoConfig>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresTipoDocumento>({});
  const [eliminar, setEliminar] = useState<TipoDocumentoConfig | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const filtrados = tipos.filter(t => {
    if (filtroNumeracion !== 'todas' && t.numeracion !== filtroNumeracion) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return t.codigo.toLowerCase().includes(q) || t.nombre.toLowerCase().includes(q);
    }
    return true;
  });

  function abrirCrear() {
    setForm(structuredClone(FORM_VACIO));
    setErrores({});
    setModal({ modo: 'crear' });
  }

  function abrirEditar(item: TipoDocumentoConfig) {
    setForm(structuredClone(item));
    setErrores({});
    setModal({ modo: 'editar', original: item.codigo });
  }

  function update(field: keyof TipoDocumentoConfig, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarTipoDocumento(form, tipos, modal?.original);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar.' });
      return;
    }
    const limpio: TipoDocumentoConfig = {
      ...form,
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      consecutivo: form.numeracion === 'AUTOMATICA' ? form.consecutivo : 0,
    };
    const siguientes = modal?.modo === 'editar'
      ? tipos.map(t => t.codigo === modal.original ? limpio : t)
      : [...tipos, limpio];
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setTipos(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Tipo de documento ${limpio.codigo} actualizado.` : `Tipo de documento ${limpio.codigo} creado.` });
    setModal(null);
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = tipos.filter(t => t.codigo !== eliminar.codigo);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó el tipo de documento.' });
      setEliminar(null);
      return;
    }
    setTipos(siguientes);
    setMensaje({ tipo: 'success', texto: `Tipo de documento ${eliminar.codigo} eliminado.` });
    setEliminar(null);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Tipos de documento</div>
          <h1 className="text-lg font-semibold text-gray-800">Tipos de documento</h1>
          <p className="mt-1 text-xs text-gray-500">Numeración manual o automática, consecutivo vigente y exigencias de tercero y centro de costo.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por código o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
        {(['todas', 'AUTOMATICA', 'MANUAL'] as const).map(n => (
          <button key={n} onClick={() => setFiltroNumeracion(n)} className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${filtroNumeracion === n ? 'bg-petroleum-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {n === 'todas' ? 'Todas' : n === 'AUTOMATICA' ? 'Automática' : 'Manual'}
          </button>
        ))}
        <button onClick={() => exportarCSV(filtrados)} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
        <button onClick={abrirCrear} className={BUTTON_PRIMARY}>+ Crear tipo</button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Numeración</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Consecutivo</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Tercero obligatorio</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Centro obligatorio</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(t => (
                <tr key={t.codigo} className="hoverable">
                  <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{t.codigo}</td>
                  <td className="px-3 py-2.5 text-gray-700">{t.nombre}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.numeracion === 'AUTOMATICA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {t.numeracion === 'AUTOMATICA' ? 'Automática' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                    {t.numeracion === 'AUTOMATICA' ? String(t.consecutivo).padStart(4, '0') : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">{t.terceroObligatorio ? <span className="text-blue-500 font-semibold">✓</span> : <span className="text-gray-200">—</span>}</td>
                  <td className="px-3 py-2.5 text-center">{t.centroObligatorio ? <span className="text-blue-500 font-semibold">✓</span> : <span className="text-gray-200">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEditar(t)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => setEliminar(t)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          {filtrados.length} tipo{filtrados.length !== 1 ? 's' : ''} de documento
        </div>
      </div>

      {modal && <Modal title={modal.modo === 'crear' ? 'Nuevo tipo de documento' : `Editar tipo ${modal.original}`} onClose={() => setModal(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos del tipo de documento</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="td-codigo" className="text-xs font-medium text-gray-600">Código:</label>
                  <input id="td-codigo" data-initial-focus className={`${INPUT} font-mono`} value={form.codigo} maxLength={3} onChange={e => update('codigo', e.target.value.toUpperCase())} aria-invalid={!!errores.codigo} aria-describedby={errores.codigo ? 'td-codigo-error' : undefined} />
                  {errores.codigo && <p id="td-codigo-error" className="text-xs text-red-600 sm:col-start-2">{errores.codigo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="td-numeracion" className="text-xs font-medium text-gray-600">Numeración:</label>
                  <select id="td-numeracion" className={INPUT} value={form.numeracion} onChange={e => update('numeracion', e.target.value)}>
                    <option value="MANUAL">Manual</option>
                    <option value="AUTOMATICA">Automática</option>
                  </select>
                  {errores.numeracion && <p className="text-xs text-red-600 sm:col-start-2">{errores.numeracion}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="td-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="td-nombre" className={INPUT} value={form.nombre} onChange={e => update('nombre', e.target.value)} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'td-nombre-error' : undefined} />
                  {errores.nombre && <p id="td-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                {form.numeracion === 'AUTOMATICA' && (
                  <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                    <label htmlFor="td-consecutivo" className="text-xs font-medium text-gray-600">Consecutivo:</label>
                    <input id="td-consecutivo" type="number" min={0} step={1} className={`${INPUT} font-mono`} value={String(form.consecutivo)} onChange={e => update('consecutivo', Number(e.target.value))} aria-invalid={!!errores.consecutivo} aria-describedby={errores.consecutivo ? 'td-consecutivo-error' : undefined} />
                    {errores.consecutivo && <p id="td-consecutivo-error" className="text-xs text-red-600 sm:col-start-2">{errores.consecutivo}</p>}
                  </div>
                )}
              </div>
            </fieldset>
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Exigencias al digitar</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                  <input type="checkbox" checked={form.terceroObligatorio} onChange={e => update('terceroObligatorio', e.target.checked)} className="h-4 w-4 shrink-0 accent-petroleum-500" />
                  <span>Tercero obligatorio</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                  <input type="checkbox" checked={form.centroObligatorio} onChange={e => update('centroObligatorio', e.target.checked)} className="h-4 w-4 shrink-0 accent-petroleum-500" />
                  <span>Centro de costo obligatorio</span>
                </label>
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setModal(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar</button>
          </div>
        </form>
      </Modal>}

      {eliminar && <Modal title="Eliminar tipo de documento" onClose={() => setEliminar(null)}>
        <p className="p-5 text-sm text-gray-600">¿Está seguro de eliminar el tipo de documento <span className="font-mono font-semibold text-gray-800">{eliminar.codigo}</span> — {eliminar.nombre}? Los documentos existentes conservarán su numeración.</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar</button>
        </div>
      </Modal>}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  PERIODOS_OPERACION, esRutaContableValida, validarParametros,
  type ErroresParametros, type ParametrosOperacion as Parametros, type PeriodoOperacion,
} from '../data/parametrosOperacion';
import { consultarParametrosOperacion, guardarParametrosOperacion } from '../api/parametrosOperacion';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

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

export default function ParametrosOperacion({ cia, onExit }: { cia: string; onExit: () => void }) {
  const [guardados, setGuardados] = useState<Parametros | null>(null);
  const [form, setForm] = useState<Parametros | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [errores, setErrores] = useState<ErroresParametros>({});
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [showDirectory, setShowDirectory] = useState(false);
  const [ruta, setRuta] = useState('');
  const [errorRuta, setErrorRuta] = useState('');
  const [showExit, setShowExit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = Boolean(form && guardados && JSON.stringify(form) !== JSON.stringify(guardados));
  const habilitados = form ? Object.values(form.periodosHabilitados).filter(Boolean).length : 0;

  useEffect(() => {
    let active = true;
    setCargando(true);
    setErrorCarga('');
    consultarParametrosOperacion(cia)
      .then(item => {
        if (!active) return;
        setGuardados(item);
        setForm(structuredClone(item));
      })
      .catch(cause => {
        if (!active) return;
        setErrorCarga('No fue posible cargar los parámetros de operación.');
      })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [cia]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update<K extends keyof Parametros>(field: K, value: Parametros[K]) {
    setForm(prev => prev ? ({ ...prev, [field]: value }) : prev);
    setErrores(prev => ({ ...prev, [field]: undefined }));
    setMensaje(null);
  }

  async function grabar(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    const nuevosErrores = validarParametros(form);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de grabar.' });
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setGuardando(true);
    try {
      const saved = await guardarParametrosOperacion(cia, form);
      setGuardados(saved);
      setForm(structuredClone(saved));
      setMensaje({ tipo: 'success', texto: 'Parámetros guardados correctamente.' });
    } catch (cause) {
      setMensaje({ tipo: 'error', texto: 'No fue posible guardar los parámetros. Revise los datos e intente nuevamente.' });
    } finally {
      setGuardando(false);
    }
  }

  function avanzarConEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    // Al llegar a Guardar se conserva el comportamiento nativo para enviar el formulario.
    if (target.matches('button[type="submit"]')) return;
    event.preventDefault();
    const controles = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'input:not(:disabled):not([readonly]), select:not(:disabled), textarea:not(:disabled), button[type="submit"]:not(:disabled)',
    ));
    const posicion = controles.indexOf(target);
    controles[posicion + 1]?.focus();
  }

  function campo(label: string, field: keyof Parametros, options: { placeholder?: string; className?: string; numeric?: boolean } = {}) {
    if (!form) return null;
    const id = `param-${field}`;
    return (
      <div className={`${options.className || ''} grid items-center gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-3`}>
        <label htmlFor={id} className="text-xs font-medium text-gray-600">{label}</label>
        <input id={id} name={field} className={INPUT} value={String(form[field])} onChange={e => update(field, e.target.value)}
          placeholder={options.placeholder} inputMode={options.numeric ? 'numeric' : undefined} maxLength={options.numeric ? 4 : undefined}
          aria-invalid={!!errores[field]} aria-describedby={errores[field] ? `${id}-error` : undefined} />
        {errores[field] && <p id={`${id}-error`} className="text-xs text-red-600 sm:col-start-2">{errores[field]}</p>}
      </div>
    );
  }

  function control(label: string, field: 'verificaDocumentosLotes' | 'tercerosDocumentosPropios' | 'controlaUsuarioLotes', description: string) {
    if (!form) return null;
    return (
      <label title={description} className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
        <input type="checkbox" checked={form[field]} onChange={e => update(field, e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-petroleum-500" />
        <span>{label}</span>
      </label>
    );
  }

  function periodo(codigo: PeriodoOperacion) {
    if (!form) return null;
    const item = PERIODOS_OPERACION.find(p => p.codigo === codigo)!;
    const enabled = form.periodosHabilitados[codigo];
    return (
      <label key={codigo} className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
        <span>{item.nombre}</span>
        <input type="checkbox" aria-label={item.nombre} checked={enabled} onChange={e => update('periodosHabilitados', { ...form.periodosHabilitados, [codigo]: e.target.checked })}
          className="h-4 w-4 shrink-0 accent-petroleum-500" />
      </label>
    );
  }

  if (cargando) return <div className="p-6 text-sm text-gray-500">Cargando parámetros de operación…</div>;
  if (errorCarga || !form) return <div className="m-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div>{errorCarga || 'No fue posible cargar los parámetros.'}</div><button type="button" onClick={onExit} className="mt-3 underline">Volver</button></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Parámetros</div>
          <h1 className="text-lg font-semibold text-gray-800">Parámetros de operación</h1>
        </div>
      </div>

      <form ref={formRef} noValidate onKeyDown={avanzarConEnter} onSubmit={grabar} className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
          <span className="text-sm font-semibold text-petroleum-900">Definición parámetros de operación</span>
          <div className="text-right"><div className={`text-xs ${dirty ? 'text-amber-600' : 'text-gray-400'}`}>{dirty ? '● Cambios sin guardar' : `Compañía ${cia}`}</div><div className="mt-0.5 text-[11px] text-gray-400">Use Enter para avanzar entre campos.</div></div>
        </div>

        <div className="space-y-3 p-4">
          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos Compañía</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-6">
              {campo('Nombre de la empresa:', 'nombreEmpresa', { className: 'sm:col-span-6' })}
              {campo('NIT:', 'nit', { className: 'sm:col-span-3' })}
              {campo('Dirección:', 'direccion', { className: 'sm:col-span-3', placeholder: 'Dirección de la empresa' })}
              {campo('Ciudad:', 'ciudad', { className: 'sm:col-span-3', placeholder: 'Ciudad de la empresa' })}
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Parámetros generales</legend>
            <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-3">
                <label htmlFor="param-directorioContabilidad" className="text-xs font-medium text-gray-600">Directorio de contabilidad:</label>
                <div className="flex items-start gap-2">
                  <input id="param-directorioContabilidad" className={`${INPUT} font-mono`} value={form.directorioContabilidad} onChange={e => update('directorioContabilidad', e.target.value)}
                    aria-invalid={!!errores.directorioContabilidad} aria-describedby="directory-help" />
                  <button type="button" title="Seleccionar directorio" aria-label="Seleccionar directorio" onClick={() => { setRuta(form.directorioContabilidad); setErrorRuta(''); setShowDirectory(true); }} className="shrink-0 rounded border border-gray-300 p-1.5 text-petroleum-600 hover:bg-petroleum-50">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h16a2 2 0 0 1 2 2l-2 10H3L1 9a2 2 0 0 1 2-2Z" /></svg>
                  </button>
                </div>
                {errores.directorioContabilidad && <p id="directory-help" className="text-xs text-red-600 sm:col-start-2">{errores.directorioContabilidad}</p>}
              </div>
              {campo('Año de operación:', 'anioOperacion', { numeric: true })}
              {campo('Contabilidad de conciliación:', 'contabilidadConciliacion', { placeholder: 'Código de 3 caracteres' })}
              <div className="mt-1">{control('Verificar documentos en lotes', 'verificaDocumentosLotes', 'Activa el control de documentos al verificar un lote.')}</div>
              <div className="mt-1">{control('Operar terceros y documentos propios', 'tercerosDocumentosPropios', 'Utiliza la configuración propia de terceros y documentos.')}</div>
              <div>{control('Controlar usuario de lotes', 'controlaUsuarioLotes', 'Controla que el usuario corresponda al propietario del lote.')}</div>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Comentario del certificado</legend>
            <div className="mt-2 space-y-2">
              <label htmlFor="param-comentarioCertificado" className="sr-only">Comentario del certificado</label>
              <input id="param-comentarioCertificado" maxLength={120} className={INPUT} value={form.comentarioCertificado} onChange={e => update('comentarioCertificado', e.target.value)} placeholder="Comentario para certificados de retención" />
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Períodos habilitados</legend>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500">Marcado: habilitado. Sin marcar: bloqueado para registrar movimiento.</p>
              <span className="text-xs text-petroleum-700">{habilitados} de 13 períodos habilitados</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-x-5 sm:grid-cols-4">
              <div>{periodo('00')}{(['01', '02', '03'] as const).map(periodo)}</div>
              <div className="sm:pt-7">{(['04', '05', '06'] as const).map(periodo)}</div>
              <div className="sm:pt-7">{(['07', '08', '09'] as const).map(periodo)}</div>
              <div className="sm:pt-7">{(['10', '11', '12'] as const).map(periodo)}</div>
            </div>
          </fieldset>

          {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}
        </div>

        <div className="flex items-center justify-center gap-4 rounded-b-lg border-t border-gray-200 bg-gray-50 px-5 py-4">
          <button type="submit" disabled={guardando || !dirty} className={`${BUTTON_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          <button type="button" onClick={() => dirty ? setShowExit(true) : onExit()} className={BUTTON_SECONDARY}>Salir</button>
        </div>
      </form>

      {showDirectory && <Modal title="Ubicación Contabilidad" onClose={() => setShowDirectory(false)}>
        <form noValidate onSubmit={e => { e.preventDefault(); if (!esRutaContableValida(ruta)) { setErrorRuta('Ingrese una ruta absoluta de Windows o de red válida.'); return; } update('directorioContabilidad', ruta.trim()); setShowDirectory(false); }}>
          <div className="space-y-3 p-5">
            <label htmlFor="ruta-contable" className="block text-xs font-medium text-gray-600">Directorio de la contabilidad</label>
            <input id="ruta-contable" data-initial-focus value={ruta} onChange={e => { setRuta(e.target.value); setErrorRuta(''); }} className={`${INPUT} font-mono`} aria-invalid={!!errorRuta} aria-describedby={errorRuta ? 'ruta-error' : undefined} />
            {errorRuta && <p id="ruta-error" role="alert" className="text-xs text-red-600">{errorRuta}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4"><button type="button" onClick={() => setShowDirectory(false)} className={BUTTON_SECONDARY}>Cancelar</button><button type="submit" className={BUTTON_PRIMARY}>Usar directorio</button></div>
        </form>
      </Modal>}

      {showExit && <Modal title="Cambios sin grabar" onClose={() => setShowExit(false)}>
        <p className="p-5 text-sm text-gray-600">Hay cambios en los parámetros que aún no ha grabado. ¿Desea salir y descartarlos?</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4"><button type="button" data-initial-focus onClick={() => setShowExit(false)} className={BUTTON_SECONDARY}>Continuar editando</button><button type="button" onClick={onExit} className={BUTTON_PRIMARY}>Salir sin grabar</button></div>
      </Modal>}
    </div>
  );
}

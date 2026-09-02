import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EMPRESA, PERIODO } from '../data/mock';
import {
  PERIODOS_OPERACION, crearParametrosIniciales, esParametrosGuardados, esRutaContableValida, validarParametros,
  type ErroresParametros, type ParametrosOperacion as Parametros, type PeriodoOperacion,
} from '../data/parametrosOperacion';

const STORAGE_KEY = `contabdsi:parametros-operacion:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function cargarParametros(): Parametros {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esParametrosGuardados(value)) return value;
    }
  } catch {
    // Una preferencia dañada o almacenamiento deshabilitado no debe dejar la pantalla vacía.
  }
  return crearParametrosIniciales(EMPRESA, PERIODO.anio);
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

export default function ParametrosOperacion({ onExit }: { onExit: () => void }) {
  const [guardados, setGuardados] = useState(cargarParametros);
  const [form, setForm] = useState<Parametros>(() => structuredClone(guardados));
  const [errores, setErrores] = useState<ErroresParametros>({});
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [showDirectory, setShowDirectory] = useState(false);
  const [ruta, setRuta] = useState('');
  const [errorRuta, setErrorRuta] = useState('');
  const [showExit, setShowExit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(guardados);
  const habilitados = Object.values(form.periodosHabilitados).filter(Boolean).length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update<K extends keyof Parametros>(field: K, value: Parametros[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
    setMensaje(null);
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarParametros(form);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de grabar.' });
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setGuardados(structuredClone(form));
      setMensaje({ tipo: 'success', texto: 'Parámetros grabados en este navegador. No se modificó la base de datos contable original.' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. Los cambios siguen en pantalla; habilite el almacenamiento e intente de nuevo.' });
    }
  }

  function campo(label: string, field: keyof Parametros, options: { placeholder?: string; className?: string; numeric?: boolean } = {}) {
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
    return (
      <label title={description} className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
        <input type="checkbox" checked={form[field]} onChange={e => update(field, e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-petroleum-500" />
        <span>{label}</span>
      </label>
    );
  }

  function periodo(codigo: PeriodoOperacion) {
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

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Parámetros</div>
          <h1 className="text-lg font-semibold text-gray-800">Parámetros de operación</h1>
          <p className="mt-1 text-xs text-gray-500">Definición de parámetros de operación — los mismos campos del formulario original.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
        Prototipo local del formulario <strong>PARAM_1</strong>. Grabar conserva los cambios sólo en este navegador, sin modificar la contabilidad original.
      </div>

      <form ref={formRef} noValidate onSubmit={grabar} className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
          <span className="text-sm font-semibold text-petroleum-900">Definición parámetros de operación</span>
          <span className={`text-xs ${dirty ? 'text-amber-600' : 'text-gray-400'}`}>{dirty ? '● Cambios sin grabar' : 'Compañía ' + EMPRESA.codigo}</span>
        </div>

        <div className="space-y-3 p-4">
          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos Compañía</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-6">
              {campo('Nombre Empresa:', 'nombreEmpresa', { className: 'sm:col-span-6' })}
              {campo('Nit:', 'nit', { className: 'sm:col-span-3' })}
              {campo('Dirección:', 'direccion', { className: 'sm:col-span-3', placeholder: 'Dirección de la empresa' })}
              {campo('Ciudad:', 'ciudad', { className: 'sm:col-span-3', placeholder: 'Ciudad de la empresa' })}
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Parámetros generales</legend>
            <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-3">
                <label htmlFor="param-directorioContabilidad" className="text-xs font-medium text-gray-600">Directorio Contabilidad:</label>
                <div className="flex items-start gap-2">
                  <input id="param-directorioContabilidad" className={`${INPUT} font-mono`} value={form.directorioContabilidad} onChange={e => update('directorioContabilidad', e.target.value)}
                    aria-invalid={!!errores.directorioContabilidad} aria-describedby="directory-help" />
                  <button type="button" title="Seleccionar directorio" aria-label="Seleccionar directorio" onClick={() => { setRuta(form.directorioContabilidad); setErrorRuta(''); setShowDirectory(true); }} className="shrink-0 rounded border border-gray-300 p-1.5 text-petroleum-600 hover:bg-petroleum-50">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h16a2 2 0 0 1 2 2l-2 10H3L1 9a2 2 0 0 1 2-2Z" /></svg>
                  </button>
                </div>
                <p id="directory-help" className={`text-xs sm:col-start-2 ${errores.directorioContabilidad ? 'text-red-600' : 'text-gray-400'}`}>{errores.directorioContabilidad || 'Su existencia se verificará al conectar el servidor.'}</p>
              </div>
              {campo('Año Operación:', 'anioOperacion', { numeric: true })}
              {campo('Contabilidad de Conciliación:', 'contabilidadConciliacion', { placeholder: 'Código de contabilidad' })}
              <div className="mt-1">{control('Verifica Documentos en Lotes', 'verificaDocumentosLotes', 'Activa el control de documentos al verificar un lote.')}</div>
              <div className="mt-1">{control('Opera Terceros y Documentos Propios:', 'tercerosDocumentosPropios', 'Usa los maestros de esta contabilidad, no los compartidos.')}</div>
              <div>{control('Controla Usuario Lotes:', 'controlaUsuarioLotes', 'Controla que el usuario corresponda al propietario del lote.')}</div>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Comentario Certificado y Manejo Cuentas de Retención</legend>
            <div className="mt-2 space-y-2">
              <label htmlFor="param-comentarioCertificado" className="sr-only">Comentario del certificado</label>
              <input id="param-comentarioCertificado" className={INPUT} value={form.comentarioCertificado} onChange={e => update('comentarioCertificado', e.target.value)} placeholder="Comentario que se incluye en el certificado de retención" />
              <div className="space-y-2" role="radiogroup" aria-label="Manejo de cuentas de retención">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700"><input type="radio" name="manejo-retencion" value="retencion-a-base" checked={form.modoRetencion === 'retencion-a-base'} onChange={() => update('modoRetencion', 'retencion-a-base')} className="h-4 w-4 accent-petroleum-500" />Digita la Retención el Sistema Calcula la Base</label>
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700"><input type="radio" name="manejo-retencion" value="base-a-retencion" checked={form.modoRetencion === 'base-a-retencion'} onChange={() => update('modoRetencion', 'base-a-retencion')} className="h-4 w-4 accent-petroleum-500" />Digita la Base el Sistema Calcula la Retención</label>
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Bloqueo meses</legend>
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
          <button type="submit" className={BUTTON_PRIMARY}>Grabar</button>
          <button type="button" onClick={() => dirty ? setShowExit(true) : onExit()} className={BUTTON_SECONDARY}>Salir</button>
        </div>
      </form>

      {showDirectory && <Modal title="Ubicación Contabilidad" onClose={() => setShowDirectory(false)}>
        <form noValidate onSubmit={e => { e.preventDefault(); if (!esRutaContableValida(ruta)) { setErrorRuta('Ingrese una ruta absoluta de Windows o de red válida.'); return; } update('directorioContabilidad', ruta.trim()); setShowDirectory(false); }}>
          <div className="space-y-3 p-5">
            <p className="text-xs leading-relaxed text-gray-500">En la versión web se indica la ruta del servidor. Este prototipo no explora carpetas ni comprueba archivos reales.</p>
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

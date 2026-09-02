import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { EMPRESA, PERIODO, fmtCOP } from '../data/mock';
import { CAMPOS_FORMATO, ELEMENTOS_DISPONIBLES, FORMATOS_INICIALES, crearElemento, esFormatosGuardados, type Alineacion, type CampoFormato, type ElementoFormato, type FormatoDocumental, type TipoElementoFormato } from '../data/configFormatos';

const STORAGE_KEY = `contabdsi:formatos:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

const VALORES_CAMPOS: Record<CampoFormato, string> = {
  comprobante: 'CE-000246',
  documento: 'CE-2026-046',
  fecha: '2026-02-28',
  totales: fmtCOP(12600000),
};

function cargar(): FormatoDocumental[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esFormatosGuardados(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(FORMATOS_INICIALES);
}

function guardar(formatos: FormatoDocumental[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formatos));
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

function nombreCampo(campo?: CampoFormato): string {
  return CAMPOS_FORMATO.find(c => c.valor === campo)?.nombre || '—';
}

function ElementoCanvas({ elemento, seleccionado, vistaPrevia, onSelect }: { elemento: ElementoFormato; seleccionado: boolean; vistaPrevia: boolean; onSelect: () => void }) {
  const style: CSSProperties = {
    position: 'absolute',
    left: elemento.x,
    top: elemento.y,
    width: elemento.w,
    height: elemento.h,
    fontSize: elemento.fontSize,
    fontWeight: elemento.negrita ? 700 : 400,
    textAlign: elemento.alineacion === 'izquierda' ? 'left' : elemento.alineacion === 'centro' ? 'center' : 'right',
    lineHeight: 1.2,
  };
  const seleccionStyle = !vistaPrevia && seleccionado ? { outline: '1.5px dashed #0073C0', outlineOffset: 1 } : {};

  if (elemento.tipo === 'linea') {
    return <div onClick={onSelect} style={{ ...style, ...seleccionStyle, backgroundColor: '#1f2937' }} aria-label="Línea" />;
  }
  if (elemento.tipo === 'rectangulo') {
    return <div onClick={onSelect} style={{ ...style, ...seleccionStyle, border: '1px solid #6b7280' }} aria-label="Rectángulo" />;
  }
  if (elemento.tipo === 'imagen') {
    return (
      <div onClick={onSelect} style={{ ...style, ...seleccionStyle }} className="flex items-center justify-center border border-dashed border-gray-400 bg-gray-100 text-gray-400" aria-label="Imagen">
        <span className="text-lg">🖼</span>
      </div>
    );
  }
  if (elemento.tipo === 'campo') {
    const valor = vistaPrevia && elemento.campo ? VALORES_CAMPOS[elemento.campo] : elemento.texto || `{${elemento.campo || ''}}`;
    return (
      <div onClick={onSelect} style={{ ...style, ...seleccionStyle }} className="truncate text-gray-800" aria-label={`Campo ${nombreCampo(elemento.campo)}`}>
        {valor}
      </div>
    );
  }
  return (
    <div onClick={onSelect} style={{ ...style, ...seleccionStyle }} className="text-gray-800" aria-label="Leyenda">
      {elemento.texto}
    </div>
  );
}

export default function FormatosDocumentales() {
  const [formatos, setFormatos] = useState<FormatoDocumental[]>(cargar);
  const [guardadosRef, setGuardadosRef] = useState<FormatoDocumental[]>(() => cargar());
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(formatos.length ? formatos[0].id : null);
  const [elementoId, setElementoId] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState({ nombre: '', descripcion: '' });
  const [errorNuevo, setErrorNuevo] = useState('');
  const [eliminar, setEliminar] = useState<FormatoDocumental | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const formato = formatos.find(f => f.id === seleccionadoId) || null;
  const elemento = formato?.elementos.find(e => e.id === elementoId) || null;
  const dirty = JSON.stringify(formatos) !== JSON.stringify(guardadosRef);

  function actualizarElemento(id: string, cambios: Partial<ElementoFormato>) {
    setFormatos(prev => prev.map(f => ({
      ...f,
      elementos: f.id === seleccionadoId ? f.elementos.map(e => e.id === id ? { ...e, ...cambios } : e) : f.elementos,
    })));
  }

  function agregarElemento(tipo: TipoElementoFormato) {
    if (!formato) return;
    const nuevo = crearElemento(tipo, tipo === 'campo' ? 'comprobante' : undefined);
    setFormatos(prev => prev.map(f => f.id === formato.id ? { ...f, elementos: [...f.elementos, nuevo] } : f));
    setElementoId(nuevo.id);
  }

  function quitarElemento(id: string) {
    if (!formato) return;
    setFormatos(prev => prev.map(f => f.id === formato.id ? { ...f, elementos: f.elementos.filter(e => e.id !== id) } : f));
    setElementoId(null);
  }

  function crearFormato(event: FormEvent) {
    event.preventDefault();
    if (!formNuevo.nombre.trim()) {
      setErrorNuevo('Ingrese el nombre del formato.');
      return;
    }
    const nuevo: FormatoDocumental = { id: `fmt-${Date.now()}`, nombre: formNuevo.nombre.trim(), descripcion: formNuevo.descripcion.trim(), elementos: [] };
    setFormatos(prev => [...prev, nuevo]);
    setSeleccionadoId(nuevo.id);
    setElementoId(null);
    setFormNuevo({ nombre: '', descripcion: '' });
    setErrorNuevo('');
    setModalNuevo(false);
    setMensaje({ tipo: 'success', texto: `Formato "${nuevo.nombre}" creado. No olvide guardar los cambios.` });
  }

  function guardarTodo() {
    if (!guardar(formatos)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar el formato.' });
      return;
    }
    setGuardadosRef(structuredClone(formatos));
    setMensaje({ tipo: 'success', texto: 'Formatos documentales guardados en este navegador.' });
  }

  function cancelarTodo() {
    setFormatos(structuredClone(guardadosRef));
    setElementoId(null);
    setMensaje({ tipo: 'success', texto: 'Cambios descartados. Se restauró la última versión guardada.' });
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = formatos.filter(f => f.id !== eliminar.id);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó el formato.' });
      setEliminar(null);
      return;
    }
    setFormatos(siguientes);
    setGuardadosRef(structuredClone(siguientes));
    if (seleccionadoId === eliminar.id) {
      setSeleccionadoId(siguientes.length ? siguientes[0].id : null);
      setElementoId(null);
    }
    setMensaje({ tipo: 'success', texto: `Formato "${eliminar.nombre}" eliminado.` });
    setEliminar(null);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Formatos documentales</div>
          <h1 className="text-lg font-semibold text-gray-800">Formatos documentales</h1>
          <p className="mt-1 text-xs text-gray-500">Editor visual de formatos de impresión: leyendas, campos dinámicos, imagen, rectángulos y líneas.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="flex gap-4 items-stretch">
        {/* Lista de formatos */}
        <div className="w-60 shrink-0 space-y-2">
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
              <span className="text-xs font-semibold text-gray-700">Formatos</span>
              <button onClick={() => setModalNuevo(true)} className="text-xs text-petroleum-600 hover:underline">+ Nuevo</button>
            </div>
            <div className="divide-y divide-gray-50">
              {formatos.map(f => (
                <button key={f.id} onClick={() => { setSeleccionadoId(f.id); setElementoId(null); }}
                  className={`block w-full px-3 py-2.5 text-left ${seleccionadoId === f.id ? 'bg-petroleum-50' : 'hover:bg-gray-50'}`}>
                  <div className="text-xs font-medium text-gray-800">{f.nombre}</div>
                  <div className="text-xs text-gray-400 truncate">{f.descripcion || 'Sin descripción'} · {f.elementos.length} elementos</div>
                </button>
              ))}
            </div>
          </div>
          {formato && (
            <button onClick={() => setEliminar(formato)} className="w-full rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">Eliminar formato</button>
          )}
        </div>

        {/* Lienzo */}
        <div className="flex-1 min-w-0 bg-white rounded border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">{formato ? `Lienzo — ${formato.nombre}` : 'Seleccione un formato'}</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={vistaPrevia} onChange={e => { setVistaPrevia(e.target.checked); setElementoId(null); }} className="h-4 w-4 accent-petroleum-500" />
              <span>Vista previa</span>
            </label>
          </div>
          {formato ? (
            <div className="flex justify-center">
              <div className="relative w-full max-w-[595px] overflow-hidden rounded border border-gray-300 bg-white shadow-sm" style={{ aspectRatio: '595 / 842' }}
                onClick={e => { if (e.target === e.currentTarget) setElementoId(null); }}>
                {!vistaPrevia && <div className="pointer-events-none absolute inset-0 border-4 border-gray-100" aria-hidden="true" />}
                {formato.elementos.map(el => (
                  <ElementoCanvas key={el.id} elemento={el} seleccionado={el.id === elementoId} vistaPrevia={vistaPrevia} onSelect={() => setElementoId(el.id)} />
                ))}
                {formato.elementos.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-300">
                    <span className="text-4xl">📄</span>
                    <span className="text-xs">Agregue elementos desde el panel derecho</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-xs text-gray-400">No hay formatos. Cree uno con "+ Nuevo".</div>
          )}
          {vistaPrevia && formato && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Vista previa con datos de ejemplo: {EMPRESA.nombre} — NIT {EMPRESA.nit}-{EMPRESA.digito} — {PERIODO.nombre}
            </p>
          )}
        </div>

        {/* Panel de propiedades */}
        <div className="w-72 shrink-0 space-y-2">
          <div className="bg-white rounded border border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Agregar elemento</div>
            <div className="flex flex-wrap gap-1.5">
              {ELEMENTOS_DISPONIBLES.map(e => (
                <button key={e.tipo} disabled={!formato} onClick={() => agregarElemento(e.tipo)}
                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-petroleum-50 hover:border-petroleum-200 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-gray-200">
                  + {e.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Propiedades</div>
            {!elemento ? (
              <p className="text-xs text-gray-400">Seleccione un elemento del lienzo para editar sus propiedades.</p>
            ) : (
              <div className="space-y-2">
                {elemento.tipo === 'campo' && (
                  <div className="grid items-center gap-1">
                    <label htmlFor="fmt-campo" className="text-xs font-medium text-gray-600">Campo dinámico:</label>
                    <select id="fmt-campo" className={INPUT} value={elemento.campo || 'comprobante'} onChange={e => actualizarElemento(elemento.id, { campo: e.target.value as CampoFormato, texto: `{${e.target.value}}` })}>
                      {CAMPOS_FORMATO.map(c => <option key={c.valor} value={c.valor}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}
                {(elemento.tipo === 'leyenda' || elemento.tipo === 'campo') && (
                  <div className="grid items-center gap-1">
                    <label htmlFor="fmt-texto" className="text-xs font-medium text-gray-600">Texto:</label>
                    <input id="fmt-texto" className={INPUT} value={elemento.texto} onChange={e => actualizarElemento(elemento.id, { texto: e.target.value })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid items-center gap-1">
                    <label htmlFor="fmt-x" className="text-xs font-medium text-gray-600">X:</label>
                    <input id="fmt-x" type="number" className={`${INPUT} font-mono`} value={String(elemento.x)} onChange={e => actualizarElemento(elemento.id, { x: Number(e.target.value) })} />
                  </div>
                  <div className="grid items-center gap-1">
                    <label htmlFor="fmt-y" className="text-xs font-medium text-gray-600">Y:</label>
                    <input id="fmt-y" type="number" className={`${INPUT} font-mono`} value={String(elemento.y)} onChange={e => actualizarElemento(elemento.id, { y: Number(e.target.value) })} />
                  </div>
                  <div className="grid items-center gap-1">
                    <label htmlFor="fmt-w" className="text-xs font-medium text-gray-600">Ancho:</label>
                    <input id="fmt-w" type="number" className={`${INPUT} font-mono`} value={String(elemento.w)} onChange={e => actualizarElemento(elemento.id, { w: Number(e.target.value) })} />
                  </div>
                  <div className="grid items-center gap-1">
                    <label htmlFor="fmt-h" className="text-xs font-medium text-gray-600">Alto:</label>
                    <input id="fmt-h" type="number" className={`${INPUT} font-mono`} value={String(elemento.h)} onChange={e => actualizarElemento(elemento.id, { h: Number(e.target.value) })} />
                  </div>
                </div>
                {(elemento.tipo === 'leyenda' || elemento.tipo === 'campo') && (
                  <div className="grid items-center gap-1">
                    <label htmlFor="fmt-align" className="text-xs font-medium text-gray-600">Alineación:</label>
                    <select id="fmt-align" className={INPUT} value={elemento.alineacion} onChange={e => actualizarElemento(elemento.id, { alineacion: e.target.value as Alineacion })}>
                      <option value="izquierda">Izquierda</option>
                      <option value="centro">Centro</option>
                      <option value="derecha">Derecha</option>
                    </select>
                  </div>
                )}
                {(elemento.tipo === 'leyenda' || elemento.tipo === 'campo') && (
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                    <input type="checkbox" checked={elemento.negrita} onChange={e => actualizarElemento(elemento.id, { negrita: e.target.checked })} className="h-4 w-4 shrink-0 accent-petroleum-500" />
                    <span>Negrita</span>
                  </label>
                )}
                <button onClick={() => quitarElemento(elemento.id)} className="w-full rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Quitar elemento</button>
              </div>
            )}
          </div>

          <div className="bg-white rounded border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Cambios</span>
              <span className={`text-xs ${dirty ? 'text-amber-600' : 'text-gray-400'}`}>{dirty ? '● Sin guardar' : 'Guardado'}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={guardarTodo} className={`${BUTTON_PRIMARY} flex-1`}>Guardar</button>
              <button onClick={cancelarTodo} disabled={!dirty} className={`${BUTTON_SECONDARY} disabled:opacity-40`}>Cancelar</button>
            </div>
          </div>
        </div>
      </div>

      {modalNuevo && <Modal title="Nuevo formato documental" onClose={() => setModalNuevo(false)}>
        <form noValidate onSubmit={crearFormato}>
          <div className="space-y-3 p-5">
            <label htmlFor="fmt-nombre" className="block text-xs font-medium text-gray-600">Nombre del formato</label>
            <input id="fmt-nombre" data-initial-focus className={INPUT} value={formNuevo.nombre} onChange={e => { setFormNuevo(prev => ({ ...prev, nombre: e.target.value })); setErrorNuevo(''); }} aria-invalid={!!errorNuevo} aria-describedby={errorNuevo ? 'fmt-nombre-error' : undefined} />
            {errorNuevo && <p id="fmt-nombre-error" role="alert" className="text-xs text-red-600">{errorNuevo}</p>}
            <label htmlFor="fmt-desc" className="block text-xs font-medium text-gray-600">Descripción</label>
            <input id="fmt-desc" className={INPUT} value={formNuevo.descripcion} onChange={e => setFormNuevo(prev => ({ ...prev, descripcion: e.target.value }))} placeholder="Uso del formato" />
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setModalNuevo(false)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Crear formato</button>
          </div>
        </form>
      </Modal>}

      {eliminar && <Modal title="Eliminar formato documental" onClose={() => setEliminar(null)}>
        <p className="p-5 text-sm text-gray-600">¿Está seguro de eliminar el formato <span className="font-semibold text-gray-800">"{eliminar.nombre}"</span>? Los documentos ya impresos no se modifican.</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar</button>
        </div>
      </Modal>}
    </div>
  );
}

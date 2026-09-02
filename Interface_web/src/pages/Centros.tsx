import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EMPRESA } from '../data/mock';
import { CENTROS_JERARQUICOS_INICIALES, centrosHijos, esCentrosGuardados, validarCentro, type CentroJerarquico, type ErroresCentro } from '../data/configCentros';

const STORAGE_KEY = `contabdsi:centros:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function cargar(): CentroJerarquico[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esCentrosGuardados(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(CENTROS_JERARQUICOS_INICIALES);
}

function guardar(centros: CentroJerarquico[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(centros));
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

function exportarCSV(centros: CentroJerarquico[]) {
  const filas = [['Código', 'Nombre', 'Nivel', 'Padre'], ...centros.map(c => [c.codigo, c.nombre, String(c.nivel), c.padre || '—'])];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `centros-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_VACIO: CentroJerarquico = { codigo: '', nombre: '', nivel: 1, padre: '' };

// Ordena los centros para mostrarlos como árbol: cada padre antes que sus hijos.
function ordenarJerarquico(centros: CentroJerarquico[]): CentroJerarquico[] {
  const resultado: CentroJerarquico[] = [];
  const visitar = (nivel: number, padre: string) => {
    for (const c of centros.filter(x => x.nivel === nivel && x.padre === padre)) {
      resultado.push(c);
      visitar((nivel + 1) as 1 | 2 | 3, c.codigo);
    }
  };
  visitar(1, '');
  for (const c of centros) if (!resultado.includes(c)) resultado.push(c);
  return resultado;
}

export default function Centros() {
  const [centros, setCentros] = useState<CentroJerarquico[]>(cargar);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; original?: string } | null>(null);
  const [form, setForm] = useState<CentroJerarquico>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresCentro>({});
  const [eliminar, setEliminar] = useState<CentroJerarquico | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const filtrados = ordenarJerarquico(centros).filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q);
  });

  function abrirCrear() {
    setForm(structuredClone(FORM_VACIO));
    setErrores({});
    setModal({ modo: 'crear' });
  }

  function abrirEditar(item: CentroJerarquico) {
    setForm(structuredClone(item));
    setErrores({});
    setModal({ modo: 'editar', original: item.codigo });
  }

  function update(field: keyof CentroJerarquico, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarCentro(form, centros, modal?.original);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar.' });
      return;
    }
    const limpio: CentroJerarquico = {
      ...form,
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      nivel: Number(form.nivel) as 1 | 2 | 3,
      padre: Number(form.nivel) > 1 ? form.padre : '',
    };
    const siguientes = modal?.modo === 'editar'
      ? centros.map(c => c.codigo === modal.original ? limpio : c)
      : [...centros, limpio];
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setCentros(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Centro ${limpio.codigo} actualizado.` : `Centro ${limpio.codigo} creado.` });
    setModal(null);
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = centros.filter(c => c.codigo !== eliminar.codigo);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó el centro.' });
      setEliminar(null);
      return;
    }
    setCentros(siguientes);
    setMensaje({ tipo: 'success', texto: `Centro ${eliminar.codigo} eliminado.` });
    setEliminar(null);
  }

  const hijosDeEliminar = eliminar ? centrosHijos(eliminar.codigo, centros) : [];
  const candidatosPadre = centros.filter(c => c.nivel === Number(form.nivel) - 1 && c.codigo !== form.codigo);

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Centros de costo</div>
          <h1 className="text-lg font-semibold text-gray-800">Centros de costo</h1>
          <p className="mt-1 text-xs text-gray-500">Estructura jerárquica de centros de costo en tres niveles, con código de padre para cada nivel.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por código o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
        <span className="text-xs text-gray-500">{centros.length} centros · {centros.filter(c => c.nivel === 1).length} de nivel 1</span>
        <button onClick={() => exportarCSV(ordenarJerarquico(centros))} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
        <button onClick={abrirCrear} className={BUTTON_PRIMARY}>+ Crear centro</button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Nivel</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Padre</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Dependientes</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(c => {
                const indent = (c.nivel - 1) * 20;
                const dependientes = centrosHijos(c.codigo, centros).length;
                return (
                  <tr key={c.codigo} className="hoverable">
                    <td className="px-3 py-2.5" style={{ paddingLeft: `${12 + indent}px` }}>
                      <span className={`font-mono ${c.nivel === 1 ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{c.codigo}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700" style={{ paddingLeft: `${12 + indent}px` }}>{c.nombre}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.nivel === 1 ? 'bg-blue-100 text-blue-700' : c.nivel === 2 ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                        {c.nivel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gray-500">{c.padre || '—'}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-gray-600">{dependientes || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => abrirEditar(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => setEliminar(c)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          {filtrados.length} centro{filtrados.length !== 1 ? 's' : ''} mostrados en orden jerárquico
        </div>
      </div>

      {modal && <Modal title={modal.modo === 'crear' ? 'Nuevo centro de costo' : `Editar centro ${modal.original}`} onClose={() => setModal(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos del centro</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cen-codigo" className="text-xs font-medium text-gray-600">Código:</label>
                  <input id="cen-codigo" data-initial-focus className={`${INPUT} font-mono`} value={form.codigo} maxLength={12} onChange={e => update('codigo', e.target.value.toUpperCase())} aria-invalid={!!errores.codigo} aria-describedby={errores.codigo ? 'cen-codigo-error' : undefined} />
                  {errores.codigo && <p id="cen-codigo-error" className="text-xs text-red-600 sm:col-start-2">{errores.codigo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cen-nivel" className="text-xs font-medium text-gray-600">Nivel:</label>
                  <select id="cen-nivel" className={INPUT} value={String(form.nivel)} onChange={e => { update('nivel', Number(e.target.value)); update('padre', ''); }} aria-invalid={!!errores.nivel}>
                    <option value={1}>1 — Dirección</option>
                    <option value={2}>2 — Subcentro</option>
                    <option value={3}>3 — Detalle</option>
                  </select>
                  {errores.nivel && <p className="text-xs text-red-600 sm:col-start-2">{errores.nivel}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="cen-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="cen-nombre" className={INPUT} value={form.nombre} onChange={e => update('nombre', e.target.value)} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'cen-nombre-error' : undefined} />
                  {errores.nombre && <p id="cen-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                {Number(form.nivel) > 1 && (
                  <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                    <label htmlFor="cen-padre" className="text-xs font-medium text-gray-600">Centro padre:</label>
                    <select id="cen-padre" className={INPUT} value={form.padre} onChange={e => update('padre', e.target.value)} aria-invalid={!!errores.padre} aria-describedby={errores.padre ? 'cen-padre-error' : undefined}>
                      <option value="">— Seleccione el centro padre —</option>
                      {candidatosPadre.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                    </select>
                    {errores.padre && <p id="cen-padre-error" className="text-xs text-red-600 sm:col-start-2">{errores.padre}</p>}
                  </div>
                )}
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setModal(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar</button>
          </div>
        </form>
      </Modal>}

      {eliminar && <Modal title="Eliminar centro de costo" onClose={() => setEliminar(null)}>
        <div className="space-y-3 p-5">
          {hijosDeEliminar.length > 0 ? (
            <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              No puede eliminar <span className="font-mono font-semibold">{eliminar.codigo}</span> porque tiene {hijosDeEliminar.length} centro{hijosDeEliminar.length !== 1 ? 's' : ''} dependiente{hijosDeEliminar.length !== 1 ? 's' : ''}: {hijosDeEliminar.map(h => h.codigo).join(', ')}. Reasigne o elimine primero los dependientes.
            </div>
          ) : (
            <p className="text-sm text-gray-600">¿Está seguro de eliminar el centro <span className="font-mono font-semibold text-gray-800">{eliminar.codigo}</span> — {eliminar.nombre}? Los movimientos que lo referencien quedarán sin centro de costo.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          {hijosDeEliminar.length === 0 && <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar</button>}
        </div>
      </Modal>}
    </div>
  );
}

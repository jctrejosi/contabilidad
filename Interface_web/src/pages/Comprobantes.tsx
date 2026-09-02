import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { COMPROBANTES, EMPRESA } from '../data/mock';
import { TIPOS_COMPROBANTE, esComprobantesGuardados, validarComprobante, type ErroresComprobante } from '../data/configComprobantes';
import type { Comprobante } from '../types';

const STORAGE_KEY = `contabdsi:comprobantes:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

const BADGE_TIPO: Record<string, string> = {
  E: 'bg-amber-100 text-amber-700',
  I: 'bg-green-100 text-green-700',
  N: 'bg-blue-100 text-blue-700',
};

function cargar(): Comprobante[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esComprobantesGuardados(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(COMPROBANTES);
}

function guardar(comprobantes: Comprobante[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comprobantes));
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
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto w-[calc(100%_-_2rem)] ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

function exportarCSV(comprobantes: Comprobante[]) {
  const filas = [['Código', 'Nombre', 'Tipo', 'Consecutivo'], ...comprobantes.map(c => [c.codigo, c.nombre, c.tipo, String(c.consecutivo)])];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `comprobantes-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_VACIO: Comprobante = { codigo: '', nombre: '', tipo: 'N', consecutivo: 0 };

export default function Comprobantes() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>(cargar);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'E' | 'I' | 'N'>('todos');
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; original?: string } | null>(null);
  const [form, setForm] = useState<Comprobante>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresComprobante>({});
  const [eliminar, setEliminar] = useState<Comprobante | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const filtrados = comprobantes.filter(c => {
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q);
    }
    return true;
  });

  function abrirCrear() {
    setForm(FORM_VACIO);
    setErrores({});
    setModal({ modo: 'crear' });
  }

  function abrirEditar(item: Comprobante) {
    setForm(structuredClone(item));
    setErrores({});
    setModal({ modo: 'editar', original: item.codigo });
  }

  function update(field: keyof Comprobante, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarComprobante(form, comprobantes, modal?.original);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar.' });
      return;
    }
    const limpio: Comprobante = { ...form, codigo: form.codigo.trim(), nombre: form.nombre.trim() };
    const siguientes = modal?.modo === 'editar'
      ? comprobantes.map(c => c.codigo === modal.original ? limpio : c)
      : [...comprobantes, limpio];
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setComprobantes(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Comprobante ${limpio.codigo} actualizado.` : `Comprobante ${limpio.codigo} creado.` });
    setModal(null);
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = comprobantes.filter(c => c.codigo !== eliminar.codigo);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó el comprobante.' });
      setEliminar(null);
      return;
    }
    setComprobantes(siguientes);
    setMensaje({ tipo: 'success', texto: `Comprobante ${eliminar.codigo} eliminado.` });
    setEliminar(null);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Comprobantes</div>
          <h1 className="text-lg font-semibold text-gray-800">Comprobantes</h1>
          <p className="mt-1 text-xs text-gray-500">Catálogo de comprobantes de contabilidad: código, nombre, tipo y consecutivo vigente.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por código o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
        {(['todos', 'E', 'I', 'N'] as const).map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)} className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${filtroTipo === t ? 'bg-petroleum-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'todos' ? 'Todos' : t}
          </button>
        ))}
        <button onClick={() => exportarCSV(filtrados)} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
        <button onClick={abrirCrear} className={BUTTON_PRIMARY}>+ Crear comprobante</button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Tipo</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Consecutivo</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(c => (
                <tr key={c.codigo} className="hoverable">
                  <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{c.codigo}</td>
                  <td className="px-3 py-2.5 text-gray-700">{c.nombre}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_TIPO[c.tipo] || 'bg-gray-100 text-gray-600'}`}>
                      {c.tipo} — {TIPOS_COMPROBANTE.find(t => t.valor === c.tipo)?.nombre || ''}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">{String(c.consecutivo).padStart(4, '0')}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEditar(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => setEliminar(c)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          {filtrados.length} comprobante{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {modal && <Modal title={modal.modo === 'crear' ? 'Nuevo comprobante' : `Editar comprobante ${modal.original}`} onClose={() => setModal(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos del comprobante</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="comp-codigo" className="text-xs font-medium text-gray-600">Código:</label>
                  <input id="comp-codigo" data-initial-focus className={`${INPUT} font-mono`} value={form.codigo} maxLength={4} onChange={e => update('codigo', e.target.value.toUpperCase())} aria-invalid={!!errores.codigo} aria-describedby={errores.codigo ? 'comp-codigo-error' : undefined} />
                  {errores.codigo && <p id="comp-codigo-error" className="text-xs text-red-600 sm:col-start-2">{errores.codigo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="comp-tipo" className="text-xs font-medium text-gray-600">Tipo:</label>
                  <select id="comp-tipo" className={INPUT} value={form.tipo} onChange={e => update('tipo', e.target.value)} aria-invalid={!!errores.tipo}>
                    {TIPOS_COMPROBANTE.map(t => <option key={t.valor} value={t.valor}>{t.valor} — {t.nombre}</option>)}
                  </select>
                  {errores.tipo && <p className="text-xs text-red-600 sm:col-start-2">{errores.tipo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="comp-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="comp-nombre" className={INPUT} value={form.nombre} onChange={e => update('nombre', e.target.value)} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'comp-nombre-error' : undefined} />
                  {errores.nombre && <p id="comp-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="comp-consecutivo" className="text-xs font-medium text-gray-600">Consecutivo:</label>
                  <input id="comp-consecutivo" type="number" min={0} step={1} className={`${INPUT} font-mono`} value={String(form.consecutivo)} onChange={e => update('consecutivo', Number(e.target.value))} aria-invalid={!!errores.consecutivo} aria-describedby={errores.consecutivo ? 'comp-consecutivo-error' : undefined} />
                  {errores.consecutivo && <p id="comp-consecutivo-error" className="text-xs text-red-600 sm:col-start-2">{errores.consecutivo}</p>}
                </div>
              </div>
            </fieldset>
            <p className="text-xs leading-relaxed text-gray-500">El consecutivo se usa para numerar los documentos de tipo {form.tipo || '—'}. Los cambios sólo afectan los datos de demostración de este navegador.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setModal(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar</button>
          </div>
        </form>
      </Modal>}

      {eliminar && <Modal title="Eliminar comprobante" onClose={() => setEliminar(null)}>
        <p className="p-5 text-sm text-gray-600">¿Está seguro de eliminar el comprobante <span className="font-mono font-semibold text-gray-800">{eliminar.codigo}</span> — {eliminar.nombre}? Esta acción no afecta los comprobantes contabilizados en la contabilidad original.</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar</button>
        </div>
      </Modal>}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CUENTAS, EMPRESA, fmtCOP } from '../data/mock';
import { PLANTILLAS_INICIALES, crearLoteDePlantilla, esPlantillasGuardadas, totalesPlantilla, validarPlantilla, type ErroresPlantilla, type LineaPlantilla, type PlantillaContable } from '../data/configPlantillas';
import type { Lote } from '../types';
import type { NavPage } from '../components/Shell';

interface Props {
  onNavigate: (p: NavPage) => void;
  onCrearLote: (l: Lote) => void;
}

const STORAGE_KEY = `contabdsi:plantillas:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function cargar(): PlantillaContable[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esPlantillasGuardadas(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(PLANTILLAS_INICIALES);
}

function guardar(plantillas: PlantillaContable[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plantillas));
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
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto w-[calc(100%_-_2rem)] ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

function exportarCSV(plantillas: PlantillaContable[]) {
  const filas = [['Código', 'Nombre', 'Líneas', 'Débito', 'Crédito', 'Diferencia'],
  ...plantillas.map(p => { const t = totalesPlantilla(p); return [p.codigo, p.nombre, String(t.lineas), String(t.debito), String(t.credito), String(t.diferencia)]; })];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `plantillas-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_VACIO: PlantillaContable = {
  id: '',
  codigo: '',
  nombre: '',
  descripcion: '',
  lineas: [
    { id: 'L01', cuenta: '510506', debito: 0, credito: 0, concepto: '' },
    { id: 'L02', cuenta: '111005', debito: 0, credito: 0, concepto: '' },
  ],
};

export default function Plantillas({ onNavigate, onCrearLote }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaContable[]>(cargar);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; idOriginal?: string } | null>(null);
  const [form, setForm] = useState<PlantillaContable>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresPlantilla>({});
  const [eliminar, setEliminar] = useState<PlantillaContable | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [loteCreado, setLoteCreado] = useState<Lote | null>(null);

  const filtrados = plantillas.filter(p => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q);
  });

  function abrirCrear() {
    setForm(structuredClone(FORM_VACIO));
    setErrores({});
    setModal({ modo: 'crear' });
  }

  function abrirEditar(item: PlantillaContable) {
    setForm(structuredClone(item));
    setErrores({});
    setModal({ modo: 'editar', idOriginal: item.id });
  }

  function updateLinea(id: string, campo: keyof LineaPlantilla, valor: string | number) {
    setForm(prev => ({
      ...prev,
      lineas: prev.lineas.map(l => l.id === id ? { ...l, [campo]: campo === 'debito' || campo === 'credito' ? Number(valor) : valor } : l),
    }));
    setErrores(prev => ({ ...prev, lineas: undefined }));
  }

  function agregarLinea() {
    setForm(prev => ({
      ...prev,
      lineas: [...prev.lineas, { id: `L${String(prev.lineas.length + 1).padStart(2, '0')}`, cuenta: '111005', debito: 0, credito: 0, concepto: '' }],
    }));
    setErrores(prev => ({ ...prev, lineas: undefined }));
  }

  function quitarLinea(id: string) {
    setForm(prev => ({ ...prev, lineas: prev.lineas.filter(l => l.id !== id) }));
    setErrores(prev => ({ ...prev, lineas: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarPlantilla(form, plantillas, modal?.idOriginal);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar la plantilla.' });
      return;
    }
    const limpio: PlantillaContable = {
      ...form,
      id: form.id || `plt-${Date.now()}`,
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
    };
    const siguientes = modal?.modo === 'editar'
      ? plantillas.map(p => p.id === modal.idOriginal ? limpio : p)
      : [...plantillas, limpio];
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setPlantillas(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Plantilla ${limpio.codigo} actualizada.` : `Plantilla ${limpio.codigo} creada.` });
    setModal(null);
  }

  function usarPlantilla(plantilla: PlantillaContable) {
    const errores = validarPlantilla(plantilla, plantillas, plantilla.id);
    if (Object.keys(errores).length) {
      setMensaje({ tipo: 'error', texto: `No se puede usar la plantilla ${plantilla.codigo}: ${errores.lineas || errores.codigo || 'revise la plantilla.'}` });
      return;
    }
    const lote = crearLoteDePlantilla(plantilla, plantillas.length + 1);
    onCrearLote(lote);
    setLoteCreado(lote);
    setMensaje({ tipo: 'success', texto: `Lote ${lote.codigo} creado como Borrador y cuadrado (${fmtCOP(lote.debito)} = ${fmtCOP(lote.credito)}).` });
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = plantillas.filter(p => p.id !== eliminar.id);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó la plantilla.' });
      setEliminar(null);
      return;
    }
    setPlantillas(siguientes);
    setMensaje({ tipo: 'success', texto: `Plantilla ${eliminar.codigo} eliminada.` });
    setEliminar(null);
  }

  const totales = totalesPlantilla(form);

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Plantillas</div>
          <h1 className="text-lg font-semibold text-gray-800">Plantillas contables</h1>
          <p className="mt-1 text-xs text-gray-500">Plantillas con líneas de cuenta, débito y crédito para generar lotes borrador cuadrados.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      {loteCreado && (
        <div className="rounded border border-petroleum-200 bg-petroleum-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-petroleum-900">
            Lote <span className="font-mono font-semibold">{loteCreado.codigo}</span> — {loteCreado.nombre} creado como <strong>Borrador</strong> con {loteCreado.lineasCount} líneas y débito = crédito = {fmtCOP(loteCreado.debito)}.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate('movimientos/lotes')} className={BUTTON_PRIMARY}>Abrir lotes</button>
            <button onClick={() => setLoteCreado(null)} className={BUTTON_SECONDARY}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por código, nombre o descripción..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
        <button onClick={() => exportarCSV(filtrados)} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
        <button onClick={abrirCrear} className={BUTTON_PRIMARY}>+ Crear plantilla</button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Descripción</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Líneas</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(p => {
                const t = totalesPlantilla(p);
                return (
                  <tr key={p.id} className="hoverable">
                    <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{p.codigo}</td>
                    <td className="px-3 py-2.5 text-gray-700">{p.nombre}</td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-72 truncate">{p.descripcion}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{t.lineas}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(t.debito)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(t.credito)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.diferencia === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {t.diferencia === 0 ? 'Cuadrada' : 'Descuadrada'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => abrirEditar(p)} className="text-xs text-blue-600 hover:underline">Editar</button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => usarPlantilla(p)} className={`text-xs hover:underline ${t.diferencia === 0 ? 'text-petroleum-600 font-medium' : 'text-gray-400'}`}>Usar plantilla</button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => setEliminar(p)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          {filtrados.length} plantilla{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {modal && <Modal wide title={modal.modo === 'crear' ? 'Nueva plantilla contable' : 'Editar plantilla'} onClose={() => setModal(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Encabezado</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="plt-codigo" className="text-xs font-medium text-gray-600">Código:</label>
                  <input id="plt-codigo" data-initial-focus className={`${INPUT} font-mono`} value={form.codigo} maxLength={12} onChange={e => { setForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() })); setErrores(prev => ({ ...prev, codigo: undefined })); }} aria-invalid={!!errores.codigo} aria-describedby={errores.codigo ? 'plt-codigo-error' : undefined} />
                  {errores.codigo && <p id="plt-codigo-error" className="text-xs text-red-600 sm:col-start-2">{errores.codigo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="plt-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="plt-nombre" className={INPUT} value={form.nombre} onChange={e => { setForm(prev => ({ ...prev, nombre: e.target.value })); setErrores(prev => ({ ...prev, nombre: undefined })); }} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'plt-nombre-error' : undefined} />
                  {errores.nombre && <p id="plt-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="plt-desc" className="text-xs font-medium text-gray-600">Descripción:</label>
                  <input id="plt-desc" className={INPUT} value={form.descripcion} onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))} placeholder="Uso previsto de la plantilla" />
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Líneas de la plantilla</legend>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs min-w-[36rem]">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-gray-500">
                      <th className="px-2 py-1.5 font-semibold w-16">#</th>
                      <th className="px-2 py-1.5 font-semibold">Cuenta</th>
                      <th className="px-2 py-1.5 font-semibold w-32">Débito</th>
                      <th className="px-2 py-1.5 font-semibold w-32">Crédito</th>
                      <th className="px-2 py-1.5 font-semibold">Concepto</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {form.lineas.map(l => (
                      <tr key={l.id}>
                        <td className="px-2 py-1.5 font-mono text-gray-400">{l.id}</td>
                        <td className="px-2 py-1.5">
                          <select className={INPUT} value={l.cuenta} onChange={e => updateLinea(l.id, 'cuenta', e.target.value)}>
                            {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min={0} step={1} className={`${INPUT} font-mono text-right`} value={String(l.debito)} onChange={e => updateLinea(l.id, 'debito', Number(e.target.value))} aria-label={`Débito línea ${l.id}`} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min={0} step={1} className={`${INPUT} font-mono text-right`} value={String(l.credito)} onChange={e => updateLinea(l.id, 'credito', Number(e.target.value))} aria-label={`Crédito línea ${l.id}`} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className={INPUT} value={l.concepto} onChange={e => updateLinea(l.id, 'concepto', e.target.value)} placeholder="Concepto de la línea" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => quitarLinea(l.id)} disabled={form.lineas.length <= 2} className="text-gray-400 hover:text-red-500 disabled:opacity-30" aria-label={`Quitar línea ${l.id}`}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 text-gray-700">
                      <td className="px-2 py-2" colSpan={2}>
                        <button type="button" onClick={agregarLinea} className="text-xs text-petroleum-600 hover:underline">+ Agregar línea</button>
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold">{fmtCOP(totales.debito)}</td>
                      <td className="px-2 py-2 text-right font-mono font-semibold">{fmtCOP(totales.credito)}</td>
                      <td className="px-2 py-2" colSpan={2}>
                        {totales.diferencia === 0
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Cuadrada</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Descuadrada por {fmtCOP(Math.abs(totales.diferencia))}</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {errores.lineas && <p className="mt-2 text-xs text-red-600">{errores.lineas}</p>}
              <p className="mt-2 text-xs text-gray-500">Para poder usar la plantilla, el débito y el crédito deben ser iguales (lote cuadrado). El crédito nunca se registra negativo.</p>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setModal(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar plantilla</button>
          </div>
        </form>
      </Modal>}

      {eliminar && <Modal title="Eliminar plantilla" onClose={() => setEliminar(null)}>
        <p className="p-5 text-sm text-gray-600">¿Está seguro de eliminar la plantilla <span className="font-mono font-semibold text-gray-800">{eliminar.codigo}</span> — {eliminar.nombre}? Los lotes ya generados con ella no se modifican.</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar</button>
        </div>
      </Modal>}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CUENTAS, EMPRESA, fmtCOP } from '../data/mock';
import { RENGLONES_RENTA_INICIALES, esRenglonesGuardados, totalCuentaRenta, validarRenglon, type ErroresRenglon, type RenglonRenta } from '../data/configRenglones';

const STORAGE_KEY = `contabdsi:renglones:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function cargar(): RenglonRenta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esRenglonesGuardados(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(RENGLONES_RENTA_INICIALES);
}

function guardar(renglones: RenglonRenta[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(renglones));
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

function exportarCSV(renglones: RenglonRenta[]) {
  const filas = [['Código', 'Nombre', 'Cuenta', 'Signo'], ...renglones.map(r => [r.codigo, r.nombre, r.cuenta, r.signo])];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `renglones-renta-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_VACIO: RenglonRenta = { codigo: '', nombre: '', cuenta: '', signo: '+' };

export default function RenglonesRenta() {
  const [renglones, setRenglones] = useState<RenglonRenta[]>(cargar);
  const [tab, setTab] = useState<'catalogo' | 'generador'>('catalogo');
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; original?: string } | null>(null);
  const [form, setForm] = useState<RenglonRenta>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresRenglon>({});
  const [eliminar, setEliminar] = useState<RenglonRenta | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const [seleccion, setSeleccion] = useState<string[]>(() => structuredClone(RENGLONES_RENTA_INICIALES).map(r => r.codigo));
  const [vistaPrevia, setVistaPrevia] = useState(false);

  const filtrados = renglones.filter(r => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q) || r.cuenta.includes(q);
  });

  const seleccionados = renglones.filter(r => seleccion.includes(r.codigo));
  const totalConSigno = seleccionados.reduce((acc, r) => acc + totalCuentaRenta(r.cuenta) * (r.signo === '-' ? -1 : 1), 0);

  function abrirCrear() {
    setForm(structuredClone(FORM_VACIO));
    setErrores({});
    setModal({ modo: 'crear' });
  }

  function abrirEditar(item: RenglonRenta) {
    setForm(structuredClone(item));
    setErrores({});
    setModal({ modo: 'editar', original: item.codigo });
  }

  function update(field: keyof RenglonRenta, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarRenglon(form, renglones, modal?.original);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar.' });
      return;
    }
    const limpio: RenglonRenta = { ...form, codigo: form.codigo.trim(), nombre: form.nombre.trim() };
    const siguientes = modal?.modo === 'editar'
      ? renglones.map(r => r.codigo === modal.original ? limpio : r)
      : [...renglones, limpio];
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setRenglones(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Renglón ${limpio.codigo} actualizado.` : `Renglón ${limpio.codigo} creado.` });
    setModal(null);
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = renglones.filter(r => r.codigo !== eliminar.codigo);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó el renglón.' });
      setEliminar(null);
      return;
    }
    setRenglones(siguientes);
    setSeleccion(prev => prev.filter(c => c !== eliminar.codigo));
    setMensaje({ tipo: 'success', texto: `Renglón ${eliminar.codigo} eliminado.` });
    setEliminar(null);
  }

  function mover(indice: number, direccion: -1 | 1) {
    setSeleccion(prev => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= prev.length) return prev;
      const siguiente = [...prev];
      [siguiente[indice], siguiente[destino]] = [siguiente[destino], siguiente[indice]];
      return siguiente;
    });
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Renglones de renta</div>
          <h1 className="text-lg font-semibold text-gray-800">Renglones de renta</h1>
          <p className="mt-1 text-xs text-gray-500">Catálogo de renglones para la declaración de renta y generador con totales por cuenta, orden y vista previa.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="flex items-center gap-1">
        {([['catalogo', 'Catálogo de renglones'], ['generador', 'Generador de declaración']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-xs px-3 py-1.5 rounded-t border-b-2 font-medium ${tab === k ? 'border-petroleum-500 text-petroleum-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'catalogo' && (
        <>
          <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
            <input type="text" placeholder="Buscar por código, nombre o cuenta..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
            <button onClick={() => exportarCSV(filtrados)} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
            <button onClick={abrirCrear} className={BUTTON_PRIMARY}>+ Crear renglón</button>
          </div>

          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta asociada</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Signo</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Total de la cuenta</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrados.map(r => {
                    const total = totalCuentaRenta(r.cuenta);
                    return (
                      <tr key={r.codigo} className="hoverable">
                        <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{r.codigo}</td>
                        <td className="px-3 py-2.5 text-gray-700">{r.nombre}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-600">{r.cuenta} — {CUENTAS.find(c => c.codigo === r.cuenta)?.nombre || 'Cuenta inexistente'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.signo === '+' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.signo}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmtCOP(total)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => abrirEditar(r)} className="text-xs text-blue-600 hover:underline">Editar</button>
                            <span className="text-gray-200">|</span>
                            <button onClick={() => setEliminar(r)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              {filtrados.length} renglón{filtrados.length !== 1 ? 'es' : ''}
            </div>
          </div>
        </>
      )}

      {tab === 'generador' && (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="bg-white rounded border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-semibold text-petroleum-900">Selección y orden de renglones</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSeleccion(renglones.map(r => r.codigo))} className="text-xs px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Seleccionar todos</button>
                  <button onClick={() => setSeleccion([])} className="text-xs px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Quitar todos</button>
                </div>
              </div>
              <div className="mt-2 divide-y divide-gray-50">
                {renglones.map((r, i) => {
                  const posicion = seleccion.indexOf(r.codigo);
                  const activo = posicion !== -1;
                  return (
                    <div key={r.codigo} className={`flex items-center gap-3 px-2 py-2 rounded ${activo ? 'bg-petroleum-50/50' : ''}`}>
                      <input type="checkbox" checked={activo} onChange={e => {
                        setSeleccion(prev => e.target.checked ? [...prev, r.codigo] : prev.filter(c => c !== r.codigo));
                      }} className="h-4 w-4 shrink-0 accent-petroleum-500" aria-label={`Seleccionar ${r.codigo}`} />
                      <span className={`font-mono w-10 shrink-0 ${activo ? 'text-petroleum-700 font-semibold' : 'text-gray-400'}`}>{posicion !== -1 ? String(posicion + 1).padStart(2, '0') : '—'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-800">{r.nombre}</div>
                        <div className="text-xs text-gray-400 font-mono">{r.codigo} · cuenta {r.cuenta} · signo {r.signo}</div>
                      </div>
                      <span className="font-mono text-xs text-gray-600 shrink-0">{fmtCOP(totalCuentaRenta(r.cuenta))}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => mover(posicion, -1)} disabled={!activo || posicion === 0} className="px-1.5 py-0.5 text-xs border border-gray-200 rounded text-gray-600 disabled:opacity-40 hover:bg-gray-50" aria-label="Subir">↑</button>
                        <button onClick={() => mover(posicion, 1)} disabled={!activo || posicion === seleccion.length - 1} className="px-1.5 py-0.5 text-xs border border-gray-200 rounded text-gray-600 disabled:opacity-40 hover:bg-gray-50" aria-label="Bajar">↓</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-96 shrink-0 space-y-3">
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="text-center space-y-0.5">
                  <div className="text-xs font-bold text-gray-800">VISTA PREVIA — RENGLONES DE RENTA</div>
                  <div className="text-xs text-gray-500">{EMPRESA.nombre} — NIT {EMPRESA.nit}-{EMPRESA.digito}</div>
                </div>
              </div>
              <div className="table-fixed-header overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Renglón</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {seleccionados.map((r, i) => {
                      const valor = totalCuentaRenta(r.cuenta) * (r.signo === '-' ? -1 : 1);
                      return (
                        <tr key={r.codigo} className="hoverable">
                          <td className="px-3 py-2 font-mono text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-3 py-2 text-gray-700">{r.nombre} <span className="text-gray-400 font-mono">({r.codigo})</span></td>
                          <td className={`px-3 py-2 text-right font-mono ${valor < 0 ? 'text-red-700' : 'text-gray-800'}`}>{fmtCOP(Math.abs(valor))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-right font-semibold text-gray-700">Total declaración</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${totalConSigno < 0 ? 'text-red-700' : 'text-gray-800'}`}>{fmtCOP(Math.abs(totalConSigno))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setVistaPrevia(true)} className={BUTTON_PRIMARY}>Generar vista previa</button>
              <span className="text-xs text-gray-500">{seleccionados.length} renglón{seleccionados.length !== 1 ? 'es' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      {vistaPrevia && <Modal title="Vista previa de la declaración" onClose={() => setVistaPrevia(false)}>
        <div className="p-5 space-y-3">
          <p className="text-xs leading-relaxed text-gray-500">Esta es la selección final de renglones con el orden definido. El prototipo no genera el formulario oficial de la DIAN; los totales provienen de las cuentas del período de demostración.</p>
          <div className="rounded border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-50">
                {seleccionados.map((r, i) => {
                  const valor = totalCuentaRenta(r.cuenta) * (r.signo === '-' ? -1 : 1);
                  return (
                    <tr key={r.codigo}>
                      <td className="px-3 py-2 font-mono text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                      <td className="px-3 py-2 text-gray-700">{r.nombre}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800">{valor < 0 ? `(${fmtCOP(Math.abs(valor))})` : fmtCOP(valor)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50">
                  <td className="px-3 py-2" colSpan={2}>
                    <span className="font-semibold text-gray-700">Total</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{totalConSigno < 0 ? `(${fmtCOP(Math.abs(totalConSigno))})` : fmtCOP(totalConSigno)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setVistaPrevia(false)} className={BUTTON_SECONDARY}>Cerrar</button>
          <button type="button" onClick={() => { exportarCSV(seleccionados); }} className={BUTTON_PRIMARY}>Exportar CSV</button>
        </div>
      </Modal>}

      {modal && <Modal title={modal.modo === 'crear' ? 'Nuevo renglón de renta' : `Editar renglón ${modal.original}`} onClose={() => setModal(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos del renglón</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ren-codigo" className="text-xs font-medium text-gray-600">Código:</label>
                  <input id="ren-codigo" data-initial-focus className={`${INPUT} font-mono`} value={form.codigo} maxLength={10} onChange={e => update('codigo', e.target.value.toUpperCase())} aria-invalid={!!errores.codigo} aria-describedby={errores.codigo ? 'ren-codigo-error' : undefined} />
                  {errores.codigo && <p id="ren-codigo-error" className="text-xs text-red-600 sm:col-start-2">{errores.codigo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ren-signo" className="text-xs font-medium text-gray-600">Signo:</label>
                  <select id="ren-signo" className={INPUT} value={form.signo} onChange={e => update('signo', e.target.value)} aria-invalid={!!errores.signo}>
                    <option value="+">+ Suma al total</option>
                    <option value="-">− Resta del total</option>
                  </select>
                  {errores.signo && <p className="text-xs text-red-600 sm:col-start-2">{errores.signo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ren-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="ren-nombre" className={INPUT} value={form.nombre} onChange={e => update('nombre', e.target.value)} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'ren-nombre-error' : undefined} />
                  {errores.nombre && <p id="ren-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ren-cuenta" className="text-xs font-medium text-gray-600">Cuenta:</label>
                  <select id="ren-cuenta" className={INPUT} value={form.cuenta} onChange={e => update('cuenta', e.target.value)} aria-invalid={!!errores.cuenta} aria-describedby={errores.cuenta ? 'ren-cuenta-error' : undefined}>
                    <option value="">— Seleccione la cuenta —</option>
                    {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                  {errores.cuenta && <p id="ren-cuenta-error" className="text-xs text-red-600 sm:col-start-2">{errores.cuenta}</p>}
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

      {eliminar && <Modal title="Eliminar renglón" onClose={() => setEliminar(null)}>
        <p className="p-5 text-sm text-gray-600">¿Está seguro de eliminar el renglón <span className="font-mono font-semibold text-gray-800">{eliminar.codigo}</span> — {eliminar.nombre}? También se quitará de la selección del generador.</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar</button>
        </div>
      </Modal>}
    </div>
  );
}

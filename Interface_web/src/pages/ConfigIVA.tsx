import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CUENTAS, EMPRESA } from '../data/mock';
import { TARIFAS_IVA_INICIALES, esTarifasIVAGuardadas, validarTarifaIVA, type ErroresTarifaIVA, type TarifaIVA } from '../data/configIva';

const STORAGE_KEY = `contabdsi:iva:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function cargar(): TarifaIVA[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esTarifasIVAGuardadas(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(TARIFAS_IVA_INICIALES);
}

function guardar(tarifas: TarifaIVA[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tarifas));
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

function exportarCSV(tarifas: TarifaIVA[]) {
  const filas = [['Tarifa', 'Nombre', 'Cuenta IVA generado', 'Cuenta IVA descontable', 'Activa'],
  ...tarifas.map(t => [String(t.tarifa), t.nombre, t.cuentaGenerado || '—', t.cuentaDescontable || '—', t.activa ? 'Sí' : 'No'])];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `iva-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ConfigIVA() {
  const [tarifas, setTarifas] = useState<TarifaIVA[]>(cargar);
  const [editar, setEditar] = useState<{ tarifa: number } | null>(null);
  const [form, setForm] = useState<TarifaIVA>(TARIFAS_IVA_INICIALES[0]);
  const [errores, setErrores] = useState<ErroresTarifaIVA>({});
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  function abrirEditar(t: TarifaIVA) {
    setForm(structuredClone(t));
    setErrores({});
    setEditar({ tarifa: t.tarifa });
  }

  function update(field: keyof TarifaIVA, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    if (!editar) return;
    const nuevosErrores = validarTarifaIVA(form);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar.' });
      return;
    }
    const limpio: TarifaIVA = { ...form, nombre: form.nombre.trim() };
    const siguientes = tarifas.map(t => t.tarifa === editar.tarifa ? limpio : t);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setTarifas(siguientes);
    setMensaje({ tipo: 'success', texto: `Tarifa de IVA ${form.tarifa}% actualizada.` });
    setEditar(null);
  }

  function toggleActiva(t: TarifaIVA) {
    const siguientes = tarifas.map(x => x.tarifa === t.tarifa ? { ...x, activa: !x.activa } : x);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar el cambio.' });
      return;
    }
    setTarifas(siguientes);
    setMensaje({ tipo: 'success', texto: `Tarifa de IVA ${t.tarifa}% ${t.activa ? 'desactivada' : 'activada'}.` });
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / IVA</div>
          <h1 className="text-lg font-semibold text-gray-800">Configuración de IVA</h1>
          <p className="mt-1 text-xs text-gray-500">Tarifas fijas del impuesto (0%, 5% y 19%) y sus cuentas de IVA generado y descontable.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
        Las tarifas <strong>0%, 5% y 19%</strong> están fijas por norma y no se pueden crear ni eliminar. Sólo se configuran el nombre y las cuentas asociadas a cada una.
      </div>

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500">{tarifas.filter(t => t.activa).length} de {tarifas.length} tarifas activas</span>
        <button onClick={() => exportarCSV(tarifas)} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Tarifa</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta IVA generado (crédito)</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta IVA descontable (débito)</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tarifas.map(t => (
                <tr key={t.tarifa} className={`hoverable ${!t.activa ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{t.tarifa}%</td>
                  <td className="px-3 py-2.5 text-gray-700">{t.nombre}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">
                    {t.cuentaGenerado ? `${t.cuentaGenerado} — ${CUENTAS.find(c => c.codigo === t.cuentaGenerado)?.nombre || 'Cuenta inexistente'}` : <span className="text-gray-300">No aplica (exento)</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">
                    {t.cuentaDescontable ? `${t.cuentaDescontable} — ${CUENTAS.find(c => c.codigo === t.cuentaDescontable)?.nombre || 'Cuenta inexistente'}` : <span className="text-gray-300">No aplica (exento)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.activa ? 'Activa' : 'Inactiva'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEditar(t)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => toggleActiva(t)} className={`text-xs hover:underline ${t.activa ? 'text-amber-600' : 'text-green-600'}`}>{t.activa ? 'Desactivar' : 'Activar'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          3 tarifas fijas de IVA
        </div>
      </div>

      {editar && <Modal title={`Tarifa de IVA ${editar.tarifa}%`} onClose={() => setEditar(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos de la tarifa</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="iva-tarifa" className="text-xs font-medium text-gray-600">Tarifa (%):</label>
                  <input id="iva-tarifa" className={`${INPUT} font-mono`} value={`${form.tarifa}%`} disabled readOnly />
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="iva-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="iva-nombre" data-initial-focus className={INPUT} value={form.nombre} onChange={e => update('nombre', e.target.value)} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'iva-nombre-error' : undefined} />
                  {errores.nombre && <p id="iva-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="iva-gen" className="text-xs font-medium text-gray-600">IVA generado:</label>
                  <select id="iva-gen" className={INPUT} value={form.cuentaGenerado} onChange={e => update('cuentaGenerado', e.target.value)} aria-invalid={!!errores.cuentaGenerado} aria-describedby={errores.cuentaGenerado ? 'iva-gen-error' : undefined}>
                    <option value="">— Sin cuenta (exento) —</option>
                    {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                  {errores.cuentaGenerado && <p id="iva-gen-error" className="text-xs text-red-600 sm:col-start-2">{errores.cuentaGenerado}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="iva-des" className="text-xs font-medium text-gray-600">IVA descontable:</label>
                  <select id="iva-des" className={INPUT} value={form.cuentaDescontable} onChange={e => update('cuentaDescontable', e.target.value)} aria-invalid={!!errores.cuentaDescontable} aria-describedby={errores.cuentaDescontable ? 'iva-des-error' : undefined}>
                    <option value="">— Sin cuenta (exento) —</option>
                    {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                  {errores.cuentaDescontable && <p id="iva-des-error" className="text-xs text-red-600 sm:col-start-2">{errores.cuentaDescontable}</p>}
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700 sm:col-span-2">
                  <input type="checkbox" checked={form.activa} onChange={e => update('activa', e.target.checked)} className="h-4 w-4 shrink-0 accent-petroleum-500" />
                  <span>Tarifa activa para el registro de documentos</span>
                </label>
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setEditar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar</button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}

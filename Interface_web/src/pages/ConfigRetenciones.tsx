import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CUENTAS, EMPRESA, fmtCOP } from '../data/mock';
import { RETENCIONES_INICIALES, esRetencionesGuardadas, validarRetencion, type ConceptoRetencion, type ErroresRetencion } from '../data/configRetenciones';

const STORAGE_KEY = `contabdsi:retenciones:v1:${EMPRESA.codigo}`;
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

function cargar(): ConceptoRetencion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esRetencionesGuardadas(value)) return value;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usan los datos de demostración.
  }
  return structuredClone(RETENCIONES_INICIALES);
}

function guardar(conceptos: ConceptoRetencion[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conceptos));
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

function exportarCSV(conceptos: ConceptoRetencion[]) {
  const filas = [['Código', 'Nombre', 'Tarifa %', 'Base mínima', 'Cuenta débito', 'Cuenta crédito', 'Activo'],
  ...conceptos.map(c => [c.codigo, c.nombre, String(c.tarifa), String(c.baseMinima), c.cuentaDebito, c.cuentaCredito, c.activo ? 'Sí' : 'No'])];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `retenciones-${EMPRESA.codigo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_VACIO: ConceptoRetencion = { codigo: '', nombre: '', tarifa: 1, baseMinima: 0, cuentaDebito: '510506', cuentaCredito: '236540', activo: true };

export default function ConfigRetenciones() {
  const [conceptos, setConceptos] = useState<ConceptoRetencion[]>(cargar);
  const [tab, setTab] = useState<'conceptos' | 'tarifas' | 'cuentas'>('conceptos');
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; original?: string } | null>(null);
  const [form, setForm] = useState<ConceptoRetencion>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresRetencion>({});
  const [tarifaModal, setTarifaModal] = useState<ConceptoRetencion | null>(null);
  const [cuentasModal, setCuentasModal] = useState<ConceptoRetencion | null>(null);
  const [tarifaError, setTarifaError] = useState('');
  const [eliminar, setEliminar] = useState<ConceptoRetencion | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [avisoTarifas, setAvisoTarifas] = useState(false);

  const filtrados = conceptos.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q);
  });

  function abrirCrear() {
    setForm(structuredClone(FORM_VACIO));
    setErrores({});
    setModal({ modo: 'crear' });
  }

  function abrirEditar(item: ConceptoRetencion) {
    setForm(structuredClone(item));
    setErrores({});
    setModal({ modo: 'editar', original: item.codigo });
  }

  function update(field: keyof ConceptoRetencion, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function grabar(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores = validarRetencion(form, conceptos, modal?.original);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise los campos señalados antes de guardar.' });
      return;
    }
    const limpio: ConceptoRetencion = { ...form, codigo: form.codigo.trim(), nombre: form.nombre.trim() };
    const siguientes = modal?.modo === 'editar'
      ? conceptos.map(c => c.codigo === modal.original ? limpio : c)
      : [...conceptos, limpio];
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      return;
    }
    setConceptos(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Concepto ${limpio.codigo} actualizado.` : `Concepto ${limpio.codigo} creado.` });
    setModal(null);
  }

  function toggleActivo(item: ConceptoRetencion) {
    const siguientes = conceptos.map(c => c.codigo === item.codigo ? { ...c, activo: !c.activo } : c);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar el cambio.' });
      return;
    }
    setConceptos(siguientes);
    setMensaje({ tipo: 'success', texto: `Concepto ${item.codigo} ${item.activo ? 'inactivado' : 'activado'}.` });
  }

  function grabarTarifa(event: FormEvent) {
    event.preventDefault();
    if (!tarifaModal) return;
    if (!(tarifaModal.tarifa > 0) || tarifaModal.tarifa > 35) {
      setTarifaError('La tarifa debe estar entre 0,1% y 35%.');
      return;
    }
    const siguientes = conceptos.map(c => c.codigo === tarifaModal.codigo ? { ...c, tarifa: tarifaModal.tarifa } : c);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      setTarifaModal(null);
      return;
    }
    setConceptos(siguientes);
    setTarifaModal(null);
    setAvisoTarifas(true);
    setMensaje({ tipo: 'success', texto: `Tarifa de ${tarifaModal.codigo} actualizada al ${String(tarifaModal.tarifa).replace('.', ',')}%.` });
  }

  function grabarCuentas(event: FormEvent) {
    event.preventDefault();
    if (!cuentasModal) return;
    const errores: Partial<Record<'cuentaDebito' | 'cuentaCredito', string>> = {};
    if (!CUENTAS.some(c => c.codigo === cuentasModal.cuentaDebito)) errores.cuentaDebito = 'La cuenta no existe en el plan de cuentas.';
    if (!CUENTAS.some(c => c.codigo === cuentasModal.cuentaCredito)) errores.cuentaCredito = 'La cuenta no existe en el plan de cuentas.';
    if (cuentasModal.cuentaDebito === cuentasModal.cuentaCredito) errores.cuentaCredito = 'Las cuentas de débito y crédito deben ser distintas.';
    if (Object.keys(errores).length) {
      setMensaje({ tipo: 'error', texto: 'Revise las cuentas señaladas antes de guardar.' });
      return;
    }
    const siguientes = conceptos.map(c => c.codigo === cuentasModal.codigo ? { ...c, cuentaDebito: cuentasModal.cuentaDebito, cuentaCredito: cuentasModal.cuentaCredito } : c);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. El cambio no quedó almacenado.' });
      setCuentasModal(null);
      return;
    }
    setConceptos(siguientes);
    setMensaje({ tipo: 'success', texto: `Cuentas del concepto ${cuentasModal.codigo} actualizadas.` });
    setCuentasModal(null);
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    const siguientes = conceptos.filter(c => c.codigo !== eliminar.codigo);
    if (!guardar(siguientes)) {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. No se eliminó el concepto.' });
      setEliminar(null);
      return;
    }
    setConceptos(siguientes);
    setMensaje({ tipo: 'success', texto: `Concepto ${eliminar.codigo} eliminado.` });
    setEliminar(null);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Retenciones</div>
          <h1 className="text-lg font-semibold text-gray-800">Configuración de retenciones</h1>
          <p className="mt-1 text-xs text-gray-500">Conceptos, tarifas y cuentas contables de la retención en la fuente, ICA y rete-IVA.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}
      {avisoTarifas && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
          <span><strong>Pendiente de validación funcional.</strong> Cambió una tarifa de retención; el cálculo de los certificados debe ser revisado por el contador antes de aplicarlo a los períodos vigentes.</span>
          <button onClick={() => setAvisoTarifas(false)} className="text-xs underline hover:text-amber-900">Entendido</button>
        </div>
      )}

      <div className="flex items-center gap-1">
        {([['conceptos', 'Conceptos'], ['tarifas', 'Tarifas'], ['cuentas', 'Cuentas contables']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-xs px-3 py-1.5 rounded-t border-b-2 font-medium ${tab === k ? 'border-petroleum-500 text-petroleum-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por código o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
        <span className="text-xs text-gray-500">{conceptos.filter(c => c.activo).length} de {conceptos.length} conceptos activos</span>
        <button onClick={() => exportarCSV(filtrados)} className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar CSV</button>
        {tab === 'conceptos' && <button onClick={abrirCrear} className={BUTTON_PRIMARY}>+ Crear concepto</button>}
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Tarifa</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Base mínima</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta débito</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta retención</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(c => (
                <tr key={c.codigo} className={`hoverable ${!c.activo ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{c.codigo}</td>
                  <td className="px-3 py-2.5 text-gray-700">{c.nombre}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{String(c.tarifa).replace('.', ',')}%</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-600">{c.baseMinima > 0 ? fmtCOP(c.baseMinima) : '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">{c.cuentaDebito} — {CUENTAS.find(x => x.codigo === c.cuentaDebito)?.nombre || ''}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">{c.cuentaCredito} — {CUENTAS.find(x => x.codigo === c.cuentaCredito)?.nombre || ''}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {tab === 'conceptos' && (
                        <>
                          <button onClick={() => abrirEditar(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                          <span className="text-gray-200">|</span>
                          <button onClick={() => toggleActivo(c)} className={`text-xs hover:underline ${c.activo ? 'text-amber-600' : 'text-green-600'}`}>{c.activo ? 'Inactivar' : 'Activar'}</button>
                          <span className="text-gray-200">|</span>
                          <button onClick={() => setEliminar(c)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                        </>
                      )}
                      {tab === 'tarifas' && <button onClick={() => { setTarifaModal(structuredClone(c)); setTarifaError(''); }} className="text-xs text-blue-600 hover:underline">Cambiar tarifa</button>}
                      {tab === 'cuentas' && <button onClick={() => setCuentasModal(structuredClone(c))} className="text-xs text-blue-600 hover:underline">Editar cuentas</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          {filtrados.length} concepto{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {modal && <Modal title={modal.modo === 'crear' ? 'Nuevo concepto de retención' : `Editar concepto ${modal.original}`} onClose={() => setModal(null)}>
        <form noValidate onSubmit={grabar}>
          <div className="space-y-3 p-5">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Datos del concepto</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ret-codigo" className="text-xs font-medium text-gray-600">Código:</label>
                  <input id="ret-codigo" data-initial-focus className={`${INPUT} font-mono`} value={form.codigo} maxLength={10} onChange={e => update('codigo', e.target.value.toUpperCase())} aria-invalid={!!errores.codigo} aria-describedby={errores.codigo ? 'ret-codigo-error' : undefined} />
                  {errores.codigo && <p id="ret-codigo-error" className="text-xs text-red-600 sm:col-start-2">{errores.codigo}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ret-tarifa" className="text-xs font-medium text-gray-600">Tarifa (%):</label>
                  <input id="ret-tarifa" type="number" min={0.1} max={35} step={0.1} className={`${INPUT} font-mono`} value={String(form.tarifa)} onChange={e => update('tarifa', Number(e.target.value))} aria-invalid={!!errores.tarifa} aria-describedby={errores.tarifa ? 'ret-tarifa-error' : undefined} />
                  {errores.tarifa && <p id="ret-tarifa-error" className="text-xs text-red-600 sm:col-start-2">{errores.tarifa}</p>}
                </div>
                <div className="grid items-center gap-1 sm:col-span-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ret-nombre" className="text-xs font-medium text-gray-600">Nombre:</label>
                  <input id="ret-nombre" className={INPUT} value={form.nombre} onChange={e => update('nombre', e.target.value)} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'ret-nombre-error' : undefined} />
                  {errores.nombre && <p id="ret-nombre-error" className="text-xs text-red-600 sm:col-start-2">{errores.nombre}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ret-base" className="text-xs font-medium text-gray-600">Base mínima:</label>
                  <input id="ret-base" type="number" min={0} step={1000} className={`${INPUT} font-mono`} value={String(form.baseMinima)} onChange={e => update('baseMinima', Number(e.target.value))} />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                  <input type="checkbox" checked={form.activo} onChange={e => update('activo', e.target.checked)} className="h-4 w-4 shrink-0 accent-petroleum-500" />
                  <span>Concepto activo</span>
                </label>
              </div>
            </fieldset>
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Cuentas contables</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ret-cdeb" className="text-xs font-medium text-gray-600">Cuenta débito:</label>
                  <select id="ret-cdeb" className={INPUT} value={form.cuentaDebito} onChange={e => update('cuentaDebito', e.target.value)} aria-invalid={!!errores.cuentaDebito} aria-describedby={errores.cuentaDebito ? 'ret-cdeb-error' : undefined}>
                    {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                  {errores.cuentaDebito && <p id="ret-cdeb-error" className="text-xs text-red-600 sm:col-start-2">{errores.cuentaDebito}</p>}
                </div>
                <div className="grid items-center gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                  <label htmlFor="ret-ccre" className="text-xs font-medium text-gray-600">Cuenta retención:</label>
                  <select id="ret-ccre" className={INPUT} value={form.cuentaCredito} onChange={e => update('cuentaCredito', e.target.value)} aria-invalid={!!errores.cuentaCredito} aria-describedby={errores.cuentaCredito ? 'ret-ccre-error' : undefined}>
                    {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                  {errores.cuentaCredito && <p id="ret-ccre-error" className="text-xs text-red-600 sm:col-start-2">{errores.cuentaCredito}</p>}
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

      {tarifaModal && <Modal title={`Cambiar tarifa — ${tarifaModal.codigo}`} onClose={() => setTarifaModal(null)}>
        <form noValidate onSubmit={grabarTarifa}>
          <div className="space-y-3 p-5">
            <p className="text-xs leading-relaxed text-gray-500">Modifique la tarifa de <strong>{tarifaModal.nombre}</strong>. Los certificados ya emitidos no se recalculan.</p>
            <label htmlFor="tarifa-nueva" className="block text-xs font-medium text-gray-600">Nueva tarifa (%)</label>
            <input id="tarifa-nueva" data-initial-focus type="number" min={0.1} max={35} step={0.1} className={`${INPUT} font-mono`} value={String(tarifaModal.tarifa)} onChange={e => setTarifaModal({ ...tarifaModal, tarifa: Number(e.target.value) })} aria-invalid={!!tarifaError} aria-describedby={tarifaError ? 'tarifa-nueva-error' : undefined} />
            {tarifaError && <p id="tarifa-nueva-error" role="alert" className="text-xs text-red-600">{tarifaError}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setTarifaModal(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar tarifa</button>
          </div>
        </form>
      </Modal>}

      {cuentasModal && <Modal title={`Cuentas del concepto ${cuentasModal.codigo}`} onClose={() => setCuentasModal(null)}>
        <form noValidate onSubmit={grabarCuentas}>
          <div className="space-y-3 p-5">
            <div className="grid items-center gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
              <label htmlFor="cu-deb" className="text-xs font-medium text-gray-600">Cuenta débito (gasto):</label>
              <select id="cu-deb" data-initial-focus className={INPUT} value={cuentasModal.cuentaDebito} onChange={e => setCuentasModal({ ...cuentasModal, cuentaDebito: e.target.value })}>
                {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
            <div className="grid items-center gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
              <label htmlFor="cu-cre" className="text-xs font-medium text-gray-600">Cuenta retención (crédito):</label>
              <select id="cu-cre" className={INPUT} value={cuentasModal.cuentaCredito} onChange={e => setCuentasModal({ ...cuentasModal, cuentaCredito: e.target.value })}>
                {CUENTAS.filter(c => c.afectable).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setCuentasModal(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_PRIMARY}>Guardar cuentas</button>
          </div>
        </form>
      </Modal>}

      {eliminar && <Modal title="Eliminar concepto de retención" onClose={() => setEliminar(null)}>
        <p className="p-5 text-sm text-gray-600">¿Está seguro de eliminar el concepto <span className="font-mono font-semibold text-gray-800">{eliminar.codigo}</span> — {eliminar.nombre}? Los acumulados del año conservarán su código.</p>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" data-initial-focus onClick={() => setEliminar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
          <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar</button>
        </div>
      </Modal>}
    </div>
  );
}

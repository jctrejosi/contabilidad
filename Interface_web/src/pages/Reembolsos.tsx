import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { listarCentros } from '../api/centros';
import { listarComprobantes, type ComprobanteReal } from '../api/comprobantes';
import { consultarPeriodoOperacion, type PeriodoOperacion } from '../api/periodoOperacion';
import {
  confirmarReembolso, consultarReembolso, guardarReembolso, listarReembolsos,
  type ReembolsoContable, type ReembolsoEncabezado, type ReembolsoItem,
  type ResumenReembolso, type ResultadoConfirmacion,
} from '../api/reembolsosContables';
import { listarTerceros } from '../api/terceros';
import { listarTiposDocumento, type TipoDocumentoReal } from '../api/tiposDocumento';
import CrearTerceroModal from '../components/CrearTerceroModal';
import ConfirmarCrearTerceroModal from '../components/ConfirmarCrearTerceroModal';
import type { NavPage } from '../components/Shell';
import type { Tercero } from '../types';

const INPUT = 'w-full min-w-0 rounded border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON = 'rounded border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const PRIMARY = 'rounded bg-petroleum-600 px-4 py-2 text-xs font-semibold text-white hover:bg-petroleum-700 disabled:cursor-not-allowed disabled:bg-gray-300';
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(value);
const emptyItem = (): ReembolsoItem => ({ tercero: '', centro: '', centroCruce: '', concepto: '', valor: 0 });

function initialHeader(periodo: PeriodoOperacion | null, count: number): ReembolsoEncabezado {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const available = periodo?.anio === today.getFullYear() && periodo.mesesHabilitados.includes(today.getMonth() + 1);
  const fecha = available ? localToday : periodo?.fechaSugerida ?? localToday;
  return {
    lote: `RB${fecha.slice(5, 7)}${String(count + 1).padStart(3, '0')}`,
    documentoCaja: '', fecha, valorGeneral: 0, concepto: '', documentoCruce: '', comprobante: '',
  };
}

function advanceOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  const current = event.target as HTMLElement;
  if (current.matches('button[type="submit"],button[data-enter-action]')) return;
  event.preventDefault();
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button[data-enter-action]:not(:disabled),button[type="submit"]:not(:disabled)',
  ));
  controls[controls.indexOf(current) + 1]?.focus();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>{children}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-3"><h2 className="text-sm font-semibold text-gray-800">{title}</h2><button type="button" onClick={onClose} aria-label="Cerrar" className="text-xl text-gray-500">×</button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

function EditorItem({ initial, centers, onSave, onClose }: {
  initial: ReembolsoItem;
  centers: Array<{ codigo: string; nombre: string }>;
  onSave: (item: ReembolsoItem) => void;
  onClose: () => void;
}) {
  const [item, setItem] = useState<ReembolsoItem>(initial);
  const [search, setSearch] = useState(initial.tercero);
  const [results, setResults] = useState<Tercero[]>([]);
  const [selected, setSelected] = useState<Tercero | null>(null);
  const [choice, setChoice] = useState(0);
  const [searching, setSearching] = useState(false);
  const [showCreateQuestion, setShowCreateQuestion] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const centerRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof ReembolsoItem>(field: K, value: ReembolsoItem[K]) {
    setItem(previous => ({ ...previous, [field]: value }));
    setError('');
  }

  async function searchThird() {
    const term = search.trim();
    if (term.length < 2) { setError('Digite al menos dos caracteres del tercero.'); return; }
    setSearching(true);
    setError('');
    try {
      const response = await listarTerceros({ page: 1, pageSize: 30, search: term });
      setResults(response.items);
      setChoice(0);
      if (!response.items.length) setShowCreateQuestion(term);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible buscar el tercero.');
    } finally { setSearching(false); }
  }

  function selectThird(third: Tercero) {
    if (third.estado !== 'Activo') { setError('El tercero está inactivo y no permite movimientos.'); return; }
    setSelected(third);
    set('tercero', third.nit);
    setSearch(`${third.nit} — ${third.nombre}`);
    setResults([]);
    requestAnimationFrame(() => centerRef.current?.focus());
  }

  function submit() {
    const nit = selected?.nit ?? item.tercero;
    if (!nit || search.trim() !== `${selected?.nit} — ${selected?.nombre}`) {
      setError('Busque y seleccione un tercero válido antes de guardar el ítem.'); return;
    }
    if (!centers.some(center => center.codigo === item.centro) || !centers.some(center => center.codigo === item.centroCruce)) {
      setError('Seleccione centros de costo y de cruce existentes.'); return;
    }
    if (!item.concepto.trim() || item.concepto.length > 100) { setError('El concepto admite de 1 a 100 caracteres.'); return; }
    if (!(item.valor > 0)) { setError('El valor debe ser mayor que cero.'); return; }
    onSave({ ...item, tercero: nit, concepto: item.concepto.trim() });
  }

  return <><Modal title={initial.tercero ? 'Modificar ítem del reembolso' : 'Agregar ítem al reembolso'} onClose={onClose}>
    <form onKeyDown={advanceOnEnter} onSubmit={event => { event.preventDefault(); submit(); }} className="space-y-3">
      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      <datalist id="reembolso-centros">{centers.map(center => <option key={center.codigo} value={center.codigo}>{center.nombre}</option>)}</datalist>
      <div className="relative">
        <Field label="Tercero · identificación o nombre">
          <div className="flex gap-2">
            <input autoFocus value={search} onChange={event => { setSearch(event.target.value); setSelected(null); setResults([]); set('tercero', ''); }}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); event.stopPropagation(); setChoice(current => Math.min(results.length - 1, current + 1)); }
                if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); event.stopPropagation(); setChoice(current => Math.max(0, current - 1)); }
                if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (results[choice]) selectThird(results[choice]); else void searchThird(); }
              }} className={INPUT} placeholder="Buscar tercero" />
            <button type="button" disabled={searching} onClick={() => void searchThird()} className={BUTTON}>{searching ? 'Buscando…' : 'Buscar'}</button>
          </div>
        </Field>
        {results.length > 0 && <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
          <div className="px-3 py-1 text-[11px] text-gray-500">Use ↑/↓ y Enter para seleccionar</div>
          {results.map((third, index) => <button type="button" key={third.nit} onMouseDown={event => event.preventDefault()} onClick={() => selectThird(third)} className={`block w-full px-3 py-2 text-left text-xs ${choice === index ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
            {third.nit} — {third.nombre} {third.estado !== 'Activo' ? '(inactivo)' : ''}
          </button>)}
        </div>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Centro de costo"><input ref={centerRef} list="reembolso-centros" maxLength={7} value={item.centro} onChange={event => set('centro', event.target.value.toUpperCase())} className={INPUT} required /></Field>
        <Field label="Centro de costo de cruce"><input list="reembolso-centros" maxLength={7} value={item.centroCruce} onChange={event => set('centroCruce', event.target.value.toUpperCase())} className={INPUT} required /></Field>
        <Field label="Valor"><input type="number" min="0.01" step="0.01" value={item.valor || ''} onChange={event => set('valor', Number(event.target.value))} className={INPUT} required /></Field>
        <Field label="Concepto del ítem"><input maxLength={100} value={item.concepto} onChange={event => set('concepto', event.target.value)} className={INPUT} required /></Field>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className={BUTTON}>Cancelar</button><button type="submit" className={PRIMARY}>Guardar ítem</button></div>
    </form>
  </Modal>
    {showCreateQuestion && <ConfirmarCrearTerceroModal termino={showCreateQuestion} onCancel={() => setShowCreateQuestion('')} onConfirm={() => { setShowCreateQuestion(''); setShowCreate(true); }} />}
    {showCreate && <CrearTerceroModal initialTerm={search} onClose={() => setShowCreate(false)} onCreated={third => { selectThird(third); setShowCreate(false); }} />}
  </>;
}

export default function Reembolsos({ cia, onNavigate }: { cia: string; onNavigate: (page: NavPage) => void }) {
  const [periodo, setPeriodo] = useState<PeriodoOperacion | null>(null);
  const [headers, setHeaders] = useState<ResumenReembolso[]>([]);
  const [centers, setCenters] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [types, setTypes] = useState<TipoDocumentoReal[]>([]);
  const [vouchers, setVouchers] = useState<ComprobanteReal[]>([]);
  const [current, setCurrent] = useState<ReembolsoContable>({ encabezado: initialHeader(null, 0), items: [], estado: 'Borrador' });
  const [original, setOriginal] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [lotCode, setLotCode] = useState('R001');
  const [preview, setPreview] = useState<ResultadoConfirmacion | null>(null);
  const [discardAction, setDiscardAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const addItemButtonRef = useRef<HTMLButtonElement>(null);
  const dirty = JSON.stringify({ encabezado: current.encabezado, items: current.items }) !== savedSignature;
  const itemTotal = current.items.reduce((sum, item) => sum + item.valor, 0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try {
        // Las lecturas se hacen en secuencia para no abrir varias sesiones ADS a la vez.
        const period = await consultarPeriodoOperacion(cia);
        const centerRows = await listarCentros(cia);
        const typeRows = await listarTiposDocumento();
        const voucherRows = await listarComprobantes(cia);
        const existing = await listarReembolsos(cia);
        if (!active) return;
        setPeriodo(period); setCenters(centerRows.items); setTypes(typeRows.items);
        // En contabilidad se pueden seleccionar todos los comprobantes de
        // CONTICOM de la compañía activa; HIST no los excluye del reembolso.
        setVouchers(voucherRows.items); setHeaders(existing);
        const initial = { encabezado: initialHeader(period, existing.length), items: [], estado: 'Borrador' } as ReembolsoContable;
        setCurrent(initial); setSavedSignature(JSON.stringify({ encabezado: initial.encabezado, items: initial.items }));
        setLotCode(`R${String(existing.length + 1).padStart(3, '0')}`);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'No fue posible cargar los datos.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [cia]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function setHeader<K extends keyof ReembolsoEncabezado>(key: K, value: ReembolsoEncabezado[K]) {
    setCurrent(previous => ({ ...previous, encabezado: { ...previous.encabezado, [key]: value } }));
    setError(''); setMessage('');
  }

  function newRefund(force = false) {
    if (dirty && !force) { setDiscardAction('new'); return; }
    const next = { encabezado: initialHeader(periodo, headers.length), items: [], estado: 'Borrador' } as ReembolsoContable;
    setCurrent(next); setOriginal(null); setSavedSignature(JSON.stringify({ encabezado: next.encabezado, items: next.items }));
    setError(''); setMessage(''); setPreview(null);
  }

  async function openRefund(code: string, force = false) {
    if (dirty && !force) { setDiscardAction(code); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const item = await consultarReembolso(cia, code);
      setCurrent(item); setOriginal(code);
      setSavedSignature(JSON.stringify({ encabezado: item.encabezado, items: item.items }));
      setLotCode(`R${String(headers.findIndex(row => row.lote === code) + 1).padStart(3, '0')}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible abrir el reembolso.'); }
    finally { setBusy(false); }
  }

  function saveItem(item: ReembolsoItem) {
    setCurrent(previous => {
      const items = [...previous.items];
      if (editing !== null && editing < items.length) items[editing] = item;
      else items.push(item);
      return { ...previous, items, encabezado: { ...previous.encabezado, valorGeneral: Number(items.reduce((sum, row) => sum + row.valor, 0).toFixed(2)) } };
    });
    setEditing(null); setError(''); setMessage('');
    // Tras guardar, Enter sobre el botón permite iniciar inmediatamente otro ítem.
    requestAnimationFrame(() => addItemButtonRef.current?.focus());
  }

  async function save() {
    setError(''); setMessage('');
    if (!current.items.length) { setError('Agregue al menos un ítem antes de guardar.'); return; }
    if (Math.abs(current.encabezado.valorGeneral - itemTotal) > 0.005) { setError('El valor general debe coincidir con la suma de los ítems.'); return; }
    setBusy(true);
    try {
      await guardarReembolso(cia, current, original ?? undefined);
      setOriginal(current.encabezado.lote);
      setSavedSignature(JSON.stringify({ encabezado: current.encabezado, items: current.items }));
      setHeaders(await listarReembolsos(cia));
      setMessage('Reembolso guardado. Puede continuar editándolo o confirmar para crear el lote.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el reembolso.'); }
    finally { setBusy(false); }
  }

  async function prepareConfirmation() {
    setError(''); setMessage('');
    if (!original || dirty) { setError('Guarde el reembolso antes de confirmarlo.'); return; }
    setBusy(true);
    try { setPreview(await confirmarReembolso(cia, original, lotCode, true)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible validar la confirmación.'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!original) return;
    setBusy(true); setError('');
    try {
      const result = await confirmarReembolso(cia, original, lotCode, false);
      setPreview(null);
      setCurrent(previous => ({ ...previous, estado: 'Lote generado' }));
      setHeaders(await listarReembolsos(cia));
      setMessage(`Lote ${result.loteContable} creado con ${result.partidas} partidas. Revíselo y actualícelo desde Lotes.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible generar el lote.'); setPreview(null); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    function shortcut(event: globalThis.KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
          (event.key !== 'F4' && event.key !== 'F2')) return;
      // Un editor o una confirmación abierta deben terminarse antes de usar
      // atajos del encabezado; así no se pierden cambios de un ítem.
      if (editing !== null || preview || discardAction || loading || busy || current.estado !== 'Borrador') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'F4') void save();
      else void prepareConfirmation();
    }
    window.addEventListener('keydown', shortcut, true);
    return () => window.removeEventListener('keydown', shortcut, true);
  }, [editing, preview, discardAction, loading, busy, current, original, dirty, lotCode, cia]);

  return <div className="mx-auto max-w-screen-xl space-y-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="text-xs text-gray-400">Movimientos / Reembolsos · Compañía {cia}</div><h1 className="text-lg font-semibold text-gray-800">Reembolsos</h1><p className="mt-1 text-xs text-gray-500">Registre gastos y genere un lote para su revisión contable.</p></div>
      <button type="button" onClick={() => newRefund()} disabled={loading || busy} className={BUTTON}>Nuevo reembolso</button>
    </div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
    {message && <div role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">{message}</div>}
    {loading ? <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">Cargando reembolsos y catálogos…</div> : <>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="rounded border border-gray-200 bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold text-gray-800">Reembolsos guardados</div>
          {headers.length ? <div className="max-h-80 overflow-auto">{headers.map(row => <button type="button" key={row.lote} onClick={() => void openRefund(row.lote)} className={`block w-full border-b px-4 py-2.5 text-left text-xs hover:bg-gray-50 ${original === row.lote ? 'bg-petroleum-50' : ''}`}>
            <span className="block font-semibold text-gray-800">{row.lote} · {money(row.valor)}</span><span className="block truncate text-gray-500">{row.fecha} · {row.concepto}</span><span className="block text-gray-500">{row.estado}</span>
          </button>)}</div> : <div className="px-4 py-5 text-xs text-gray-500">No hay reembolsos de esta compañía.</div>}
        </aside>
        <div className="space-y-4">
          <form onKeyDown={advanceOnEnter} onSubmit={event => { event.preventDefault(); void save(); }} className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Encabezado</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Código del reembolso"><input autoFocus maxLength={12} disabled={Boolean(original)} value={current.encabezado.lote} onChange={event => setHeader('lote', event.target.value.toUpperCase())} className={`${INPUT} disabled:bg-gray-100`} required /></Field>
              <Field label="Tipo de documento de caja"><select disabled={current.estado !== 'Borrador'} value={current.encabezado.documentoCaja} onChange={event => setHeader('documentoCaja', event.target.value)} className={INPUT} required><option value="">Seleccione…</option>{types.map(row => <option key={row.codigo} value={row.codigo}>{row.codigo} — {row.nombre}</option>)}</select></Field>
              <Field label="Fecha"><input type="date" disabled={current.estado !== 'Borrador'} value={current.encabezado.fecha} onChange={event => setHeader('fecha', event.target.value)} className={INPUT} required /></Field>
              <Field label="Valor general"><input type="number" step="0.01" min="0.01" disabled={current.estado !== 'Borrador'} value={current.encabezado.valorGeneral || ''} onChange={event => setHeader('valorGeneral', Number(event.target.value))} className={INPUT} required /></Field>
              <Field label="Tipo de documento de cruce"><select disabled={current.estado !== 'Borrador'} value={current.encabezado.documentoCruce} onChange={event => setHeader('documentoCruce', event.target.value)} className={INPUT} required><option value="">Seleccione…</option>{types.map(row => <option key={row.codigo} value={row.codigo}>{row.codigo} — {row.nombre}</option>)}</select></Field>
              <Field label="Comprobante"><select disabled={current.estado !== 'Borrador'} value={current.encabezado.comprobante} onChange={event => setHeader('comprobante', event.target.value)} className={INPUT} required><option value="">Seleccione…</option>{vouchers.map(row => <option key={row.codigo} value={row.codigo}>{row.codigo} — {row.nombre}</option>)}</select></Field>
              <div className="sm:col-span-2 lg:col-span-3"><Field label="Concepto general"><input maxLength={50} disabled={current.estado !== 'Borrador'} value={current.encabezado.concepto} onChange={event => setHeader('concepto', event.target.value)} onKeyDown={event => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault(); event.stopPropagation();
                if (!busy) setEditing(current.items.length);
              }} className={INPUT} required /></Field></div>
            </div>
            <p className="mt-3 text-xs text-gray-500">Ejercicio {periodo?.anio ?? '—'} · Solo se aceptan fechas de meses habilitados.</p>
            {current.estado === 'Borrador' && <div className="mt-4 flex justify-end"><button type="submit" disabled={busy} className={PRIMARY}>{busy ? 'Guardando…' : 'Guardar reembolso (F4)'}</button></div>}
          </form>
          <section className="rounded border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-sm font-semibold text-gray-800">Ítems del reembolso</h2>{current.estado === 'Borrador' && <button ref={addItemButtonRef} type="button" onClick={() => setEditing(current.items.length)} className={BUTTON}>Agregar ítem</button>}</div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left">Tercero</th><th className="px-3 py-2 text-left">Centro</th><th className="px-3 py-2 text-left">Centro cruce</th><th className="px-3 py-2 text-left">Concepto</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-gray-100">{current.items.map((item, index) => <tr key={index}><td className="px-3 py-2 font-mono">{item.tercero}</td><td className="px-3 py-2">{item.centro}</td><td className="px-3 py-2">{item.centroCruce}</td><td className="max-w-xs truncate px-3 py-2">{item.concepto}</td><td className="px-3 py-2 text-right font-mono">{money(item.valor)}</td><td className="whitespace-nowrap px-3 py-2 text-right">{current.estado === 'Borrador' && <><button type="button" onClick={() => setEditing(index)} className="mr-2 text-petroleum-700 hover:underline">Editar</button><button type="button" onClick={() => setCurrent(previous => ({ ...previous, items: previous.items.filter((_, i) => i !== index), encabezado: { ...previous.encabezado, valorGeneral: Number(previous.items.filter((_, i) => i !== index).reduce((sum, row) => sum + row.valor, 0).toFixed(2)) } }))} className="text-red-600 hover:underline">Quitar</button></>}</td></tr>)}</tbody><tfoot className="border-t bg-gray-50"><tr><td colSpan={4} className="px-3 py-2 font-semibold">Total de ítems</td><td className="px-3 py-2 text-right font-mono font-semibold">{money(itemTotal)}</td><td /></tr></tfoot></table></div>
            {!current.items.length && <div className="p-5 text-center text-xs text-gray-500">Agregue al menos un ítem de gasto.</div>}
          </section>
          {current.estado === 'Borrador' && original && <section className="rounded border border-gray-200 bg-white p-4"><h2 className="text-sm font-semibold text-gray-800">Generar lote contable</h2><p className="mt-1 text-xs text-gray-500">El lote se crea para revisión; luego podrá verificarlo y actualizarlo desde Lotes.</p><div className="mt-3 flex flex-wrap items-end gap-3"><Field label="Código del lote (4 caracteres)"><input maxLength={4} value={lotCode} onChange={event => setLotCode(event.target.value.toUpperCase())} className={INPUT} /></Field><button type="button" data-enter-action onClick={() => void prepareConfirmation()} disabled={busy || dirty} className={PRIMARY}>{busy ? 'Validando…' : 'Actualizar reembolso (F2)'}</button></div>{dirty && <p className="mt-2 text-xs text-amber-700">Guarde los cambios antes de confirmar.</p>}</section>}
          {current.estado === 'Lote generado' && <button type="button" onClick={() => onNavigate('movimientos/lotes')} className={PRIMARY}>Ir a lotes</button>}
        </div>
      </div>
    </>}
    {editing !== null && <EditorItem key={editing} initial={current.items[editing] ?? emptyItem()} centers={centers} onSave={saveItem} onClose={() => setEditing(null)} />}
    {preview && <Modal title="Confirmar generación del lote" onClose={() => setPreview(null)}><p className="text-sm text-gray-700">Se generará el lote <strong>{preview.loteContable}</strong> con {preview.partidas} partidas y {preview.documentos} documentos. Débitos: {money(preview.debito)}. Créditos: {money(preview.credito)}.</p><p className="mt-2 text-xs text-gray-500">Quedará en borrador para verificarlo antes de contabilizar.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPreview(null)} className={BUTTON}>Cancelar</button><button autoFocus type="button" disabled={busy} onClick={() => void confirm()} className={PRIMARY}>{busy ? 'Generando…' : 'Generar lote'}</button></div></Modal>}
    {discardAction && <Modal title="Cambios sin guardar" onClose={() => setDiscardAction(null)}><p className="text-sm text-gray-700">Tiene cambios pendientes. Si continúa, se perderán los cambios que aún no ha guardado.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDiscardAction(null)} className={BUTTON}>Seguir editando</button><button type="button" onClick={() => { const action = discardAction; setDiscardAction(null); if (action === 'new') newRefund(true); else void openRefund(action, true); }} className={PRIMARY}>Descartar cambios</button></div></Modal>}
  </div>;
}

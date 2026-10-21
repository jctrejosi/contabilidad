import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { listarMedioFormatos, type MedioFormato } from '../api/mediosFormatos';
import { listarMedioConceptos, type MedioConcepto } from '../api/mediosConceptos';
import { listarTerceros } from '../api/terceros';
import { consultarRevision, detalleRevision, eliminarRevision, exportarRevision, guardarRevision, identificarRevision,
  type CambioIdentificacion, type DetalleMedio, type GuardarMedio, type RegistroMedio, type RevisionMedios } from '../api/mediosRevision';
import CrearTerceroModal from '../components/CrearTerceroModal';
import type { Tercero } from '../types';

const INPUT = 'w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON = 'rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-petroleum-50 disabled:opacity-40';
const PRIMARY = 'rounded bg-petroleum-500 px-4 py-1.5 text-xs text-white hover:bg-petroleum-600 disabled:opacity-40';
const money = (value: number) => value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EMPTY: GuardarMedio = { concepto: '', tercero: '', digito: '', valor1: 0, valor2: 0 };
const DETAIL = [['CODIGO', 'Cuenta'], ['TIPODOC', 'Tipo'], ['TDOCUM', 'Documento'], ['TCOMPR', 'Compr.'], ['TFASE', 'Centro'], ['TFECHA', 'Fecha'], ['TVALOR', 'Valor'], ['TBASE', 'Base'], ['TDETALLE', 'Detalle'], ['TINCON', 'Columna']];

function avanzar(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter' || event.defaultPrevented || event.nativeEvent.isComposing) return;
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) return;
  event.preventDefault();
  const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not([readonly]), select, button[type="submit"]')).filter(e => !e.hasAttribute('disabled'));
  fields[fields.indexOf(event.target) + (event.shiftKey ? -1 : 1)]?.focus();
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl">
      <header className="flex items-center justify-between border-b px-5 py-3"><h2 className="text-sm font-semibold text-gray-800">{title}</h2><button type="button" onClick={onClose} aria-label="Cerrar">×</button></header>
      <div className="space-y-4 overflow-auto p-5">{children}</div>
    </section>
  </div>;
}

/** Mantenimiento del resultado vigente por compañía; no vuelve a generarlo. */
export default function MediosRevision({ cia }: { cia: string }) {
  const [formatos, setFormatos] = useState<MedioFormato[]>([]);
  const [formato, setFormato] = useState('');
  const [result, setResult] = useState<RevisionMedios | null>(null);
  const [conceptos, setConceptos] = useState<MedioConcepto[]>([]);
  const [selected, setSelected] = useState<RegistroMedio | null>(null);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [form, setForm] = useState<GuardarMedio | null>(null);
  const [thirdSearch, setThirdSearch] = useState(''); const [thirds, setThirds] = useState<Tercero[]>([]);
  const [thirdIndex, setThirdIndex] = useState(0); const [thirdBusy, setThirdBusy] = useState(false);
  const [thirdMessage, setThirdMessage] = useState(''); const [createThird, setCreateThird] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detail, setDetail] = useState<{ row: RegistroMedio; items: DetalleMedio[] } | null>(null);
  const [delivery, setDelivery] = useState(false); const [identification, setIdentification] = useState('codigo');
  const [idPreview, setIdPreview] = useState<CambioIdentificacion | null>(null);
  const [report, setReport] = useState(false);
  const request = useRef(0); const thirdRequest = useRef(0); const digitRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const version = ++request.current;
    setResult(null); setFormato(''); setSelected(null); setForm(null); setDetail(null); setIdPreview(null);
    setConfirmDelete(false); setDelivery(false); setReport(false); setCreateThird(false); setError(''); setNotice('');
    listarMedioFormatos(cia).then(items => { if (version === request.current) setFormatos(items); })
      .catch(cause => { if (version === request.current) setError(String(cause.message)); });
    return () => { request.current++; thirdRequest.current++; };
  }, [cia]);
  async function cargar() {
    const version = ++request.current;
    setBusy(true); setError(''); setSelected(null);
    try {
      const [data, definitions] = await Promise.all([consultarRevision(cia, formato), listarMedioConceptos(cia, formato)]);
      if (version === request.current) { setResult(data); setConceptos(definitions); setPage(0); }
    } catch (cause) { if (version === request.current) { setResult(null); setError(cause instanceof Error ? cause.message : 'No fue posible consultar.'); } }
    finally { if (version === request.current) setBusy(false); }
  }
  async function action(run: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await run(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible completar la operación.'); }
    finally { setBusy(false); }
  }
  function editar(row?: RegistroMedio) {
    if (!result || busy) return;
    setError(''); setNotice(''); setThirds([]); setThirdMessage('');
    setForm(row ? { id: row.id, revision: row.revision, concepto: row.concepto, tercero: row.tercero, digito: row.digito, valor1: row.valores[0], valor2: row.valores[1] } : { ...EMPTY });
    setThirdSearch(row ? `${row.tercero} ${row.nombre}` : '');
  }
  async function buscarTercero() {
    if (thirdSearch.trim().length < 2) { setThirdMessage('Escriba al menos dos caracteres para buscar.'); return; }
    const version = ++thirdRequest.current;
    setThirdBusy(true); setThirdMessage('');
    try {
      const data = await listarTerceros({ page: 1, pageSize: 30, search: thirdSearch.trim(), estado: 'todos' });
      if (version === thirdRequest.current) { setThirds(data.items); setThirdIndex(0); if (!data.items.length) setThirdMessage('No se encontró el tercero. Puede crearlo.'); }
    } catch (cause) { if (version === thirdRequest.current) setThirdMessage(cause instanceof Error ? cause.message : 'No fue posible buscar.'); }
    finally { if (version === thirdRequest.current) setThirdBusy(false); }
  }
  function elegirTercero(third: Tercero) {
    thirdRequest.current++; setThirdBusy(false);
    setForm(previous => previous ? { ...previous, tercero: third.nit, digito: third.digito ?? '' } : null);
    setThirdSearch(`${third.nit} ${third.nombre}`); setThirds([]); setThirdMessage('');
    requestAnimationFrame(() => digitRef.current?.focus());
  }
  async function guardar(event: FormEvent) {
    event.preventDefault(); if (!form || busy) return;
    await action(async () => {
      const response = await guardarRevision(cia, formato, form);
      setForm(null); thirdRequest.current++;
      await cargar(); setNotice(response.advertencia || response.mensaje);
    });
  }
  async function abrirDetalle(row: RegistroMedio) {
    await action(async () => { const data = await detalleRevision(cia, formato, row); setDetail({ row, items: data.items }); });
  }
  async function exportar(modo: 'revision' | 'detalle' | 'archivo', salida: 'pdf' | 'xlsx') {
    await action(async () => { await exportarRevision(cia, formato, modo, salida, identification, modo === 'detalle' ? detail?.row : undefined); });
  }
  const filtered = (result?.items ?? []).filter(item => `${item.concepto} ${item.tercero} ${item.nombre} ${item.tercero2}`.toLocaleLowerCase('es-CO').includes(search.toLocaleLowerCase('es-CO')));
  const current = filtered.slice(page * 100, page * 100 + 100);
  const open = !!form || !!detail || !!idPreview || confirmDelete || delivery || report;
  const errorBox = error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>;
  return <div className="space-y-4 p-4" onKeyDown={event => {
    if (busy || !result || open || (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) return;
    if (['F2', 'F3', 'F4', 'F5', 'F6'].includes(event.key)) event.preventDefault();
    if (event.key === 'F2') editar();
    if (event.key === 'F3' && selected) editar(selected);
    if (event.key === 'F4' && selected) setConfirmDelete(true);
    if (event.key === 'F5') setReport(true);
    if (event.key === 'F6') setDelivery(true);
  }}>
    <header><p className="text-xs text-gray-500">Medios magnéticos</p><h1 className="text-lg font-semibold text-gray-800">5. Revisión de medios</h1></header>
    {!open && errorBox}
    {notice && <p role="status" className="rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">{notice}</p>}
    <form onSubmit={e => { e.preventDefault(); void cargar(); }} onKeyDown={avanzar} className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
      <label className="min-w-64 text-xs text-gray-700">Formato<select required disabled={busy} className={INPUT} value={formato} onChange={e => { request.current++; setFormato(e.target.value); setResult(null); setSelected(null); setError(''); setNotice(''); setSearch(''); }}><option value="">Seleccione…</option>{formatos.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></label>
      <button type="submit" disabled={busy || !formato} className={PRIMARY}>{busy ? 'Procesando…' : 'Consultar'}</button>
      {result && <div className="ml-auto text-right text-xs text-gray-600">{result.items.length} registros<br /><span className="font-semibold">Total Valor 1: {money(result.totalValor1)}</span></div>}
    </form>
    {result && <section className="space-y-3 rounded border bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className={BUTTON} onClick={() => editar()}>F2 Nuevo</button>
        <button disabled={busy || !selected} className={BUTTON} onClick={() => selected && editar(selected)}>F3 Modificar</button>
        <button disabled={busy || !selected} className={BUTTON} onClick={() => setConfirmDelete(true)}>F4 Eliminar</button>
        <button disabled={busy || !selected} className={BUTTON} onClick={() => selected && void abrirDetalle(selected)}>Ver detalle</button>
        <button disabled={busy} className={BUTTON} onClick={() => setReport(true)}>F5 Informe de revisión</button>
        <button disabled={busy || !result.items.length} className={BUTTON} onClick={() => setDelivery(true)}>F6 Generar archivo</button>
        <button disabled={busy || !result.items.length} className={BUTTON} onClick={() => void action(async () => { setIdPreview(await identificarRevision(cia, formato)); })}>Asignar ID a identificación</button>
      </div>
      <p className="text-xs text-amber-700">Una nueva generación de medios reemplazará los resultados y las correcciones manuales de esta compañía.</p>
      <input aria-label="Buscar en la revisión" placeholder="Buscar concepto, tercero o nombre…" value={search} className={INPUT} onChange={e => { setSearch(e.target.value); setSelected(null); setPage(0); }} />
      <div className="overflow-auto"><table className="w-full whitespace-nowrap text-xs"><thead className="bg-gray-50 text-gray-600"><tr>{['Concepto', 'Tercero', 'DV', 'Nombre', 'Tercero 2', ...Array.from({ length: 11 }, (_, i) => `Valor ${i + 1}`), 'X'].map(label => <th key={label} className="px-3 py-2 text-left font-semibold">{label}</th>)}</tr></thead>
        <tbody>{current.map(row => <tr key={row.id} tabIndex={0} aria-selected={selected?.id === row.id} className={`cursor-pointer border-t focus:outline-petroleum-500 ${selected?.id === row.id ? 'bg-petroleum-50' : 'hover:bg-gray-50'}`} onFocus={() => setSelected(row)} onClick={() => setSelected(row)} onDoubleClick={() => !busy && void abrirDetalle(row)} onKeyDown={e => { if (e.key === 'Enter' && !busy) { e.preventDefault(); void abrirDetalle(row); } if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); const next = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling; (next as HTMLElement | null)?.focus(); } }}>
          <td className="px-3 py-2 font-mono">{row.concepto}</td><td className="px-3 py-2 font-mono">{row.tercero}</td><td className="px-3 py-2">{row.digito}</td><td className="max-w-72 truncate px-3 py-2" title={row.nombre}>{row.nombre || 'Tercero sin coincidencia'}</td><td className="px-3 py-2">{row.tercero2}</td>{row.valores.map((value, i) => <td key={i} className="px-3 py-2 text-right font-mono">{money(value)}</td>)}<td className="px-3 py-2">{row.sale ? 'X' : ''}</td>
        </tr>)}</tbody></table></div>
      {!filtered.length && <p className="p-4 text-center text-xs text-gray-500">No hay registros para esta selección.</p>}
      <div className="flex items-center justify-end gap-3 text-xs"><span>{filtered.length} registros · Página {page + 1} de {Math.max(1, Math.ceil(filtered.length / 100))}</span><button disabled={busy || page === 0} className={BUTTON} onClick={() => { setPage(p => p - 1); setSelected(null); }}>Anterior</button><button disabled={busy || (page + 1) * 100 >= filtered.length} className={BUTTON} onClick={() => { setPage(p => p + 1); setSelected(null); }}>Siguiente</button></div>
    </section>}
    {form && <Modal title={form.id ? 'Modificar registro de medios' : 'Nuevo registro de medios'} onClose={() => { if (!busy) { setForm(null); thirdRequest.current++; } }}>
      {errorBox}<form onSubmit={guardar} onKeyDown={avanzar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs">Concepto<select autoFocus required disabled={busy} className={INPUT} value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}><option value="">Seleccione…</option>{conceptos.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></label>
        <div className="space-y-2 text-xs"><label>Tercero<input className={INPUT} disabled={busy} value={thirdSearch} placeholder="NIT o nombre" onChange={e => { thirdRequest.current++; setThirdBusy(false); setThirdSearch(e.target.value); setThirds([]); setThirdMessage(''); setForm({ ...form, tercero: '' }); }} onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setThirdIndex(index => Math.max(0, Math.min(thirds.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))); }
          if (e.key === 'Enter') { e.preventDefault(); if (thirds[thirdIndex]) elegirTercero(thirds[thirdIndex]); else if (!form.tercero) void buscarTercero(); else digitRef.current?.focus(); }
        }} /></label><button type="button" disabled={busy || thirdBusy} className={BUTTON} onClick={() => void buscarTercero()}>{thirdBusy ? 'Buscando…' : 'Buscar tercero'}</button>
          {thirds.map((third, index) => <button type="button" key={third.nit} onClick={() => elegirTercero(third)} className={`block w-full rounded border p-2 text-left ${index === thirdIndex ? 'bg-petroleum-50' : ''}`}>{third.nit} — {third.nombre}</button>)}
          {thirdMessage && <p role="status">{thirdMessage}</p>}<button type="button" className={BUTTON} disabled={busy} onClick={() => setCreateThird(true)}>Crear tercero</button>
        </div>
        <label className="text-xs">Dígito de verificación<input ref={digitRef} maxLength={1} pattern="[0-9]?" disabled={busy} className={INPUT} value={form.digito} onChange={e => setForm({ ...form, digito: e.target.value })} /></label>
        <label className="text-xs">Valor 1<input required type="number" step="0.01" min="-99999999999.99" max="99999999999.99" disabled={busy} className={INPUT} value={form.valor1} onChange={e => setForm({ ...form, valor1: Number(e.target.value) })} /></label>
        <label className="text-xs">Valor 2<input required type="number" step="0.01" min="-99999999999.99" max="99999999999.99" disabled={busy} className={INPUT} value={form.valor2} onChange={e => setForm({ ...form, valor2: Number(e.target.value) })} /></label>
        <p className="text-xs text-gray-500 sm:col-span-2">Los demás valores se conservan. Una corrección manual no modifica las partidas de origen.</p>
        <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" disabled={busy} className={BUTTON} onClick={() => setForm(null)}>Cancelar</button><button type="submit" disabled={busy || !form.tercero} className={PRIMARY}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
      </form>
    </Modal>}
    {createThird && <CrearTerceroModal initialTerm={thirdSearch} onClose={() => setCreateThird(false)} onCreated={third => { elegirTercero(third); setCreateThird(false); }} />}
    {confirmDelete && selected && <Modal title="Eliminar registro" onClose={() => !busy && setConfirmDelete(false)}>{errorBox}<p className="text-sm">¿Eliminar el concepto {selected.concepto} del tercero {selected.tercero}? Las partidas de origen se conservarán.</p><div className="flex justify-end gap-3"><button disabled={busy} className={BUTTON} onClick={() => setConfirmDelete(false)}>Cancelar</button><button disabled={busy} className={PRIMARY} onClick={() => void action(async () => { const response = await eliminarRevision(cia, formato, selected); setConfirmDelete(false); await cargar(); setNotice(response.advertencia || response.mensaje); })}>Eliminar registro</button></div></Modal>}
    {detail && <Modal title={`Detalle · concepto ${detail.row.concepto} · ${detail.row.tercero}`} onClose={() => !busy && setDetail(null)}>{errorBox}
      <div className="flex gap-3"><button className={BUTTON} disabled={busy} onClick={() => void exportar('detalle', 'pdf')}>PDF / Imprimir</button><button className={BUTTON} disabled={busy} onClick={() => void exportar('detalle', 'xlsx')}>Excel</button></div>
      <div className="overflow-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{DETAIL.map(([key, label]) => <th key={key} className="whitespace-nowrap px-3 py-2 text-left">{label}</th>)}</tr></thead><tbody>{detail.items.map((item, index) => <tr key={index} className="border-t">{DETAIL.map(([key]) => <td key={key} className="px-3 py-2">{['TVALOR', 'TBASE'].includes(key) ? money(Number(item[key])) : item[key]}</td>)}</tr>)}</tbody></table></div>
      {!detail.items.length && <p className="text-xs text-gray-500">No hay partidas de origen para esta combinación. Puede ser un registro manual o una identificación reasignada.</p>}
      <p className="text-xs font-semibold text-gray-700">Totales: Valor {money(detail.items.reduce((sum, item) => sum + Number(item.TVALOR || 0), 0))} · Base {money(detail.items.reduce((sum, item) => sum + Number(item.TBASE || 0), 0))}</p>
    </Modal>}
    {report && <Modal title="Informe de revisión" onClose={() => !busy && setReport(false)}>{errorBox}<p className="text-xs">Se incluyen todos los registros del formato consultado, no solo la página visible.</p><div className="flex gap-3"><button disabled={busy} className={PRIMARY} onClick={() => void exportar('revision', 'pdf')}>PDF / Imprimir</button><button disabled={busy} className={BUTTON} onClick={() => void exportar('revision', 'xlsx')}>Excel</button></div></Modal>}
    {delivery && <Modal title="Generar archivo de medios" onClose={() => !busy && setDelivery(false)}>{errorBox}<p className="text-xs">Se agrupan los valores por concepto y tercero y se aplican las columnas configuradas. El archivo no lleva encabezados.</p><label className="block text-xs">Identificación del tercero<select disabled={busy} value={identification} className={INPUT} onChange={e => setIdentification(e.target.value)}><option value="codigo">Código del tercero</option><option value="identificacion">ID del tercero</option><option value="beneficiario">Beneficiario alterno</option></select></label><button disabled={busy} className={PRIMARY} onClick={() => void exportar('archivo', 'xlsx')}>{busy ? 'Generando…' : 'Generar Excel'}</button></Modal>}
    {idPreview && <Modal title="Asignar ID a identificación" onClose={() => !busy && setIdPreview(null)}>{errorBox}<p className="text-sm">Esta acción reemplaza el código del tercero por su ID en {idPreview.cantidad} registros del formato actual. No cambia los valores ni las partidas de origen y puede dejar de encontrarse su detalle por el código anterior. Para exportar con ID sin modificar los registros, utilice «Generar archivo».</p>
      <div className="max-h-64 overflow-auto text-xs">{idPreview.cambios.map((change, index) => <div key={index} className="border-b py-1">{change.concepto}: {change.anterior} → {change.nuevo}</div>)}</div>
      <div className="flex justify-end gap-3"><button disabled={busy} className={BUTTON} onClick={() => setIdPreview(null)}>Cancelar</button><button disabled={busy || !idPreview.cantidad} className={PRIMARY} onClick={() => void action(async () => { const response = await identificarRevision(cia, formato, idPreview.token); setIdPreview(null); await cargar(); setNotice(response.advertencia || `Se actualizaron ${response.cantidad} registros.`); })}>Confirmar reasignación</button></div>
    </Modal>}
  </div>;
}

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { listarTerceros } from '../api/terceros';
import { consultarDetalleMedios, exportarDetalleMedios, paginaDetalleMedios, type DetalleMediosTercero, type ModoDetalleMedios } from '../api/mediosDetalleTercero';
import type { Tercero } from '../types';

const INPUT = 'w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON = 'rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-petroleum-50 disabled:opacity-40';
const PRIMARY = 'rounded bg-petroleum-500 px-4 py-1.5 text-xs text-white disabled:opacity-40';
const money = (value: number) => value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** MEDMAG06: solo tercero y forma de impresión, sin filtros de año/mes/formato. */
export default function MediosDetalleTercero({ cia }: { cia: string }) {
  const [search, setSearch] = useState(''); const [third, setThird] = useState<Tercero | null>(null);
  const [items, setItems] = useState<Tercero[]>([]); const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<ModoDetalleMedios>('detallado');
  const [result, setResult] = useState<DetalleMediosTercero | null>(null);
  const [busy, setBusy] = useState(false); const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const searchVersion = useRef(0); const resultVersion = useRef(0);
  const modeRef = useRef<HTMLSelectElement>(null); const consultRef = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { searchVersion.current++; resultVersion.current++; }, [cia]);
  function invalidate() { resultVersion.current++; setResult(null); setError(''); }
  function select(item: Tercero) {
    searchVersion.current++; setSearchBusy(false); invalidate(); setThird(item);
    setSearch(`${item.nit} — ${item.nombre}`); setItems([]); setNotice('');
    requestAnimationFrame(() => modeRef.current?.focus());
  }
  async function buscar() {
    if (search.trim().length < 2) { setNotice('Escriba al menos dos caracteres del código o nombre.'); return; }
    const version = ++searchVersion.current;
    setSearchBusy(true); setError(''); setNotice(''); setItems([]);
    try {
      const data = await listarTerceros({ page: 1, pageSize: 30, search: search.trim(), estado: 'todos' });
      if (version !== searchVersion.current) return;
      const exact = data.items.find(item => item.nit === search.trim());
      if (exact) select(exact);
      else { setItems(data.items); setIndex(0); if (!data.items.length) setNotice('No se encontró el tercero.'); }
    } catch (cause) { if (version === searchVersion.current) setError(cause instanceof Error ? cause.message : 'No fue posible buscar.'); }
    finally { if (version === searchVersion.current) setSearchBusy(false); }
  }
  async function consultar() {
    if (!third || busy) return;
    const version = ++resultVersion.current;
    setBusy(true); setError(''); setResult(null);
    try { const data = await consultarDetalleMedios(cia, third.nit, mode); if (version === resultVersion.current) setResult(data); }
    catch (cause) { if (version === resultVersion.current) setError(cause instanceof Error ? cause.message : 'No fue posible consultar.'); }
    finally { if (version === resultVersion.current) setBusy(false); }
  }
  async function page(number: number) {
    if (!result || busy) return;
    const version = ++resultVersion.current;
    setBusy(true); setError('');
    try { const data = await paginaDetalleMedios(cia, result.snapshotId, number); if (version === resultVersion.current) setResult(data); }
    catch (cause) { if (version === resultVersion.current) setError(cause instanceof Error ? cause.message : 'No fue posible cambiar de página.'); }
    finally { if (version === resultVersion.current) setBusy(false); }
  }
  async function exportar(salida: 'pdf' | 'xlsx') {
    if (!result || busy) return;
    setBusy(true); setError('');
    try { await exportarDetalleMedios(cia, result.snapshotId, salida); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible exportar.'); }
    finally { setBusy(false); }
  }
  function thirdKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setIndex(i => Math.max(0, Math.min(items.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1))));
    }
    if (event.key === 'Enter') {
      event.preventDefault(); if (items[index]) select(items[index]); else if (third) modeRef.current?.focus(); else void buscar();
    }
  }
  return <div className="space-y-4 p-4" onKeyDown={e => { if (e.key === 'F5' && result && !busy) { e.preventDefault(); void exportar('pdf'); } }}>
    <header><p className="text-xs text-gray-500">Medios magnéticos</p><h1 className="text-lg font-semibold text-gray-800">6. Detalle por tercero</h1></header>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <form className="space-y-3 rounded border bg-white p-4" onSubmit={e => { e.preventDefault(); void consultar(); }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 text-xs">Tercero<input autoFocus disabled={busy} className={INPUT} placeholder="Código o nombre del tercero" value={search} onKeyDown={thirdKeys} onChange={e => { searchVersion.current++; setSearchBusy(false); invalidate(); setSearch(e.target.value); setThird(null); setItems([]); setNotice(''); }} /></label>
        <button type="button" className={BUTTON} disabled={busy || searchBusy} onClick={() => void buscar()}>{searchBusy ? 'Buscando…' : 'Buscar tercero'}</button>
        <label className="text-xs">Forma del informe<select ref={modeRef} disabled={busy} className={INPUT} value={mode} onChange={e => { invalidate(); setMode(e.target.value as ModoDetalleMedios); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); consultRef.current?.focus(); } }}><option value="detallado">Detallado</option><option value="resumido">Resumido</option></select></label>
        <button type="submit" ref={consultRef} className={PRIMARY} disabled={busy || !third}>{busy ? 'Procesando…' : 'Consultar'}</button>
      </div>
      {notice && <p role="status" className="text-xs text-gray-600">{notice}</p>}
      {!!items.length && <div className="max-h-64 overflow-auto rounded border">{items.map((item, i) => <button type="button" key={item.nit} onClick={() => select(item)} className={`block w-full border-b px-3 py-2 text-left text-xs ${i === index ? 'bg-petroleum-50' : 'hover:bg-gray-50'}`}>{item.nit} — {item.nombre}</button>)}</div>}
      {third && <p className="text-xs text-gray-600">Tercero seleccionado: {third.nit} — {third.nombre}</p>}
    </form>
    {result && <section className="space-y-3 rounded border bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-gray-700">{result.tercero} — {result.nombre}<br />{result.movimientos} partidas · Total valor: <strong>{money(result.totalValor)}</strong> · Total base: <strong>{money(result.totalBase)}</strong></div><div className="flex gap-2"><button disabled={busy || !result.movimientos} className={BUTTON} onClick={() => void exportar('pdf')}>F5 PDF / Imprimir</button><button disabled={busy || !result.movimientos} className={BUTTON} onClick={() => void exportar('xlsx')}>Excel</button></div></div>
      {!result.movimientos ? <p className="p-4 text-center text-xs text-gray-500">El tercero no tiene movimientos de medios en esta compañía.</p> : <>
        <div className="overflow-auto"><table className="w-full whitespace-nowrap text-xs"><thead className="bg-gray-50 text-gray-600"><tr>{result.columnas.map(label => <th key={label} className="px-3 py-2 text-left font-semibold">{label}</th>)}</tr></thead><tbody>{result.filas.map((row, i) => <tr key={i} className={`border-t ${result.tipos[i]?.startsWith('subtotal') || result.tipos[i] === 'total-general' ? 'bg-petroleum-50 font-semibold text-petroleum-800' : 'hover:bg-gray-50'}`}>{row.map((cell, index) => <td key={index} className={`px-3 py-2 ${typeof cell === 'number' ? 'text-right font-mono' : ''}`}>{typeof cell === 'number' ? money(cell) : cell}</td>)}</tr>)}</tbody></table></div>
        <div className="flex items-center justify-end gap-3 text-xs"><span>Página {result.page + 1} de {Math.max(1, Math.ceil(result.totalFilas / result.pageSize))}</span><button className={BUTTON} disabled={busy || !result.page} onClick={() => void page(result.page - 1)}>Anterior</button><button className={BUTTON} disabled={busy || (result.page + 1) * result.pageSize >= result.totalFilas} onClick={() => void page(result.page + 1)}>Siguiente</button></div>
      </>}
    </section>}
  </div>;
}

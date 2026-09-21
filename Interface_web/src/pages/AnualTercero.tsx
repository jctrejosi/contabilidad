import { useEffect, useMemo, useState } from 'react';
import { listarCuentas } from '../api/cuentas';
import { consultarDetalleAnualTercero, consultarMovimientoAnualTercero, type DetalleAnualTerceroResponse, type MesMovimientoAnualTercero, type MovimientoAnualTerceroResponse } from '../api/movimientoAnualTercero';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import { listarTerceros } from '../api/terceros';
import type { Cuenta, Tercero } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function AnualTercero({ cia }: { cia: string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [accounts, setAccounts] = useState<Cuenta[]>([]);
  const [thirds, setThirds] = useState<Tercero[]>([]);
  const [thirdSearch, setThirdSearch] = useState('');
  const [accountFrom, setAccountFrom] = useState('');
  const [accountTo, setAccountTo] = useState('');
  const [result, setResult] = useState<MovimientoAnualTerceroResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, DetalleAnualTerceroResponse>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setThirdSearch(''); setAccountFrom(''); setAccountTo(''); setResult(null); setExpanded(null); setDetails({}); setError('');
    Promise.all([consultarPeriodoOperacion(cia), listarCuentas(cia)]).then(([period, accountItems]) => {
      if (!active) return;
      setYear(period.anio); setAccounts(accountItems);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No fue posible cargar los datos de consulta.'); });
    return () => { active = false; };
  }, [cia]);

  useEffect(() => {
    const search = thirdSearch.trim();
    if (search.length < 2) { setThirds([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      listarTerceros({ page: 1, pageSize: 20, search }).then(response => { if (active) setThirds(response.items); }).catch(() => { if (active) setThirds([]); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [thirdSearch]);

  const selectedThird = useMemo(() => {
    const search = thirdSearch.trim().toLocaleUpperCase('es-CO');
    return thirds.find(item => item.nit === thirdSearch.trim()) ?? thirds.find(item => item.nombre.trim().toLocaleUpperCase('es-CO') === search);
  }, [thirds, thirdSearch]);

  function resolveAccount(value: string): Cuenta | undefined {
    const search = value.trim().toLocaleUpperCase('es-CO');
    return accounts.find(item => item.codigo === value.trim()) ?? accounts.find(item => item.nombre.trim().toLocaleUpperCase('es-CO') === search);
  }
  function clearResult() { setResult(null); setExpanded(null); setDetails({}); }

  async function consult() {
    const nit = /^\d{1,15}$/.test(thirdSearch.trim()) ? thirdSearch.trim() : selectedThird?.nit;
    if (!nit) { setError('Seleccione un tercero válido por identificación o nombre.'); return; }
    const from = accountFrom.trim() ? resolveAccount(accountFrom) : undefined;
    const to = accountTo.trim() ? resolveAccount(accountTo) : undefined;
    if (accountFrom.trim() && !from) { setError('Seleccione una cuenta inicial válida.'); return; }
    if (accountTo.trim() && !to) { setError('Seleccione una cuenta final válida.'); return; }
    setLoading(true); setError(''); setExpanded(null); setDetails({});
    try {
      const response = await consultarMovimientoAnualTercero({ cia, anio: year, tercero: nit, cuentaDesde: from?.codigo, cuentaHasta: to?.codigo });
      setThirdSearch(response.nit); setAccountFrom(response.cuentaDesde); setAccountTo(response.cuentaHasta); setResult(response);
    } catch (cause) {
      setResult(null); setError(cause instanceof Error ? cause.message : 'No fue posible consultar el movimiento anual.');
    } finally { setLoading(false); }
  }

  async function loadMonth(month: number, page: number, append: boolean) {
    if (!result) return;
    setLoadingMonth(month); setError('');
    try {
      const response = await consultarDetalleAnualTercero({ cia, anio: result.anio, tercero: result.nit, cuentaDesde: result.cuentaDesde, cuentaHasta: result.cuentaHasta, mes: month, page, pageSize: 100 });
      setDetails(current => ({ ...current, [month]: append && current[month] ? { ...response, items: [...current[month].items, ...response.items] } : response }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar el detalle mensual.');
    } finally { setLoadingMonth(null); }
  }

  async function toggleMonth(month: number) {
    if (!result) return;
    if (expanded === month) { setExpanded(null); return; }
    setExpanded(month);
    if (!details[month]) await loadMonth(month, 1, false);
  }

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div><div className="mb-1 text-xs text-gray-400">Consultas / Anual por tercero</div><h1 className="text-lg font-semibold text-gray-800">Movimiento anual por tercero</h1><p className="mt-1 text-xs text-gray-500">Consulte un tercero, limite opcionalmente el rango de cuentas y despliegue sus partidas por mes.</p></div>
    <div className="rounded border border-gray-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_110px_minmax(190px,1fr)_minmax(190px,1fr)_auto]">
      <Field label="Tercero"><input list="annual-third-list" value={thirdSearch} maxLength={60} onChange={event => { setThirdSearch(event.target.value); setError(''); clearResult(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); consult(); } }} placeholder="Identificación o nombre" className={INPUT} /><datalist id="annual-third-list">{thirds.map(item => <option key={item.nit} value={item.nit} label={item.nombre}>{item.nombre}</option>)}</datalist>{selectedThird && <div className="mt-1 truncate text-xs text-gray-500"><span className="font-mono">{selectedThird.nit}</span> · {selectedThird.nombre}</div>}</Field>
      <Field label="Año"><input value={year} readOnly className={`${INPUT} bg-gray-50 font-mono`} /></Field>
      <Field label="Cuenta inicial"><AccountInput value={accountFrom} accounts={accounts} listId="annual-account-from" placeholder="Desde (todas)" onChange={value => { setAccountFrom(value); clearResult(); }} /></Field>
      <Field label="Cuenta final"><AccountInput value={accountTo} accounts={accounts} listId="annual-account-to" placeholder="Hasta (todas)" onChange={value => { setAccountTo(value); clearResult(); }} /></Field>
      <div className="flex items-end"><button type="button" onClick={consult} disabled={loading} className="rounded bg-petroleum-500 px-5 py-2 text-xs font-medium text-white disabled:opacity-60">{loading ? 'Consultando…' : 'Consultar'}</button></div>
    </div></div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      {result && <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50/60 px-4 py-3"><div><span className="font-mono text-sm font-semibold text-gray-800">{result.nit}{result.digito ? `-${result.digito}` : ''}</span><span className="ml-3 text-sm text-gray-600">{result.nombre}</span></div><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${result.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{result.activo ? 'Activo' : 'Bloqueado'}</span></div>}
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Mes', 'Débito', 'Crédito', 'Saldo del mes', 'Saldo acumulado', ''].map((heading, index) => <th key={`${heading}-${index}`} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index > 0 && index < 5 ? 'text-right' : 'text-left'}`}>{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">{!result && !loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Seleccione el tercero y pulse Consultar.</td></tr>}{loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Consultando el ejercicio…</td></tr>}{result && <tr className="bg-gray-50/40"><td className="px-3 py-2 text-gray-600">Saldo inicial</td><td colSpan={3} /><Money value={result.saldoInicial} strong /><td /></tr>}{result?.meses.map(month => <MonthRow key={month.mes} month={month} expanded={expanded === month.mes} loading={loadingMonth === month.mes} detail={details[month.mes]} third={result.nit} onToggle={() => toggleMonth(month.mes)} onMore={() => loadMonth(month.mes, (details[month.mes]?.page ?? 0) + 1, true)} />)}</tbody>
        {result && <tfoot className="border-t-2 border-gray-200 bg-gray-50"><tr><td className="px-3 py-2 font-semibold text-gray-700">TOTAL AÑO</td><Money value={result.totalDebito} strong /><Money value={result.totalCredito} strong /><td /><Money value={result.saldoFinal} strong /><td /></tr></tfoot>}
      </table></div>
    </div>
  </div>;
}

function AccountInput({ value, accounts, listId, placeholder, onChange }: { value: string; accounts: Cuenta[]; listId: string; placeholder: string; onChange: (value: string) => void }) {
  const selected = accounts.find(item => item.codigo === value.trim()) ?? accounts.find(item => item.nombre.trim().toLocaleUpperCase('es-CO') === value.trim().toLocaleUpperCase('es-CO'));
  return <><input list={listId} value={value} maxLength={60} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={INPUT} /><datalist id={listId}>{accounts.map(item => <option key={item.codigo} value={item.codigo} label={item.nombre}>{item.nombre}</option>)}</datalist>{selected && <div className="mt-1 truncate text-xs text-gray-500"><span className="font-mono">{selected.codigo}</span> · {selected.nombre}</div>}</>;
}

function MonthRow({ month, expanded, loading, detail, third, onToggle, onMore }: { month: MesMovimientoAnualTercero; expanded: boolean; loading: boolean; detail?: DetalleAnualTerceroResponse; third: string; onToggle: () => void; onMore: () => void }) {
  return <><tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50"><td className="px-3 py-2 font-medium text-gray-700"><span className="mr-1.5 text-gray-400">{expanded ? '▾' : '▸'}</span>{String(month.mes).padStart(2, '0')} · {MONTHS[month.mes - 1]}</td><Money value={month.debito} /><Money value={month.credito} /><Money value={month.saldoMes} /><Money value={month.saldoAcumulado} strong /><td className="px-3 py-2 text-right"><button type="button" onClick={event => { event.stopPropagation(); onToggle(); }} className="text-petroleum-600 hover:underline">{expanded ? 'Ocultar' : 'Ver detalle'}</button></td></tr>
    {expanded && <tr><td colSpan={6} className="bg-gray-50/60 px-3 py-3">{loading && !detail && <div className="py-5 text-center text-gray-500">Consultando movimientos…</div>}{!loading && detail && !detail.items.length && <div className="py-5 text-center text-gray-500">No existen movimientos en {MONTHS[month.mes - 1].toLowerCase()} para el tercero {third}.</div>}{detail && detail.items.length > 0 && <div className="overflow-x-auto rounded border border-gray-200 bg-white"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Fecha', 'Cuenta', 'Documento', 'Tipo', 'Comprobante', 'Centro', 'Débito', 'Crédito', 'Base', 'Concepto'].map((heading, index) => <th key={heading} className={`whitespace-nowrap px-3 py-2 font-semibold text-gray-600 ${index >= 6 && index <= 8 ? 'text-right' : 'text-left'}`}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-50">{detail.items.map((item, index) => <tr key={`${item.documento}-${item.secuencia}-${index}`}><td className="whitespace-nowrap px-3 py-1.5 font-mono text-gray-600">{item.fecha || '—'}</td><td className="px-3 py-1.5 text-gray-700"><span className="font-mono">{item.cuenta}</span>{item.nombreCuenta && <span className="ml-1 text-gray-500">· {item.nombreCuenta}</span>}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.documento || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.tipoDoc || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-700">{item.comprobante || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.centro || '—'}</td><Money value={item.debito} /><Money value={item.credito} /><Money value={item.base} /><td className="max-w-80 truncate px-3 py-1.5 text-gray-600" title={item.concepto}>{item.concepto || '—'}</td></tr>)}</tbody></table>{detail.hasMore && <div className="border-t border-gray-200 p-2 text-center"><button type="button" onClick={onMore} disabled={loading} className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50">{loading ? 'Consultando…' : 'Mostrar más movimientos'}</button></div>}</div>}</td></tr>}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>; }
function Money({ value, strong = false }: { value: number; strong?: boolean }) { return <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${strong ? 'font-semibold text-gray-800' : value < 0 ? 'text-red-700' : 'text-gray-700'}`}>{value ? money(value) : '—'}</td>; }

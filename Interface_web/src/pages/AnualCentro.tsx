import { useEffect, useState } from 'react';
import { listarCentros } from '../api/centros';
import { listarCuentas } from '../api/cuentas';
import { consultarDetalleAnualCentro, consultarMovimientoAnualCentro, type DetalleAnualCentroResponse, type MesMovimientoAnualCentro, type MovimientoAnualCentroResponse } from '../api/movimientoAnualCentro';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import type { CentroJerarquico } from '../data/configCentros';
import type { Cuenta } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function AnualCentro({ cia }: { cia: string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [centers, setCenters] = useState<CentroJerarquico[]>([]);
  const [accounts, setAccounts] = useState<Cuenta[]>([]);
  const [centerSearch, setCenterSearch] = useState('');
  const [accountFrom, setAccountFrom] = useState('');
  const [accountTo, setAccountTo] = useState('');
  const [result, setResult] = useState<MovimientoAnualCentroResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, DetalleAnualCentroResponse>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setCenterSearch(''); setAccountFrom(''); setAccountTo(''); setResult(null); setExpanded(null); setDetails({}); setError('');
    Promise.all([consultarPeriodoOperacion(cia), listarCentros(cia), listarCuentas(cia)]).then(([period, centerResponse, accountItems]) => {
      if (!active) return;
      setYear(period.anio); setCenters(centerResponse.items); setAccounts(accountItems);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No fue posible cargar los datos de consulta.'); });
    return () => { active = false; };
  }, [cia]);

  function findCenter(value: string) {
    const search = value.trim().toLocaleUpperCase('es-CO');
    return centers.find(item => item.codigo === value.trim()) ?? centers.find(item => item.nombre.trim().toLocaleUpperCase('es-CO') === search);
  }
  function findAccount(value: string) {
    const search = value.trim().toLocaleUpperCase('es-CO');
    return accounts.find(item => item.codigo === value.trim()) ?? accounts.find(item => item.nombre.trim().toLocaleUpperCase('es-CO') === search);
  }
  const selectedCenter = findCenter(centerSearch);
  function clearResult() { setResult(null); setExpanded(null); setDetails({}); }

  async function consult() {
    const center = findCenter(centerSearch);
    const from = accountFrom.trim() ? findAccount(accountFrom) : undefined;
    const to = accountTo.trim() ? findAccount(accountTo) : undefined;
    if (!center) { setError('Seleccione un centro de costo válido.'); return; }
    if (accountFrom.trim() && !from) { setError('Seleccione una cuenta inicial válida.'); return; }
    if (accountTo.trim() && !to) { setError('Seleccione una cuenta final válida.'); return; }
    setLoading(true); setError(''); setExpanded(null); setDetails({});
    try {
      const response = await consultarMovimientoAnualCentro({ cia, anio: year, centro: center.codigo, cuentaDesde: from?.codigo, cuentaHasta: to?.codigo });
      setCenterSearch(response.centro); setAccountFrom(response.cuentaDesde); setAccountTo(response.cuentaHasta); setResult(response);
    } catch (cause) {
      setResult(null); setError(cause instanceof Error ? cause.message : 'No fue posible consultar el movimiento anual.');
    } finally { setLoading(false); }
  }

  async function loadMonth(month: number, page: number, append: boolean) {
    if (!result) return;
    setLoadingMonth(month); setError('');
    try {
      const response = await consultarDetalleAnualCentro({ cia, anio: result.anio, centro: result.centro, cuentaDesde: result.cuentaDesde, cuentaHasta: result.cuentaHasta, mes: month, page, pageSize: 100 });
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
    <div><div className="mb-1 text-xs text-gray-400">Consultas / Anual por centro de costo</div><h1 className="text-lg font-semibold text-gray-800">Movimiento anual por centro de costo</h1><p className="mt-1 text-xs text-gray-500">Consulte un centro de la compañía, limite el rango de cuentas y despliegue sus partidas por mes.</p></div>
    <div className="rounded border border-gray-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_110px_minmax(190px,1fr)_minmax(190px,1fr)_auto]">
      <Field label="Centro de costo"><input list="annual-center-list" value={centerSearch} maxLength={60} onChange={event => { setCenterSearch(event.target.value); setError(''); clearResult(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); consult(); } }} placeholder="Código o nombre" className={INPUT} /><datalist id="annual-center-list">{centers.map(item => <option key={item.codigo} value={item.codigo} label={item.nombre}>{item.nombre}</option>)}</datalist>{selectedCenter && <div className="mt-1 truncate text-xs text-gray-500"><span className="font-mono">{selectedCenter.codigo}</span> · {selectedCenter.nombre}</div>}</Field>
      <Field label="Año"><input value={year} readOnly className={`${INPUT} bg-gray-50 font-mono`} /></Field>
      <Field label="Cuenta inicial"><AccountInput value={accountFrom} accounts={accounts} listId="center-account-from" placeholder="Desde (todas)" onChange={value => { setAccountFrom(value); clearResult(); }} /></Field>
      <Field label="Cuenta final"><AccountInput value={accountTo} accounts={accounts} listId="center-account-to" placeholder="Hasta (todas)" onChange={value => { setAccountTo(value); clearResult(); }} /></Field>
      <div className="flex items-end"><button type="button" onClick={consult} disabled={loading} className="rounded bg-petroleum-500 px-5 py-2 text-xs font-medium text-white disabled:opacity-60">{loading ? 'Consultando…' : 'Consultar'}</button></div>
    </div></div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      {result && <div className="border-b border-gray-200 bg-gray-50/60 px-4 py-3"><span className="font-mono text-sm font-semibold text-gray-800">{result.centro}</span><span className="ml-3 text-sm text-gray-600">{result.nombre}</span></div>}
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Mes', 'Débito', 'Crédito', 'Saldo del mes', 'Saldo acumulado', ''].map((heading, index) => <th key={`${heading}-${index}`} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index > 0 && index < 5 ? 'text-right' : 'text-left'}`}>{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">{!result && !loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Seleccione el centro de costo y pulse Consultar.</td></tr>}{loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Consultando el ejercicio…</td></tr>}{result && <tr className="bg-gray-50/40"><td className="px-3 py-2 text-gray-600">Saldo inicial</td><td colSpan={3} /><Money value={result.saldoInicial} strong /><td /></tr>}{result?.meses.map(month => <MonthRow key={month.mes} month={month} expanded={expanded === month.mes} loading={loadingMonth === month.mes} detail={details[month.mes]} center={result.centro} onToggle={() => toggleMonth(month.mes)} onMore={() => loadMonth(month.mes, (details[month.mes]?.page ?? 0) + 1, true)} />)}</tbody>
        {result && <tfoot className="border-t-2 border-gray-200 bg-gray-50"><tr><td className="px-3 py-2 font-semibold text-gray-700">TOTAL AÑO</td><Money value={result.totalDebito} strong /><Money value={result.totalCredito} strong /><td /><Money value={result.saldoFinal} strong /><td /></tr></tfoot>}
      </table></div>
    </div>
  </div>;
}

function AccountInput({ value, accounts, listId, placeholder, onChange }: { value: string; accounts: Cuenta[]; listId: string; placeholder: string; onChange: (value: string) => void }) {
  const search = value.trim().toLocaleUpperCase('es-CO');
  const selected = accounts.find(item => item.codigo === value.trim()) ?? accounts.find(item => item.nombre.trim().toLocaleUpperCase('es-CO') === search);
  return <><input list={listId} value={value} maxLength={60} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={INPUT} /><datalist id={listId}>{accounts.map(item => <option key={item.codigo} value={item.codigo} label={item.nombre}>{item.nombre}</option>)}</datalist>{selected && <div className="mt-1 truncate text-xs text-gray-500"><span className="font-mono">{selected.codigo}</span> · {selected.nombre}</div>}</>;
}

function MonthRow({ month, expanded, loading, detail, center, onToggle, onMore }: { month: MesMovimientoAnualCentro; expanded: boolean; loading: boolean; detail?: DetalleAnualCentroResponse; center: string; onToggle: () => void; onMore: () => void }) {
  return <><tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50"><td className="px-3 py-2 font-medium text-gray-700"><span className="mr-1.5 text-gray-400">{expanded ? '▾' : '▸'}</span>{String(month.mes).padStart(2, '0')} · {MONTHS[month.mes - 1]}</td><Money value={month.debito} /><Money value={month.credito} /><Money value={month.saldoMes} /><Money value={month.saldoAcumulado} strong /><td className="px-3 py-2 text-right"><button type="button" onClick={event => { event.stopPropagation(); onToggle(); }} className="text-petroleum-600 hover:underline">{expanded ? 'Ocultar' : 'Ver detalle'}</button></td></tr>
    {expanded && <tr><td colSpan={6} className="bg-gray-50/60 px-3 py-3">{loading && !detail && <div className="py-5 text-center text-gray-500">Consultando movimientos…</div>}{!loading && detail && !detail.items.length && <div className="py-5 text-center text-gray-500">No existen movimientos en {MONTHS[month.mes - 1].toLowerCase()} para el centro {center}.</div>}{detail && detail.items.length > 0 && <div className="overflow-x-auto rounded border border-gray-200 bg-white"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Fecha', 'Cuenta', 'Documento', 'Tipo', 'Comprobante', 'NIT', 'Débito', 'Crédito', 'Concepto'].map((heading, index) => <th key={heading} className={`whitespace-nowrap px-3 py-2 font-semibold text-gray-600 ${index === 6 || index === 7 ? 'text-right' : 'text-left'}`}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-50">{detail.items.map((item, index) => <tr key={`${item.documento}-${item.secuencia}-${index}`}><td className="whitespace-nowrap px-3 py-1.5 font-mono text-gray-600">{item.fecha || '—'}</td><td className="px-3 py-1.5 text-gray-700"><span className="font-mono">{item.cuenta}</span>{item.nombreCuenta && <span className="ml-1 text-gray-500">· {item.nombreCuenta}</span>}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.documento || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.tipoDoc || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-700">{item.comprobante || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.nit || '—'}</td><Money value={item.debito} /><Money value={item.credito} /><td className="max-w-80 truncate px-3 py-1.5 text-gray-600" title={item.concepto}>{item.concepto || '—'}</td></tr>)}</tbody></table>{detail.hasMore && <div className="border-t border-gray-200 p-2 text-center"><button type="button" onClick={onMore} disabled={loading} className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50">{loading ? 'Consultando…' : 'Mostrar más movimientos'}</button></div>}</div>}</td></tr>}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>; }
function Money({ value, strong = false }: { value: number; strong?: boolean }) { return <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${strong ? 'font-semibold text-gray-800' : value < 0 ? 'text-red-700' : 'text-gray-700'}`}>{value ? money(value) : '—'}</td>; }

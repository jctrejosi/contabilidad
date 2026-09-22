import { useEffect, useMemo, useState } from 'react';
import { listarCuentas } from '../api/cuentas';
import { consultarDetalleAnualCuenta, consultarMovimientoAnualCuenta, type DetalleAnualCuentaResponse, type MesMovimientoAnual, type MovimientoAnualCuentaResponse } from '../api/movimientoAnualCuenta';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import type { Cuenta } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 disabled:bg-gray-100 disabled:text-gray-400';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function AnualCuenta({ cia }: { cia: string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [accounts, setAccounts] = useState<Cuenta[]>([]);
  const [account, setAccount] = useState('');
  const [nitFrom, setNitFrom] = useState('');
  const [nitTo, setNitTo] = useState('');
  const [result, setResult] = useState<MovimientoAnualCuentaResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, DetalleAnualCuentaResponse>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setAccount(''); setNitFrom(''); setNitTo(''); setResult(null); setExpanded(null); setDetails({}); setShowChart(false); setError('');
    Promise.all([consultarPeriodoOperacion(cia), listarCuentas(cia)]).then(([period, items]) => {
      if (!active) return;
      setYear(period.anio); setAccounts(items);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No fue posible cargar las cuentas.'); });
    return () => { active = false; };
  }, [cia]);

  const selectedAccount = useMemo(() => {
    const search = account.trim().toLocaleUpperCase('es-CO');
    return accounts.find(item => item.codigo === account.trim())
      ?? accounts.find(item => item.nombre.trim().toLocaleUpperCase('es-CO') === search);
  }, [accounts, account]);
  const allowsThird = Boolean(selectedAccount?.requiereTercero || selectedAccount?.claseIVA || selectedAccount?.claseRetencion);
  function clearResult() { setResult(null); setExpanded(null); setDetails({}); setShowChart(false); }

  async function consult() {
    if (!account.trim()) { setError('Seleccione o digite la cuenta que desea consultar.'); return; }
    if (!selectedAccount) { setError('Seleccione una cuenta válida de la lista de resultados.'); return; }
    setLoading(true); setError(''); setExpanded(null); setDetails({}); setShowChart(false);
    try {
      setAccount(selectedAccount.codigo);
      setResult(await consultarMovimientoAnualCuenta({ cia, anio: year, cuenta: selectedAccount.codigo, nitDesde: nitFrom, nitHasta: nitTo }));
    } catch (cause) {
      setResult(null); setError(cause instanceof Error ? cause.message : 'No fue posible consultar el movimiento anual.');
    } finally { setLoading(false); }
  }

  async function loadMonth(month: number, page: number, append: boolean) {
    if (!result) return;
    setLoadingMonth(month); setError('');
    try {
      const response = await consultarDetalleAnualCuenta({ cia, anio: year, cuenta: result.cuenta, nitDesde: result.nitDesde, nitHasta: result.nitHasta, mes: month, page, pageSize: 100 });
      setDetails(current => ({ ...current, [month]: append && current[month] ? { ...response, items: [...current[month].items, ...response.items] } : response }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar el detalle del mes.');
    } finally { setLoadingMonth(null); }
  }

  async function toggleMonth(month: number) {
    if (!result) return;
    if (expanded === month) { setExpanded(null); return; }
    setExpanded(month);
    if (!details[month]) await loadMonth(month, 1, false);
  }

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div><div className="mb-1 text-xs text-gray-400">Consultas / Movimiento anual por cuenta</div><h1 className="text-lg font-semibold text-gray-800">Movimiento anual por cuenta</h1><p className="mt-1 text-xs text-gray-500">Consulte el comportamiento de una cuenta durante el ejercicio y despliegue el detalle de cada mes.</p></div>
    <div className="rounded border border-gray-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_110px_170px_170px_auto]">
      <Field label="Cuenta"><input list="annual-account-list" value={account} maxLength={60} onChange={event => { setAccount(event.target.value); setNitFrom(''); setNitTo(''); setError(''); clearResult(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); consult(); } }} placeholder="Código o nombre de la cuenta" className={INPUT} /><datalist id="annual-account-list">{accounts.map(item => <option key={item.codigo} value={item.codigo} label={item.nombre}>{item.nombre}</option>)}</datalist>{selectedAccount && <div className="mt-1 truncate text-xs text-gray-500" title={selectedAccount.nombre}><span className="font-mono">{selectedAccount.codigo}</span> · {selectedAccount.nombre}</div>}</Field>
      <Field label="Año"><input value={year} readOnly className={`${INPUT} bg-gray-50 font-mono`} /></Field>
      <Field label="NIT inicial"><input value={nitFrom} onChange={event => { setNitFrom(event.target.value.slice(0, 15)); clearResult(); }} disabled={Boolean(selectedAccount) && !allowsThird} placeholder="Todos" className={`${INPUT} font-mono`} /></Field>
      <Field label="NIT final"><input value={nitTo} onChange={event => { setNitTo(event.target.value.slice(0, 15)); clearResult(); }} disabled={Boolean(selectedAccount) && !allowsThird} placeholder="Todos" className={`${INPUT} font-mono`} /></Field>
      <div className="flex items-end"><button type="button" onClick={consult} disabled={loading} className="rounded bg-petroleum-500 px-5 py-2 text-xs font-medium text-white disabled:opacity-60">{loading ? 'Consultando…' : 'Consultar'}</button></div>
    </div></div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      {result && <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50/60 px-4 py-3">
        <div className="min-w-0 flex-1"><span className="font-mono text-sm font-semibold text-gray-800">{result.cuenta}</span><span className="ml-3 text-sm text-gray-600">{result.nombre}</span></div>
        <button type="button" onClick={() => setShowChart(value => !value)} aria-expanded={showChart} aria-controls="grafica-anual-cuenta" className="rounded border border-petroleum-500 bg-white px-3 py-1.5 text-xs font-medium text-petroleum-700 hover:bg-petroleum-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500">
          {showChart ? 'Ocultar gráfica' : 'Graficar'}
        </button>
      </div>}
      {result && showChart && <AnnualAccountChart result={result} />}
      <div className="overflow-x-auto"><table className="w-full text-xs">
        <thead className="border-b border-gray-200 bg-gray-50"><tr>{['Mes', 'Débito', 'Crédito', 'Saldo del mes', 'Saldo acumulado', ''].map((heading, index) => <th key={`${heading}-${index}`} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index > 0 && index < 5 ? 'text-right' : 'text-left'}`}>{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">
          {!result && !loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Seleccione una cuenta y pulse Consultar.</td></tr>}
          {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Consultando el ejercicio…</td></tr>}
          {result && <tr className="bg-gray-50/40"><td className="px-3 py-2 text-gray-600">Saldo inicial</td><td colSpan={3} /><Money value={result.saldoInicial} strong /><td /></tr>}
          {result?.meses.map(month => <MonthRow key={month.mes} month={month} expanded={expanded === month.mes} loading={loadingMonth === month.mes} detail={details[month.mes]} account={result.cuenta} onToggle={() => toggleMonth(month.mes)} onMore={() => loadMonth(month.mes, (details[month.mes]?.page ?? 0) + 1, true)} />)}
        </tbody>
        {result && <tfoot className="border-t-2 border-gray-200 bg-gray-50"><tr><td className="px-3 py-2 font-semibold text-gray-700">TOTAL AÑO</td><Money value={result.totalDebito} strong /><Money value={result.totalCredito} strong /><td /><Money value={result.saldoFinal} strong /><td /></tr></tfoot>}
      </table></div>
    </div>
  </div>;
}

const shortAmount = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

function AnnualAccountChart({ result }: { result: MovimientoAnualCuentaResponse }) {
  const months = result.meses;
  const balances = months.map(item => item.saldoAcumulado);
  const minBalance = Math.min(0, ...balances);
  const maxBalance = Math.max(0, ...balances);
  const balanceSpan = maxBalance - minBalance || 1;
  const x = (index: number) => 65 + index * (835 / 11);
  const y = (value: number) => 210 - ((value - minBalance) / balanceSpan) * 170;
  const line = balances.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`).join(' ');
  const maxMovement = Math.max(1, ...months.map(item => Math.max(item.debito, item.credito)));

  return <section id="grafica-anual-cuenta" aria-label={`Gráficas del movimiento anual de ${result.cuenta}`} className="border-b border-gray-200 bg-white px-4 py-4">
    <div className="mb-3 text-xs text-gray-600">Comportamiento de {result.cuenta} durante {result.anio}{result.nitDesde || result.nitHasta ? ` · NIT ${result.nitDesde || 'inicio'} a ${result.nitHasta || 'fin'}` : ''}. Los valores exactos permanecen en la tabla.</div>
    <div className="grid gap-4">
      <div className="min-w-0 rounded border border-gray-200 p-3">
        <h3 className="mb-2 text-xs font-semibold text-gray-700">Saldo acumulado por mes</h3>
        <div className="overflow-x-auto"><svg viewBox="0 0 960 250" className="min-w-[640px] w-full" role="img" aria-label="Evolución mensual del saldo acumulado">
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => {
            const value = minBalance + balanceSpan * fraction;
            return <g key={fraction}><line x1="55" x2="920" y1={y(value)} y2={y(value)} stroke="#e5e7eb" strokeWidth="1" /><text x="50" y={y(value) + 4} textAnchor="end" fill="#6b7280" fontSize="11">{shortAmount.format(value)}</text></g>;
          })}
          <path d={line} fill="none" stroke="#0073C0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {months.map((month, index) => <g key={month.mes}><circle cx={x(index)} cy={y(month.saldoAcumulado)} r="5" fill="#0073C0"><title>{`${MONTHS[month.mes - 1]}: ${money(month.saldoAcumulado)}`}</title></circle><text x={x(index)} y="239" textAnchor="middle" fill="#4b5563" fontSize="11">{MONTHS[month.mes - 1].slice(0, 3)}</text></g>)}
        </svg></div>
      </div>
      <div className="min-w-0 rounded border border-gray-200 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-gray-700">Débitos y créditos por mes</h3><div className="flex gap-3 text-xs text-gray-600"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-petroleum-500" />Débitos</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#00B0F2]" />Créditos</span></div></div>
        <div className="overflow-x-auto"><svg viewBox="0 0 960 250" className="min-w-[640px] w-full" role="img" aria-label="Comparación mensual de débitos y créditos">
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}><line x1="55" x2="920" y1={210 - fraction * 170} y2={210 - fraction * 170} stroke="#e5e7eb" strokeWidth="1" /><text x="50" y={214 - fraction * 170} textAnchor="end" fill="#6b7280" fontSize="11">{shortAmount.format(maxMovement * fraction)}</text></g>)}
          {months.map((month, index) => {
            const center = x(index);
            const debitHeight = month.debito / maxMovement * 170;
            const creditHeight = month.credito / maxMovement * 170;
            return <g key={month.mes}>
              <rect x={center - 22} y={210 - debitHeight} width="19" height={debitHeight} rx="2" fill="#0073C0"><title>{`${MONTHS[month.mes - 1]} · Débitos: ${money(month.debito)}`}</title></rect>
              <rect x={center + 3} y={210 - creditHeight} width="19" height={creditHeight} rx="2" fill="#00B0F2"><title>{`${MONTHS[month.mes - 1]} · Créditos: ${money(month.credito)}`}</title></rect>
              <text x={center} y="239" textAnchor="middle" fill="#4b5563" fontSize="11">{MONTHS[month.mes - 1].slice(0, 3)}</text>
            </g>;
          })}
        </svg></div>
      </div>
    </div>
  </section>;
}

function MonthRow({ month, expanded, loading, detail, account, onToggle, onMore }: { month: MesMovimientoAnual; expanded: boolean; loading: boolean; detail?: DetalleAnualCuentaResponse; account: string; onToggle: () => void; onMore: () => void }) {
  return <>
    <tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50"><td className="px-3 py-2 font-medium text-gray-700"><span className="mr-1.5 text-gray-400">{expanded ? '▾' : '▸'}</span>{String(month.mes).padStart(2, '0')} · {MONTHS[month.mes - 1]}</td><Money value={month.debito} /><Money value={month.credito} /><Money value={month.saldoMes} /><Money value={month.saldoAcumulado} strong /><td className="px-3 py-2 text-right"><button type="button" onClick={event => { event.stopPropagation(); onToggle(); }} className="text-petroleum-600 hover:underline">{expanded ? 'Ocultar' : 'Ver detalle'}</button></td></tr>
    {expanded && <tr><td colSpan={6} className="bg-gray-50/60 px-3 py-3">
      {loading && !detail && <div className="py-5 text-center text-gray-500">Consultando movimientos…</div>}
      {!loading && detail && !detail.items.length && <div className="py-5 text-center text-gray-500">No existen movimientos en {MONTHS[month.mes - 1].toLowerCase()} para la cuenta {account}.</div>}
      {detail && detail.items.length > 0 && <div className="overflow-x-auto rounded border border-gray-200 bg-white"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Fecha', 'Comprobante', 'Tipo', 'Documento', 'NIT', 'Centro', 'Débito', 'Crédito', 'Concepto'].map((heading, index) => <th key={heading} className={`whitespace-nowrap px-3 py-2 font-semibold text-gray-600 ${index === 6 || index === 7 ? 'text-right' : 'text-left'}`}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-50">{detail.items.map((item, index) => <tr key={`${item.documento}-${item.secuencia}-${index}`}><td className="whitespace-nowrap px-3 py-1.5 font-mono text-gray-600">{item.fecha || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-700">{item.comprobante || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.tipoDoc || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.documento || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.nit || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{item.centro || '—'}</td><Money value={item.debito} /><Money value={item.credito} /><td className="max-w-80 truncate px-3 py-1.5 text-gray-600" title={item.concepto}>{item.concepto || '—'}</td></tr>)}</tbody></table>{detail.hasMore && <div className="border-t border-gray-200 p-2 text-center"><button type="button" onClick={onMore} disabled={loading} className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50">{loading ? 'Consultando…' : 'Mostrar más movimientos'}</button></div>}</div>}
    </td></tr>}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>; }
function Money({ value, strong = false }: { value: number; strong?: boolean }) { return <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${strong ? 'font-semibold text-gray-800' : value < 0 ? 'text-red-700' : 'text-gray-700'}`}>{value ? money(value) : '—'}</td>; }

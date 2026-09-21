import { useEffect, useState } from 'react';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import { consultarMovimientoMensual, type MovimientoMensualResponse } from '../api/movimientoMensual';
import {
  consultarSaldosAnuales,
  type FiltroSaldosAnuales,
  type SaldoAnual,
  type SaldosAnualesResponse,
} from '../api/saldosAnuales';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', '13-Enero', '14-Febrero', '15-Marzo', '16-Abril', '17-Mayo', '18-Junio'];
const CALENDAR_MONTHS = MONTHS.slice(0, 12);
const FILTERS: Array<{ value: FiltroSaldosAnuales; label: string }> = [
  { value: 'generales', label: 'Cuentas generales' },
  { value: 'todos', label: 'Generales y terceros' },
  { value: 'retenciones', label: 'Retenciones' },
  { value: 'iva', label: 'IVA' },
];

const money = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);

export default function SaldosAnuales({ cia }: { cia: string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [filter, setFilter] = useState<FiltroSaldosAnuales>('generales');
  const [accountSearch, setAccountSearch] = useState('');
  const [result, setResult] = useState<SaldosAnualesResponse | null>(null);
  const [selected, setSelected] = useState<SaldoAnual | null>(null);
  const [movements, setMovements] = useState<MovimientoMensualResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    consultarPeriodoOperacion(cia).then(period => {
      if (!active) return;
      setYear(period.anio);
      setMonth(Number(period.periodoSugerido.split('-')[1]) || 1);
    }).catch(() => undefined);
    setAccountSearch(''); setResult(null); setSelected(null); setMovements(null); setError('');
    return () => { active = false; };
  }, [cia]);

  async function consult(page = 1) {
    setLoading(true); setError(''); setSelected(null); setMovements(null);
    try {
      setResult(await consultarSaldosAnuales({ cia, anio: year, mes: month, filtro: filter, cuenta: accountSearch, page, pageSize: 100 }));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar los saldos.');
    } finally { setLoading(false); }
  }

  async function showMovements() {
    if (!selected) return;
    setLoadingMovements(true); setError('');
    try {
      setMovements(await consultarMovimientoMensual({
        cia, anio: year, mes: month, page: 1, pageSize: 200,
        cuentaDesde: selected.cuenta, cuentaHasta: selected.cuenta,
        tercero: selected.nit || undefined,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar el detalle del período.');
    } finally { setLoadingMovements(false); }
  }

  const items = result?.items ?? [];
  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div>
        <div className="mb-1 text-xs text-gray-400">Consultas / Saldos anuales</div>
        <h1 className="text-lg font-semibold text-gray-800">Saldos y comportamiento anual</h1>
        <p className="mt-1 text-xs text-gray-500">Consulte el saldo anterior, movimiento y saldo de un período; abra una cuenta para ver su comportamiento del año.</p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[110px_170px_220px_1fr_auto]">
          <Field label="Año"><input value={year} readOnly className={`${INPUT} bg-gray-50 font-mono`} /></Field>
          <Field label="Período">
            <select value={month} onChange={event => { setMonth(Number(event.target.value)); setResult(null); }} className={INPUT}>
              {MONTHS.map((name, index) => <option key={name} value={index + 1}>{String(index + 1).padStart(2, '0')} · {name}</option>)}
            </select>
          </Field>
          <Field label="Buscar cuenta">
            <input
              value={accountSearch}
              onChange={event => { setAccountSearch(event.target.value); setResult(null); }}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); consult(1); } }}
              placeholder="Código o nombre"
              className={INPUT}
            />
          </Field>
          <fieldset>
            <legend className="mb-1 block text-xs font-medium text-gray-600">Filtro</legend>
            <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2">
              {FILTERS.map(option => <label key={option.value} className="flex items-center gap-1.5 text-xs text-gray-700">
                <input type="radio" name="annual-filter" value={option.value} checked={filter === option.value} onChange={() => { setFilter(option.value); setResult(null); }} />
                {option.label}
              </label>)}
            </div>
          </fieldset>
          <div className="flex items-end"><button type="button" onClick={() => consult(1)} disabled={loading} className="rounded bg-petroleum-500 px-5 py-2 text-xs font-medium text-white disabled:opacity-60">{loading ? 'Consultando…' : 'Consultar'}</button></div>
        </div>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="table-fixed-header overflow-auto" style={{ maxHeight: '52vh' }}>
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              {['Cuenta', 'Nombre', 'NIT', 'Saldo anterior', 'Débitos', 'Créditos', 'Saldo'].map((heading, index) => <th key={heading} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index >= 3 ? 'text-right' : 'text-left'}`}>{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {!result && !loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Seleccione el período y el filtro, luego pulse Consultar.</td></tr>}
              {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Consultando saldos…</td></tr>}
              {result && !loading && !items.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No hay cuentas que coincidan con el filtro.</td></tr>}
              {!loading && items.map((item, index) => <tr
                key={`${item.tipo}-${item.cuenta}-${item.nit}-${index}`}
                tabIndex={0}
                onClick={() => setSelected(item)}
                onDoubleClick={() => setSelected(item)}
                onKeyDown={event => { if (event.key === 'Enter') setSelected(item); }}
                className={`cursor-pointer outline-none hover:bg-gray-50 focus:bg-blue-50 ${selected === item ? 'bg-blue-50' : ''}`}
              >
                <td className="px-3 py-2 font-mono text-gray-700">{item.cuenta}</td>
                <td className="max-w-72 truncate px-3 py-2 text-gray-700" title={item.nombre}>{item.nombre}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{item.nit || '—'}</td>
                <Money value={item.saldoAnterior} /><Money value={item.debito} /><Money value={item.credito} /><Money value={item.saldo} strong />
              </tr>)}
            </tbody>
            {result && items.length > 0 && <tfoot className="border-t-2 border-gray-200 bg-gray-50"><tr>
              <td colSpan={3} className="px-3 py-2 font-semibold text-gray-700">TOTALES DE LA PÁGINA</td>
              <Money value={result.totalesPagina.saldoAnterior} strong /><Money value={result.totalesPagina.debito} strong /><Money value={result.totalesPagina.credito} strong /><Money value={result.totalesPagina.saldo} strong />
            </tr></tfoot>}
          </table>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-200 px-4 py-2.5">
          <span className="text-xs text-gray-500">{result ? `${items.length} registros · página ${result.page}` : 'Sin consulta'}</span>
          {result && <div className="ml-auto flex gap-2">
            <button type="button" disabled={result.page <= 1 || loading} onClick={() => consult(result.page - 1)} className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40">← Anterior</button>
            <button type="button" disabled={!result.hasMore || loading} onClick={() => consult(result.page + 1)} className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40">Siguiente →</button>
          </div>}
        </div>
      </div>

      {selected && <div className="rounded border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3">
          <div><div className="font-mono text-sm font-semibold text-gray-800">{selected.cuenta}{selected.nit ? ` · ${selected.nit}` : ''}</div><div className="text-xs text-gray-500">{selected.nombre}</div></div>
          <button type="button" onClick={showMovements} disabled={loadingMovements} className="ml-auto rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 disabled:opacity-60">{loadingMovements ? 'Consultando…' : `Ver movimientos de ${MONTHS[month - 1]}`}</button>
          <button type="button" onClick={() => { setSelected(null); setMovements(null); }} className="px-2 text-lg text-gray-400">×</button>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs"><thead><tr className="border-b border-gray-200 bg-gray-50">
            {['Período', 'Saldo anterior', 'Débitos', 'Créditos', 'Saldo'].map((heading, index) => <th key={heading} className={`px-3 py-2 font-semibold text-gray-600 ${index ? 'text-right' : 'text-left'}`}>{heading}</th>)}
          </tr></thead><tbody className="divide-y divide-gray-50">
            {selected.meses.map((item, index) => <tr key={item.mes}><td className="px-3 py-2 text-gray-700">{String(item.mes).padStart(2, '0')} · {CALENDAR_MONTHS[index]}</td><Money value={index === 0 ? selected.saldoInicial : selected.meses[index - 1].saldo} /><Money value={item.debito} /><Money value={item.credito} /><Money value={item.saldo} strong /></tr>)}
          </tbody></table>
        </div>
      </div>}

      {movements && <div className="rounded border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-gray-800">Movimientos del período</div><button type="button" onClick={() => setMovements(null)} className="text-lg text-gray-400">×</button></div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b bg-gray-50">
          {['Fecha', 'Comprobante', 'Documento', 'NIT', 'Centro', 'Débito', 'Crédito', 'Concepto'].map((heading, index) => <th key={heading} className={`px-3 py-2 font-semibold text-gray-600 ${index === 5 || index === 6 ? 'text-right' : 'text-left'}`}>{heading}</th>)}
        </tr></thead><tbody className="divide-y divide-gray-50">
          {!movements.items.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No existen movimientos para esta cuenta en el período.</td></tr>}
          {movements.items.map((item, index) => <tr key={`${item.documento}-${item.secuencia}-${index}`}><td className="px-3 py-2 font-mono">{item.fecha || '—'}</td><td className="px-3 py-2 font-mono">{item.comprobante}</td><td className="px-3 py-2 font-mono">{item.documento}</td><td className="px-3 py-2 font-mono">{item.nit || '—'}</td><td className="px-3 py-2 font-mono">{item.centro || '—'}</td><Money value={item.debito} /><Money value={item.credito} /><td className="max-w-80 truncate px-3 py-2 text-gray-600" title={item.concepto}>{item.concepto}</td></tr>)}
        </tbody></table></div>
      </div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>;
}

function Money({ value, strong = false }: { value: number; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${strong ? 'font-semibold text-gray-800' : value < 0 ? 'text-red-700' : 'text-gray-700'}`}>{value ? money(value) : '—'}</td>;
}

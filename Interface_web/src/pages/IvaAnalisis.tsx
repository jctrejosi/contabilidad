import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import {
  exportCertificates, getIva, listIva, previewCertificates, saveIva,
  type CertificateFilters, type CertificateReport, type IvaFilters, type IvaItem, type IvaPage,
} from '../api/ivaAnalisis';

const field = 'w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const button = 'rounded border border-petroleum-500 px-3 py-1.5 text-xs font-medium text-petroleum-700 hover:bg-petroleum-50 disabled:opacity-50';
const primary = 'rounded bg-petroleum-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-petroleum-600 disabled:opacity-50';
const money = (value: number) => value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const empty = { cuentaDesde: '', cuentaHasta: '', nitDesde: '', nitHasta: '', buscar: '' };
type TextFilters = typeof empty;
type MoneyField = 'baseDebito' | 'ivaDebito' | 'baseCredito' | 'ivaCredito';

interface Props { cia: string; anio: number; onClose: () => void }

export default function IvaAnalisis({ cia, anio, onClose }: Props) {
  const [filters, setFilters] = useState<TextFilters>(empty);
  const [page, setPage] = useState<IvaPage | null>(null);
  const [item, setItem] = useState<IvaItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [certificate, setCertificate] = useState(false);
  const [certFilters, setCertFilters] = useState<CertificateFilters>({ cia, anio, periodicidad: 'anual', periodo: 'todos', incluirPorcentaje: false });
  const [certReport, setCertReport] = useState<CertificateReport | null>(null);

  const base: IvaFilters = { cia, anio, ...filters };

  const load = useCallback(async (f: IvaFilters, append = false) => {
    setBusy(true); setError('');
    try {
      const result = await listIva(f);
      setPage(previous => append && previous ? { ...result, filas: [...previous.filas, ...result.filas] } : result);
      if (!append) setItem(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No fue posible consultar los acumulados.');
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load({ cia, anio }); }, [cia, anio, load]);

  async function select(row: IvaItem) {
    setBusy(true); setError(''); setNotice('');
    try { setItem(await getIva(base, row.cuenta, row.tercero)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'No fue posible abrir el detalle.'); }
    finally { setBusy(false); }
  }

  function changeMonth(month: number, key: MoneyField, text: string) {
    const value = text === '' ? 0 : Number(text);
    setItem(current => current && Number.isFinite(value) ? {
      ...current,
      meses: current.meses.map(row => row.mes === month ? {
        ...row, [key]: value,
        baseNeta: (key === 'baseDebito' ? value : row.baseDebito) + (key === 'baseCredito' ? value : row.baseCredito),
        ivaNeto: (key === 'ivaDebito' ? value : row.ivaDebito) + (key === 'ivaCredito' ? value : row.ivaCredito),
      } : row),
    } : current);
  }

  async function save() {
    if (!item) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await saveIva(base, item);
      setItem(updated);
      setPage(previous => previous ? { ...previous, filas: previous.filas.map(row =>
        row.cuenta === updated.cuenta && row.tercero === updated.tercero ? updated : row) } : null);
      setNotice('Los valores del acumulado se guardaron correctamente.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No fue posible guardar los valores.');
    } finally { setBusy(false); }
  }

  function openCertificates() {
    setCertFilters({ cia, anio,
      cuentaDesde: item?.cuenta || filters.cuentaDesde,
      cuentaHasta: item?.cuenta || filters.cuentaHasta,
      nitDesde: item?.tercero || filters.nitDesde,
      nitHasta: item?.tercero || filters.nitHasta,
      periodicidad: 'anual', periodo: 'todos', incluirPorcentaje: false });
    setCertReport(null); setCertificate(true); setError('');
  }

  async function preview() {
    setBusy(true); setError('');
    try { setCertReport(await previewCertificates(certFilters)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'No fue posible consultar certificados.'); }
    finally { setBusy(false); }
  }

  async function exportFile(format: 'pdf' | 'xlsx') {
    setBusy(true); setError('');
    try { await exportCertificates(certFilters, format); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'No fue posible exportar certificados.'); }
    finally { setBusy(false); }
  }

  // Mantiene los atajos F6/F8 del formulario original mientras esta vista esté abierta.
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'F6') { event.preventDefault(); openCertificates(); }
      if (event.key === 'F8' && !certificate && item && !busy) { event.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });

  function advance(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const inputs = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([disabled]), select:not([disabled])'));
    const index = inputs.indexOf(document.activeElement as HTMLInputElement);
    if (index >= 0 && index < inputs.length - 1) {
      event.preventDefault();
      const next = inputs[index + 1];
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
    }
  }

  const periods = certFilters.periodicidad === 'mensual' ? 12 : certFilters.periodicidad === 'bimestral' ? 6 : 1;
  const annual = item ? {
    baseDebito: item.meses.reduce((sum, row) => sum + row.baseDebito, 0),
    ivaDebito: item.meses.reduce((sum, row) => sum + row.ivaDebito, 0),
    baseCredito: item.meses.reduce((sum, row) => sum + row.baseCredito, 0),
    ivaCredito: item.meses.reduce((sum, row) => sum + row.ivaCredito, 0),
  } : null;

  return <section className="rounded border border-gray-200 bg-white p-4 space-y-4" aria-label="Análisis acumulados y certificados IVA">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
      <div><h2 className="text-base font-semibold text-gray-800">Análisis acumulados y certificados de IVA</h2>
        <p className="text-xs text-gray-500">Compañía {cia} · Ejercicio {anio}</p></div>
      <div className="flex gap-2"><button className={button} onClick={openCertificates}>Certificados (F6)</button><button className={button} onClick={onClose}>Volver a informes</button></div>
    </div>
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded bg-green-50 p-2 text-xs text-green-700">{notice}</p>}

    {!certificate ? <>
      <form className="grid grid-cols-2 gap-2 md:grid-cols-6" onKeyDown={advance} onSubmit={event => { event.preventDefault(); void load(base); }}>
        {([['cuentaDesde', 'Cuenta desde'], ['cuentaHasta', 'Cuenta hasta'], ['nitDesde', 'Tercero desde'], ['nitHasta', 'Tercero hasta'], ['buscar', 'Buscar cuenta']] as const).map(([key, label]) =>
          <label key={key} className="text-xs text-gray-600">{label}<input className={field} value={filters[key]} onChange={event => setFilters(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
        <div className="flex items-end"><button className={primary} type="submit" disabled={busy}>Consultar</button></div>
      </form>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full min-w-[900px] text-xs"><thead className="bg-gray-50 text-gray-600"><tr>
          {['Cuenta', 'Nombre cuenta', 'Tercero', 'Nombre tercero', 'Base débito', 'IVA débito', 'Base crédito', 'IVA crédito'].map(label => <th key={label} className="px-2 py-2 text-left font-semibold">{label}</th>)}
        </tr></thead><tbody>
          {page?.filas.map(row => <tr key={`${row.cuenta}-${row.tercero}`} className={`cursor-pointer border-t border-gray-100 hover:bg-petroleum-50 ${item?.cuenta === row.cuenta && item.tercero === row.tercero ? 'bg-petroleum-50' : ''}`}>
            <td className="px-2 py-1.5"><button className="font-medium text-petroleum-700 hover:underline" onClick={() => void select(row)}>{row.cuenta}</button></td>
            <td className="px-2 py-1.5">{row.nombreCuenta}</td><td className="px-2 py-1.5">{row.tercero}</td><td className="px-2 py-1.5">{row.nombreTercero}</td>
            {(['baseDebito', 'ivaDebito', 'baseCredito', 'ivaCredito'] as const).map(key => <td key={key} className="px-2 py-1.5 text-right tabular-nums">{money(row.anual[key])}</td>)}
          </tr>)}
          {page && page.filas.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-500">No hay acumulados de IVA para estos filtros.</td></tr>}
        </tbody></table>
      </div>
      {page?.siguiente && <button className={button} disabled={busy} onClick={() => void load({ ...base, cursorCuenta: page.siguiente!.cuenta, cursorTercero: page.siguiente!.tercero }, true)}>Cargar más</button>}
      {item && <div className="space-y-2 rounded border border-petroleum-100 bg-petroleum-50/40 p-3" onKeyDown={advance}>
        <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold text-gray-800">{item.cuenta} · {item.nombreCuenta} / {item.tercero} · {item.nombreTercero}</h3>
          <button className={primary} disabled={busy} onClick={() => void save()}>Guardar valores (F8)</button></div>
        <p className="text-xs text-gray-500">Los débitos se registran positivos y los créditos negativos. Una nueva acumulación del período reemplazará las correcciones manuales.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-xs"><thead><tr>{['Mes', 'Base débito', 'IVA débito', 'Base crédito', 'IVA crédito', 'IVA neto'].map(label => <th key={label} className="p-1.5 text-left">{label}</th>)}</tr></thead><tbody>
          {item.meses.map(row => <tr key={row.mes} className="border-t border-gray-200"><td className="p-1.5">{row.nombre}</td>
            {(['baseDebito', 'ivaDebito', 'baseCredito', 'ivaCredito'] as const).map(key => <td key={key} className="p-1"><input type="number" step="0.01" className={field} value={row[key]} onChange={event => changeMonth(row.mes, key, event.target.value)} aria-label={`${key} ${row.nombre}`} /></td>)}
            <td className="p-1.5 text-right tabular-nums">{money(row.ivaNeto)}</td></tr>)}
          {annual && <tr className="border-t-2 border-petroleum-200 font-semibold"><td className="p-1.5">Total anual</td>
            {(['baseDebito', 'ivaDebito', 'baseCredito', 'ivaCredito'] as const).map(key => <td key={key} className="p-1.5 text-right">{money(annual[key])}</td>)}
            <td className="p-1.5 text-right">{money(annual.ivaDebito + annual.ivaCredito)}</td></tr>}
        </tbody></table></div>
      </div>}
    </> : <div className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-800">Certificados de IVA</h3><button className={button} onClick={() => setCertificate(false)}>Volver al análisis</button></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" onKeyDown={advance}>
        {([['cuentaDesde', 'Cuenta desde'], ['cuentaHasta', 'Cuenta hasta'], ['nitDesde', 'Tercero desde'], ['nitHasta', 'Tercero hasta']] as const).map(([key, label]) => <label key={key} className="text-xs text-gray-600">{label}<input className={field} value={certFilters[key] || ''} onChange={event => { setCertFilters(previous => ({ ...previous, [key]: event.target.value })); setCertReport(null); }} /></label>)}
        <label className="text-xs text-gray-600">Periodicidad<select className={field} value={certFilters.periodicidad} onChange={event => { setCertFilters(previous => ({ ...previous, periodicidad: event.target.value as CertificateFilters['periodicidad'], periodo: 'todos' })); setCertReport(null); }}><option value="mensual">Mensual</option><option value="bimestral">Bimestral</option><option value="anual">Anual</option></select></label>
        <label className="text-xs text-gray-600">Período<select className={field} value={certFilters.periodo} onChange={event => { setCertFilters(previous => ({ ...previous, periodo: event.target.value })); setCertReport(null); }}><option value="todos">Todos</option>{Array.from({ length: periods }, (_, index) => <option key={index} value={String(index + 1)}>{certFilters.periodicidad === 'anual' ? 'Anual' : `${certFilters.periodicidad === 'mensual' ? 'Mes' : 'Bimestre'} ${index + 1}`}</option>)}</select></label>
        <label className="flex items-center gap-2 pt-4 text-xs text-gray-600"><input type="checkbox" checked={certFilters.incluirPorcentaje} onChange={event => { setCertFilters(previous => ({ ...previous, incluirPorcentaje: event.target.checked })); setCertReport(null); }} />Mostrar porcentaje</label>
      </div>
      <div className="flex flex-wrap gap-2"><button className={primary} disabled={busy} onClick={() => void preview()}>Consultar certificados</button><button className={button} disabled={busy} onClick={() => void exportFile('pdf')}>Exportar PDF</button><button className={button} disabled={busy} onClick={() => void exportFile('xlsx')}>Exportar Excel</button></div>
      {certReport && <div className="space-y-3"><p className="text-xs text-gray-600">{certReport.cantidad} certificado{certReport.cantidad !== 1 ? 's' : ''}</p>
        {certReport.certificados.map(cert => <div key={cert.tercero} className="rounded border border-gray-200 p-3 text-xs"><h4 className="font-semibold text-gray-800">{cert.nombreTercero} · {cert.tercero}</h4>
          <p className="mt-1 text-gray-600">Base: {money(cert.totalBase)} · IVA: {money(cert.totalIva)}</p>
          <div className="mt-2 overflow-x-auto"><table className="w-full"><thead><tr>{['Período', 'Cuenta', 'Concepto', 'Base', '% IVA', 'IVA'].map(label => <th key={label} className="border-b p-1 text-left">{label}</th>)}</tr></thead><tbody>{cert.filas.map((line, index) => <tr key={index}>{[line.periodo, line.cuenta, line.concepto, money(line.base), line.porcentaje === null ? '' : `${money(line.porcentaje)} %`, money(line.iva)].map((value, column) => <td key={column} className="border-b p-1">{value}</td>)}</tr>)}</tbody></table></div>
        </div>)}
        {certReport.cantidad === 0 && <p className="text-xs text-gray-500">No hay importes de IVA para los filtros seleccionados.</p>}
      </div>}
    </div>}
  </section>;
}

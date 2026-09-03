import { useEffect, useState } from 'react';
import {
  consultarMovimientoMensual,
  type MovimientoMensualReal,
  type MovimientoMensualResponse,
} from '../api/movimientoMensual';

interface Props {
  /** Código de la compañía seleccionada al ingresar a la aplicación. */
  cia: string;
  onOpenDocumento?: () => void;
}

const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
}).format(value);
const INPUT_CLASS = 'w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1';

export default function MovimientoMensual({ cia, onOpenDocumento }: Props) {
  // El período inicia vacío a propósito: abrir la opción no debe consultar MOV01.
  const [periodo, setPeriodo] = useState('');
  const [cuentaDesde, setCuentaDesde] = useState('');
  const [cuentaHasta, setCuentaHasta] = useState('');
  const [tercero, setTercero] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [centro, setCentro] = useState('');
  const [documento, setDocumento] = useState('');
  const [resultado, setResultado] = useState<MovimientoMensualResponse | null>(null);
  const [selected, setSelected] = useState<MovimientoMensualReal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Cambiar de compañía borra los resultados anteriores, pero no consulta ADS.
  useEffect(() => {
    setPeriodo('');
    setResultado(null);
    setSelected(null);
    setError('');
  }, [cia]);

  async function consultar(page = 1) {
    if (!periodo) {
      setError('Seleccione el período que desea consultar.');
      return;
    }
    const [anio, mes] = periodo.split('-').map(Number);
    setCargando(true);
    setError('');
    setSelected(null);
    try {
      const response = await consultarMovimientoMensual({
        cia, anio, mes, page, pageSize: 100,
        cuentaDesde, cuentaHasta, tercero, comprobante, centro, documento,
      });
      setResultado(response);
    } catch (cause: unknown) {
      setResultado(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar MOV01.');
    } finally {
      setCargando(false);
    }
  }

  function exportarPaginaCSV() {
    if (!resultado?.items.length) return;
    const filas = [
      ['Fecha', 'Comprobante', 'Tipo documento', 'Documento', 'Cuenta', 'NIT', 'Centro', 'Débito', 'Crédito', 'Base', 'Concepto'],
      ...resultado.items.map(item => [item.fecha, item.comprobante, item.tipoDoc, item.documento, item.cuenta, item.nit, item.centro, String(item.debito), String(item.credito), String(item.base), item.concepto]),
    ];
    const csv = filas.map(fila => fila.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `movimiento-${cia}-${periodo}-pagina-${resultado.page}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  const items = resultado?.items ?? [];

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Movimiento mensual</h1>
          <p className="text-xs text-gray-500">Consulta bajo demanda de MOV01 para la compañía {cia}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Advantage · MOV01 · CIA {cia}</span>
          <button type="button" disabled={!items.length} onClick={exportarPaginaCSV} className="rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">↓ Exportar página CSV</button>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <Filter label="Período *"><input type="month" value={periodo} onChange={event => setPeriodo(event.target.value)} className={INPUT_CLASS} /></Filter>
          <Filter label="Cuenta desde"><input inputMode="numeric" value={cuentaDesde} onChange={event => setCuentaDesde(event.target.value)} placeholder="100000" className={`${INPUT_CLASS} font-mono`} /></Filter>
          <Filter label="Cuenta hasta"><input inputMode="numeric" value={cuentaHasta} onChange={event => setCuentaHasta(event.target.value)} placeholder="999999999999" className={`${INPUT_CLASS} font-mono`} /></Filter>
          <Filter label="NIT tercero"><input value={tercero} onChange={event => setTercero(event.target.value)} placeholder="NITN" className={`${INPUT_CLASS} font-mono`} /></Filter>
          <Filter label="Comprobante"><input value={comprobante} onChange={event => setComprobante(event.target.value)} placeholder="06" className={`${INPUT_CLASS} font-mono`} /></Filter>
          <Filter label="Centro"><input value={centro} onChange={event => setCentro(event.target.value)} placeholder="TFASE" className={`${INPUT_CLASS} font-mono`} /></Filter>
          <Filter label="Documento"><input value={documento} onChange={event => setDocumento(event.target.value)} placeholder="TDOCUM" className={`${INPUT_CLASS} font-mono`} /></Filter>
          <div className="flex items-end"><button type="button" disabled={cargando} onClick={() => consultar(1)} className="w-full rounded bg-petroleum-500 py-1.5 text-xs font-medium text-white disabled:cursor-wait disabled:opacity-60">{cargando ? 'Consultando…' : 'Consultar'}</button></div>
        </div>
        <p className="mt-2 text-xs text-gray-400">La base de datos solo se consulta cuando pulsa Consultar. El período y la compañía son filtros obligatorios.</p>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1 overflow-hidden rounded border border-gray-200 bg-white">
          <div className="table-fixed-header overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 bg-gray-50"><tr>
                {['Fecha', 'Comprobante', 'Tipo Doc', 'Documento', 'Cuenta', 'NIT', 'Centro', 'Débito', 'Crédito', 'Base', 'Concepto'].map((column, index) => <th key={column} className={`px-3 py-2.5 font-semibold text-gray-600 ${index >= 7 && index <= 9 ? 'text-right' : 'text-left'}`}>{column}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {!resultado && !cargando && <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500"><div className="font-medium text-gray-600">Aún no se ha consultado MOV01</div><div className="mt-1">Seleccione un período, aplique los filtros necesarios y pulse Consultar.</div></td></tr>}
                {cargando && <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500">Consultando MOV01 para la compañía {cia}…</td></tr>}
                {resultado && !cargando && items.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500">No hay movimientos que coincidan con los filtros aplicados.</td></tr>}
                {!cargando && items.map((item, index) => {
                  const rowKey = `${resultado?.page}-${item.fecha}-${item.comprobante}-${item.documento}-${item.cuenta}-${item.secuencia}-${index}`;
                  return <tr key={rowKey} onClick={() => setSelected(item)} className={`hoverable cursor-pointer ${selected === item ? 'bg-blue-50' : ''}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{item.fecha || '—'}</td>
                    <td className="px-3 py-2 font-mono font-medium text-gray-700">{item.comprobante || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{item.tipoDoc || '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{item.documento || '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">{item.cuenta}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{item.nit || '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{item.centro || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-800">{item.debito ? fmtCOP(item.debito) : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{item.credito ? fmtCOP(item.credito) : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{item.base ? fmtCOP(item.base) : '—'}</td>
                    <td title={item.concepto} className="max-w-56 truncate px-3 py-2 text-gray-500">{item.concepto || '—'}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-5 border-t border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="text-xs text-gray-500">{resultado ? `${items.length} registros · página ${resultado.page}` : 'Sin consulta'}</span>
            {resultado && <>
              <span className="text-xs text-gray-500">Débitos de la página: <span className="font-mono font-semibold text-gray-800">{fmtCOP(resultado.pageDebit)}</span></span>
              <span className="text-xs text-gray-500">Créditos de la página: <span className="font-mono font-semibold text-gray-800">{fmtCOP(resultado.pageCredit)}</span></span>
              <div className="ml-auto flex gap-2">
                <button type="button" disabled={resultado.page <= 1 || cargando} onClick={() => consultar(resultado.page - 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">← Anterior</button>
                <button type="button" disabled={!resultado.hasMore || cargando} onClick={() => consultar(resultado.page + 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">Siguiente →</button>
              </div>
            </>}
          </div>
        </div>

        {selected && <aside className="w-72 shrink-0 space-y-3 rounded border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between"><div><div className="font-mono font-bold text-gray-800">{selected.comprobante || 'Sin comprobante'}</div><div className="mt-0.5 text-xs text-gray-500">{selected.documento || 'Sin documento'}</div></div><button type="button" onClick={() => setSelected(null)} className="text-lg leading-none text-gray-400 hover:text-gray-600">×</button></div>
          <div className="space-y-2 text-xs">
            {[
              ['Período', selected.periodo], ['Fecha', selected.fecha || '—'], ['Cuenta', selected.cuenta],
              ['NIT tercero', selected.nitTercero || '—'], ['NIT movimiento', selected.nitMovimiento || '—'],
              ['Centro', selected.centro || '—'], ['Tipo documento', selected.tipoDoc || '—'],
              ['Doc. afectado', selected.docAfectado || '—'], ['Clasificación fiscal', selected.claseFiscal || '—'],
              ['Secuencia', String(selected.secuencia)], ['Usuario', selected.usuario || '—'],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><span className="shrink-0 text-gray-400">{label}</span><span className="max-w-36 truncate text-right font-mono text-gray-700">{value}</span></div>)}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2"><div><div className="text-xs text-gray-400">Débito</div><div className="font-mono font-bold text-gray-800">{selected.debito ? fmtCOP(selected.debito) : '—'}</div></div><div><div className="text-xs text-gray-400">Crédito</div><div className="font-mono font-bold text-gray-600">{selected.credito ? fmtCOP(selected.credito) : '—'}</div></div></div>
          <div><div className="mb-1 text-xs text-gray-400">Concepto</div><div className="text-xs text-gray-700">{selected.concepto || '—'}</div></div>
          {onOpenDocumento && <button type="button" onClick={onOpenDocumento} className="w-full rounded bg-petroleum-500 py-2 text-xs font-medium text-white">Ver documento oficial →</button>}
        </aside>}
      </div>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>;
}

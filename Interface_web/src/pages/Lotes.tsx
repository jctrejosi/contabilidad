import { useEffect, useMemo, useState } from 'react';
import {
  consultarDetalleLote,
  consultarLotes,
  type DetalleLoteResponse,
  type LoteReal,
  type LotesResponse,
} from '../api/lotes';

const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
}).format(value);

const STATE_COLORS: Record<string, string> = {
  Activo: 'bg-blue-100 text-blue-700',
  Borrador: 'bg-gray-100 text-gray-700',
  'Con errores': 'bg-red-100 text-red-700',
  Verificado: 'bg-cyan-100 text-cyan-700',
  Pendiente: 'bg-amber-100 text-amber-700',
  Contabilizado: 'bg-green-100 text-green-700',
  Anulado: 'bg-gray-100 text-gray-500',
  Histórico: 'bg-purple-100 text-purple-700',
};

function Estado({ valor }: { valor: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_COLORS[valor] ?? 'bg-gray-100 text-gray-600'}`}>{valor}</span>;
}

export default function LotesPage({ cia }: { cia: string }) {
  const [resultado, setResultado] = useState<LotesResponse | null>(null);
  const [seleccionado, setSeleccionado] = useState<LoteReal | null>(null);
  const [detalle, setDetalle] = useState<DetalleLoteResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState('');
  const [errorDetalle, setErrorDetalle] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // CONMOVI sí se carga al ingresar, tal como funciona el mantenimiento de
  // lotes original. CIA siempre viaja como parte obligatoria de la consulta.
  useEffect(() => {
    setSeleccionado(null);
    setDetalle(null);
    setBusqueda('');
    void cargarLotes(1);
  }, [cia]);

  async function cargarLotes(page: number) {
    setCargando(true);
    setError('');
    try {
      setResultado(await consultarLotes(cia, page));
    } catch (cause: unknown) {
      setResultado(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar CONMOVI.');
    } finally {
      setCargando(false);
    }
  }

  async function abrirLote(lote: LoteReal, page = 1) {
    setSeleccionado(lote);
    setCargandoDetalle(true);
    setErrorDetalle('');
    try {
      setDetalle(await consultarDetalleLote(cia, lote.lote, page));
    } catch (cause: unknown) {
      setDetalle(null);
      setErrorDetalle(cause instanceof Error ? cause.message : 'No fue posible consultar CONLOTES.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  const lotesVisibles = useMemo(() => {
    const query = busqueda.trim().toLocaleLowerCase('es');
    if (!query) return resultado?.items ?? [];
    return (resultado?.items ?? []).filter(lote =>
      lote.lote.toLocaleLowerCase('es').includes(query)
      || lote.nombre.toLocaleLowerCase('es').includes(query)
      || lote.usuarioInicial.toLocaleLowerCase('es').includes(query),
    );
  }, [busqueda, resultado]);

  if (seleccionado) {
    return <DetalleLote
      cia={cia}
      lote={seleccionado}
      resultado={detalle}
      cargando={cargandoDetalle}
      error={errorDetalle}
      onBack={() => { setSeleccionado(null); setDetalle(null); setErrorDetalle(''); }}
      onPage={page => { void abrirLote(seleccionado, page); }}
    />;
  }

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Movimientos / Lotes</div>
          <h1 className="text-lg font-semibold text-gray-800">Lotes contables</h1>
          <p className="mt-1 text-xs text-gray-500">Cabeceras de CONMOVI para la compañía {cia}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Advantage · CONMOVI · CIA {cia}</span>
          <button type="button" disabled={cargando} onClick={() => cargarLotes(resultado?.page ?? 1)} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">↻ Actualizar</button>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">Buscar en la página</label>
        <input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Código, nombre o usuario del lote" className="w-full max-w-md rounded border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100" />
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              {['Lote', 'Descripción', 'Mes', 'Fecha', 'Usuario inicial', 'Usuario final', 'Ítems', 'Débitos', 'Créditos', 'Diferencia', 'Estado', 'Acción'].map((titulo, index) => <th key={titulo} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index >= 6 && index <= 9 ? 'text-right' : 'text-left'}`}>{titulo}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {cargando && <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500">Consultando CONMOVI para la compañía {cia}…</td></tr>}
              {!cargando && resultado && lotesVisibles.length === 0 && <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500"><div className="font-medium text-gray-600">No hay lotes para mostrar</div><div className="mt-1">CONMOVI no contiene registros de la compañía {cia}{busqueda ? ' que coincidan con la búsqueda.' : '.'}</div></td></tr>}
              {!cargando && lotesVisibles.map(lote => <tr key={`${lote.id}-${lote.lote}`} onClick={() => { void abrirLote(lote); }} className="hoverable cursor-pointer">
                <td className="px-3 py-2 font-mono font-medium text-gray-800">{lote.lote}</td>
                <td title={lote.nombre} className="max-w-64 truncate px-3 py-2 text-gray-700">{lote.nombre || '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{lote.mes || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{lote.fecha || '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{lote.usuarioInicial || '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{lote.usuarioFinal || '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-700">{lote.items}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(lote.debito)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{fmtCOP(lote.credito)}</td>
                <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-semibold ${Math.abs(lote.diferencia) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>{Math.abs(lote.diferencia) < 0.01 ? '—' : fmtCOP(Math.abs(lote.diferencia))}</td>
                <td className="px-3 py-2"><Estado valor={lote.estado} /></td>
                <td className="px-3 py-2"><button type="button" onClick={event => { event.stopPropagation(); void abrirLote(lote); }} className="text-xs font-medium text-petroleum-600 hover:underline">Ver detalle</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center border-t border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="text-xs text-gray-500">{resultado ? `${lotesVisibles.length} lotes · página ${resultado.page}` : 'Consultando…'}</span>
          {resultado && <div className="ml-auto flex gap-2"><button type="button" disabled={resultado.page <= 1 || cargando} onClick={() => cargarLotes(resultado.page - 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">← Anterior</button><button type="button" disabled={!resultado.hasMore || cargando} onClick={() => cargarLotes(resultado.page + 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">Siguiente →</button></div>}
        </div>
      </div>
    </div>
  );
}

function DetalleLote({ cia, lote, resultado, cargando, error, onBack, onPage }: {
  cia: string;
  lote: LoteReal;
  resultado: DetalleLoteResponse | null;
  cargando: boolean;
  error: string;
  onBack: () => void;
  onPage: (page: number) => void;
}) {
  const lineas = resultado?.items ?? [];
  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><button type="button" onClick={onBack} className="mb-2 text-xs text-petroleum-600 hover:underline">← Volver a lotes</button><h1 className="text-lg font-semibold text-gray-800">Lote {lote.lote} — {lote.nombre}</h1><p className="mt-1 text-xs text-gray-500">Detalle de CONLOTES · relación CIA {cia} + LOTE {lote.lote}</p></div>
      <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Advantage · CONLOTES · CIA {cia}</span>
    </div>

    <div className="grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-3 text-xs md:grid-cols-4 lg:grid-cols-8">
      <Dato label="Mes" value={lote.mes || '—'} /><Dato label="Fecha" value={lote.fecha || '—'} /><Dato label="Usuario inicial" value={lote.usuarioInicial || '—'} /><Dato label="Usuario final" value={lote.usuarioFinal || '—'} /><Dato label="Ítems cabecera" value={String(lote.items)} /><Dato label="Débitos cabecera" value={fmtCOP(lote.debito)} /><Dato label="Créditos cabecera" value={fmtCOP(lote.credito)} /><div><div className="mb-1 text-gray-400">Estado</div><Estado valor={lote.estado} /></div>
    </div>

    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="table-fixed-header overflow-x-auto"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Cuenta', 'Nombre cuenta', 'NIT', 'Centro', 'Comprobante', 'Tipo', 'Documento', 'Fecha', 'Débito', 'Crédito', 'Base', 'Doc. afectado', 'Concepto', 'Inconsistencia'].map((titulo, index) => <th key={titulo} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index >= 8 && index <= 10 ? 'text-right' : 'text-left'}`}>{titulo}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">
          {cargando && <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-500">Consultando CONLOTES del lote {lote.lote}…</td></tr>}
          {!cargando && resultado && lineas.length === 0 && <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-500">El lote existe en CONMOVI, pero no tiene partidas en CONLOTES para la compañía {cia}.</td></tr>}
          {!cargando && lineas.map((linea, index) => <tr key={`${linea.id}-${index}`} className={linea.inconsistencia.trim() ? 'bg-red-50' : ''}><td className="px-3 py-2 font-mono text-gray-700">{linea.cuenta}</td><td title={linea.nombreCuenta} className="max-w-60 truncate px-3 py-2 text-gray-600">{linea.nombreCuenta || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.nit || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.centro || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.comprobante || '—'}</td><td className="px-3 py-2 text-gray-600">{linea.tipoDocumento || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.documento || '—'}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{linea.fecha || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-800">{linea.debito ? fmtCOP(linea.debito) : '—'}</td><td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{linea.credito ? fmtCOP(linea.credito) : '—'}</td><td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{linea.base ? fmtCOP(linea.base) : '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.documentoAfectado || '—'}</td><td title={linea.concepto} className="max-w-72 truncate px-3 py-2 text-gray-500">{linea.concepto || '—'}</td><td className="px-3 py-2 text-red-600">{linea.inconsistencia || '—'}</td></tr>)}
        </tbody></table></div>
      <div className="flex flex-wrap items-center gap-5 border-t border-gray-200 bg-gray-50 px-4 py-2.5"><span className="text-xs text-gray-500">{resultado ? `${lineas.length} partidas · página ${resultado.page}` : 'Consultando…'}</span>{resultado && <><span className="text-xs text-gray-500">Débitos página: <strong className="font-mono text-gray-800">{fmtCOP(resultado.pageDebit)}</strong></span><span className="text-xs text-gray-500">Créditos página: <strong className="font-mono text-gray-800">{fmtCOP(resultado.pageCredit)}</strong></span><div className="ml-auto flex gap-2"><button type="button" disabled={resultado.page <= 1 || cargando} onClick={() => onPage(resultado.page - 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">← Anterior</button><button type="button" disabled={!resultado.hasMore || cargando} onClick={() => onPage(resultado.page + 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">Siguiente →</button></div></>}</div>
    </div>
  </div>;
}

function Dato({ label, value }: { label: string; value: string }) {
  return <div><div className="mb-1 text-gray-400">{label}</div><div className="font-mono font-medium text-gray-700">{value}</div></div>;
}

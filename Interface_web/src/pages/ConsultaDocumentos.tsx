import { useEffect, useState } from 'react';
import { listarComprobantes, type ComprobanteReal } from '../api/comprobantes';
import {
  consultarDetalleDocumento,
  consultarDocumentos,
  type DocumentoContable,
  type DocumentosResponse,
  type MovimientoDocumento,
} from '../api/documentos';
import { listarTiposDocumento, type TipoDocumentoReal } from '../api/tiposDocumento';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
}).format(value);

interface Props {
  cia: string;
  onOpenDocumento?: () => void;
}

interface Filtros {
  periodo: string;
  comprobante: string;
  tipoDocumento: string;
  nit: string;
  fechaDesde: string;
  fechaHasta: string;
  documento: string;
}

const FILTROS_VACIOS: Filtros = {
  periodo: '', comprobante: '', tipoDocumento: '', nit: '',
  fechaDesde: '', fechaHasta: '', documento: '',
};

function claveDocumento(documento: DocumentoContable): string {
  return `${documento.fecha}|${documento.comprobante}|${documento.tipoDocumento}|${documento.documento}|${documento.id}`;
}

export default function ConsultaDocumentos({ cia, onOpenDocumento }: Props) {
  // La pantalla inicia deliberadamente sin documentos. Solo consultar() llama
  // CONDOCUM, después de que el usuario escriba al menos un filtro.
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [resultado, setResultado] = useState<DocumentosResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [comprobantes, setComprobantes] = useState<ComprobanteReal[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoReal[]>([]);
  const [maestrosError, setMaestrosError] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, MovimientoDocumento[]>>({});
  const [detalleCargando, setDetalleCargando] = useState<string | null>(null);
  const [detalleError, setDetalleError] = useState<Record<string, string>>({});

  // CONTICOM y VISDOCUM alimentan únicamente los selectores. Esta carga no
  // consulta documentos ni movimientos.
  useEffect(() => {
    let vigente = true;
    setFiltros(FILTROS_VACIOS);
    setResultado(null);
    setExpandido(null);
    setDetalles({});
    setError('');
    setMaestrosError('');
    Promise.all([listarComprobantes(cia), listarTiposDocumento()])
      .then(([comprobantesResponse, tiposResponse]) => {
        if (!vigente) return;
        setComprobantes(comprobantesResponse.items);
        setTiposDocumento(tiposResponse.items);
      })
      .catch((cause: unknown) => {
        if (vigente) setMaestrosError(cause instanceof Error ? cause.message : 'No fue posible cargar los filtros maestros.');
      });
    return () => { vigente = false; };
  }, [cia]);

  function cambiarFiltro(campo: keyof Filtros, valor: string) {
    setFiltros(actual => ({ ...actual, [campo]: valor }));
    // Los resultados corresponden a los filtros usados en la última consulta;
    // al modificarlos se ocultan para no presentar información desactualizada.
    setResultado(null);
    setExpandido(null);
    setError('');
  }

  const hayFiltro = Object.values(filtros).some(valor => valor.trim());

  async function consultar(page = 1) {
    if (!hayFiltro) {
      setError('Aplique al menos un filtro antes de consultar documentos.');
      return;
    }
    setCargando(true);
    setError('');
    setExpandido(null);
    try {
      const response = await consultarDocumentos({ cia, page, pageSize: 50, ...filtros });
      setResultado(response);
    } catch (cause: unknown) {
      setResultado(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar CONDOCUM.');
    } finally {
      setCargando(false);
    }
  }

  async function alternarDetalle(documento: DocumentoContable) {
    const clave = claveDocumento(documento);
    if (expandido === clave) {
      setExpandido(null);
      return;
    }
    setExpandido(clave);
    if (detalles[clave]) return;
    setDetalleCargando(clave);
    setDetalleError(actual => ({ ...actual, [clave]: '' }));
    try {
      const lineas = await consultarDetalleDocumento(cia, documento);
      setDetalles(actual => ({ ...actual, [clave]: lineas }));
    } catch (cause: unknown) {
      setDetalleError(actual => ({
        ...actual,
        [clave]: cause instanceof Error ? cause.message : 'No fue posible consultar MOV01.',
      }));
    } finally {
      setDetalleCargando(null);
    }
  }

  const items = resultado?.items ?? [];

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Consultas / Documentos</div>
          <h1 className="text-lg font-semibold text-gray-800">Consulta general de documentos</h1>
          <p className="mt-1 text-xs text-gray-500">Cabeceras de CONDOCUM y detalle contable de MOV01 · compañía {cia}</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Advantage · CIA {cia}</span>
      </div>

      <div className="rounded border border-gray-200 bg-white p-3">
        <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
          <legend className="px-2 text-xs font-semibold text-petroleum-800">Filtros</legend>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            <Filter label="Período"><input type="month" value={filtros.periodo} onChange={event => cambiarFiltro('periodo', event.target.value)} className={INPUT} /></Filter>
            <Filter label="Comprobante"><select value={filtros.comprobante} onChange={event => cambiarFiltro('comprobante', event.target.value)} className={INPUT}><option value="">Todos</option>{comprobantes.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></Filter>
            <Filter label="Tipo documento"><select value={filtros.tipoDocumento} onChange={event => cambiarFiltro('tipoDocumento', event.target.value)} className={INPUT}><option value="">Todos</option>{tiposDocumento.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></Filter>
            <Filter label="NIT"><input value={filtros.nit} onChange={event => cambiarFiltro('nit', event.target.value)} placeholder="CCODIGO" className={`${INPUT} font-mono`} /></Filter>
            <Filter label="Documento"><input value={filtros.documento} onChange={event => cambiarFiltro('documento', event.target.value)} placeholder="DDOCUM" className={`${INPUT} font-mono`} /></Filter>
            <Filter label="Fecha desde"><input type="date" value={filtros.fechaDesde} onChange={event => cambiarFiltro('fechaDesde', event.target.value)} className={INPUT} /></Filter>
            <Filter label="Fecha hasta"><input type="date" value={filtros.fechaHasta} onChange={event => cambiarFiltro('fechaHasta', event.target.value)} className={INPUT} /></Filter>
            <div className="flex items-end"><button type="button" disabled={cargando || !hayFiltro} onClick={() => consultar(1)} className="w-full rounded bg-petroleum-500 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{cargando ? 'Consultando…' : 'Consultar'}</button></div>
          </div>
          <p className="mt-2 text-xs text-gray-400">No se consulta CONDOCUM al entrar. Seleccione al menos un criterio y pulse Consultar.</p>
        </fieldset>
      </div>

      {maestrosError && <div role="alert" className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{maestrosError}</div>}
      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              {['Fecha', 'Comprobante', 'Tipo', 'Documento', 'NIT', 'Tercero / detalle', 'Valor', 'Acción'].map((titulo, index) => <th key={titulo} className={`px-3 py-2.5 font-semibold text-gray-600 ${index === 6 ? 'text-right' : 'text-left'}`}>{titulo}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {!resultado && !cargando && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500"><div className="font-medium text-gray-600">Aún no se ha consultado CONDOCUM</div><div className="mt-1">Aplique un filtro y pulse Consultar para mostrar documentos.</div></td></tr>}
              {cargando && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Consultando CONDOCUM para la compañía {cia}…</td></tr>}
              {resultado && !cargando && !items.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No existen documentos que coincidan con los filtros aplicados.</td></tr>}
              {!cargando && items.map(documento => {
                const clave = claveDocumento(documento);
                return <DocumentoConDetalle
                  key={clave}
                  documento={documento}
                  abierto={expandido === clave}
                  cargando={detalleCargando === clave}
                  lineas={detalles[clave]}
                  error={detalleError[clave]}
                  onToggle={() => { void alternarDetalle(documento); }}
                  onOpenDocumento={onOpenDocumento}
                />;
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="text-xs text-gray-500">{resultado ? `${items.length} documentos · página ${resultado.page}` : 'Sin consulta'}</span>
          {resultado && <div className="ml-auto flex gap-2"><button type="button" disabled={resultado.page <= 1 || cargando} onClick={() => consultar(resultado.page - 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">← Anterior</button><button type="button" disabled={!resultado.hasMore || cargando} onClick={() => consultar(resultado.page + 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">Siguiente →</button></div>}
        </div>
      </div>
    </div>
  );
}

function DocumentoConDetalle({ documento, abierto, cargando, lineas, error, onToggle, onOpenDocumento }: {
  documento: DocumentoContable;
  abierto: boolean;
  cargando: boolean;
  lineas?: MovimientoDocumento[];
  error?: string;
  onToggle: () => void;
  onOpenDocumento?: () => void;
}) {
  const totalDebito = lineas?.reduce((total, linea) => total + linea.debito, 0) ?? 0;
  const totalCredito = lineas?.reduce((total, linea) => total + linea.credito, 0) ?? 0;
  return <>
    <tr className="hoverable">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{documento.fecha || '—'}</td>
      <td className="px-3 py-2 font-mono font-medium text-gray-700">{documento.comprobante || '—'}</td>
      <td className="px-3 py-2 text-gray-600">{documento.tipoDocumento || '—'}</td>
      <td className="px-3 py-2 font-mono text-gray-700">{documento.documento}</td>
      <td className="px-3 py-2 font-mono text-gray-600">{documento.nit || '—'}</td>
      <td title={documento.detalle} className="max-w-72 truncate px-3 py-2 text-gray-600">{documento.tercero || documento.detalle || '—'}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(documento.valor)}</td>
      <td className="whitespace-nowrap px-3 py-2"><button type="button" onClick={onToggle} className="text-xs text-petroleum-600 hover:underline">{abierto ? 'Ocultar detalle' : 'Ver detalle'}</button>{onOpenDocumento && <button type="button" onClick={onOpenDocumento} className="ml-3 text-xs text-petroleum-600 hover:underline">Documento oficial</button>}</td>
    </tr>
    {abierto && <tr><td colSpan={8} className="bg-gray-50/70 px-3 py-3">
      {cargando && <div className="rounded border border-gray-200 bg-white p-6 text-center text-xs text-gray-500">Consultando las partidas del documento en MOV01…</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {!cargando && !error && lineas && lineas.length === 0 && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">La cabecera existe en CONDOCUM, pero no se encontraron partidas relacionadas en MOV01.</div>}
      {!cargando && !error && lineas && lineas.length > 0 && <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Cuenta', 'Nombre cuenta', 'NIT', 'Centro', 'Documento afectado', 'Débito', 'Crédito', 'Base', 'Concepto'].map((titulo, index) => <th key={titulo} className={`px-3 py-2 font-semibold text-gray-600 ${index >= 5 && index <= 7 ? 'text-right' : 'text-left'}`}>{titulo}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">{lineas.map((linea, index) => <tr key={`${linea.id}-${index}`}><td className="px-3 py-1.5 font-mono text-gray-700">{linea.cuenta}</td><td className="px-3 py-1.5 text-gray-600">{linea.nombreCuenta || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{linea.nit || '—'}</td><td className="px-3 py-1.5 text-gray-600">{linea.centro || '—'}</td><td className="px-3 py-1.5 font-mono text-gray-600">{linea.documentoAfectado || '—'}</td><td className="px-3 py-1.5 text-right font-mono text-gray-800">{linea.debito ? fmtCOP(linea.debito) : '—'}</td><td className="px-3 py-1.5 text-right font-mono text-gray-600">{linea.credito ? fmtCOP(linea.credito) : '—'}</td><td className="px-3 py-1.5 text-right font-mono text-gray-600">{linea.base ? fmtCOP(linea.base) : '—'}</td><td title={linea.concepto} className="max-w-72 truncate px-3 py-1.5 text-gray-500">{linea.concepto || '—'}</td></tr>)}</tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50"><tr><td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-600">Totales</td><td className="px-3 py-2 text-right font-mono font-semibold text-gray-800">{fmtCOP(totalDebito)}</td><td className="px-3 py-2 text-right font-mono font-semibold text-gray-800">{fmtCOP(totalCredito)}</td><td colSpan={2} className={`px-3 py-2 text-xs font-medium ${Math.abs(totalDebito - totalCredito) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>{Math.abs(totalDebito - totalCredito) < 0.01 ? 'Documento cuadrado' : `Diferencia ${fmtCOP(Math.abs(totalDebito - totalCredito))}`}</td></tr></tfoot>
        </table>
      </div>}
    </td></tr>}
  </>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>;
}

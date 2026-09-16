import { useEffect, useState } from 'react';
import { listarComprobantes, type ComprobanteReal } from '../api/comprobantes';
import {
  anularDocumento,
  consultarDetalleDocumento,
  consultarDocumentos,
  type DocumentoContable,
  type DocumentosResponse,
  type MovimientoDocumento,
  type ResultadoAnulacion,
} from '../api/documentos';
import { listarTiposDocumento, type TipoDocumentoReal } from '../api/tiposDocumento';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
}).format(value);

interface Props { cia: string }
interface Filtros {
  periodo: string;
  comprobante: string;
  tipoDocumento: string;
  documento: string;
  nit: string;
}

const FILTROS_VACIOS: Filtros = {
  periodo: '', comprobante: '', tipoDocumento: '', documento: '', nit: '',
};

export default function Anulacion({ cia }: Props) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [resultado, setResultado] = useState<DocumentosResponse | null>(null);
  const [comprobantes, setComprobantes] = useState<ComprobanteReal[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoReal[]>([]);
  const [seleccionado, setSeleccionado] = useState<DocumentoContable | null>(null);
  const [detalle, setDetalle] = useState<MovimientoDocumento[]>([]);
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [resumen, setResumen] = useState<ResultadoAnulacion | null>(null);

  useEffect(() => {
    let vigente = true;
    setFiltros(FILTROS_VACIOS);
    setResultado(null);
    setSeleccionado(null);
    setDetalle([]);
    setError('');
    setMensaje('');
    Promise.all([listarComprobantes(cia), listarTiposDocumento()])
      .then(([comprobantesResponse, tiposResponse]) => {
        if (!vigente) return;
        setComprobantes(comprobantesResponse.items);
        setTiposDocumento(tiposResponse.items);
      })
      .catch((cause: unknown) => {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible cargar los filtros.');
      });
    return () => { vigente = false; };
  }, [cia]);

  const hayFiltro = Object.values(filtros).some(value => value.trim());

  function cambiarFiltro(campo: keyof Filtros, valor: string) {
    setFiltros(actual => ({ ...actual, [campo]: valor }));
    setResultado(null);
    setSeleccionado(null);
    setDetalle([]);
    setError('');
    setMensaje('');
  }

  async function consultar(page = 1) {
    if (!hayFiltro) {
      setError('Aplique al menos un filtro antes de consultar.');
      return;
    }
    setCargando(true);
    setError('');
    setMensaje('');
    setSeleccionado(null);
    setDetalle([]);
    try {
      setResultado(await consultarDocumentos({ cia, page, pageSize: 50, ...filtros }));
    } catch (cause: unknown) {
      setResultado(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible realizar la consulta.');
    } finally {
      setCargando(false);
    }
  }

  async function revisar(documento: DocumentoContable) {
    setSeleccionado(documento);
    setDetalle([]);
    setMotivo('');
    setError('');
    setMensaje('');
    setResumen(null);
    setDetalleCargando(true);
    try {
      const lineas = await consultarDetalleDocumento(cia, documento);
      if (!lineas.length) throw new Error('El documento no contiene partidas que puedan anularse.');
      setDetalle(lineas);
    } catch (cause: unknown) {
      setSeleccionado(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible revisar el documento.');
    } finally {
      setDetalleCargando(false);
    }
  }

  async function ejecutarAnulacion() {
    if (!seleccionado || motivo.trim().length < 5) return;
    setConfirmar(false);
    setAnulando(true);
    setError('');
    try {
      const response = await anularDocumento(cia, seleccionado, motivo.trim());
      setResumen(response);
      setMensaje(`El documento ${response.documento} fue anulado correctamente.`);
      setResultado(actual => actual ? {
        ...actual,
        items: actual.items.filter(item => item.id !== seleccionado.id),
      } : null);
      setSeleccionado(null);
      setDetalle([]);
      setMotivo('');
      if (response.advertencia) setError(response.advertencia);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No fue posible completar la anulación.');
    } finally {
      setAnulando(false);
    }
  }

  const items = resultado?.items ?? [];
  const totalDebito = detalle.reduce((total, line) => total + line.debito, 0);
  const totalCredito = detalle.reduce((total, line) => total + line.credito, 0);

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div>
      <div className="mb-1 text-xs text-gray-400">Movimientos / Anulación</div>
      <h1 className="text-lg font-semibold text-gray-800">Anulación de documentos</h1>
      <p className="mt-1 text-xs text-gray-500">Consulte el documento, revise sus partidas y confirme el retiro del movimiento.</p>
    </div>

    <div className="rounded border border-gray-200 bg-white p-3">
      <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
        <legend className="px-2 text-xs font-semibold text-petroleum-800">Buscar documento</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Filter label="Período"><input type="month" value={filtros.periodo} onChange={event => cambiarFiltro('periodo', event.target.value)} className={INPUT} /></Filter>
          <Filter label="Comprobante"><select value={filtros.comprobante} onChange={event => cambiarFiltro('comprobante', event.target.value)} className={INPUT}><option value="">Todos</option>{comprobantes.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></Filter>
          <Filter label="Tipo de documento"><select value={filtros.tipoDocumento} onChange={event => cambiarFiltro('tipoDocumento', event.target.value)} className={INPUT}><option value="">Todos</option>{tiposDocumento.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></Filter>
          <Filter label="N.° documento"><input value={filtros.documento} onChange={event => cambiarFiltro('documento', event.target.value)} className={`${INPUT} font-mono`} /></Filter>
          <Filter label="Tercero"><input value={filtros.nit} onChange={event => cambiarFiltro('nit', event.target.value)} className={`${INPUT} font-mono`} /></Filter>
          <div className="flex items-end"><button type="button" disabled={cargando || !hayFiltro} onClick={() => void consultar(1)} className="w-full rounded bg-petroleum-500 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{cargando ? 'Consultando…' : 'Consultar'}</button></div>
        </div>
      </fieldset>
    </div>

    {mensaje && <div role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"><div className="font-medium">{mensaje}</div>{resumen && <div className="mt-1 text-xs">{resumen.partidasRetiradas} partidas retiradas · {resumen.cuentasRecalculadas} cuentas y {resumen.tercerosRecalculados} auxiliares de tercero recalculados.</div>}</div>}
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      <table className="w-full text-xs">
        <thead className="border-b border-gray-200 bg-gray-50"><tr>{['Fecha', 'Comprobante', 'Tipo', 'Documento', 'Tercero', 'Detalle', 'Valor', 'Acción'].map((title, index) => <th key={title} className={`px-3 py-2.5 font-semibold text-gray-600 ${index === 6 ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">
          {!resultado && !cargando && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500"><div className="font-medium text-gray-600">Aún no se ha realizado una consulta</div><div className="mt-1">Aplique un filtro y pulse Consultar para mostrar documentos.</div></td></tr>}
          {cargando && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Consultando documentos…</td></tr>}
          {resultado && !cargando && !items.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No se encontraron documentos con los filtros aplicados.</td></tr>}
          {!cargando && items.map(documento => <tr key={documento.id} className="hoverable">
            <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{documento.fecha}</td>
            <td className="px-3 py-2 font-mono text-gray-700">{documento.comprobante}</td>
            <td className="px-3 py-2 text-gray-600">{documento.tipoDocumento}</td>
            <td className="px-3 py-2 font-mono font-medium text-gray-800">{documento.documento}</td>
            <td className="px-3 py-2 font-mono text-gray-600">{documento.nit || '—'}</td>
            <td title={documento.detalle} className="max-w-72 truncate px-3 py-2 text-gray-600">{documento.tercero || documento.detalle || '—'}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(documento.valor)}</td>
            <td className="px-3 py-2"><button type="button" disabled={detalleCargando} onClick={() => void revisar(documento)} className="whitespace-nowrap text-xs font-medium text-petroleum-600 hover:underline disabled:opacity-50">Revisar anulación</button></td>
          </tr>)}
        </tbody>
      </table>
      {resultado && <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5"><span className="text-xs text-gray-500">{items.length} documentos · página {resultado.page}</span><div className="ml-auto flex gap-2"><button type="button" disabled={resultado.page <= 1 || cargando} onClick={() => void consultar(resultado.page - 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">← Anterior</button><button type="button" disabled={!resultado.hasMore || cargando} onClick={() => void consultar(resultado.page + 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">Siguiente →</button></div></div>}
    </div>

    {detalleCargando && <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Cargando partidas del documento…</div>}
    {seleccionado && !detalleCargando && <div className="space-y-4 rounded border border-amber-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-gray-800">Documento {seleccionado.documento}</h2><p className="mt-1 text-xs text-gray-500">Revise cuidadosamente las partidas. La anulación retirará el documento del movimiento contable.</p></div><button type="button" onClick={() => { setSeleccionado(null); setDetalle([]); }} className="text-xs text-gray-500 hover:text-gray-700">Cerrar</button></div>
      <div className="overflow-x-auto rounded border border-gray-200"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Cuenta', 'Nombre', 'Tercero', 'Centro', 'Concepto', 'Débito', 'Crédito'].map((title, index) => <th key={title} className={`px-3 py-2 font-semibold text-gray-600 ${index >= 5 ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr></thead><tbody className="divide-y divide-gray-50">{detalle.map((line, index) => <tr key={`${line.id}-${index}`}><td className="px-3 py-2 font-mono text-gray-700">{line.cuenta}</td><td className="px-3 py-2 text-gray-600">{line.nombreCuenta}</td><td className="px-3 py-2 font-mono text-gray-600">{line.nit || '—'}</td><td className="px-3 py-2 text-gray-600">{line.centro || '—'}</td><td className="max-w-72 truncate px-3 py-2 text-gray-500">{line.concepto}</td><td className="px-3 py-2 text-right font-mono">{line.debito ? fmtCOP(line.debito) : '—'}</td><td className="px-3 py-2 text-right font-mono">{line.credito ? fmtCOP(line.credito) : '—'}</td></tr>)}</tbody><tfoot className="border-t bg-gray-50"><tr><td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-600">Totales</td><td className="px-3 py-2 text-right font-mono font-semibold">{fmtCOP(totalDebito)}</td><td className="px-3 py-2 text-right font-mono font-semibold">{fmtCOP(totalCredito)}</td></tr></tfoot></table></div>
      <div><label className="mb-1 block text-xs font-medium text-gray-700">Motivo de la anulación <span className="text-red-500">*</span></label><textarea value={motivo} maxLength={180} onChange={event => setMotivo(event.target.value)} rows={2} placeholder="Explique por qué se anula el documento" className={INPUT} /><div className="mt-1 text-right text-[11px] text-gray-400">{motivo.length}/180</div></div>
      <div className="flex justify-end"><button type="button" disabled={anulando || motivo.trim().length < 5 || Math.abs(totalDebito - totalCredito) > 0.01} onClick={() => setConfirmar(true)} className="rounded bg-red-600 px-4 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">Anular documento</button></div>
    </div>}

    {confirmar && seleccionado && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-annulment-title"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><h2 id="confirm-annulment-title" className="text-base font-semibold text-gray-900">Confirmar anulación</h2><p className="mt-2 text-sm text-gray-600">Se retirará definitivamente el documento <strong>{seleccionado.documento}</strong> y se recalcularán los saldos afectados. Esta operación no se puede deshacer desde esta pantalla.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmar(false)} className="rounded border border-gray-300 px-4 py-2 text-xs text-gray-700">Cancelar</button><button type="button" onClick={() => void ejecutarAnulacion()} className="rounded bg-red-600 px-4 py-2 text-xs font-medium text-white">Sí, anular documento</button></div></div></div>}
  </div>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>;
}

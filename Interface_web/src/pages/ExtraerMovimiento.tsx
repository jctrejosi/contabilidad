import { useEffect, useState } from 'react';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import { listarComprobantes, type ComprobanteReal } from '../api/comprobantes';
import { listarTiposDocumento, type TipoDocumentoReal } from '../api/tiposDocumento';
import { confirmarExtraccion, previsualizarExtraccion, type ModoExtraccion, type ResumenExtraccion, type SolicitudExtraccion } from '../api/extraccionMovimiento';
import type { CompaniaSesion } from '../types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const INPUT = 'w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none focus:border-[#0073C0]';

export default function ExtraerMovimiento({ compania, onClose }: { compania: CompaniaSesion; onClose: () => void }) {
  const [anio, setAnio] = useState<number | null>(null);
  const [mes, setMes] = useState(1);
  const [modo, setModo] = useState<ModoExtraccion>('comprobante');
  const [lote, setLote] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [documentoDesde, setDocumentoDesde] = useState('');
  const [documentoHasta, setDocumentoHasta] = useState('');
  const [comprobantes, setComprobantes] = useState<ComprobanteReal[]>([]);
  const [tipos, setTipos] = useState<TipoDocumentoReal[]>([]);
  const [resumen, setResumen] = useState<ResumenExtraccion | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void Promise.all([consultarPeriodoOperacion(compania.codigo), listarComprobantes(compania.codigo), listarTiposDocumento()])
      .then(([periodo, comprobantesResponse, tiposResponse]) => {
        if (!activo) return;
        setAnio(periodo.anio);
        setMes(Number(periodo.periodoSugerido.slice(5, 7)) || 1);
        setComprobantes(comprobantesResponse.items);
        setTipos(tiposResponse.items);
      })
      .catch(cause => { if (activo) setError(cause instanceof Error ? cause.message : 'No fue posible cargar los filtros.'); });
    return () => { activo = false; };
  }, [compania.codigo]);

  function reset() { setResumen(null); setCompletado(false); setConfirmacion(''); setError(null); }

  function payload(): SolicitudExtraccion {
    if (anio === null) throw new Error('No se ha determinado el ejercicio.');
    return { cia: compania.codigo, anio, mes, modo, lote: lote.trim().toUpperCase(),
      comprobante: modo === 'comprobante' ? comprobante : '',
      tipoDocumento: modo === 'completo' ? '' : tipoDocumento,
      documentoDesde: modo === 'documentos' ? documentoDesde.trim() : '',
      documentoHasta: modo === 'documentos' ? documentoHasta.trim() : '' };
  }

  async function preview() {
    setCargando(true); setError(null); setResumen(null);
    try { setResumen(await previsualizarExtraccion(payload())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible previsualizar la extracción.'); }
    finally { setCargando(false); }
  }

  async function confirm() {
    if (!resumen || confirmacion !== 'EXTRACTAR' || motivo.trim().length < 5) return;
    setCargando(true); setError(null);
    try {
      setResumen(await confirmarExtraccion({ ...payload(), huella: resumen.huella, usuario: 'WEB', motivo: motivo.trim() }));
      setCompletado(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible confirmar la extracción.'); }
    finally { setCargando(false); }
  }

  const money = (value: number) => value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div><h2 className="text-sm font-semibold text-gray-800">Extractar movimiento</h2><p className="mt-1 text-xs text-gray-500">Traslada partidas contabilizadas a un lote nuevo para revisión o corrección.</p></div>
          <button type="button" onClick={onClose} disabled={cargando} className="text-lg text-gray-400 disabled:opacity-40">×</button>
        </div>
        <div className="space-y-4 p-5 text-xs">
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">Esta operación retira el movimiento seleccionado de la contabilidad y recalcula sus saldos. Primero revise la vista previa; el lote quedará sin actualizar hasta que lo verifique.</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><span className="block text-gray-500">Compañía</span><strong>{compania.codigo} — {compania.nombre}</strong></div>
            <label>Alcance<select className={INPUT} value={modo} disabled={completado || cargando} onChange={event => { setModo(event.target.value as ModoExtraccion); reset(); }}><option value="comprobante">Por comprobante</option><option value="documentos">Por rango de documentos</option><option value="completo">Movimiento completo del mes</option></select></label>
            <label>Año<input className={INPUT} type="number" min="1900" max="2100" value={anio ?? ''} disabled={completado || cargando} onChange={event => { setAnio(Number(event.target.value)); reset(); }} /></label>
            <label>Mes<select className={INPUT} value={mes} disabled={completado || cargando} onChange={event => { setMes(Number(event.target.value)); reset(); }}>{MESES.map((name, index) => <option key={name} value={index + 1}>{String(index + 1).padStart(2, '0')} — {name}</option>)}</select></label>
            <label>Lote nuevo (4 caracteres)<input className={INPUT} value={lote} maxLength={4} disabled={completado || cargando} onChange={event => { setLote(event.target.value.toUpperCase()); reset(); }} /></label>
            {modo === 'comprobante' && <label>Comprobante<select className={INPUT} value={comprobante} disabled={completado || cargando} onChange={event => { setComprobante(event.target.value); reset(); }}><option value="">Seleccione…</option>{comprobantes.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></label>}
            {modo !== 'completo' && <label>Tipo de documento<select className={INPUT} value={tipoDocumento} disabled={completado || cargando} onChange={event => { setTipoDocumento(event.target.value); reset(); }}><option value="">Seleccione…</option>{tipos.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></label>}
            {modo === 'documentos' && <><label>Documento desde<input className={INPUT} value={documentoDesde} maxLength={12} disabled={completado || cargando} onChange={event => { setDocumentoDesde(event.target.value); reset(); }} /></label><label>Documento hasta<input className={INPUT} value={documentoHasta} maxLength={12} disabled={completado || cargando} onChange={event => { setDocumentoHasta(event.target.value); reset(); }} /></label></>}
          </div>
          {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
          {resumen && <div className="space-y-3 rounded border border-gray-200 p-3">
            <h3 className="font-semibold text-gray-800">{completado ? 'Extracción completada' : 'Vista previa'}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div>Partidas<strong className="block">{resumen.partidas.toLocaleString('es-CO')}</strong></div><div>Documentos<strong className="block">{resumen.documentos.toLocaleString('es-CO')}</strong></div><div>Débitos<strong className="block">{money(resumen.debito)}</strong></div><div>Créditos<strong className="block">{money(resumen.credito)}</strong></div></div>
            <div>Diferencia: <strong>{money(resumen.diferencia)}</strong> · Documentos descuadrados: <strong>{resumen.documentosDescuadrados}</strong></div>
            {resumen.advertencias.map(item => <p key={item} className="rounded bg-amber-50 p-2 text-amber-800">{item}</p>)}
            {resumen.advertenciaAuditoria && <p className="rounded bg-amber-50 p-2 text-amber-800">{resumen.advertenciaAuditoria}</p>}
            {!completado && <><label className="block">Motivo de la extracción<input className={INPUT} value={motivo} maxLength={180} onChange={event => setMotivo(event.target.value)} /></label><label className="block">Escriba EXTRACTAR para confirmar<input className={INPUT} value={confirmacion} onChange={event => setConfirmacion(event.target.value)} /></label></>}
            {completado && <p className="rounded bg-green-50 p-2 font-medium text-green-800">El movimiento fue trasladado al lote {resumen.lote}. Revíselo antes de actualizarlo.</p>}
          </div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} disabled={cargando} className="rounded border border-gray-200 px-4 py-2 text-xs disabled:opacity-40">Cerrar</button>
          {!completado && <button type="button" onClick={() => void preview()} disabled={cargando || anio === null || lote.trim().length !== 4} className="rounded bg-[#0073C0] px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">{cargando ? 'Procesando…' : 'Vista previa'}</button>}
          {resumen && !completado && <button type="button" onClick={() => void confirm()} disabled={cargando || confirmacion !== 'EXTRACTAR' || motivo.trim().length < 5} className="rounded bg-red-600 px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">Confirmar extracción</button>}
        </div>
      </div>
    </div>
  );
}

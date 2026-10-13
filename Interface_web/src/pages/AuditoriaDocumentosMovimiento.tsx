import { useEffect, useMemo, useState } from 'react';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import { auditarDocumentosMovimiento, type ResultadoAuditoriaMovimiento } from '../api/auditoriaDocumentosMovimiento';
import type { CompaniaSesion } from '../types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TIPOS: Record<string, string> = {
  documento_descuadrado: 'Documento descuadrado',
  cuenta_inexistente: 'Cuenta inexistente',
  tercero_faltante: 'Tercero faltante',
  tercero_inexistente: 'Tercero inexistente',
  tercero_inesperado: 'Tercero no requerido',
  centro_faltante: 'Centro faltante',
  centro_inexistente: 'Centro inexistente',
  centro_inesperado: 'Centro no requerido',
};

export default function AuditoriaDocumentosMovimiento({ compania, onClose }: { compania: CompaniaSesion; onClose: () => void }) {
  const [anio, setAnio] = useState<number | null>(null);
  const [mes, setMes] = useState(1);
  const [resultado, setResultado] = useState<ResultadoAuditoriaMovimiento | null>(null);
  const [tipo, setTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void consultarPeriodoOperacion(compania.codigo)
      .then(periodo => {
        if (!activo) return;
        setAnio(periodo.anio);
        setMes(Number(periodo.periodoSugerido.slice(5, 7)) || 1);
      })
      .catch(cause => { if (activo) setError(cause instanceof Error ? cause.message : 'No fue posible consultar el período.'); });
    return () => { activo = false; };
  }, [compania.codigo]);

  const incidencias = useMemo(() => {
    const query = busqueda.trim().toLocaleLowerCase();
    return (resultado?.incidencias ?? []).filter(item =>
      (tipo === 'todos' || item.tipo === tipo) &&
      (!query || [item.documento, item.comprobante, item.tipoDocumento, item.cuenta,
        item.tercero, item.centro, item.mensaje].some(value => value.toLocaleLowerCase().includes(query))));
  }, [resultado, tipo, busqueda]);

  async function consultar() {
    if (anio === null) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      setResultado(await auditarDocumentosMovimiento(compania.codigo, anio, mes));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible completar la auditoría.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Análisis de documentos y movimiento mensual</h2>
            <p className="mt-1 text-xs text-gray-500">Detecta descuadres y datos inconsistentes. No modifica registros.</p>
          </div>
          <button type="button" onClick={onClose} disabled={cargando} className="text-lg text-gray-400 hover:text-gray-600 disabled:opacity-40">×</button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
            <div><span className="block text-gray-500">Compañía</span><strong>{compania.codigo} — {compania.nombre}</strong></div>
            <label className="block text-gray-600">Año
              <input type="number" min="1900" max="2100" value={anio ?? ''} onChange={event => { setAnio(Number(event.target.value)); setResultado(null); }} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5" />
            </label>
            <label className="block text-gray-600">Mes
              <select value={mes} onChange={event => { setMes(Number(event.target.value)); setResultado(null); }} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5">
                {MESES.map((name, index) => <option key={name} value={index + 1}>{String(index + 1).padStart(2, '0')} — {name}</option>)}
              </select>
            </label>
            <div className="flex items-end"><button type="button" onClick={() => void consultar()} disabled={cargando || anio === null || anio < 1900 || anio > 2100} className="w-full rounded bg-[#0073C0] px-3 py-2 font-medium text-white disabled:bg-gray-300">{cargando ? 'Analizando…' : 'Consultar'}</button></div>
          </div>
          {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          {resultado && <>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded bg-gray-50 p-3"><span className="block text-gray-500">Partidas revisadas</span><strong>{resultado.partidas.toLocaleString('es-CO')}</strong></div>
              <div className="rounded bg-gray-50 p-3"><span className="block text-gray-500">Documentos</span><strong>{resultado.documentos.toLocaleString('es-CO')}</strong></div>
              <div className="rounded bg-amber-50 p-3"><span className="block text-amber-700">Descuadrados</span><strong>{resultado.documentosDescuadrados.toLocaleString('es-CO')}</strong></div>
              <div className="rounded bg-red-50 p-3"><span className="block text-red-700">Incidencias</span><strong>{resultado.incidencias.length.toLocaleString('es-CO')}</strong></div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <label>Tipo de incidencia
                <select value={tipo} onChange={event => setTipo(event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5">
                  <option value="todos">Todas</option>
                  {Object.entries(TIPOS).map(([key, label]) => <option key={key} value={key}>{label} ({resultado.conteos[key] ?? 0})</option>)}
                </select>
              </label>
              <label>Buscar en el resultado
                <input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Documento, cuenta, tercero, centro…" className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5" />
              </label>
            </div>
            {incidencias.length === 0 ? <p className="rounded bg-green-50 p-4 text-sm text-green-800">No se encontraron incidencias con estos filtros.</p> :
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-100 text-gray-600"><tr>{['Incidencia', 'Comprobante', 'Tipo', 'Documento', 'Fecha', 'Cuenta', 'Tercero', 'Centro', 'Detalle'].map(label => <th key={label} className="whitespace-nowrap px-2 py-2 font-semibold">{label}</th>)}</tr></thead>
                  <tbody>{incidencias.map((item, index) => <tr key={`${index}-${item.tipo}`} className="border-t border-gray-100 even:bg-gray-50">
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-red-700">{TIPOS[item.tipo] ?? item.tipo}</td>
                    <td className="px-2 py-2">{item.comprobante}</td><td className="px-2 py-2">{item.tipoDocumento}</td>
                    <td className="px-2 py-2">{item.documento}</td><td className="whitespace-nowrap px-2 py-2">{item.fecha}</td>
                    <td className="px-2 py-2">{item.cuenta}</td><td className="px-2 py-2">{item.tercero}</td><td className="px-2 py-2">{item.centro}</td>
                    <td className="min-w-52 px-2 py-2">{item.mensaje}{item.diferencia !== undefined ? ` Diferencia: ${item.diferencia.toLocaleString('es-CO', { minimumFractionDigits: 2 })}` : ''}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
          </>}
        </div>
        <div className="flex justify-end border-t border-gray-100 px-5 py-3"><button type="button" onClick={onClose} disabled={cargando} className="rounded border border-gray-200 px-4 py-2 text-xs text-gray-700 disabled:opacity-40">Cerrar</button></div>
      </div>
    </div>
  );
}

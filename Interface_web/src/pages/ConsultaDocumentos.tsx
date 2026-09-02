import { useState } from 'react';
import { COMPROBANTES, MOVIMIENTOS_FEB, fmtCOP } from '../data/mock';
import type { MovimientoLinea } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const SELECT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';

interface Props {
  onOpenDocumento?: () => void;
}

interface GrupoDocumento {
  fecha: string;
  comprobante: string;
  tipoDoc: string;
  documento: string;
  nit: string;
  tercero: string;
  lineas: MovimientoLinea[];
  totalDebito: number;
  totalCredito: number;
}

const TIPOS_DOC = Array.from(new Set(MOVIMIENTOS_FEB.map(m => m.tipoDoc)));

function agruparDocumentos(): GrupoDocumento[] {
  const porDocumento = new Map<string, MovimientoLinea[]>();
  for (const m of MOVIMIENTOS_FEB) {
    const existente = porDocumento.get(m.documento) ?? [];
    existente.push(m);
    porDocumento.set(m.documento, existente);
  }
  return Array.from(porDocumento.entries()).map(([documento, lineas]) => {
    const principal = lineas.find(l => l.tercero) ?? lineas[0];
    return {
      fecha: lineas[0].fecha,
      comprobante: lineas[0].comprobante,
      tipoDoc: lineas[0].tipoDoc,
      documento,
      nit: principal.nit,
      tercero: principal.tercero,
      lineas,
      totalDebito: lineas.reduce((s, l) => s + l.debito, 0),
      totalCredito: lineas.reduce((s, l) => s + l.credito, 0),
    };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export default function ConsultaDocumentos({ onOpenDocumento }: Props) {
  const [periodo, setPeriodo] = useState('2026-02');
  const [comprobante, setComprobante] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [nit, setNit] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  const documentos = agruparDocumentos();
  const filtrados = documentos.filter(d => {
    if (comprobante && !d.comprobante.startsWith(comprobante)) return false;
    if (tipoDoc && d.tipoDoc !== tipoDoc) return false;
    if (nit && !d.nit.includes(nit)) return false;
    if (desde && d.fecha < desde) return false;
    if (hasta && d.fecha > hasta) return false;
    if (periodo && d.fecha.slice(0, 7) !== periodo) return false;
    return true;
  });
  const totalDeb = filtrados.reduce((s, d) => s + d.totalDebito, 0);
  const totalCred = filtrados.reduce((s, d) => s + d.totalCredito, 0);

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Consultas / Documentos</div>
          <h1 className="text-lg font-semibold text-gray-800">Consulta general de documentos</h1>
          <p className="mt-1 text-xs text-gray-500">Búsqueda de documentos contables por período, comprobante, tipo, NIT y fechas.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
          <button type="button" onClick={() => window.print()} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
          <div className="relative">
            <button type="button" onClick={() => setShowExport(v => !v)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar ▾</button>
            {showExport && (
              <div className="absolute right-0 top-8 bg-white rounded border border-gray-200 shadow-lg z-20 py-1 w-36">
                {['PDF', 'XLSX', 'CSV'].map(f => (
                  <button key={f} type="button" onClick={() => setShowExport(false)} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">{f}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 p-3">
        <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
          <legend className="px-2 text-xs font-semibold text-petroleum-800">Filtros</legend>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Período</label>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} className={INPUT} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Comprobante</label>
              <select value={comprobante} onChange={e => setComprobante(e.target.value)} className={SELECT}>
                <option value="">Todos</option>
                {COMPROBANTES.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Tipo de documento</label>
              <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} className={SELECT}>
                <option value="">Todos</option>
                {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">NIT</label>
              <input value={nit} onChange={e => setNit(e.target.value)} placeholder="900.123.456" className={`${INPUT} font-mono`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Fecha desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={`${INPUT} font-mono`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Fecha hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={`${INPUT} font-mono`} />
            </div>
          </div>
        </fieldset>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Comprobante</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Documento</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tercero</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(d => (
                <DocumentoFila
                  key={d.documento}
                  grupo={d}
                  expandido={expandido === d.documento}
                  onToggle={() => setExpandido(expandido === d.documento ? null : d.documento)}
                  onOpenDocumento={onOpenDocumento}
                />
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-2xl mb-2 text-gray-300">⊟</div>
            <div className="text-xs text-gray-500">Sin resultados — ajuste los filtros o el período para encontrar documentos.</div>
          </div>
        ) : (
          <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50 border-t border-gray-200">
            <span className="text-xs text-gray-500">{filtrados.length} documento{filtrados.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-gray-500">Total débitos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalDeb)}</span></span>
            <span className="text-xs text-gray-500">Total créditos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalCred)}</span></span>
            <span className={`text-xs font-mono font-semibold ${totalDeb === totalCred ? 'text-green-600' : 'text-red-600'}`}>
              Diferencia: {fmtCOP(Math.abs(totalDeb - totalCred))}
            </span>
          </div>
        )}
      </div>

      {showExport && <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />}
    </div>
  );
}

function DocumentoFila({ grupo, expandido, onToggle, onOpenDocumento }: {
  grupo: GrupoDocumento;
  expandido: boolean;
  onToggle: () => void;
  onOpenDocumento?: () => void;
}) {
  const cuadrado = grupo.totalDebito === grupo.totalCredito;
  return (
    <>
      <tr className="hoverable">
        <td className="px-3 py-2 font-mono text-gray-600">{grupo.fecha}</td>
        <td className="px-3 py-2 font-mono text-gray-700 font-medium">{grupo.comprobante}</td>
        <td className="px-3 py-2 text-gray-600">{grupo.tipoDoc}</td>
        <td className="px-3 py-2 font-mono text-gray-600">{grupo.documento}</td>
        <td className="px-3 py-2 font-mono text-gray-600">{grupo.nit || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{grupo.tercero || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2 text-right font-mono text-gray-800">{grupo.totalDebito > 0 ? fmtCOP(grupo.totalDebito) : <span className="text-gray-200">—</span>}</td>
        <td className="px-3 py-2 text-right font-mono text-gray-500">{grupo.totalCredito > 0 ? fmtCOP(grupo.totalCredito) : <span className="text-gray-200">—</span>}</td>
        <td className="px-3 py-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cuadrado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {cuadrado ? 'Cuadrada' : 'Descuadrada'}
          </span>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <button type="button" onClick={onToggle} className="text-xs text-petroleum-600 hover:underline mr-3">
            {expandido ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
          <button type="button" onClick={onOpenDocumento} className="text-xs text-petroleum-600 hover:underline">Documento oficial</button>
        </td>
      </tr>
      {expandido && (
        <tr>
          <td colSpan={10} className="px-3 py-3 bg-gray-50/60">
            <div className="rounded border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre cuenta</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Centro</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Débito</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Crédito</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {grupo.lineas.map(l => (
                    <tr key={l.id}>
                      <td className="px-3 py-1.5 font-mono text-gray-700">{l.cuenta}</td>
                      <td className="px-3 py-1.5 text-gray-600">{l.nombreCuenta}</td>
                      <td className="px-3 py-1.5 text-gray-600">{l.centro || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-800">{l.debito > 0 ? fmtCOP(l.debito) : <span className="text-gray-200">—</span>}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-500">{l.credito > 0 ? fmtCOP(l.credito) : <span className="text-gray-200">—</span>}</td>
                      <td className="px-3 py-1.5 text-gray-500">{l.concepto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

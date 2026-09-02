import { useState } from 'react';
import { MOVIMIENTOS_FEB, fmtCOP } from '../data/mock';
import type { MovimientoLinea } from '../types';

export default function Anulacion() {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDoc, setFiltroDoc] = useState('');
  const [selected, setSelected] = useState<MovimientoLinea | null>(null);
  const [step, setStep] = useState<'buscar' | 'preview' | 'confirmado'>('buscar');
  const [motivo, setMotivo] = useState('');
  const [periodoRev, setPeriodoRev] = useState('2026-02');
  const [comprobanteRev, setComprobanteRev] = useState('NO');

  const docGroups = MOVIMIENTOS_FEB.reduce((acc, m) => {
    if (!acc[m.documento]) acc[m.documento] = [];
    acc[m.documento].push(m);
    return acc;
  }, {} as Record<string, MovimientoLinea[]>);

  const docs = Object.keys(docGroups).filter(d => {
    if (busqueda && !d.toLowerCase().includes(busqueda.toLowerCase())) return false;
    if (filtroDoc && !d.toLowerCase().includes(filtroDoc.toLowerCase())) return false;
    return true;
  });

  function handleAnular() {
    if (!motivo.trim()) return;
    setStep('confirmado');
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Anulación de documentos</h1>
          <p className="text-xs text-gray-500">Genera un asiento inverso trazable — el movimiento original no se elimina</p>
        </div>
      </div>

      {step === 'buscar' && (
        <>
          {/* Search filters */}
          <div className="bg-white rounded border border-gray-200 p-4">
            <h2 className="text-xs font-semibold text-gray-700 mb-3">Buscar documento a anular</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
                <input type="month" defaultValue="2026-02"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">N.° documento</label>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="NOM-2026-02..."
                  className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante</label>
                <input value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                  placeholder="CE, CI..."
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
              </div>
              <div className="flex items-end">
                <button className="w-full text-xs py-1.5 rounded font-medium text-white" style={{ backgroundColor: '#0073C0' }}>
                  Buscar
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">
              Documentos encontrados
            </div>
            {docs.map(doc => {
              const lines = docGroups[doc];
              const deb = lines.reduce((s, l) => s + l.debito, 0);
              const cred = lines.reduce((s, l) => s + l.credito, 0);
              const firstLine = lines[0];
              return (
                <div
                  key={doc}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors"
                  onClick={() => { setSelected(firstLine); setStep('preview'); }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-gray-800 text-sm">{doc}</span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-500">{firstLine.comprobante}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Contabilizado</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{firstLine.fecha} · {lines.length} líneas</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs text-gray-700 font-semibold">{fmtCOP(deb)}</div>
                    <div className="text-xs text-gray-400">{firstLine.origen}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {step === 'preview' && selected && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('buscar')} className="text-xs text-gray-500 hover:text-gray-700">← Volver</button>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-medium text-gray-800">Anular {selected.documento}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Original document */}
            <div className="bg-white rounded border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">Documento original</h3>
              <div className="space-y-1 text-xs">
                {MOVIMIENTOS_FEB.filter(m => m.documento === selected.documento).map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3 py-1 border-b border-gray-50">
                    <span className="text-gray-400 w-4">{i + 1}</span>
                    <span className="font-mono w-16 text-gray-600">{l.cuenta}</span>
                    <span className="flex-1 text-gray-600 truncate">{l.nombreCuenta}</span>
                    <span className="font-mono text-gray-800">{l.debito > 0 ? fmtCOP(l.debito) : ''}</span>
                    <span className="font-mono text-gray-500">{l.credito > 0 ? `(${fmtCOP(l.credito)})` : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reversal preview */}
            <div className="bg-white rounded border border-amber-200 p-4" style={{ backgroundColor: '#FFFBEB' }}>
              <h3 className="text-xs font-semibold text-amber-700 mb-3">Vista previa del asiento inverso</h3>
              <div className="space-y-1 text-xs">
                {MOVIMIENTOS_FEB.filter(m => m.documento === selected.documento).map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3 py-1 border-b border-amber-100">
                    <span className="text-amber-400 w-4">{i + 1}</span>
                    <span className="font-mono w-16 text-amber-700">{l.cuenta}</span>
                    <span className="flex-1 text-amber-700 truncate">{l.nombreCuenta}</span>
                    <span className="font-mono text-amber-800">{l.credito > 0 ? fmtCOP(l.credito) : ''}</span>
                    <span className="font-mono text-amber-600">{l.debito > 0 ? `(${fmtCOP(l.debito)})` : ''}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-amber-600 italic">Débitos y créditos invertidos</div>
            </div>
          </div>

          {/* Reversal parameters */}
          <div className="bg-white rounded border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">Parámetros de la reversión</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Período reversión</label>
                <input type="month" value={periodoRev} onChange={e => setPeriodoRev(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante</label>
                <input value={comprobanteRev} onChange={e => setComprobanteRev(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de anulación <span className="text-red-500">*</span></label>
                <input
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Descripción del motivo de la anulación..."
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep('buscar')} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={handleAnular}
              disabled={!motivo.trim()}
              className={`text-xs px-4 py-2 rounded font-medium text-white ${motivo.trim() ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
              style={{ backgroundColor: '#DC2626' }}
            >
              ⊘ Anular documento
            </button>
          </div>
        </div>
      )}

      {step === 'confirmado' && (
        <div className="bg-white rounded border border-green-200 p-6 text-center space-y-3">
          <div className="text-3xl text-green-500">✓</div>
          <h3 className="text-sm font-semibold text-gray-800">Anulación completada</h3>
          <p className="text-xs text-gray-500">Se generó el asiento inverso como nota de contabilidad NO-000089 en el período {periodoRev}.</p>
          <p className="text-xs text-gray-400">El documento original permanece intacto y enlazado a esta reversión.</p>
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => { setStep('buscar'); setBusqueda(''); setSelected(null); setMotivo(''); }}
              className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
              Nueva anulación
            </button>
            <button className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
              Ver asiento inverso
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

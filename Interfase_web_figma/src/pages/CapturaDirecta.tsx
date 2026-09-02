import { useState } from 'react';
import { CUENTAS, TERCEROS, CENTROS, COMPROBANTES, fmtCOP } from '../data/mock';

interface Linea {
  id: number;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  tercero: string;
  centro: string;
  documento: string;
  debito: string;
  credito: string;
  base: string;
  concepto: string;
}

let lineId = 1;
function newLine(): Linea {
  return { id: lineId++, cuenta: '', nombreCuenta: '', nit: '', tercero: '', centro: '', documento: '', debito: '', credito: '', base: '', concepto: '' };
}

function parseCOP(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

export default function CapturaDirecta() {
  const [periodo, setPeriodo] = useState('2026-02');
  const [fecha, setFecha] = useState('2026-02-28');
  const [comprobante, setComprobante] = useState('CE');
  const [tipoDoc, setTipoDoc] = useState('');
  const [numDoc, setNumDoc] = useState('');
  const [terceroHdr, setTerceroHdr] = useState('');
  const [concepto, setConcepto] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([newLine(), newLine()]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [posted, setPosted] = useState(false);
  const [showCuentaPicker, setShowCuentaPicker] = useState<number | null>(null);
  const [cuentaSearch, setCuentaSearch] = useState('');

  const cuentasAfectables = CUENTAS.filter(c => c.afectable);

  const totalDeb = lineas.reduce((s, l) => s + parseCOP(l.debito), 0);
  const totalCred = lineas.reduce((s, l) => s + parseCOP(l.credito), 0);
  const diff = totalDeb - totalCred;
  const isBalanced = diff === 0 && totalDeb > 0;

  function updateLine(id: number, field: keyof Linea, value: string) {
    setLineas(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'cuenta') {
        const cuenta = cuentasAfectables.find(c => c.codigo === value);
        if (cuenta) updated.nombreCuenta = cuenta.nombre;
      }
      if (field === 'tercero') {
        const t = TERCEROS.find(t => t.nombre === value);
        if (t) updated.nit = t.nit;
      }
      return updated;
    }));
    setShowCuentaPicker(null);
  }

  function addLine() {
    setLineas(prev => [...prev, newLine()]);
  }

  function deleteLine(id: number) {
    setLineas(prev => prev.filter(l => l.id !== id));
  }

  const filteredCuentas = cuentasAfectables.filter(c => {
    const q = cuentaSearch.toLowerCase();
    return c.codigo.includes(q) || c.nombre.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-800">Captura directa</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">F5 Plantilla</button>
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">F6 Importar Excel</button>
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Guardar borrador</button>
          <button
            disabled={!isBalanced || posted}
            onClick={() => setShowConfirm(true)}
            className={`text-xs px-3 py-1.5 rounded font-medium text-white transition-colors ${isBalanced && !posted ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
            style={{ backgroundColor: '#0073C0' }}
          >
            F2 Validar / Contabilizar
          </button>
        </div>
      </div>

      {/* Header form */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante</label>
            <select value={comprobante} onChange={e => setComprobante(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              {COMPROBANTES.map(c => (
                <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento</label>
            <input value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} placeholder="FV, OR, NOM..."
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">N.° documento</label>
            <input value={numDoc} onChange={e => setNumDoc(e.target.value)} placeholder="000001"
              className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tercero header</label>
            <select value={terceroHdr} onChange={e => setTerceroHdr(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              <option value="">— Sin tercero —</option>
              {TERCEROS.map(t => <option key={t.nit} value={t.nit}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Concepto general</label>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción del comprobante..."
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 max-w-xl" />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto table-fixed-header">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-6">#</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-24">Cuenta</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-44">Nombre cuenta</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-44">Tercero</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-20">Centro</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-32">Documento</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-28">Débito</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-28">Crédito</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-24">Base</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 min-w-36">Concepto línea</th>
                <th className="px-2 py-2 border-b border-gray-200 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((line, idx) => (
                <tr
                  key={line.id}
                  className="border-b border-gray-100 hoverable"
                  onClick={() => setEditingId(line.id)}
                >
                  <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-1.5 relative">
                    <div className="flex items-center gap-1">
                      <input
                        className={`w-20 font-mono text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 ${editingId === line.id ? 'border-blue-300' : 'border-gray-200'}`}
                        value={line.cuenta}
                        onChange={e => updateLine(line.id, 'cuenta', e.target.value)}
                        onFocus={() => { setEditingId(line.id); setCuentaSearch(line.cuenta); setShowCuentaPicker(line.id); }}
                        onClick={e => e.stopPropagation()}
                        placeholder="código"
                      />
                      {showCuentaPicker === line.id && (
                        <div className="absolute top-8 left-0 z-20 bg-white border border-gray-200 rounded shadow-lg w-72">
                          <div className="p-2 border-b">
                            <input
                              autoFocus
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none"
                              placeholder="Buscar cuenta..."
                              value={cuentaSearch}
                              onChange={e => setCuentaSearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {filteredCuentas.slice(0, 15).map(c => (
                              <div
                                key={c.codigo}
                                className="px-3 py-1.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                onMouseDown={e => { e.preventDefault(); updateLine(line.id, 'cuenta', c.codigo); }}
                              >
                                <span className="font-mono text-gray-600 w-16 shrink-0">{c.codigo}</span>
                                <span className="text-gray-700 truncate">{c.nombre}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600 text-xs truncate max-w-44">
                    {line.nombreCuenta || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1"
                      value={line.tercero}
                      onChange={e => updateLine(line.id, 'tercero', e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">—</option>
                      {TERCEROS.map(t => <option key={t.nit} value={t.nombre}>{t.nombre}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1"
                      value={line.centro}
                      onChange={e => updateLine(line.id, 'centro', e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">—</option>
                      {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1"
                      value={line.documento}
                      onChange={e => updateLine(line.id, 'documento', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="doc..."
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right"
                      value={line.debito}
                      onChange={e => updateLine(line.id, 'debito', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right"
                      value={line.credito}
                      onChange={e => updateLine(line.id, 'credito', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right"
                      value={line.base}
                      onChange={e => updateLine(line.id, 'base', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1"
                      value={line.concepto}
                      onChange={e => updateLine(line.id, 'concepto', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="Concepto..."
                    />
                  </td>
                  <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => deleteLine(line.id)}
                      className="text-xs text-red-400 hover:text-red-600 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add line + totals */}
        <div className="shrink-0 border-t border-gray-200 bg-white">
          <button
            onClick={addLine}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors"
          >
            <span>+</span> Agregar línea (Enter)
          </button>
          {/* Totals */}
          <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">Total débitos:</span>
              <span className="font-mono font-bold text-gray-800">{fmtCOP(totalDeb)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">Total créditos:</span>
              <span className="font-mono font-bold text-gray-800">{fmtCOP(totalCred)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Diferencia:</span>
              <span className={`font-mono font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtCOP(Math.abs(diff))}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              isBalanced ? 'bg-green-100 text-green-700' : totalDeb === 0 ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
            }`}>
              {isBalanced ? '✓ Cuadrado' : totalDeb === 0 ? '— Sin datos' : '✗ Descuadrado'}
            </div>
            <div className="flex-1" />
            <div className="text-xs text-gray-400">{lineas.length} línea{lineas.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && !posted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Confirmar contabilización</h3>
            <p className="text-xs text-gray-600 mb-1">Comprobante: <strong>{comprobante}</strong></p>
            <p className="text-xs text-gray-600 mb-1">Período: <strong>{periodo}</strong></p>
            <p className="text-xs text-gray-600 mb-1">Líneas: <strong>{lineas.filter(l => parseCOP(l.debito) > 0 || parseCOP(l.credito) > 0).length}</strong></p>
            <p className="text-xs text-gray-600 mb-4">Total: <strong className="font-mono">{fmtCOP(totalDeb)}</strong></p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button
                onClick={() => { setShowConfirm(false); setPosted(true); }}
                className="text-xs px-4 py-2 rounded text-white font-medium"
                style={{ backgroundColor: '#0073C0' }}
              >
                Contabilizar
              </button>
            </div>
          </div>
        </div>
      )}

      {posted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="text-4xl mb-3 text-green-500">✓</div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Comprobante contabilizado</h3>
            <p className="text-xs text-gray-500 mb-4">El movimiento ha sido registrado exitosamente en el período {periodo}.</p>
            <button
              onClick={() => setPosted(false)}
              className="text-xs px-4 py-2 rounded text-white font-medium"
              style={{ backgroundColor: '#0073C0' }}
            >
              Nuevo comprobante
            </button>
          </div>
        </div>
      )}

      {/* Close picker on outside click */}
      {showCuentaPicker && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCuentaPicker(null)} />
      )}
    </div>
  );
}

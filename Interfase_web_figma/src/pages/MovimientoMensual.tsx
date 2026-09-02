import { useState } from 'react';
import { MOVIMIENTOS_FEB, CUENTAS, TERCEROS, fmtCOP } from '../data/mock';
import type { MovimientoLinea } from '../types';

interface Props {
  onOpenDocumento?: () => void;
}

export default function MovimientoMensual({ onOpenDocumento }: Props) {
  const [periodo, setPeriodo] = useState('2026-02');
  const [cuentaDesde, setCuentaDesde] = useState('');
  const [cuentaHasta, setCuentaHasta] = useState('');
  const [filterTercero, setFilterTercero] = useState('');
  const [filterComprobante, setFilterComprobante] = useState('');
  const [selected, setSelected] = useState<MovimientoLinea | null>(null);
  const [showExport, setShowExport] = useState(false);

  const cuentasAfectables = CUENTAS.filter(c => c.afectable);

  const filtered = MOVIMIENTOS_FEB.filter(m => {
    if (cuentaDesde && m.cuenta < cuentaDesde) return false;
    if (cuentaHasta && m.cuenta > cuentaHasta) return false;
    if (filterTercero && !m.tercero.toLowerCase().includes(filterTercero.toLowerCase())) return false;
    if (filterComprobante && !m.comprobante.toLowerCase().includes(filterComprobante.toLowerCase())) return false;
    return true;
  });

  const totalDeb = filtered.reduce((s, m) => s + m.debito, 0);
  const totalCred = filtered.reduce((s, m) => s + m.credito, 0);

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Movimiento mensual</h1>
          <p className="text-xs text-gray-500">Consulta de movimiento contable por período, cuenta, tercero y comprobante</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
          <div className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
            >
              ↓ Exportar ▾
            </button>
            {showExport && (
              <div className="absolute right-0 top-8 bg-white rounded border border-gray-200 shadow-lg z-20 py-1 w-36">
                {['PDF', 'XLSX', 'CSV'].map(f => (
                  <button
                    key={f}
                    onClick={() => setShowExport(false)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded border border-gray-200 p-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta desde</label>
            <input value={cuentaDesde} onChange={e => setCuentaDesde(e.target.value)} placeholder="100000"
              className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta hasta</label>
            <input value={cuentaHasta} onChange={e => setCuentaHasta(e.target.value)} placeholder="999999"
              className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tercero</label>
            <select value={filterTercero} onChange={e => setFilterTercero(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              <option value="">Todos</option>
              {TERCEROS.map(t => <option key={t.nit} value={t.nombre}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante</label>
            <input value={filterComprobante} onChange={e => setFilterComprobante(e.target.value)} placeholder="CE, CI, NOM..."
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div className="flex items-end">
            <button className="w-full text-xs py-1.5 rounded font-medium text-white" style={{ backgroundColor: '#0073C0' }}>
              Consultar
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Results table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fecha</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Comprobante</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo Doc</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Documento</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre cuenta</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tercero</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Centro</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(m => (
                    <tr
                      key={m.id}
                      className={`hoverable cursor-pointer ${selected?.id === m.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelected(m)}
                    >
                      <td className="px-3 py-2 font-mono text-gray-600">{m.fecha}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 font-medium">{m.comprobante}</td>
                      <td className="px-3 py-2 text-gray-600">{m.tipoDoc}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">{m.documento}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{m.cuenta}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-40 truncate">{m.nombreCuenta}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{m.tercero || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2">
                        {m.centro ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            m.centro === 'ADM' ? 'bg-blue-50 text-blue-700' :
                            m.centro === 'VEN' ? 'bg-green-50 text-green-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>{m.centro}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800">
                        {m.debito > 0 ? fmtCOP(m.debito) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">
                        {m.credito > 0 ? fmtCOP(m.credito) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-48 truncate">{m.concepto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50 border-t border-gray-200">
              <span className="text-xs text-gray-500">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
              <span className="text-xs text-gray-500">Total débitos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalDeb)}</span></span>
              <span className="text-xs text-gray-500">Total créditos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalCred)}</span></span>
              <span className={`text-xs font-mono font-semibold ${totalDeb === totalCred ? 'text-green-600' : 'text-red-600'}`}>
                Diferencia: {fmtCOP(Math.abs(totalDeb - totalCred))}
              </span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 shrink-0">
            <div className="bg-white rounded border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono font-bold text-gray-800">{selected.comprobante}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{selected.documento}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  ['Período', selected.periodo],
                  ['Fecha', selected.fecha],
                  ['Cuenta', `${selected.cuenta} — ${selected.nombreCuenta}`],
                  ['NIT', selected.nit || '—'],
                  ['Tercero', selected.tercero || '—'],
                  ['Centro', selected.centro || '—'],
                  ['Tipo Doc', selected.tipoDoc],
                  ['Doc. afectado', selected.docAfectado || '—'],
                  ['Origen', selected.origen],
                  ['Lote', selected.lote],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between gap-3">
                    <span className="text-gray-400 shrink-0">{label}</span>
                    <span className="text-gray-700 text-right text-xs font-mono truncate max-w-36">{val}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Débito</div>
                  <div className="font-mono font-bold text-gray-800">{selected.debito > 0 ? fmtCOP(selected.debito) : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Crédito</div>
                  <div className="font-mono font-bold text-gray-500">{selected.credito > 0 ? fmtCOP(selected.credito) : '—'}</div>
                </div>
              </div>

              <div className="pt-2">
                <div className="text-xs text-gray-400 mb-1">Concepto</div>
                <div className="text-xs text-gray-700">{selected.concepto}</div>
              </div>

              <button
                onClick={onOpenDocumento}
                className="w-full text-xs py-2 border rounded font-medium text-white transition-colors mt-2"
                style={{ backgroundColor: '#0073C0' }}
              >
                Ver documento oficial →
              </button>
            </div>
          </div>
        )}
      </div>

      {showExport && (
        <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
      )}
    </div>
  );
}

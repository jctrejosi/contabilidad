import { useState } from 'react';
import { SALDOS_BALANCE, fmtCOP } from '../data/mock';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function BalanceComprobacion() {
  const [anio, setAnio] = useState('2026');
  const [mesHasta, setMesHasta] = useState(2);
  const [tipoVista, setTipoVista] = useState<'acumulado' | 'mensual'>('acumulado');
  const [showExport, setShowExport] = useState(false);
  const [showParams, setShowParams] = useState(true);

  function saldoAcumulado(idx: number) {
    return SALDOS_BALANCE.map(c => {
      let saldo = c.saldoInicial;
      for (let i = 0; i < Math.min(mesHasta, c.meses.length); i++) {
        saldo += c.meses[i].debito - c.meses[i].credito;
      }
      return { ...c, saldoFinal: saldo };
    });
  }

  const rows = saldoAcumulado(mesHasta);
  const totalDebAcum = rows.reduce((s, r) => s + r.meses.slice(0, mesHasta).reduce((ss, m) => ss + m.debito, 0), 0);
  const totalCredAcum = rows.reduce((s, r) => s + r.meses.slice(0, mesHasta).reduce((ss, m) => ss + m.credito, 0), 0);
  const totalSaldos = rows.reduce((s, r) => s + Math.abs(r.saldoFinal), 0);

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Balance de comprobación</h1>
          <p className="text-xs text-gray-500">Saldos iniciales y movimientos acumulados por período — comprobante maestro</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParams(p => !p)}
            className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
          >
            {showParams ? '▴ Parámetros' : '▾ Parámetros'}
          </button>
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
          <div className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              className="text-xs px-3 py-1.5 rounded text-white font-medium flex items-center gap-1"
              style={{ backgroundColor: '#0073C0' }}
            >
              ↓ Exportar ▾
            </button>
            {showExport && (
              <div className="absolute right-0 top-9 bg-white rounded border border-gray-200 shadow-lg z-20 py-1 w-36">
                {['PDF', 'XLSX', 'CSV'].map(f => (
                  <button
                    key={f}
                    onClick={() => setShowExport(false)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {f === 'PDF' ? '📄 PDF' : f === 'XLSX' ? '📊 XLSX' : '📝 CSV'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Parameters */}
      {showParams && (
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Parámetros del informe</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
              <input
                type="number"
                value={anio}
                onChange={e => setAnio(e.target.value)}
                className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hasta mes</label>
              <select
                value={mesHasta}
                onChange={e => setMesHasta(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>{m} — {i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vista</label>
              <select
                value={tipoVista}
                onChange={e => setTipoVista(e.target.value as 'acumulado' | 'mensual')}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              >
                <option value="acumulado">Acumulado</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta desde</label>
              <input
                placeholder="100000"
                className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" defaultChecked />
              Solo cuentas con movimiento
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" />
              Incluir cuentas de orden
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" />
              Desglosar centros de costo
            </label>
          </div>
        </div>
      )}

      {/* Report */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        {/* Report header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="text-center space-y-0.5">
            <div className="text-sm font-bold text-gray-800">BALANCE DE COMPROBACIÓN ACUMULADO</div>
            <div className="text-xs text-gray-600">Compañía Demo S.A.S. — NIT 900.123.456-7</div>
            <div className="text-xs text-gray-500">Año {anio} — Acumulado enero a {MESES[mesHasta - 1]}</div>
          </div>
        </div>

        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 w-24">Cuenta</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Saldo inicial</th>
                {tipoVista === 'mensual' && MESES.slice(0, mesHasta).map(m => (
                  <th key={m} className="px-2 py-2.5 text-right font-semibold text-gray-600 w-24">{m}</th>
                ))}
                {tipoVista === 'acumulado' && (
                  <>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Débito acum.</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Crédito acum.</th>
                  </>
                )}
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Saldo final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => {
                const debAcum = row.meses.slice(0, mesHasta).reduce((s, m) => s + m.debito, 0);
                const credAcum = row.meses.slice(0, mesHasta).reduce((s, m) => s + m.credito, 0);
                return (
                  <tr key={row.cuenta} className="hoverable">
                    <td className="px-3 py-2 font-mono font-medium text-gray-700">{row.cuenta}</td>
                    <td className="px-3 py-2 text-gray-600">{row.nombre}</td>
                    <td className={`px-3 py-2 text-right font-mono ${row.saldoInicial > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                      {row.saldoInicial !== 0 ? fmtCOP(Math.abs(row.saldoInicial)) : '—'}
                    </td>
                    {tipoVista === 'mensual' && MESES.slice(0, mesHasta).map((mes, i) => (
                      <td key={mes} className="px-2 py-2 text-right font-mono text-gray-600">
                        {(row.meses[i]?.debito || 0) !== 0 || (row.meses[i]?.credito || 0) !== 0
                          ? fmtCOP((row.meses[i]?.debito || 0) - (row.meses[i]?.credito || 0))
                          : <span className="text-gray-200">—</span>
                        }
                      </td>
                    ))}
                    {tipoVista === 'acumulado' && (
                      <>
                        <td className="px-3 py-2 text-right font-mono text-gray-800">
                          {debAcum > 0 ? fmtCOP(debAcum) : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600">
                          {credAcum > 0 ? fmtCOP(credAcum) : <span className="text-gray-200">—</span>}
                        </td>
                      </>
                    )}
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${
                      row.saldoFinal > 0 ? 'text-green-700' : row.saldoFinal < 0 ? 'text-red-700' : 'text-gray-400'
                    }`}>
                      {row.saldoFinal !== 0 ? fmtCOP(Math.abs(row.saldoFinal)) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td className="px-3 py-2.5 font-bold text-gray-800 text-xs" colSpan={2}>TOTALES</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">
                  {fmtCOP(SALDOS_BALANCE.reduce((s, r) => s + r.saldoInicial, 0))}
                </td>
                {tipoVista === 'acumulado' && (
                  <>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(totalDebAcum)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(totalCredAcum)}</td>
                  </>
                )}
                {tipoVista === 'mensual' && MESES.slice(0, mesHasta).map(m => <td key={m} className="px-2 py-2.5 font-mono font-bold text-gray-800 text-right text-xs">—</td>)}
                <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(totalSaldos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Generado: {new Date().toLocaleDateString('es-CO')} {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · Usuario: Laura Gómez</span>
          <span className={totalDebAcum === totalCredAcum ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {totalDebAcum === totalCredAcum ? '✓ Cuadrado' : '✗ Descuadrado'}
          </span>
        </div>
      </div>

      {showExport && (
        <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
      )}
    </div>
  );
}

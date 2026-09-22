import { useEffect, useState } from 'react';
import {
  consultarBalanceComprobacion,
  exportarBalanceComprobacion,
  type BalanceComprobacion as BalanceComprobacionDatos,
  type FiltrosBalanceComprobacion,
} from '../api/balanceComprobacion';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
}).format(value);

interface Props {
  /** Compañía activa: CONMAE se consulta siempre dentro de una CIA. */
  cia: string;
}

interface Formulario {
  anio: string;
  mesDesde: number;
  mesHasta: number;
  nivel: 4 | 6 | 9 | 12;
  incluirCeros: boolean;
}

export default function BalanceComprobacion({ cia }: Props) {
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [consulta, setConsulta] = useState<FiltrosBalanceComprobacion | null>(null);
  const [balance, setBalance] = useState<BalanceComprobacionDatos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [showExport, setShowExport] = useState(false);

  // El año y el mes no se inventan: se toman del ejercicio de CONCTR que ya
  // alimenta al resto de informes.
  useEffect(() => {
    let vigente = true;
    setFormulario(null);
    setConsulta(null);
    setBalance(null);
    setError('');
    consultarPeriodoOperacion(cia)
      .then(periodo => {
        if (!vigente) return;
        const mesHasta = periodo.mesesHabilitados.at(-1) ?? 1;
        setFormulario({ anio: String(periodo.anio), mesDesde: 1, mesHasta, nivel: 6, incluirCeros: false });
        setConsulta({ cia, anio: periodo.anio, mesDesde: 1, mesHasta, nivel: 6, incluirCeros: false });
      })
      .catch((cause: unknown) => {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible consultar el período.');
      });
    return () => { vigente = false; };
  }, [cia]);

  useEffect(() => {
    if (!consulta) return;
    let vigente = true;
    setCargando(true);
    setError('');
    consultarBalanceComprobacion(consulta)
      .then(datos => { if (vigente) setBalance(datos); })
      .catch((cause: unknown) => {
        if (vigente) {
          setBalance(null);
          setError(cause instanceof Error ? cause.message : 'No fue posible generar el balance de comprobación.');
        }
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta]);

  async function exportar(formato: 'pdf' | 'xlsx') {
    if (!consulta) return;
    setShowExport(false);
    try {
      await exportarBalanceComprobacion(consulta, formato);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : `No fue posible exportar el balance en ${formato.toUpperCase()}.`);
    }
  }

  const totales = balance?.totales;
  const cuadrado = (totales?.diferencia ?? 1) === 0;

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Balance de comprobación</h1>
          <p className="text-xs text-gray-500">Acumulados reales de CONMAE por cuenta y rango de meses.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportar('pdf')}
            disabled={!balance || cargando}
            className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Imprimir
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              disabled={!balance || cargando}
              className="text-xs px-3 py-1.5 rounded text-white font-medium flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: '#0073C0' }}
            >
              Exportar
            </button>
            {showExport && (
              <div className="absolute right-0 top-9 bg-white rounded border border-gray-200 shadow-lg z-20 py-1 w-36">
                {(['pdf', 'xlsx'] as const).map(formato => (
                  <button
                    key={formato}
                    onClick={() => exportar(formato)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {formato === 'pdf' ? 'PDF' : 'XLSX'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Parameters */}
      {formulario && (
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Parámetros del informe</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
              <input
                type="number"
                value={formulario.anio}
                onChange={e => setFormulario({ ...formulario, anio: e.target.value })}
                className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Desde mes</label>
              <select
                value={formulario.mesDesde}
                onChange={e => setFormulario({ ...formulario, mesDesde: Number(e.target.value) })}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              >
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hasta mes</label>
              <select
                value={formulario.mesHasta}
                onChange={e => setFormulario({ ...formulario, mesHasta: Number(e.target.value) })}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              >
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
              <select
                value={formulario.nivel}
                onChange={e => setFormulario({ ...formulario, nivel: Number(e.target.value) as 4 | 6 | 9 | 12 })}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
              >
                <option value={4}>Cuenta</option>
                <option value={6}>Subcuenta</option>
                <option value={9}>Auxiliar 1</option>
                <option value={12}>Auxiliar 2</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={formulario.incluirCeros}
                onChange={e => setFormulario({ ...formulario, incluirCeros: e.target.checked })}
              />
              Incluir cuentas sin saldo ni movimiento
            </label>
            <button
              onClick={() => setConsulta({
                cia,
                anio: Number(formulario.anio),
                mesDesde: formulario.mesDesde,
                mesHasta: formulario.mesHasta,
                nivel: formulario.nivel,
                incluirCeros: formulario.incluirCeros,
              })}
              disabled={cargando}
              className="text-xs px-3 py-1.5 rounded text-white font-medium disabled:cursor-wait disabled:opacity-60"
              style={{ backgroundColor: '#0073C0' }}
            >
              {cargando ? 'Consultando…' : 'Generar'}
            </button>
          </div>
        </div>
      )}

      {/* Report */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="text-center space-y-0.5">
            <div className="text-sm font-bold text-gray-800">BALANCE DE COMPROBACIÓN ACUMULADO</div>
            <div className="text-xs text-gray-600">
              {balance ? `${balance.compania.nombre} — NIT ${balance.compania.nit}` : 'Sin datos consultados'}
            </div>
            <div className="text-xs text-gray-500">
              {balance ? `${balance.periodo} · Nivel ${balance.nombreNivel}${balance.incluirCeros ? ' · Incluye cuentas en cero' : ''}` : ''}
            </div>
          </div>
        </div>

        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 w-24">Cuenta</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Saldo anterior</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Débito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Crédito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-32">Saldo actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cargando && <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-gray-500">Consultando CONMAE…</td></tr>}
              {!cargando && !error && !balance && <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-gray-500">Aún no se ha consultado el balance.</td></tr>}
              {!cargando && balance && balance.items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-gray-500">La compañía no tiene acumulados en el período seleccionado.</td></tr>
              )}
              {!cargando && balance && balance.items.map(row => (
                <tr key={row.cuenta} className="hoverable">
                  <td className="px-3 py-2 font-mono font-medium text-gray-700">{row.cuenta}</td>
                  <td className="px-3 py-2 text-gray-600">{row.nombre}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{row.saldoAnterior !== 0 ? fmtCOP(row.saldoAnterior) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800">{row.debito !== 0 ? fmtCOP(row.debito) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{row.credito !== 0 ? fmtCOP(row.credito) : '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${row.saldoActual > 0 ? 'text-green-700' : row.saldoActual < 0 ? 'text-red-700' : 'text-gray-400'}`}>
                    {row.saldoActual !== 0 ? fmtCOP(row.saldoActual) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {!cargando && balance && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-3 py-2.5 font-bold text-gray-800 text-xs" colSpan={2}>TOTALES</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(totales?.saldoAnterior ?? 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(totales?.debito ?? 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(totales?.credito ?? 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(totales?.saldoActual ?? 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {balance && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{balance.count} cuenta(s)</span>
            <span className={cuadrado ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {cuadrado ? 'Cuadrado' : `Descuadrado por ${fmtCOP(Math.abs(totales?.diferencia ?? 0))}`}
            </span>
          </div>
        )}
      </div>

      {showExport && (
        <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
      )}
    </div>
  );
}

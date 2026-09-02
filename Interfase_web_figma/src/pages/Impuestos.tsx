import { useState } from 'react';
import { fmtCOP } from '../data/mock';

type Tab = 'retenciones' | 'iva' | 'medios';

interface Props {
  initialTab?: Tab;
}

const MOCK_RETENCIONES = [
  { nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', concepto: 'Honorarios', base: 15000000, tarifa: 10, valor: 1500000, periodo: '2026-01' },
  { nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.', concepto: 'Servicios', base: 8500000, tarifa: 4, valor: 340000, periodo: '2026-01' },
  { nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', concepto: 'Arrendamiento', base: 6000000, tarifa: 3.5, valor: 210000, periodo: '2026-02' },
];

const MOCK_IVA = [
  { nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', base: 15000000, iva19: 2850000, ivaDescontable: 0, neto: 2850000, periodo: '2026-01' },
  { nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.', base: 8500000, iva19: 1615000, ivaDescontable: 800000, neto: 815000, periodo: '2026-02' },
];

const MEDIOS_STEPS = ['Formatos', 'Conceptos', 'Asignación cuentas', 'Generación', 'Revisión', 'Topes/cruces', 'Exportación'];

export default function ImpuestosPage({ initialTab = 'retenciones' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mediosStep, setMediosStep] = useState(0);
  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const [showLimpiar, setShowLimpiar] = useState(false);

  const tabLabel: Record<Tab, string> = {
    retenciones: 'Retenciones',
    iva: 'IVA',
    medios: 'Medios magnéticos',
  };

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Impuestos</h1>
          <p className="text-xs text-gray-500">Retenciones, IVA y medios magnéticos para la DIAN</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['retenciones', 'iva', 'medios'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-b-2 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={tab === t ? { borderBottomColor: '#0073C0', color: '#0073C0', borderBottom: '2px solid #0073C0', backgroundColor: 'transparent' } : {}}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {/* Retenciones */}
      {tab === 'retenciones' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-700">
              ⚠ Última acumulación: 2026-01-31 — Período feb 2026 no acumulado
            </div>
            <div className="flex-1" />
            <button className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Acumular período</button>
            <button
              onClick={() => setShowLimpiar(true)}
              className="text-xs px-3 py-1.5 border border-red-200 rounded text-red-600 hover:bg-red-50"
            >
              Limpiar acumulados
            </button>
            <button className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Plano anual</button>
            <button className="text-xs px-3 py-1.5 rounded text-white" style={{ backgroundColor: '#0073C0' }}>↓ Exportar</button>
          </div>

          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <input placeholder="Buscar NIT o nombre..." className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none w-48" />
              <input value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value)} placeholder="2026-01" className="text-xs font-mono border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none w-28" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Período</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Base</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Tarifa %</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Valor retenido</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {MOCK_RETENCIONES.map((r, i) => (
                    <tr key={i} className="hoverable">
                      <td className="px-3 py-2.5 font-mono text-gray-600">{r.periodo}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{r.nit}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-48 truncate">{r.nombre}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.concepto}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(r.base)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-600">{r.tarifa}%</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{fmtCOP(r.valor)}</td>
                      <td className="px-3 py-2.5">
                        <button className="text-xs text-blue-600 hover:underline">Certificado</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 font-semibold text-xs text-gray-700">TOTALES</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(MOCK_RETENCIONES.reduce((s, r) => s + r.base, 0))}</td>
                    <td />
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(MOCK_RETENCIONES.reduce((s, r) => s + r.valor, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* IVA */}
      {tab === 'iva' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-700">
              ⚠ IVA de feb 2026 no acumulado
            </div>
            <div className="flex-1" />
            <button className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Acumular período</button>
            <button className="text-xs px-3 py-1.5 rounded text-white" style={{ backgroundColor: '#0073C0' }}>↓ Exportar</button>
          </div>

          <div className="bg-white rounded border border-gray-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Período</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Base IVA</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">IVA 19%</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">IVA descontable</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Neto a pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {MOCK_IVA.map((r, i) => (
                  <tr key={i} className="hoverable">
                    <td className="px-3 py-2.5 font-mono text-gray-600">{r.periodo}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-700">{r.nit}</td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-48 truncate">{r.nombre}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(r.base)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(r.iva19)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{fmtCOP(r.ivaDescontable)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(r.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Medios magnéticos */}
      {tab === 'medios' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {MEDIOS_STEPS.map((s, i) => (
              <div key={s} className="flex items-center shrink-0">
                <div
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors font-medium ${
                    i === mediosStep ? 'text-white' :
                    i < mediosStep ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'
                  }`}
                  style={i === mediosStep ? { backgroundColor: '#0073C0' } : {}}
                  onClick={() => setMediosStep(i)}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    i < mediosStep ? 'bg-green-100 text-green-700' : i === mediosStep ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{i < mediosStep ? '✓' : i + 1}</span>
                  {s}
                </div>
                {i < MEDIOS_STEPS.length - 1 && <span className="text-gray-200 mx-1">›</span>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded border border-gray-200 p-6 min-h-48">
            {mediosStep === 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-700">Formatos de información exógena</h3>
                {[
                  { id: 'F1001', nombre: 'Pagos o abonos en cuenta', vigencia: '2026', estado: 'Activo' },
                  { id: 'F1007', nombre: 'Ingresos recibidos', vigencia: '2026', estado: 'Activo' },
                  { id: 'F1008', nombre: 'Descuentos tributarios', vigencia: '2026', estado: 'Pendiente' },
                ].map(f => (
                  <div key={f.id} className="flex items-center gap-4 p-3 border border-gray-200 rounded">
                    <span className="font-mono text-gray-700 w-16">{f.id}</span>
                    <span className="flex-1 text-gray-600 text-xs">{f.nombre}</span>
                    <span className="text-xs text-gray-500">{f.vigencia}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{f.estado}</span>
                  </div>
                ))}
              </div>
            )}
            {mediosStep > 0 && mediosStep < 6 && (
              <div className="flex items-center justify-center py-8 text-center">
                <div>
                  <div className="text-2xl mb-2 text-gray-300">⊟</div>
                  <div className="text-xs text-gray-500">Paso {mediosStep + 1}: {MEDIOS_STEPS[mediosStep]}</div>
                  <div className="text-xs text-gray-400 mt-1">Complete el paso anterior para continuar</div>
                </div>
              </div>
            )}
            {mediosStep === 6 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-700">Exportar medios magnéticos</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['Archivo .XML para DIAN', 'Archivo .CSV resumen', 'Reporte conciliación'].map(f => (
                    <div key={f} className="border border-gray-200 rounded p-3 text-center">
                      <div className="text-lg mb-1">📄</div>
                      <div className="text-xs text-gray-600">{f}</div>
                      <button className="mt-2 text-xs px-3 py-1 rounded text-white" style={{ backgroundColor: '#0073C0' }}>Descargar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {mediosStep > 0 && (
              <button onClick={() => setMediosStep(s => s - 1)} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600">← Anterior</button>
            )}
            {mediosStep < MEDIOS_STEPS.length - 1 && (
              <button onClick={() => setMediosStep(s => s + 1)} className="text-xs px-3 py-1.5 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
                Siguiente →
              </button>
            )}
          </div>
        </div>
      )}

      {showLimpiar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-sm font-semibold text-red-700 mb-2">⚠ Limpiar acumulados de retenciones</h3>
            <p className="text-xs text-gray-600 mb-3">Esta acción elimina los totales acumulados de retenciones para el período seleccionado. <strong>No elimina el libro contable</strong> — puede regenerar los acumulados en cualquier momento.</p>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700 mb-4">
              Los acumulados son derivados del libro. Limpiar y regenerar es una operación segura.
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLimpiar(false)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">Cancelar</button>
              <button onClick={() => setShowLimpiar(false)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#DC2626' }}>Limpiar acumulados</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

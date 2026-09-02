import { useState } from 'react';

type CheckItem = {
  id: string;
  label: string;
  desc: string;
  checked: boolean;
  bloqueante: boolean;
};

const INITIAL_CHECKS: CheckItem[] = [
  { id: 'c1', label: 'Todos los lotes contabilizados', desc: 'No deben quedar lotes pendientes de contabilizar en el período', checked: false, bloqueante: true },
  { id: 'c2', label: 'Balance cuadrado (dif = 0)', desc: 'El total de débitos debe igualar el total de créditos', checked: true, bloqueante: true },
  { id: 'c3', label: 'Conciliaciones bancarias completas', desc: 'Cuentas de tesorería conciliadas con extractos', checked: false, bloqueante: false },
  { id: 'c4', label: 'Retenciones acumuladas', desc: 'Acumulados de retenciones actualizados al período', checked: false, bloqueante: false },
  { id: 'c5', label: 'IVA acumulado', desc: 'Acumulados de IVA actualizados al período', checked: false, bloqueante: false },
  { id: 'c6', label: 'Respaldo de base de datos realizado', desc: 'Copia de seguridad antes del cierre', checked: false, bloqueante: true },
  { id: 'c7', label: 'Usuarios informados del cierre', desc: 'Se notificó a los usuarios que el período se cerrará', checked: true, bloqueante: false },
];

export default function Cierres() {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [showCierreAnual, setShowCierreAnual] = useState(false);
  const [showCompCierre, setShowCompCierre] = useState(false);
  const [cierreStep, setCierreStep] = useState(0);

  function toggleCheck(id: string) {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  }

  const bloqueantes = checks.filter(c => c.bloqueante && !c.checked);
  const canClose = bloqueantes.length === 0;

  return (
    <div className="p-4 space-y-4 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Cierres contables</h1>
          <p className="text-xs text-gray-500">Cierre mensual y anual del período contable — Febrero 2026</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Checklist */}
        <div className="bg-white rounded border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700">Lista de verificación previa al cierre</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${canClose ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {checks.filter(c => c.checked).length}/{checks.length} completados
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {checks.map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${item.bloqueante && !item.checked ? 'bg-red-50' : ''}`}
                onClick={() => toggleCheck(item.id)}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 shrink-0 ${
                  item.checked ? 'bg-green-500' : 'border-2 border-gray-300'
                }`}>
                  {item.checked && <span className="text-white text-xs">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${item.checked ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {item.label}
                    {item.bloqueante && !item.checked && <span className="ml-2 text-red-500 text-xs no-underline" style={{ textDecoration: 'none' }}>Bloqueante</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {!canClose && (
            <div className="px-4 py-3 border-t border-red-100 bg-red-50">
              <div className="text-xs text-red-700 font-medium">
                {bloqueantes.length} elemento{bloqueantes.length !== 1 ? 's' : ''} bloqueante{bloqueantes.length !== 1 ? 's' : ''} sin completar
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {/* Comprobante de cierre */}
          <div className="bg-white rounded border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-1">Generar comprobante de cierre</h3>
            <p className="text-xs text-gray-400 mb-3">Cancela cuentas de resultado (clases 4-9) contra la cuenta de resultados del ejercicio</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta resultado</label>
                <input defaultValue="330505" className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante</label>
                <input defaultValue="NO" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none" />
              </div>
            </div>
            <button
              onClick={() => setShowCompCierre(true)}
              disabled={!canClose}
              className={`w-full text-xs py-2 rounded font-medium text-white transition-colors ${canClose ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
              style={{ backgroundColor: '#0073C0' }}
            >
              Previsualizar y generar lote
            </button>
          </div>

          {/* Traslado 13-18 */}
          <div className="bg-white rounded border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-500 text-sm">⚠</span>
              <h3 className="text-xs font-semibold text-red-700">Traslado períodos 13-18 a 01-06</h3>
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Máximo riesgo</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Traslada movimientos de períodos especiales al libro regular. Requiere simulación, respaldo y confirmación escrita obligatoria.</p>
            <button
              className="w-full text-xs py-2 rounded font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
            >
              Iniciar asistente de traslado
            </button>
          </div>

          {/* Cierre anual */}
          <div className="bg-white rounded border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-700">Cierre anual automático</h3>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">En desarrollo</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Esta funcionalidad está en desarrollo. Disponible en la próxima versión.</p>
            <button disabled className="w-full text-xs py-2 rounded border border-gray-200 text-gray-300 cursor-not-allowed">
              No disponible
            </button>
          </div>
        </div>
      </div>

      {/* Comprobante de cierre preview modal */}
      {showCompCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Vista previa — Comprobante de cierre febrero 2026</h3>
              <button onClick={() => setShowCompCierre(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-5 py-4">
              <div className="text-xs text-gray-500 mb-3">Cuentas de resultado (clases 4-9) que serán canceladas:</div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600">Saldo</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600">Débito cierre</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600">Crédito cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { cuenta: '510506', nombre: 'Sueldos y salarios', saldo: 24000000, deb: 0, cred: 24000000 },
                  ].map(r => (
                    <tr key={r.cuenta}>
                      <td className="px-2 py-2 font-mono text-gray-700">{r.cuenta}</td>
                      <td className="px-2 py-2 text-gray-600">{r.nombre}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-800">{r.saldo.toLocaleString('es-CO')}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-600">{r.deb > 0 ? r.deb.toLocaleString('es-CO') : '—'}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-600">{r.cred > 0 ? r.cred.toLocaleString('es-CO') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-xs text-gray-500 italic">
                El lote se genera sin contabilizar — debe pasar por verificar, aprobar y contabilizar.
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowCompCierre(false)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">Cancelar</button>
              <button onClick={() => setShowCompCierre(false)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Generar lote de cierre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

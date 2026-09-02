import { useState } from 'react';

type ProcessCard = {
  id: string;
  nombre: string;
  desc: string;
  tipo: 'auditoria' | 'correccion';
  icono: string;
  riesgo: 'Alto' | 'Medio' | 'Bajo';
};

const PROCESOS: ProcessCard[] = [
  { id: 'rep-mensual', nombre: 'Reproceso mensual', desc: 'Recalcula saldos y movimientos del período', tipo: 'correccion', icono: '↺', riesgo: 'Bajo' },
  { id: 'revalorizacion', nombre: 'Revalorización de cuentas', desc: 'Ajuste de activos y pasivos monetarios', tipo: 'correccion', icono: '⟳', riesgo: 'Medio' },
  { id: 'docs-vs-mov', nombre: 'Documentos vs movimiento', desc: 'Verifica consistencia entre documentos y libro', tipo: 'auditoria', icono: '⊟', riesgo: 'Bajo' },
  { id: 'auditoria-rev', nombre: 'Auditoría de revalorización', desc: 'Valida que la revalorización esté correcta', tipo: 'auditoria', icono: '⊛', riesgo: 'Bajo' },
  { id: 'mov-vs-ctas', nombre: 'Movimiento vs cuentas válidas', desc: 'Detecta movimientos en cuentas no afectables', tipo: 'auditoria', icono: '⊕', riesgo: 'Bajo' },
  { id: 'crear-cuentas', nombre: 'Crear cuentas faltantes', desc: 'Asistente para crear cuentas detectadas en importaciones', tipo: 'correccion', icono: '+', riesgo: 'Bajo' },
  { id: 'rev-opt', nombre: 'Revalorización mensual optimizada', desc: 'Versión rápida del proceso de revalorización', tipo: 'correccion', icono: '⟳', riesgo: 'Medio' },
];

export default function Reprocesos() {
  const [selected, setSelected] = useState<ProcessCard | null>(null);
  const [step, setStep] = useState<'idle' | 'sim' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<'todos' | 'auditoria' | 'correccion'>('todos');

  function startProcess() {
    setStep('sim');
  }

  function executeProcess() {
    setStep('running');
    let p = 0;
    const interval = setInterval(() => {
      p += 20;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setStep('done');
      }
    }, 400);
  }

  const filtered = PROCESOS.filter(p => filter === 'todos' || p.tipo === filter);

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Reprocesos y auditoría</h1>
          <p className="text-xs text-gray-500">Verificaciones, correcciones y recálculos del libro contable</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
        ⚠ Los reprocesos bloquean la contabilidad de la compañía mientras se ejecutan. Asegúrese de que no haya otros usuarios activos.
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {[
          { k: 'todos', label: 'Todos los procesos' },
          { k: 'auditoria', label: 'Solo auditorías' },
          { k: 'correccion', label: 'Solo correcciones' },
        ].map(f => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k as typeof filter)}
            className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
              filter === f.k ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={filter === f.k ? { backgroundColor: '#0073C0' } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(proc => (
          <div
            key={proc.id}
            className={`bg-white rounded border p-4 cursor-pointer transition-all hover:shadow-sm ${
              proc.tipo === 'auditoria' ? 'border-blue-200 hover:border-blue-300' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => { setSelected(proc); setStep('idle'); setProgress(0); }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`w-8 h-8 rounded flex items-center justify-center font-mono text-sm ${
                proc.tipo === 'auditoria' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {proc.icono}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  proc.tipo === 'auditoria' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {proc.tipo === 'auditoria' ? 'Auditar' : 'Corregir'}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  proc.riesgo === 'Alto' ? 'bg-red-100 text-red-700' :
                  proc.riesgo === 'Medio' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {proc.riesgo}
                </span>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-800 mb-1">{proc.nombre}</div>
            <div className="text-xs text-gray-500">{proc.desc}</div>
            <button
              className="mt-3 text-xs px-3 py-1.5 rounded font-medium text-white w-full transition-colors"
              style={{ backgroundColor: proc.tipo === 'auditoria' ? '#2563EB' : '#0073C0' }}
            >
              {proc.tipo === 'auditoria' ? 'Ejecutar auditoría' : 'Iniciar proceso'}
            </button>
          </div>
        ))}
      </div>

      {/* Process modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{selected.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selected.desc}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {step === 'idle' && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-gray-500 mb-1">Compañía</label>
                      <div className="font-medium text-gray-800">001 — Compañía Demo S.A.S.</div>
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">Año</label>
                      <div className="font-medium text-gray-800">2026</div>
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">Período desde</label>
                      <input defaultValue="01" className="w-full border border-gray-200 rounded px-2 py-1 font-mono text-xs" />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">Período hasta</label>
                      <input defaultValue="02" className="w-full border border-gray-200 rounded px-2 py-1 font-mono text-xs" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <input type="checkbox" defaultChecked />
                    <label>Ejecutar en modo simulación primero (recomendado)</label>
                  </div>
                </>
              )}

              {step === 'sim' && (
                <div className="space-y-2">
                  <div className="font-medium text-xs text-gray-700">Resultado de simulación</div>
                  <div className="space-y-1 text-xs bg-gray-50 rounded p-3">
                    <div className="text-gray-600">Cuentas a procesar: <strong>21</strong></div>
                    <div className="text-gray-600">Registros afectados: <strong>847</strong></div>
                    <div className="text-gray-600">Diferencias detectadas: <strong>0</strong></div>
                    <div className="text-green-600 font-medium mt-2">✓ Simulación sin errores — puede continuar</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Motivo (obligatorio)</label>
                    <input placeholder="Razón del proceso..." className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none" />
                  </div>
                </div>
              )}

              {step === 'running' && (
                <div className="space-y-2 py-2">
                  <div className="text-xs text-gray-600">Ejecutando {selected.nombre}...</div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: '#0073C0' }} />
                  </div>
                  <div className="text-xs text-right font-mono text-gray-400">{progress}%</div>
                </div>
              )}

              {step === 'done' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                    <span>✓</span> Proceso completado exitosamente
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Registros procesados: 847</div>
                    <div>Diferencias corregidas: 0</div>
                    <div>Auditoría generada: AUD-2026-0090</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setSelected(null)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">
                {step === 'done' ? 'Cerrar' : 'Cancelar'}
              </button>
              {step === 'idle' && (
                <button onClick={startProcess} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
                  Simular proceso
                </button>
              )}
              {step === 'sim' && (
                <button onClick={executeProcess} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#DC2626' }}>
                  Ejecutar ahora
                </button>
              )}
              {step === 'done' && (
                <button className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
                  ↓ Exportar reporte
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

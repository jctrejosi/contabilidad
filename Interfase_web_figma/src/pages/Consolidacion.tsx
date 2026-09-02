import { useState } from 'react';

const STEPS = ['Compañías origen', 'Verificar compatibilidad', 'Simulación', 'Respaldo y confirmación', 'Ejecución', 'Revalorizar', 'Comparar totales'];

export default function Consolidacion() {
  const [step, setStep] = useState(0);
  const [origen1, setOrigen1] = useState(true);
  const [confirmText, setConfirmText] = useState('');

  return (
    <div className="p-4 space-y-4 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Consolidación</h1>
          <p className="text-xs text-gray-500">Consolida múltiples compañías en una compañía destino de solo consolidación</p>
        </div>
      </div>

      {/* Warnings */}
      <div className="space-y-2">
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          <span className="mt-0.5">⚠</span>
          <div>
            <strong>Advertencia:</strong> La consolidación reemplazará <strong>todas las cuentas, centros, comprobantes y movimientos</strong> de la compañía destino con los datos consolidados de las compañías origen.
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          <span className="mt-0.5">ℹ</span>
          <div>
            Esta versión <strong>no incluye</strong> eliminación de transacciones intercompañía ni conversión de moneda. Estas funciones están reservadas para una sección futura.
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center shrink-0">
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded cursor-pointer font-medium ${
                i === step ? 'text-white' : i < step ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'
              }`}
              style={i === step ? { backgroundColor: '#0073C0' } : {}}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${i < step ? 'bg-green-100 text-green-700' : i === step ? 'bg-white/30' : 'bg-gray-200'}`}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className="hidden md:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <span className="text-gray-200 mx-1">›</span>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded border border-gray-200 p-6 min-h-64">
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-700">Seleccionar compañías origen</h3>
            <div className="space-y-2">
              {[
                { codigo: '001', nombre: 'Compañía Demo S.A.S.', nit: '900.123.456-7', tipo: 'Normal' },
                { codigo: '002', nombre: 'Filial Norte Ltda.', nit: '800.234.567-8', tipo: 'Normal' },
                { codigo: '003', nombre: 'Holding Consolidado S.A.S.', nit: '901.000.001-2', tipo: 'Solo consolidación' },
              ].map((c, i) => (
                <label key={c.codigo} className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                  c.tipo === 'Solo consolidación' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={i === 0 ? origen1 : false}
                    onChange={i === 0 ? e => setOrigen1(e.target.checked) : undefined}
                    disabled={c.tipo === 'Solo consolidación'}
                  />
                  <div className="flex-1 text-xs">
                    <div className="font-medium text-gray-800">{c.codigo} — {c.nombre}</div>
                    <div className="text-gray-400">{c.nit}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.tipo === 'Solo consolidación' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {c.tipo}
                  </span>
                </label>
              ))}
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              La compañía destino <strong>debe estar marcada como "Solo consolidación"</strong>. Use configuración de compañías para cambiar este parámetro.
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-700">Verificación de compatibilidad</h3>
            {[
              { label: 'Plan de cuentas', estado: 'Compatibles', ok: true },
              { label: 'Año contable', estado: '2026 en todas', ok: true },
              { label: 'Centros de costo', estado: 'Diferencias: 001 tiene OPE, 002 no', ok: false },
              { label: 'Comprobantes', estado: 'Compatibles (se remapearán)', ok: true },
            ].map(v => (
              <div key={v.label} className="flex items-center gap-3 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${v.ok ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                  {v.ok ? '✓' : '⚠'}
                </span>
                <span className="font-medium text-gray-700 w-32">{v.label}</span>
                <span className={v.ok ? 'text-gray-500' : 'text-amber-700'}>{v.estado}</span>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-700">Simulación de consolidación</h3>
            <div className="space-y-2 text-xs">
              <div className="text-gray-600">Registros a consolidar: <strong>3,847</strong></div>
              <div className="text-gray-600">Cuentas origen únicas: <strong>47</strong></div>
              <div className="text-gray-600">Conflictos detectados: <strong>0</strong></div>
              <div className="text-gray-600">Tamaño estimado destino: <strong>3,847 registros</strong></div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              ✓ Simulación sin conflictos — puede continuar
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-1">
              <div className="font-semibold">⚠ ACCIÓN DESTRUCTIVA — La compañía destino será vaciada</div>
              <div>Se eliminarán todos los movimientos existentes de 003 — Holding Consolidado S.A.S. antes de importar los datos consolidados.</div>
            </div>
            <div className="text-xs text-gray-600">Respaldo automático generado: <strong>BAK-CONS-2026-001</strong></div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Escriba <strong>VACIAR Y CONSOLIDAR</strong> para confirmar</label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="VACIAR Y CONSOLIDAR"
                className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
              />
            </div>
          </div>
        )}

        {step >= 4 && step <= 5 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="text-3xl">{step === 4 ? '⚡' : '⟳'}</div>
              <div className="text-sm font-medium text-gray-700">{STEPS[step]}</div>
              <div className="text-xs text-gray-400">Proceso en ejecución...</div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <span className="text-xl">✓</span> Consolidación completada exitosamente
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Registros consolidados', '3,847'],
                ['Cuentas destino', '47'],
                ['Centros de costo', '3'],
                ['Auditoría', 'AUD-CONS-2026-001'],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between border-b border-gray-50 py-1">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800">{val}</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              ℹ Sección futura: eliminación intercompañía y conversión de moneda — no incluidas en esta versión.
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {step > 0 && step < 4 && (
          <button onClick={() => setStep(s => s - 1)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">← Atrás</button>
        )}
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 3 && confirmText !== 'VACIAR Y CONSOLIDAR'}
            className={`text-xs px-4 py-2 rounded font-medium text-white transition-colors ${
              step === 3 && confirmText !== 'VACIAR Y CONSOLIDAR' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{ backgroundColor: step === 3 ? '#DC2626' : '#0073C0' }}
          >
            {step === 3 ? '⚠ Vaciar y consolidar' : step === STEPS.length - 2 ? 'Finalizar' : 'Siguiente →'}
          </button>
        )}
      </div>
    </div>
  );
}

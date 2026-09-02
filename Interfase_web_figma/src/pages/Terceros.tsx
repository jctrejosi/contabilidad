import { useState } from 'react';
import { TERCEROS, fmtCOP } from '../data/mock';
import type { Tercero } from '../types';

export default function TercerosPage() {
  const [terceros, setTerceros] = useState<Tercero[]>(TERCEROS);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<'todos' | 'Activo' | 'Bloqueado'>('todos');
  const [selected, setSelected] = useState<Tercero | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showReasign, setShowReasign] = useState(false);
  const [reasignStep, setReasignStep] = useState(0);

  const filtered = terceros.filter(t => {
    if (filterEstado !== 'todos' && t.estado !== filterEstado) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.nit.includes(q) || t.nombre.toLowerCase().includes(q) || t.ciudad.toLowerCase().includes(q);
    }
    return true;
  });

  function toggleBloqueo(nit: string) {
    setTerceros(prev => prev.map(t => {
      if (t.nit !== nit) return t;
      return { ...t, estado: t.estado === 'Activo' ? 'Bloqueado' : 'Activo', motivoBloqueo: t.estado === 'Activo' ? 'Bloqueado manualmente' : undefined };
    }));
  }

  const REASIGN_STEPS = [
    'NIT actual y nuevo',
    'Módulos afectados',
    'Simulación',
    'Respaldo y confirmación',
    'Progreso',
    'Resultado y auditoría',
  ];

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Terceros</h1>
          <p className="text-xs text-gray-500">Directorio de personas naturales y jurídicas vinculadas a la contabilidad</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↑ Importar</button>
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar XLSX</button>
          <button
            onClick={() => setShowReasign(true)}
            className="text-xs px-2.5 py-1.5 border border-amber-200 rounded text-amber-700 hover:bg-amber-50 font-medium"
          >
            ⚠ Reasignar NIT
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="text-xs px-3 py-1.5 rounded text-white font-medium"
            style={{ backgroundColor: '#0073C0' }}
          >
            + Nuevo tercero
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por NIT, nombre o ciudad..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64"
        />
        {['todos', 'Activo', 'Bloqueado'].map(e => (
          <button
            key={e}
            onClick={() => setFilterEstado(e as typeof filterEstado)}
            className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${
              filterEstado === e ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={filterEstado === e ? { backgroundColor: '#0073C0' } : {}}
          >
            {e === 'todos' ? 'Todos' : e}
          </button>
        ))}
        <button className="ml-auto text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Ciudad</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Teléfono</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Cupo</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(t => (
                    <tr
                      key={t.nit}
                      className={`hoverable cursor-pointer ${selected?.nit === t.nit ? 'bg-blue-50' : ''} ${t.estado === 'Bloqueado' ? 'opacity-70' : ''}`}
                      onClick={() => setSelected(t)}
                    >
                      <td className="px-3 py-2.5 font-mono text-gray-700">{t.nit}-{t.digito}</td>
                      <td className="px-3 py-2.5 text-gray-800 font-medium max-w-56 truncate">{t.nombre}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${t.tipo === 'Jurídica' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {t.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{t.ciudad}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-500">{t.telefono}</td>
                      <td className={`px-3 py-2.5 text-right font-mono ${t.saldo < 0 ? 'text-red-600' : t.saldo > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {t.saldo !== 0 ? fmtCOP(Math.abs(t.saldo)) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                        {t.cupo > 0 ? fmtCOP(t.cupo) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {t.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button className="text-xs text-blue-600 hover:underline">Editar</button>
                          <span className="text-gray-200">|</span>
                          <button
                            onClick={() => toggleBloqueo(t.nit)}
                            className={`text-xs hover:underline ${t.estado === 'Activo' ? 'text-amber-600' : 'text-green-600'}`}
                          >
                            {t.estado === 'Activo' ? 'Bloquear' : 'Desbloquear'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              {filtered.length} tercero{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Detail */}
        {selected && (
          <div className="w-72 shrink-0">
            <div className="bg-white rounded border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-800 text-sm">{selected.nombre}</div>
                  <div className="font-mono text-xs text-gray-500 mt-0.5">NIT {selected.nit}-{selected.digito}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>

              <div className={`text-xs px-2.5 py-1.5 rounded font-medium ${
                selected.estado === 'Activo' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {selected.estado === 'Bloqueado' ? `⚠ Bloqueado: ${selected.motivoBloqueo}` : '✓ Activo'}
              </div>

              <div className="space-y-2 text-xs">
                {[
                  ['Tipo', selected.tipo],
                  ['Doc. identidad', selected.tipoDoc],
                  ['Dirección', selected.direccion],
                  ['Teléfono', selected.telefono],
                  ['Ciudad', selected.ciudad],
                  ['Creado', selected.fechaCreacion],
                  ['Saldo', `${fmtCOP(Math.abs(selected.saldo))} ${selected.saldo < 0 ? '(por pagar)' : '(por cobrar)'}`],
                  ['Cupo', fmtCOP(selected.cupo)],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between gap-3">
                    <span className="text-gray-400 shrink-0">{label}</span>
                    <span className="text-gray-700 text-right">{val}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button className="flex-1 text-xs py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Editar</button>
                <button
                  onClick={() => toggleBloqueo(selected.nit)}
                  className={`flex-1 text-xs py-1.5 border rounded font-medium ${
                    selected.estado === 'Activo'
                      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                      : 'border-green-200 text-green-700 hover:bg-green-50'
                  }`}
                >
                  {selected.estado === 'Activo' ? 'Bloquear' : 'Desbloquear'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New third party modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Nuevo tercero</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              {[
                { label: 'NIT / Cédula', ph: '900.123.456' },
                { label: 'Dígito de verificación', ph: '7' },
                { label: 'Nombre completo', ph: 'Nombre empresa o persona' },
                { label: 'Tipo de persona', ph: '' },
                { label: 'Dirección', ph: 'Cr 15 # 80-25' },
                { label: 'Teléfono', ph: '3001234567' },
                { label: 'Ciudad', ph: 'Bogotá D.C.' },
                { label: 'Cupo de crédito', ph: '0' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
                    placeholder={f.ph}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowNew(false)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">Cancelar</button>
              <button onClick={() => setShowNew(false)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* NIT Reassignment wizard */}
      {showReasign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200" style={{ backgroundColor: '#FEF3C7' }}>
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Asistente de reasignación de NIT</h3>
                <p className="text-xs text-amber-700 mt-0.5">Esta acción afecta también facturación, cartera, inventario y cuentas por pagar</p>
              </div>
              <button onClick={() => { setShowReasign(false); setReasignStep(0); }} className="text-amber-400 hover:text-amber-600 text-lg">×</button>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-0 px-5 py-3 border-b border-gray-200 overflow-x-auto">
              {REASIGN_STEPS.map((s, i) => (
                <div key={s} className="flex items-center shrink-0">
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                    i === reasignStep ? 'font-semibold text-white' :
                    i < reasignStep ? 'text-green-600' : 'text-gray-400'
                  }`} style={i === reasignStep ? { backgroundColor: '#0073C0' } : {}}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      i < reasignStep ? 'bg-green-100 text-green-700' : i === reasignStep ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>{i < reasignStep ? '✓' : i + 1}</span>
                    <span className="hidden sm:inline">{s}</span>
                  </div>
                  {i < REASIGN_STEPS.length - 1 && <span className="text-gray-200 mx-1 text-xs">›</span>}
                </div>
              ))}
            </div>

            <div className="px-5 py-6 min-h-40">
              {reasignStep === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">NIT actual</label>
                    <input defaultValue="860.050.010" className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">NIT nuevo</label>
                    <input placeholder="NIT de destino" className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                </div>
              )}
              {reasignStep === 1 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 mb-3">Módulos que serán afectados por la reasignación:</p>
                  {['Contabilidad — movimientos, lotes y saldos', 'Facturación — facturas y notas crédito/débito', 'Cartera — documentos por cobrar', 'Cuentas por pagar — documentos por pagar', 'Inventario — entradas y salidas'].map(m => (
                    <div key={m} className="flex items-center gap-2 text-xs text-gray-700">
                      <input type="checkbox" defaultChecked />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}
              {reasignStep === 2 && (
                <div>
                  <p className="text-xs text-amber-700 font-medium mb-3">Simulación: se afectarían 1,847 registros en contabilidad</p>
                  <div className="space-y-1 text-xs max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                    {['Movimientos contables: 1,204 líneas', 'Lotes con pendientes: 3', 'Tercero en plan de cuentas: 12 cuentas asociadas', 'Posibles duplicados: 0 encontrados'].map(r => (
                      <div key={r} className="text-gray-600">{r}</div>
                    ))}
                  </div>
                </div>
              )}
              {reasignStep === 3 && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ⚠ Esta acción es irreversible. Se ha creado un respaldo automático con ID BAK-2026-0302.
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de la reasignación (obligatorio)</label>
                    <input placeholder="Corrección de NIT erróneo registrado en..." className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Escriba REASIGNAR para confirmar</label>
                    <input placeholder="REASIGNAR" className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1" />
                  </div>
                </div>
              )}
              {reasignStep === 4 && (
                <div className="flex flex-col items-center justify-center py-4 gap-3">
                  <div className="text-2xl animate-spin">⟳</div>
                  <div className="text-xs text-gray-600">Procesando reasignación... 847 / 1,847 registros</div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div className="h-full rounded-full" style={{ width: '46%', backgroundColor: '#0073C0' }} />
                  </div>
                </div>
              )}
              {reasignStep === 5 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                    <span className="text-xl">✓</span>
                    Reasignación completada exitosamente
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Registros afectados: 1,847</div>
                    <div>Auditoría registrada con ID AUD-2026-0089</div>
                    <div>Usuario: Laura Gómez · 2026-03-02 {new Date().toLocaleTimeString('es-CO')}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              {reasignStep > 0 && reasignStep < 4 && (
                <button onClick={() => setReasignStep(s => s - 1)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">← Atrás</button>
              )}
              {reasignStep < REASIGN_STEPS.length - 1 && (
                <button onClick={() => setReasignStep(s => s + 1)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
                  {reasignStep === 3 ? 'Ejecutar reasignación' : 'Siguiente →'}
                </button>
              )}
              {reasignStep === REASIGN_STEPS.length - 1 && (
                <button onClick={() => { setShowReasign(false); setReasignStep(0); }} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Cerrar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

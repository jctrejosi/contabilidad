import { useState } from 'react';
import { CUENTAS, fmtCOP } from '../data/mock';
import type { Cuenta } from '../types';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function saldo(cuenta: Cuenta): number {
  let s = cuenta.saldoInicial;
  for (const m of cuenta.movimientos) {
    s += m.debito - m.credito;
  }
  return s;
}

export default function PlanCuentas() {
  const [view, setView] = useState<'tree' | 'table'>('table');
  const [filterText, setFilterText] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todas' | 'afectables' | 'retenciones' | 'iva'>('todas');
  const [selectedCuenta, setSelectedCuenta] = useState<Cuenta | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = CUENTAS.filter(c => {
    if (filterTipo === 'afectables' && !c.afectable) return false;
    if (filterTipo === 'retenciones' && !c.claseRetencion) return false;
    if (filterTipo === 'iva' && !c.claseIVA) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      return c.codigo.includes(q) || c.nombre.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Plan de cuentas</h1>
          <p className="text-xs text-gray-500">Catálogo maestro de cuentas contables — niveles 1, 2, 4, 6, 9 y 12</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
          <button className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar</button>
          <button
            onClick={() => setShowNew(true)}
            className="text-xs px-3 py-1.5 rounded text-white font-medium"
            style={{ backgroundColor: '#0073C0' }}
          >
            + Crear cuenta
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main panel */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Toolbar */}
          <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-56"
            />
            <div className="flex items-center gap-1">
              {[
                { k: 'todas', label: 'Todas' },
                { k: 'afectables', label: 'Afectables' },
                { k: 'retenciones', label: 'Retenciones' },
                { k: 'iva', label: 'IVA' },
              ].map(f => (
                <button
                  key={f.k}
                  onClick={() => setFilterTipo(f.k as typeof filterTipo)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${
                    filterTipo === f.k
                      ? 'text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  style={filterTipo === f.k ? { backgroundColor: '#0073C0' } : {}}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              {['tree', 'table'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v as 'tree' | 'table')}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${view === v ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {v === 'tree' ? '⊞ Árbol' : '≡ Tabla'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Niv</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Afect.</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Tercero</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Centro</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Base</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Clase</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo actual</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(cuenta => {
                    const indent = (cuenta.nivel - 1) * 16;
                    const sal = saldo(cuenta);
                    return (
                      <tr
                        key={cuenta.codigo}
                        className={`hoverable cursor-pointer ${selectedCuenta?.codigo === cuenta.codigo ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedCuenta(cuenta)}
                      >
                        <td className="px-3 py-2" style={{ paddingLeft: `${12 + indent}px` }}>
                          <span className={`font-mono ${cuenta.nivel <= 2 ? 'font-bold text-gray-800' : cuenta.nivel === 3 ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>
                            {cuenta.codigo}
                          </span>
                        </td>
                        <td className="px-3 py-2" style={{ paddingLeft: `${12 + indent}px` }}>
                          <span className={cuenta.nivel <= 2 ? 'font-bold text-gray-800 uppercase text-xs' : cuenta.nivel === 3 ? 'font-semibold text-gray-700' : 'text-gray-600'}>
                            {cuenta.nombre}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500">{cuenta.nivel}</td>
                        <td className="px-3 py-2 text-center">{cuenta.afectable ? <span className="text-green-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                        <td className="px-3 py-2 text-center">{cuenta.requiereTercero ? <span className="text-blue-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                        <td className="px-3 py-2 text-center">{cuenta.requiereCentro ? <span className="text-blue-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                        <td className="px-3 py-2 text-center">{cuenta.requiereBase ? <span className="text-amber-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                        <td className="px-3 py-2">
                          {cuenta.claseRetencion && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{cuenta.claseRetencion}</span>}
                          {cuenta.claseIVA && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{cuenta.claseIVA}</span>}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${sal > 0 ? 'text-green-700' : sal < 0 ? 'text-red-700' : 'text-gray-300'}`}>
                          {sal !== 0 ? fmtCOP(Math.abs(sal)) : '—'}
                        </td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button className="text-xs text-blue-600 hover:underline">Editar</button>
                            <span className="text-gray-300">|</span>
                            <button className="text-xs text-red-500 hover:underline">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              {filtered.length} cuenta{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedCuenta && (
          <div className="w-72 shrink-0 space-y-3">
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-mono font-bold text-gray-800">{selectedCuenta.codigo}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{selectedCuenta.nombre}</div>
                </div>
                <button
                  onClick={() => setSelectedCuenta(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >×</button>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  ['Nivel', selectedCuenta.nivel],
                  ['Afectable', selectedCuenta.afectable ? 'Sí' : 'No'],
                  ['Requiere tercero', selectedCuenta.requiereTercero ? 'Sí' : 'No'],
                  ['Requiere centro', selectedCuenta.requiereCentro ? 'Sí' : 'No'],
                  ['Requiere base', selectedCuenta.requiereBase ? 'Sí' : 'No'],
                  ['Ajuste por inflación', selectedCuenta.ajuste ? 'Sí' : 'No'],
                  ['Clase IVA', selectedCuenta.claseIVA || '—'],
                  ['Clase retención', selectedCuenta.claseRetencion || '—'],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly movements */}
            {selectedCuenta.afectable && (
              <div className="bg-white rounded border border-gray-200 p-4">
                <div className="text-xs font-semibold text-gray-700 mb-3">Movimiento anual</div>
                <div className="text-xs mb-2">
                  <span className="text-gray-500">Saldo inicial:</span>
                  <span className="font-mono font-semibold ml-2 text-gray-800">{fmtCOP(selectedCuenta.saldoInicial)}</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {MESES.map((mes, idx) => {
                    const m = selectedCuenta.movimientos[idx];
                    if (!m || (m.debito === 0 && m.credito === 0)) {
                      return (
                        <div key={mes} className="flex items-center gap-2 text-xs py-0.5">
                          <span className="text-gray-400 w-8 shrink-0">{mes}</span>
                          <span className="text-gray-200 text-xs">—</span>
                        </div>
                      );
                    }
                    return (
                      <div key={mes} className="flex items-center gap-2 text-xs py-0.5 border-b border-gray-50">
                        <span className="text-gray-500 w-8 shrink-0">{mes}</span>
                        <span className="font-mono text-green-700 flex-1 text-right">{m.debito > 0 ? fmtCOP(m.debito) : '—'}</span>
                        <span className="font-mono text-gray-500 flex-1 text-right">{m.credito > 0 ? fmtCOP(m.credito) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-600">Saldo actual</span>
                    <span className={`font-mono ${saldo(selectedCuenta) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmtCOP(Math.abs(saldo(selectedCuenta)))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button className="flex-1 text-xs py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Editar</button>
              <button className="flex-1 text-xs py-1.5 border border-red-200 rounded text-red-500 hover:bg-red-50">Eliminar</button>
            </div>
          </div>
        )}
      </div>

      {/* New account modal (simplified) */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Crear cuenta contable</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              {[
                { label: 'Código', ph: 'Ej. 510506' },
                { label: 'Nombre', ph: 'Nombre de la cuenta' },
                { label: 'Nivel', ph: '4' },
                { label: 'NIT asociado', ph: 'Opcional' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
                    placeholder={f.ph}
                  />
                </div>
              ))}
              {[
                'Afectable', 'Requiere tercero', 'Requiere centro', 'Requiere base',
                'Ajuste por inflación',
              ].map(label => (
                <label key={label} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowNew(false)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">Cancelar</button>
              <button onClick={() => setShowNew(false)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { NavPage } from '../components/Shell';

const CATEGORIAS = [
  {
    id: 'estados',
    nombre: 'Estados y balances',
    icon: '⊟',
    informes: [
      { id: 'balance-comp', nombre: 'Balance de comprobación acumulado', desc: 'Saldos y movimientos acumulados por cuenta', page: 'informes/estados' as NavPage },
      { id: 'balance-mens', nombre: 'Balance mensual', desc: 'Movimiento y saldo por mes' },
      { id: 'balance-gral', nombre: 'Balance general', desc: 'Estado de situación financiera' },
      { id: 'est-resultados', nombre: 'Estado de resultados', desc: 'Ingresos, costos y utilidades' },
      { id: 'inventario-bal', nombre: 'Inventario y balance', desc: 'Activos, pasivos y patrimonio detallados' },
    ],
  },
  {
    id: 'libros',
    nombre: 'Libros contables',
    icon: '📚',
    informes: [
      { id: 'aux-gral', nombre: 'Libro auxiliar general', desc: 'Todas las cuentas con movimiento detallado' },
      { id: 'mayor-bal', nombre: 'Mayor y balance', desc: 'Resumen por cuenta con saldo' },
      { id: 'diario-cta', nombre: 'Diario por cuenta', desc: 'Movimiento ordenado por cuenta' },
      { id: 'caja-diario', nombre: 'Caja diario por comprobante', desc: 'Movimientos de caja ordenados' },
    ],
  },
  {
    id: 'terceros',
    nombre: 'Terceros',
    icon: '👤',
    informes: [
      { id: 'saldos-tercero', nombre: 'Saldos por tercero', desc: 'Saldo de cada tercero en todas las cuentas' },
      { id: 'mov-tercero', nombre: 'Movimiento por tercero', desc: 'Detalle de movimiento por NIT' },
      { id: 'comp-cta-tercero', nombre: 'Comparativo cuenta-tercero', desc: 'Cruce de cuentas contra terceros' },
    ],
  },
  {
    id: 'centros',
    nombre: 'Centros de costo',
    icon: '🏢',
    informes: [
      { id: 'bal-centro', nombre: 'Balance de centro acumulado', desc: 'Saldos acumulados por centro' },
      { id: 'bal-centro-mens', nombre: 'Balance de centro mensual', desc: 'Movimiento mensual por centro' },
      { id: 'centros-mes', nombre: 'Centros discriminados por mes', desc: 'Variación mensual de centros' },
    ],
  },
  {
    id: 'flujo',
    nombre: 'Flujo de caja',
    icon: '💰',
    informes: [
      { id: 'flujo-caja', nombre: 'Flujo de caja comparativo anual', desc: 'Entradas y salidas de efectivo' },
      { id: 'def-cuentas-flujo', nombre: 'Definición de cuentas de flujo', desc: 'Configurar cuentas para el flujo' },
    ],
  },
  {
    id: 'niif',
    nombre: 'NIC / NIIF',
    icon: '🌐',
    informes: [
      { id: 'nic-apertura', nombre: 'Estado de situación de apertura', desc: 'ESFA bajo NIC' },
      { id: 'nic-saldos', nombre: 'Información NIC de saldos', desc: 'Saldos y movimientos bajo NIIF' },
    ],
  },
];

interface Props {
  onNavigate: (page: NavPage) => void;
}

export default function Informes({ onNavigate }: Props) {
  const [searchInforme, setSearchInforme] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [showParams, setShowParams] = useState<string | null>(null);

  const allInformes = CATEGORIAS.flatMap(c => c.informes.map(i => ({ ...i, cat: c.nombre })));
  const filtered = searchInforme
    ? allInformes.filter(i => i.nombre.toLowerCase().includes(searchInforme.toLowerCase()) || i.desc.toLowerCase().includes(searchInforme.toLowerCase()))
    : [];

  const displayCategorias = selectedCat
    ? CATEGORIAS.filter(c => c.id === selectedCat)
    : CATEGORIAS;

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Centro de informes</h1>
          <p className="text-xs text-gray-500">Libros contables, estados financieros, terceros, centros y NIC/NIIF</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
          <input
            value={searchInforme}
            onChange={e => setSearchInforme(e.target.value)}
            placeholder="Buscar informe..."
            className="w-full pl-7 pr-3 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
          />
        </div>
        {CATEGORIAS.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
            className={`text-xs px-2.5 py-1 rounded transition-colors font-medium hidden md:block ${
              selectedCat === c.id ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={selectedCat === c.id ? { backgroundColor: '#0073C0' } : {}}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Search results */}
      {searchInforme && (
        <div className="bg-white rounded border border-gray-200">
          <div className="px-4 py-2.5 border-b border-gray-100 text-xs text-gray-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>
          {filtered.map(inf => (
            <div
              key={inf.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors"
              onClick={() => setShowParams(inf.id)}
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">{inf.nombre}</div>
                <div className="text-xs text-gray-400 mt-0.5">{inf.desc} · {inf.cat}</div>
              </div>
              <button className="text-xs px-3 py-1 rounded text-white shrink-0" style={{ backgroundColor: '#0073C0' }}>
                Generar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Category grid */}
      {!searchInforme && (
        <div className="space-y-4">
          {displayCategorias.map(cat => (
            <div key={cat.id} className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-sm">{cat.icon}</span>
                <h2 className="text-xs font-semibold text-gray-700">{cat.nombre}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
                {cat.informes.map(inf => (
                  <div
                    key={inf.id}
                    className="border border-gray-200 rounded p-3 hover:border-petroleum-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => {
                      if ('page' in inf && inf.page) onNavigate(inf.page as NavPage);
                      else setShowParams(inf.id);
                    }}
                  >
                    <div className="text-xs font-medium text-gray-800 mb-1 group-hover:text-petroleum-600" style={{}}>
                      {inf.nombre}
                    </div>
                    <div className="text-xs text-gray-400">{inf.desc}</div>
                    <div className="mt-2 flex items-center gap-1">
                      <button className="text-xs px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: '#0073C0', fontSize: '10px' }}>
                        Generar
                      </button>
                      <button className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 text-xs" style={{ fontSize: '10px' }}>
                        ⭐ Fav
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report params modal */}
      {showParams && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Parámetros del informe</h3>
              <button onClick={() => setShowParams(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                <input defaultValue="2026" className="w-full font-mono text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes desde</label>
                <select className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none">
                  {['Enero', 'Febrero', 'Marzo'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes hasta</label>
                <select defaultValue="Febrero" className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none">
                  {['Enero', 'Febrero', 'Marzo'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Formato</label>
                <select className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none">
                  <option>PDF</option>
                  <option>XLSX</option>
                  <option>CSV</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowParams(null)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">Cancelar</button>
              <button onClick={() => setShowParams(null)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
                Generar informe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

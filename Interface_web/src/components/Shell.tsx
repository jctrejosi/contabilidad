import { useState, type ReactNode } from 'react';
import { PERIODO, USUARIO } from '../data/mock';
import type { CompaniaSesion } from '../types';
import BotChat from './BotChat';
import Icon from './Icon';
import { FINANCIAL_MODULES, MODULE_ORDER, getModuleFromPage, type FinancialModuleId } from '../data/finance';
import { useFinance } from '../finance/store';

export type NavPage =
  | 'suite'
  | 'dashboard'
  | 'movimientos/captura'
  | 'movimientos/lotes'
  | 'movimientos/anulacion'
  | 'movimientos/importaciones'
  | 'movimientos/nomina'
  | 'movimientos/reembolsos'
  | 'consultas/documentos'
  | 'consultas/mensual'
  | 'consultas/saldos-anuales'
  | 'consultas/anual-cuenta'
  | 'consultas/anual-tercero'
  | 'consultas/anual-centro'
  | 'consultas/saldos-cuenta-centro'
  | 'consultas/documento-especifico'
  | 'consultas/comparativos'
  | 'informes/documentos'
  | 'informes/libros'
  | 'informes/estados'
  | 'informes/terceros'
  | 'informes/centros'
  | 'informes/flujo-caja'
  | 'informes/nic-niif'
  | 'informes/generador'
  | 'medios/formatos'
  | 'medios/conceptos'
  | 'medios/cuentas-manual'
  | 'medios/cuentas-copiar'
  | 'medios/generar'
  | 'medios/revision'
  | 'medios/detalle-tercero'
  | 'medios/totales-tercero'
  | 'medios/formato-tercero'
  | 'medios/documento'
  | 'medios/depurar-topes'
  | 'medios/depurar-cruce'
  | 'reprocesos'
  | 'cierres'
  | 'consolidacion'
  | 'config/parametros'
  | 'config/plan-cuentas'
  | 'config/terceros'
  | 'config/comprobantes'
  | 'config/centros'
  | 'config/renglones'
  | 'config/tipos-doc'
  | 'config/retenciones'
  | 'config/iva'
  | 'config/plantillas'
  | 'config/companias'
  | 'config/formatos'
  | 'config/especiales'
  | 'config/reclasificaciones'
  | 'admin/usuarios'
  | 'admin/bitacora'
  | 'admin/integraciones'
  | 'admin/reorganizacion'
  | FinancialModuleId
  | `${FinancialModuleId}/${string}`;

interface NavItem {
  id: NavPage;
  label: string;
  icon: string;
}

interface NavSubgroup {
  label: string;
  icon: string;
  children: NavItem[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: (NavItem | NavSubgroup)[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'movimientos',
    label: 'Movimientos',
    icon: '⊕',
    items: [
      { id: 'movimientos/captura', label: 'Captura directa', icon: '✎' },
      { id: 'movimientos/lotes', label: 'Lotes', icon: '⊞' },
      { id: 'movimientos/anulacion', label: 'Anulación', icon: '⊘' },
      { id: 'movimientos/importaciones', label: 'Importaciones', icon: '↓' },
      { id: 'movimientos/reembolsos', label: 'Reembolsos', icon: '$' },
    ],
  },
  {
    id: 'consultas',
    label: 'Consultas',
    icon: '⌕',
    items: [
      { id: 'consultas/documentos', label: 'Documentos', icon: '◻' },
      { id: 'consultas/mensual', label: 'Movimiento mensual', icon: '◻' },
      { id: 'consultas/saldos-anuales', label: 'Saldos anuales', icon: '◻' },
      { id: 'consultas/anual-cuenta', label: 'Anual por cuenta', icon: '◻' },
      { id: 'consultas/anual-tercero', label: 'Anual por tercero', icon: '◻' },
      { id: 'consultas/anual-centro', label: 'Anual por centro', icon: '◻' },
      { id: 'consultas/saldos-cuenta-centro', label: 'Saldos cuenta/centro', icon: '◻' },
      { id: 'consultas/documento-especifico', label: 'Documento específico', icon: '◻' },
      { id: 'consultas/comparativos', label: 'Comparativos', icon: '◻' },
    ],
  },
  {
    id: 'informes',
    label: 'Informes',
    icon: '⎙',
    items: [
      { id: 'informes/documentos', label: 'Informes 1–R', icon: '◻' },
    ],
  },
  {
    id: 'medios',
    label: 'Medios magnéticos',
    icon: '▤',
    items: [
      { id: 'medios/formatos', label: '1. Mantenimiento de formatos', icon: '◻' },
      { id: 'medios/conceptos', label: '2. Mantenimiento de conceptos', icon: '◻' },
      {
        label: '3. Asignación de cuentas', icon: '▸',
        children: [
          { id: 'medios/cuentas-manual', label: 'Manual por plan de cuentas', icon: '◻' },
          { id: 'medios/cuentas-copiar', label: 'Traer definiciones de otra compañía', icon: '◻' },
        ],
      },
      { id: 'medios/generar', label: '4. Generar medios', icon: '◻' },
      { id: 'medios/revision', label: '5. Revisión de medios', icon: '◻' },
      { id: 'medios/detalle-tercero', label: '6. Detalle por tercero', icon: '◻' },
      { id: 'medios/totales-tercero', label: '7. Totales por tercero', icon: '◻' },
      { id: 'medios/formato-tercero', label: '8. Formato por tercero', icon: '◻' },
      { id: 'medios/documento', label: '9. Medios por documento', icon: '◻' },
      { id: 'medios/depurar-topes', label: 'A. Depuración por topes', icon: '◻' },
      { id: 'medios/depurar-cruce', label: 'B. Cruce de terceros entre formatos', icon: '◻' },
    ],
  },
  {
    id: 'config',
    label: 'Configuración',
    icon: '⚙',
    items: [
      { id: 'config/parametros', label: 'Parámetros', icon: '◻' },
      { id: 'config/plan-cuentas', label: 'Plan de cuentas', icon: '◻' },
      { id: 'config/terceros', label: 'Terceros', icon: '◻' },
      { id: 'config/comprobantes', label: 'Comprobantes', icon: '◻' },
      { id: 'config/centros', label: 'Centros de costo', icon: '◻' },
      { id: 'config/renglones', label: 'Renglones de renta', icon: '◻' },
      { id: 'config/tipos-doc', label: 'Tipos de documento', icon: '◻' },
      { id: 'config/retenciones', label: 'Retenciones', icon: '◻' },
      { id: 'config/iva', label: 'IVA', icon: '◻' },
      { id: 'config/plantillas', label: 'Plantillas contables', icon: '◻' },
      { id: 'config/companias', label: 'Compañías', icon: '◻' },
      { id: 'config/formatos', label: 'Formatos documentales', icon: '◻' },
      { id: 'config/especiales', label: 'Especiales', icon: '◻' },
      { id: 'config/reclasificaciones', label: 'Reclasificaciones', icon: '◻' },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: '⊛',
    items: [
      { id: 'admin/usuarios', label: 'Usuarios y permisos', icon: '◻' },
      { id: 'admin/bitacora', label: 'Bitácora', icon: '◻' },
      { id: 'admin/integraciones', label: 'Integraciones', icon: '◻' },
      { id: 'admin/reorganizacion', label: 'Reorganización de datos', icon: '◻' },
    ],
  },
];

interface ShellProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  compania: CompaniaSesion;
  onChangeCompany: () => void;
  children: ReactNode;
  badgeAlerts?: number;
}

export default function Shell({ currentPage, onNavigate, compania, onChangeCompany, children, badgeAlerts = 0 }: ShellProps) {
  // El panel lateral se muestra completo; sus grupos de opciones comienzan
  // cerrados y el usuario despliega únicamente el que necesita.
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showNotif, setShowNotif] = useState(false);

  const financialModule = getModuleFromPage(currentPage);
  const isSuite = currentPage === 'suite';
  const financialSlug = currentPage.split('/')[1];
  const { state } = useFinance();

  const liveBadges: Record<string, number> = {
    'facturacion/documentos': state.invoices.filter(item => item.kind === 'FV' && ['Pendiente', 'Enviada', 'Rechazada'].includes(item.dianStatus)).length,
    'facturacion/dian': state.invoices.filter(item => ['Pendiente', 'Enviada', 'Rechazada'].includes(item.dianStatus)).length,
    'cartera/partidas': state.receivables.filter(item => item.balance > 0).length,
    'cartera/aplicacion': state.receipts.filter(item => item.status !== 'Aplicado').length,
    'cuentas-pagar/obligaciones': state.payables.filter(item => item.balance > 0).length,
    'cuentas-pagar/propuestas': state.proposals.filter(item => item.status === 'Pendiente aprobación').length,
    'tesoreria/extractos': state.statements.filter(item => item.status === 'Abierto').length,
    'tesoreria/conciliacion': state.statementLines.filter(item => item.status !== 'Conciliado').length,
    'tesoreria/cheques': state.checks.filter(item => item.status === 'Emitido').length,
    'presupuesto/aprobacion': state.budgets.filter(item => item.status === 'En revisión').length,
    'presupuesto/alertas': state.budgetAlerts.filter(item => item.status === 'Abierta').length,
    'activos-fijos/revalorizaciones': state.revaluations.filter(item => item.status === 'Borrador' || item.status === 'Aprobada').length,
    'activos-fijos/bajas': state.disposals.filter(item => item.status === 'Solicitada' || item.status === 'Aprobada').length,
    'activos-fijos/conciliacion': state.assetReconciliations.filter(item => item.status === 'Diferencia' || item.status === 'Pendiente').length,
  };

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const periodoLabel = `${PERIODO.nombre}`;
  const isGroupActive = (group: NavGroup) =>
    (group.id === 'informes' && currentPage.startsWith('informes/')) ||
    group.items.some(i => 'children' in i ? i.children.some(child => child.id === currentPage) : i.id === currentPage);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside
        className={`flex flex-col shrink-0 transition-all duration-200 sidebar-scroll overflow-y-auto ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ backgroundColor: '#001F4C', color: '#C8F0FD' }}
      >
        {/* Brand */}
        <div
          className={`flex flex-col items-center shrink-0 border-b ${
            collapsed ? 'px-2 py-4' : 'gap-3 px-4 py-4'
          }`}
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className={`flex items-center justify-center bg-white shadow-sm ${
              collapsed ? 'h-10 w-12 rounded-md px-1' : 'w-full rounded-lg px-4 py-3'
            }`}
          >
            <img
              src={`${import.meta.env.BASE_URL}dsi-logo.svg`}
              alt="DSI S.A."
              width={176}
              height={51}
              className={`block h-auto object-contain ${collapsed ? 'w-10' : 'w-44 max-w-full'}`}
            />
          </div>
          {!collapsed && (
            <div className="w-full min-w-0 text-center">
              <div className="text-white font-semibold text-sm leading-tight">CONTABDSI</div>
              <div className="text-xs mt-1" style={{ color: '#7BDCFB' }}>Suite Financiera</div>
            </div>
          )}
        </div>

        {/* Company info (collapsed: just icon) */}
        {!collapsed && (
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.15)' }}>
            <div className="text-xs font-medium text-white truncate">{compania.nombre}</div>
            <div className="text-xs mt-0.5 truncate" style={{ color: '#7BDCFB' }}>NIT {compania.nit || 'No registrado'}</div>
          </div>
        )}

        <div className="px-3 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => onNavigate('suite')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors hover:bg-white/10 ${collapsed ? 'justify-center' : ''}`}
            style={{ backgroundColor: isSuite ? 'rgba(0,176,242,0.14)' : 'rgba(255,255,255,0.05)', color: '#C8F0FD' }}
            title={collapsed ? 'Todos los módulos' : undefined}
          >
            <Icon name="apps" className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="flex-1 text-left">Todos los módulos</span>}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {isSuite && (
            <div className="px-2">
              <div className={collapsed ? 'sr-only' : 'px-3 pt-2 pb-2 text-[10px] font-semibold uppercase tracking-widest'} style={{ color: '#7BDCFB' }}>Módulos</div>
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors hover:bg-white/5"
              >
                <Icon name="ledger" className="w-5 h-5 shrink-0" />
                {!collapsed && <span>Contabilidad general</span>}
              </button>
              {MODULE_ORDER.map(id => {
                const module = FINANCIAL_MODULES[id];
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors hover:bg-white/5"
                  >
                    <Icon name={module.icon} className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>{module.name}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {financialModule && (
            <div className="px-2">
              <div className={`mx-1 mb-2 px-2 py-3 rounded ${collapsed ? 'flex justify-center' : ''}`} style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-3">
                  <Icon name={financialModule.icon} className="w-5 h-5 shrink-0 text-white" />
                  {!collapsed && <div><div className="text-xs font-semibold text-white">{financialModule.name}</div><div className="text-[10px] mt-0.5" style={{ color: '#7BDCFB' }}>Espacio operativo</div></div>}
                </div>
              </div>
              <button
                onClick={() => onNavigate(financialModule.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded transition-colors ${!financialSlug ? 'font-medium text-white' : 'hover:bg-white/5'}`}
                style={!financialSlug ? { backgroundColor: '#0073C0' } : {}}
              >
                <Icon name="apps" className="w-4 h-4 shrink-0" />
                {!collapsed && <span>Resumen del módulo</span>}
              </button>
              {financialModule.nav.map(item => {
                const active = financialSlug === item.slug;
                const badge = liveBadges[`${financialModule.id}/${item.slug}`] ?? item.badge;
                return (
                  <button
                    key={item.slug}
                    title={collapsed ? item.label : undefined}
                    onClick={() => onNavigate(`${financialModule.id}/${item.slug}` as NavPage)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded transition-colors ${active ? 'font-medium text-white' : 'hover:bg-white/5'}`}
                    style={active ? { backgroundColor: '#0073C0' } : {}}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : 'bg-petroleum-400'}`} />
                    {!collapsed && <><span className="flex-1 text-left">{item.label}</span>{badge ? <span className={`min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px] ${active ? 'bg-white/20' : 'bg-white/10'}`}>{badge}</span> : null}</>}
                  </button>
                );
              })}
            </div>
          )}

          {!isSuite && !financialModule && (
            <>
              <div className={collapsed ? 'sr-only' : 'px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest'} style={{ color: '#7BDCFB' }}>Contabilidad general</div>
          {/* Inicio */}
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              currentPage === 'dashboard'
                ? 'text-white font-medium'
                : 'hover:bg-white/5'
            }`}
            style={currentPage === 'dashboard' ? { backgroundColor: '#0073C0', color: '#fff' } : {}}
          >
            <span className="text-base w-5 text-center shrink-0">⌂</span>
            {!collapsed && <span>Inicio contable</span>}
          </button>

          {/* Reprocesos - standalone */}
          {NAV_GROUPS.map(group => (
            <div key={group.id}>
              <button
                onClick={() => {
                  if (collapsed) return;
                  toggleGroup(group.id);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${
                  isGroupActive(group) ? 'text-white' : ''
                }`}
              >
                <span className="text-base w-5 text-center shrink-0 font-mono">{group.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    <span className="text-xs opacity-60">{expandedGroups.has(group.id) ? '▾' : '▸'}</span>
                  </>
                )}
              </button>
              {!collapsed && expandedGroups.has(group.id) && (
                <div className="ml-8 border-l" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  {group.items.map(item => 'children' in item ? (
                    <div key={item.label}>
                      <button type="button" onClick={() => toggleGroup('medios/asignacion')}
                        className="flex w-full items-center gap-2 py-2 pl-3 pr-4 text-left text-xs transition-colors hover:bg-white/5 hover:text-white"
                        aria-expanded={expandedGroups.has('medios/asignacion')}>
                        <span className="flex-1">{item.label}</span><span className="opacity-60">{expandedGroups.has('medios/asignacion') ? '▾' : '▸'}</span>
                      </button>
                      {expandedGroups.has('medios/asignacion') && <div className="ml-3 border-l border-white/10">
                        {item.children.map(child => <button key={child.id} type="button" onClick={() => onNavigate(child.id)}
                          className={`w-full py-2 pl-3 pr-2 text-left text-xs transition-colors ${currentPage === child.id ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white'}`}>
                          {child.label}
                        </button>)}
                      </div>}
                    </div>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-2 pl-3 pr-4 py-2 text-xs transition-colors ${
                        currentPage === item.id
                          ? 'text-white font-medium border-l-2'
                          : 'hover:text-white hover:bg-white/5'
                      }`}
                      style={
                        currentPage === item.id
                          ? { borderLeftColor: '#00B0F2', color: '#fff', backgroundColor: 'rgba(0,176,242,0.14)' }
                          : {}
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Reprocesos standalone */}
          {(['reprocesos', 'cierres', 'consolidacion'] as NavPage[]).map(p => {
            const labels: Record<string, string> = { reprocesos: 'Reprocesos y auditoría', cierres: 'Cierres', consolidacion: 'Consolidación' };
            const icons: Record<string, string> = { reprocesos: '↺', cierres: '⊟', consolidacion: '⊕' };
            return (
              <button
                key={p}
                onClick={() => onNavigate(p)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  currentPage === p ? 'text-white font-medium' : 'hover:bg-white/5'
                }`}
                style={currentPage === p ? { backgroundColor: '#0073C0' } : {}}
              >
                <span className="text-base w-5 text-center shrink-0 font-mono">{icons[p]}</span>
                {!collapsed && <span>{labels[p]}</span>}
              </button>
            );
          })}
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="shrink-0 border-t p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center gap-2 py-1.5 text-xs rounded transition-colors hover:bg-white/10"
            style={{ color: '#7BDCFB' }}
          >
            <span>{collapsed ? '»' : '«'}</span>
            {!collapsed && <span>Contraer</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <header className="shrink-0 bg-white border-b border-gray-200 flex items-center gap-3 px-4 h-14 z-20">
          {/* Company pill */}
          <button
            type="button"
            onClick={onChangeCompany}
            title="Cambiar compañía"
            className="group flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition hover:ring-1 hover:ring-[#0073C0]"
            style={{ backgroundColor: '#EFFAFF', color: '#001F4C' }}
          >
            <span className="font-semibold">{compania.codigo}</span>
            <span className="text-gray-400">|</span>
            <span className="truncate max-w-40">{compania.nombre}</span>
            <span className="hidden text-[10px] text-[#0073C0] group-hover:inline">Cambiar</span>
          </button>

          <div className="text-gray-300 text-xs">|</div>

          {/* Period + status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">{PERIODO.anio}</span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-xs text-gray-600">{periodoLabel}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                PERIODO.estado === 'Abierto'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {PERIODO.estado}
            </span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs ml-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">⌕</span>
              <input
                type="text"
                placeholder="Buscar cuenta, documento, tercero..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:border-petroleum-500"
                style={{ '--tw-ring-color': '#0073C0' } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotif(v => !v)}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <span className="text-base">🔔</span>
              {badgeAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {badgeAlerts}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-10 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
                </div>
                <div className="py-1 max-h-60 overflow-y-auto">
                  <div className="px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50">
                    <div className="text-xs text-red-600 font-medium">Lote NOM2 tiene 2 errores</div>
                    <div className="text-xs text-gray-400 mt-0.5">Hace 2 horas</div>
                  </div>
                  <div className="px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50">
                    <div className="text-xs text-amber-600 font-medium">Lote DEP-01 pendiente de aprobación</div>
                    <div className="text-xs text-gray-400 mt-0.5">Hace 3 días</div>
                  </div>
                  <div className="px-4 py-2.5 hover:bg-gray-50">
                    <div className="text-xs text-blue-600 font-medium">Retenciones sin acumular en feb 2026</div>
                    <div className="text-xs text-gray-400 mt-0.5">Hoy</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Asistente contable (botón al lado del usuario) */}
          <BotChat
            compania={compania}
            periodo={`${PERIODO.anio} · ${periodoLabel}`}
            usuario={USUARIO.nombre}
          />

          {/* User */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: '#0073C0' }}
            >
              LG
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-medium text-gray-800 leading-tight">{USUARIO.nombre}</div>
              <div className="text-xs text-gray-400">{USUARIO.rol}</div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Notif backdrop */}
      {showNotif && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PERIODO } from '../data/mock';
import { useModuleUser } from './ModuleUser';
import type { CompaniaSesion } from '../types';
import BotChat from './BotChat';

export type NavPage =
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
  | 'admin/reorganizacion';

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

const HEADER_BG = 'radial-gradient(700px 320px at 100% 0%, rgba(31,206,196,.22), transparent 70%), radial-gradient(600px 300px at 0% 100%, rgba(15,112,252,.3), transparent 70%), linear-gradient(120deg, #003760, #002D49)';

/** Opción suelta que va como pestaña directa después de los grupos. */
const DIRECT_ITEMS: NavItem[] = [
  { id: 'reprocesos', label: 'Reprocesos y auditoría', icon: '↺' },
];

/** Grupos que se muestran directamente en la fila 2. */
const MAIN_GROUPS = NAV_GROUPS.filter(group => group.id !== 'admin');

/**
 * Lo menos usado pasa a "Más" (sección 7.2): Administración como subgrupo,
 * Cierres y Consolidación como opciones. Se conserva el orden del menú anterior.
 */
const MORE_GROUP: NavGroup = {
  id: 'mas',
  label: 'Más',
  icon: '⋯',
  items: [
    ...NAV_GROUPS.filter(group => group.id === 'admin').map(group => ({ label: group.label, icon: group.icon, children: group.items as NavItem[] })),
    { id: 'cierres', label: 'Cierres', icon: '⊟' },
    { id: 'consolidacion', label: 'Consolidación', icon: '⊕' },
  ],
};

const TAB_BASE = 'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-[13px] transition-colors sm:px-4 sm:py-3.5 sm:text-[13.5px]';
const TAB_ACTIVE = 'font-semibold text-white';
const TAB_IDLE = 'font-medium text-white/70 hover:bg-white/5 hover:text-white';

function ActiveLine() {
  return <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-gradient-to-r from-[#21CC93] to-[#33B1FF]" />;
}

function countOptions(group: NavGroup): number {
  return group.items.reduce((total, item) => total + ('children' in item ? item.children.length : 1), 0);
}

interface ShellProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  compania: CompaniaSesion;
  onChangeCompany: () => void;
  children: ReactNode;
  badgeAlerts?: number;
}

interface OpenMenu {
  groupId: string;
  left: number;
  top: number;
  /** Menos de 768 px: el desplegable se abre como panel a todo el ancho. */
  mobile: boolean;
}

export default function Shell({ currentPage, onNavigate, compania, onChangeCompany, children, badgeAlerts = 0 }: ShellProps) {
  const moduleUser = useModuleUser();
  const [showNotif, setShowNotif] = useState(false);
  // Solo un desplegable de grupo abierto a la vez.
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setOpenMenu(null);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if ((target as Element).closest?.('[data-nav-group]')) return;
      setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    const nav = navRef.current;
    const onScroll = () => setOpenMenu(null);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    nav?.addEventListener('scroll', onScroll);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      nav?.removeEventListener('scroll', onScroll);
    };
  }, [openMenu]);

  function toggleGroup(groupId: string, button: HTMLElement) {
    if (openMenu?.groupId === groupId) {
      setOpenMenu(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    setShowNotif(false);
    setOpenMenu({ groupId, left: rect.left, top: rect.bottom + 6, mobile: window.innerWidth < 768 });
  }

  function go(page: NavPage) {
    setOpenMenu(null);
    onNavigate(page);
  }

  const periodoLabel = `${PERIODO.nombre}`;
  const isGroupActive = (group: NavGroup) =>
    (group.id === 'informes' && currentPage.startsWith('informes/')) ||
    group.items.some(i => 'children' in i ? i.children.some(child => child.id === currentPage) : i.id === currentPage);

  const initials = moduleUser.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const openGroup = openMenu ? [...NAV_GROUPS, MORE_GROUP].find(group => group.id === openMenu.groupId) ?? null : null;

  function renderMenu(group: NavGroup, anchor: OpenMenu) {
    const isMobile = anchor.mobile;
    const total = countOptions(group);
    const columns = isMobile || total <= 8 ? 1 : total <= 16 ? 2 : 3;
    const width = isMobile ? undefined : columns === 1 ? 240 : columns === 2 ? 500 : 760;
    const style: CSSProperties = isMobile
      ? { left: 12, right: 12, top: anchor.top, maxHeight: '70vh' }
      : { left: Math.max(16, Math.min(anchor.left, window.innerWidth - (width ?? 240) - 16)), top: anchor.top, width, maxHeight: `calc(100vh - ${anchor.top + 16}px)` };

    const option = (item: NavItem, nested = false) => (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        onClick={() => go(item.id)}
        aria-current={currentPage === item.id ? 'page' : undefined}
        className={`flex min-h-9 w-full items-center rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-[#F7F7F7] ${
          nested ? 'pl-6' : ''
        } ${currentPage === item.id ? 'font-semibold text-[#0F70FC]' : 'font-medium text-[#002D49]'}`}
      >
        {item.label}
      </button>
    );

    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label={group.label}
        className="fixed z-50 overflow-y-auto rounded-[14px] border border-[#E6E9EC] bg-white p-2 shadow-[0_20px_40px_-16px_rgba(0,45,73,.45)]"
        style={style}
      >
        <div className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8A97A3]">{group.label}</div>
        <div style={{ columnCount: columns, columnGap: 8 }}>
          {group.items.map(item => 'children' in item ? (
            <div key={item.label} className="break-inside-avoid">
              <div className="px-3 pb-1 pt-2 text-[12px] font-semibold text-[#5B6B7A]">{item.label}</div>
              {item.children.map(child => option(child, true))}
            </div>
          ) : (
            <div key={item.id} className="break-inside-avoid">{option(item)}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F7F7F7] font-sans">
      <header className="relative z-30 shrink-0 text-white" style={{ background: HEADER_BG }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <img src={`${import.meta.env.BASE_URL}fortuner-isotipo.png`} alt="" className="absolute -top-16 right-[6%] w-[180px] select-none opacity-[.08]" />
        </div>

        <div className="relative px-4 sm:px-6">
          {/* Fila 1: identidad y contexto */}
          <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <img
                src={`${import.meta.env.BASE_URL}fortuner-logo-oscuro.png`}
                alt="Fortuner Software Empresarial"
                className="h-auto w-[170px] shrink-0 sm:w-[220px]"
              />
              <span className="hidden h-8 w-px bg-white/15 lg:block" />
              <span className="hidden truncate text-lg font-semibold lg:block" title="Contabilidad General">Contabilidad</span>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {/* Chip de compañía: conserva la acción de cambiar compañía */}
              <button
                type="button"
                onClick={onChangeCompany}
                title={`Cambiar compañía · NIT ${compania.nit || 'No registrado'}`}
                aria-label={`Compañía ${compania.codigo} ${compania.nombre}. Cambiar compañía`}
                className="group inline-flex min-w-0 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-white/14"
              >
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#21CC93] shadow-[0_0_0_3px_rgba(33,204,147,.25)]" />
                <span className="font-semibold">{compania.codigo}</span>
                <span className="hidden max-w-48 truncate xl:inline">· {compania.nombre}</span>
              </button>

              {/* Chip de periodo */}
              <span className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[12.5px] font-medium lg:inline-flex">
                {PERIODO.anio} · {periodoLabel}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    PERIODO.estado === 'Abierto' ? 'bg-[#21CC93]/20 text-[#7FF0CB]' : 'bg-red-500/25 text-red-100'
                  }`}
                >
                  {PERIODO.estado}
                </span>
              </span>

              {/* Buscador existente */}
              <div className="hidden w-64 2xl:block">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/60">⌕</span>
                  <input
                    type="text"
                    placeholder="Buscar cuenta, documento, tercero..."
                    className="w-full rounded-xl border border-white/10 bg-white/10 py-2 pl-8 pr-3 text-xs text-white placeholder:text-white/50 focus:bg-white focus:text-[#002D49] focus:placeholder:text-[#8A97A3]"
                  />
                </div>
              </div>

              {/* Notificaciones */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setOpenMenu(null); setShowNotif(v => !v); }}
                  aria-label="Notificaciones"
                  className="relative flex h-10 w-10 items-center justify-center rounded-[10px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span className="text-base">🔔</span>
                  {badgeAlerts > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                      {badgeAlerts}
                    </span>
                  )}
                </button>
                {showNotif && (
                  <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-[14px] border border-[#E6E9EC] bg-white text-[#002D49] shadow-[0_20px_40px_-16px_rgba(0,45,73,.45)]">
                    <div className="border-b border-gray-100 px-4 py-3">
                      <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      <div className="border-b border-gray-50 px-4 py-2.5 hover:bg-gray-50">
                        <div className="text-xs font-medium text-red-600">Lote NOM2 tiene 2 errores</div>
                        <div className="mt-0.5 text-xs text-gray-400">Hace 2 horas</div>
                      </div>
                      <div className="border-b border-gray-50 px-4 py-2.5 hover:bg-gray-50">
                        <div className="text-xs font-medium text-amber-600">Lote DEP-01 pendiente de aprobación</div>
                        <div className="mt-0.5 text-xs text-gray-400">Hace 3 días</div>
                      </div>
                      <div className="px-4 py-2.5 hover:bg-gray-50">
                        <div className="text-xs font-medium text-blue-600">Retenciones sin acumular en feb 2026</div>
                        <div className="mt-0.5 text-xs text-gray-400">Hoy</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Asistente contable */}
              <BotChat
                compania={compania}
                periodo={`${PERIODO.anio} · ${periodoLabel}`}
                usuario={moduleUser.name}
              />

              {/* Usuario */}
              <div className="flex shrink-0 items-center gap-2.5 rounded-xl bg-white/8 py-1.5 pl-1.5 pr-1.5 md:pr-3">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#21CC93] to-[#0F70FC] text-[13px] font-semibold">
                  {initials}
                </span>
                <span className="hidden md:block">
                  <span className="block max-w-40 truncate text-[13px] font-semibold leading-tight">{moduleUser.name}</span>
                  <span className="block text-[11px] text-white/60">{moduleUser.code}{moduleUser.administrator ? ' · Administrador' : ''}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Fila 2: navegación del módulo */}
          <nav aria-label="Navegación de Contabilidad" className="-mx-4 flex border-t border-white/10 sm:-mx-6">
            <div ref={navRef} className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-2 [scrollbar-width:none] sm:px-4">
              <button
                type="button"
                onClick={() => go('dashboard')}
                aria-current={currentPage === 'dashboard' ? 'page' : undefined}
                className={`${TAB_BASE} ${currentPage === 'dashboard' ? TAB_ACTIVE : TAB_IDLE}`}
              >
                <span className={`text-[17px] leading-none ${currentPage === 'dashboard' ? 'text-[#21CC93]' : ''}`}>⌂</span>
                Inicio
                {currentPage === 'dashboard' && <ActiveLine />}
              </button>

              {MAIN_GROUPS.map(group => {
                const active = isGroupActive(group);
                const open = openMenu?.groupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    data-nav-group={group.id}
                    onClick={event => toggleGroup(group.id, event.currentTarget)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_IDLE} ${open ? 'bg-white/5 text-white' : ''}`}
                  >
                    <span className={`font-mono text-[17px] leading-none ${active ? 'text-[#21CC93]' : ''}`}>{group.icon}</span>
                    {group.label}
                    <span className={`text-[10px] opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                    {active && <ActiveLine />}
                  </button>
                );
              })}

              {DIRECT_ITEMS.map(item => {
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_IDLE}`}
                  >
                    <span className={`font-mono text-[17px] leading-none ${active ? 'text-[#21CC93]' : ''}`}>{item.icon}</span>
                    {item.label}
                    {active && <ActiveLine />}
                  </button>
                );
              })}
            </div>

            <div className="shrink-0 border-l border-white/10 pr-2 sm:pr-4">
              <button
                type="button"
                data-nav-group={MORE_GROUP.id}
                onClick={event => toggleGroup(MORE_GROUP.id, event.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={openMenu?.groupId === MORE_GROUP.id}
                className={`${TAB_BASE} ${isGroupActive(MORE_GROUP) ? TAB_ACTIVE : TAB_IDLE} ${openMenu?.groupId === MORE_GROUP.id ? 'bg-white/5 text-white' : ''}`}
              >
                Más
                <span className={`text-[10px] opacity-70 transition-transform ${openMenu?.groupId === MORE_GROUP.id ? 'rotate-180' : ''}`}>▾</span>
                {isGroupActive(MORE_GROUP) && <ActiveLine />}
              </button>
            </div>
          </nav>
        </div>
      </header>

      {openGroup && openMenu && renderMenu(openGroup, openMenu)}

      {/* Contenido a todo el ancho; solo esta zona se desplaza */}
      <main className="min-h-0 flex-1 overflow-auto">
        {children}
      </main>

      {showNotif && (
        <div className="fixed inset-0 z-20" onClick={() => setShowNotif(false)} />
      )}
    </div>
  );
}

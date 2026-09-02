/* ============================================================
   CONTABDSI · Shell: sidebar + header + contenido + toasts
   ============================================================ */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Badge, Icon, IconButton, SearchInput } from '@/components/ui'
import { CompanyPeriodSwitcher } from '@/components/accounting/Widgets'
import { PeriodBadge } from '@/components/accounting/DataGrid'
import { NAV, ROLE_LABELS } from './nav'
import { useStore, roleHas } from '@/state/AppStore'
import { ROLES } from '@/data/mock'
import './shell.css'

export function Shell() {
  const { state, dispatch } = useStore()
  const [busqueda, setBusqueda] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const navigate = useNavigate()

  const { session, role } = state

  const notificaciones = useMemo(() => {
    const nots: { id: string; tone: 'warning' | 'danger' | 'info' | 'success'; titulo: string; detalle: string; to?: string }[] = []
    const conErrores = state.lotes.filter((l) => l.estado === 'CON_ERRORES')
    if (conErrores.length > 0) {
      nots.push({ id: 'n1', tone: 'danger', titulo: 'Lotes con errores', detalle: `${conErrores.map((l) => l.codigo).join(', ')} requieren corrección.`, to: '/movimientos/lotes' })
    }
    const pendientes = state.lotes.filter((l) => l.estado === 'PENDIENTE_APROBACION')
    if (pendientes.length > 0) {
      nots.push({ id: 'n2', tone: 'warning', titulo: 'Lotes pendientes de aprobación', detalle: `${pendientes.map((l) => l.codigo).join(', ')} esperan su aprobación.`, to: '/movimientos/lotes' })
    }
    nots.push({ id: 'n3', tone: 'info', titulo: 'Acumulados de retención', detalle: 'Última acumulación: 27/02/2026 23:00. Al día.', to: '/impuestos/retenciones' })
    if (state.massiveLock) {
      nots.push({ id: 'n4', tone: 'danger', titulo: 'Proceso masivo en curso', detalle: `${state.massiveLock.proceso} bloquea la compañía (${state.massiveLock.usuario}).` })
    }
    return nots
  }, [state.lotes, state.massiveLock])

  const resultados = useMemo(() => {
    if (!busqueda.trim()) return []
    const q = busqueda.toLowerCase()
    const out: { label: string; sub: string; to: string; icon: string }[] = []
    for (const sec of NAV) {
      for (const it of sec.items) {
        if (roleHas(role, it.perm ?? 'consulta.ver') && it.label.toLowerCase().includes(q) && it.to) {
          out.push({ label: it.label, sub: sec.label, to: it.to, icon: it.icon })
        }
      }
    }
    for (const l of state.lotes) {
      if (l.codigo.toLowerCase().includes(q) || l.nombre.toLowerCase().includes(q)) {
        out.push({ label: `Lote ${l.codigo} — ${l.nombre}`, sub: 'Lotes', to: `/movimientos/lotes/${l.codigo}`, icon: 'lote' })
      }
    }
    for (const a of state.accounts) {
      if (a.code.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q)) {
        out.push({ label: `${a.code} — ${a.nombre}`, sub: 'Plan de cuentas', to: '/configuracion/plan-cuentas', icon: 'plan' })
      }
    }
    return out.slice(0, 8)
  }, [busqueda, role, state.lotes, state.accounts])

  const filterNav = (items: typeof NAV[number]['items']) =>
    items.filter((it) => {
      if (it.featureFlag && !state.featureFlags[it.featureFlag]) return false
      if (it.children) return it.children.some((c) => roleHas(role, c.perm ?? 'consulta.ver'))
      return roleHas(role, it.perm ?? 'consulta.ver')
    })

  return (
    <div className="shell" data-density={state.density}>
      <aside className={`sidebar ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><Icon name="libro" size={18} /></span>
          {!state.sidebarCollapsed && (
            <span className="brand-text">
              <b>CONTABDSI</b>
              <span className="brand-sub">Contabilidad general</span>
            </span>
          )}
        </div>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {NAV.map((sec) => {
            const items = filterNav(sec.items)
            if (items.length === 0) return null
            return (
              <div key={sec.key} className="nav-section">
                {!state.sidebarCollapsed && <div className="nav-section-label">{sec.label}</div>}
                {items.map((it) => {
                  const badge = state.lotes.filter((l) => l.estado === 'CON_ERRORES').length
                  return (
                    <NavLink
                      key={it.key}
                      to={it.to ?? '#'}
                      end={it.to === '/'}
                      className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
                      title={state.sidebarCollapsed ? it.label : undefined}
                    >
                      <Icon name={it.icon} size={17} />
                      {!state.sidebarCollapsed && (
                        <>
                          <span className="nav-item-label">{it.label}</span>
                          {it.key === 'lotes' && badge > 0 ? <Badge tone="danger">{badge}</Badge> : null}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })} title={state.sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}>
            <Icon name={state.sidebarCollapsed ? 'chevronR' : 'chevronL'} size={17} />
            {!state.sidebarCollapsed && <span className="nav-item-label">Contraer menú</span>}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div className="header-left">
            <CompanyPeriodSwitcher />
          </div>
          <div className="header-center">
            <div className="header-search">
              <SearchInput
                value={busqueda}
                onChange={setBusqueda}
                width={340}
                placeholder="Buscar menú, lote, cuenta…  (Ctrl+K)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && resultados[0]) { navigate(resultados[0].to); setBusqueda('') }
                  if (e.key === 'Escape') setBusqueda('')
                }}
              />
              {busqueda.trim() && (
                <div className="header-search-pop">
                  {resultados.length === 0 ? (
                    <div className="hs-empty">Sin resultados para «{busqueda}»</div>
                  ) : (
                    resultados.map((r, i) => (
                      <button key={i} className="hs-item" onClick={() => { navigate(r.to); setBusqueda('') }}>
                        <Icon name={r.icon} size={14} className="muted" />
                        <span className="grow">
                          <span className="hs-label">{r.label}</span>
                          <span className="hs-sub">{r.sub}</span>
                        </span>
                        <Icon name="chevronR" size={12} className="muted" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="header-right">
            <div className="period-chip">
              <PeriodBadge status={state.periodStatus} />
            </div>
            <div className="header-icon-wrap">
              <IconButton icon="bell" label="Notificaciones" onClick={() => setNotifOpen((o) => !o)} active={notifOpen} />
              {notifOpen && (
                <div className="notif-pop">
                  <div className="notif-title xs muted bold">NOTIFICACIONES</div>
                  {notificaciones.length === 0 ? (
                    <div className="hs-empty">Sin notificaciones</div>
                  ) : (
                    notificaciones.map((n) => (
                      <button key={n.id} className="notif-item" onClick={() => { if (n.to) navigate(n.to); setNotifOpen(false) }}>
                        <span className={`notif-dot notif-${n.tone}`} />
                        <span className="grow">
                          <span className="hs-label">{n.titulo}</span>
                          <span className="hs-sub">{n.detalle}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="header-icon-wrap">
              <div className="user-chip" onClick={() => setUserOpen((o) => !o)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setUserOpen((o) => !o) }} aria-haspopup="menu" aria-expanded={userOpen}>
                <span className="user-avatar">{session.user.iniciales}</span>
                <span className="user-meta">
                  <b>{session.user.nombre}</b>
                  <span className="xs muted">{ROLE_LABELS[session.user.role]}</span>
                </span>
                <Icon name="chevronD" size={12} className="muted" />
              </div>
              {userOpen && (
                <div className="user-pop">
                  <div className="notif-title xs muted bold">CAMBIAR ROL (SIMULACIÓN DE PERMISOS)</div>
                  {ROLES.map((r) => (
                    <button key={r.key} className={`notif-item ${r.key === role ? 'notif-item-active' : ''}`} onClick={() => { dispatch({ type: 'SET_ROLE', role: r.key }); setUserOpen(false) }}>
                      <span className="grow">
                        <span className="hs-label">{r.label}</span>
                        <span className="hs-sub">{r.description}</span>
                      </span>
                      {r.key === role ? <Icon name="check" size={14} className="pos" /> : null}
                    </button>
                  ))}
                  <div className="notif-note xs muted">Los permisos por rol se aplican en toda la interfaz. Las acciones sensibles quedan auditadas.</div>
                </div>
              )}
            </div>
            <div className="header-icon-wrap">
              <IconButton
                icon="columns"
                label="Densidad"
                onClick={() => dispatch({ type: 'SET_DENSITY', density: state.density === 'compact' ? 'comfortable' : 'compact' })}
                active={state.density === 'comfortable'}
              />
            </div>
          </div>
        </header>

        <div className="banner-stack">
          {state.periodStatus === 'CERRADO' && (
            <Banner tone="warning" icon="lock">
              El período <b>{session.periodName} {session.year}</b> está <b>cerrado</b>. La información es de solo lectura. Para registrar movimientos, reabra el período en el selector de compañía/período.
            </Banner>
          )}
          {state.massiveLock && (
            <Banner tone="danger" icon="clock">
              Proceso masivo en curso: <b>{state.massiveLock.proceso}</b> (iniciado por {state.massiveLock.usuario}). La compañía está bloqueada para captura y contabilización hasta que finalice.
            </Banner>
          )}
          {role === 'GERENCIA' && (
            <Banner tone="info" icon="eye">
              Modo consulta gerencial: acciones de escritura deshabilitadas para su rol.
            </Banner>
          )}
        </div>

        <main className="content" id="main-content">
          <Outlet />
        </main>
      </div>

      <ToastHost />
      <GlobalShortcuts onSearch={() => { document.querySelector<HTMLInputElement>('.header-search input')?.focus() }} />
    </div>
  )
}

function Banner({ children, tone, icon }: { children: ReactNode; tone: 'warning' | 'danger' | 'info'; icon: string }) {
  return (
    <div className={`banner banner-${tone}`} role="alert">
      <Icon name={icon} size={15} />
      <span>{children}</span>
    </div>
  )
}

/* ---------------- Toasts ---------------- */

function ToastHost() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <Icon name={t.kind === 'success' ? 'success' : t.kind === 'error' ? 'error' : t.kind === 'warning' ? 'warn' : 'info'} size={16} />
          <div className="grow">
            <b className="small">{t.titulo}</b>
            {t.detalle ? <div className="xs muted">{t.detalle}</div> : null}
          </div>
          <IconButton icon="x" label="Cerrar" size={20} onClick={() => dismissToast(t.id)} />
        </div>
      ))}
    </div>
  )
}

/* ---------------- Atajo global Ctrl+K ---------------- */

function GlobalShortcuts({ onSearch }: { onSearch: () => void }) {
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onSearchRef.current()
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])
  return null
}

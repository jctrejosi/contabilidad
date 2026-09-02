/* ============================================================
   CONTABDSI · Dashboard — tablero del contador
   ============================================================ */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Icon, LoadingState, NoPermissionState, PageHeader } from '@/components/ui'
import { PeriodBadge } from '@/components/accounting/DataGrid'
import { usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { fechaHora, money, sum } from '@/core/format'
import { LOTE_ESTADOS } from '@/core/types'
import type { Lote, LoteEstado } from '@/core/types'

interface Alerta {
  id: string
  icon: string
  texto: ReactNode
  to?: string
}

interface Tarea {
  id: string
  icon: string
  texto: ReactNode
  accion: string
  to: string
}

export function DashboardPage() {
  usePageTitle('Inicio')
  const navigate = useNavigate()
  const { state } = useStore()
  const puedeVer = useCan('consulta.ver')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setCargando(false), 400)
    return () => window.clearTimeout(t)
  }, [])

  const periodoStr = `${state.session.year}${String(state.session.period).padStart(2, '0')}`
  const docsMes = state.documentos.filter((d) => d.periodo === periodoStr)
  const debMes = sum(docsMes.flatMap((d) => d.lineas.map((l) => l.debito)))
  const creMes = sum(docsMes.flatMap((d) => d.lineas.map((l) => l.credito)))
  const difMes = Math.round((debMes - creMes) * 100) / 100

  const porEstado = useMemo(() => {
    const mapa = new Map<LoteEstado, Lote[]>()
    for (const l of state.lotes) {
      const arr = mapa.get(l.estado) ?? []
      arr.push(l)
      mapa.set(l.estado, arr)
    }
    return mapa
  }, [state.lotes])

  const estadosVisibles = useMemo(
    () => (Object.keys(LOTE_ESTADOS) as LoteEstado[]).filter((e) => (porEstado.get(e)?.length ?? 0) > 0),
    [porEstado],
  )

  if (!puedeVer) {
    return (
      <div className="page">
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="page">
        <PageHeader title="Inicio" icon="home" />
        <Card>
          <LoadingState label="Cargando tablero…" />
        </Card>
      </div>
    )
  }

  const alertas: Alerta[] = []
  for (const l of state.lotes) {
    const errores = l.issues.filter((i) => i.severidad === 'ERROR')
    if (l.estado === 'CON_ERRORES') {
      alertas.push({
        id: `al-${l.codigo}`,
        icon: 'error',
        texto: (
          <span>
            Lote <b>{l.codigo}</b> — {l.nombre}: {errores.length} error(es) por corregir.
          </span>
        ),
        to: `/movimientos/lotes/${l.codigo}`,
      })
    }
    const desc = l.issues.find((i) => i.tipo === 'DESCUADRE')
    if (desc) {
      alertas.push({
        id: `ad-${l.codigo}`,
        icon: 'warn',
        texto: (
          <span>
            Lote <b>{l.codigo}</b> — {l.nombre}: {desc.mensaje}
          </span>
        ),
        to: `/movimientos/lotes/${l.codigo}`,
      })
    }
  }
  const tsAcum = new Date(state.acumuladosFecha).getTime()
  if (Number.isFinite(tsAcum) && Date.now() - tsAcum > 48 * 3600 * 1000) {
    alertas.push({
      id: 'al-acum',
      icon: 'clock',
      texto: <span>Acumulados desactualizados: última acumulación {fechaHora(state.acumuladosFecha)}.</span>,
      to: '/impuestos/retenciones',
    })
  }

  const tareas: Tarea[] = []
  for (const l of state.lotes) {
    switch (l.estado) {
      case 'BORRADOR':
        tareas.push({
          id: `t-${l.codigo}`, icon: 'edit', accion: 'Completar captura',
          texto: <span>Lote <b>{l.codigo}</b> — {l.nombre} está en borrador.</span>,
          to: `/movimientos/lotes/${l.codigo}`,
        })
        break
      case 'CON_ERRORES':
        tareas.push({
          id: `t-${l.codigo}`, icon: 'warn', accion: 'Corregir errores',
          texto: <span>Lote <b>{l.codigo}</b> — {l.nombre} tiene errores de validación.</span>,
          to: `/movimientos/lotes/${l.codigo}`,
        })
        break
      case 'VERIFICADO':
        tareas.push({
          id: `t-${l.codigo}`, icon: 'upload', accion: 'Enviar a aprobación',
          texto: <span>Lote <b>{l.codigo}</b> — {l.nombre} está verificado.</span>,
          to: `/movimientos/lotes/${l.codigo}`,
        })
        break
      case 'PENDIENTE_APROBACION':
        tareas.push({
          id: `t-${l.codigo}`, icon: 'shield', accion: 'Aprobar lote',
          texto: <span>Lote <b>{l.codigo}</b> — {l.nombre} espera aprobación.</span>,
          to: `/movimientos/lotes/${l.codigo}`,
        })
        break
      case 'APROBADO':
        tareas.push({
          id: `t-${l.codigo}`, icon: 'play', accion: 'Contabilizar',
          texto: <span>Lote <b>{l.codigo}</b> — {l.nombre} está aprobado y listo para contabilizar.</span>,
          to: `/movimientos/lotes/${l.codigo}`,
        })
        break
    }
  }

  const accesos = [
    { id: 'lotes', icon: 'lote', label: 'Lotes', to: '/movimientos/lotes' },
    { id: 'captura', icon: 'entrada', label: 'Captura directa', to: '/movimientos/captura' },
    { id: 'anulacion', icon: 'anular', label: 'Anulación', to: '/movimientos/anulacion' },
    { id: 'plan', icon: 'plan', label: 'Plan de cuentas', to: '/configuracion/plan-cuentas' },
    { id: 'impresion', icon: 'print', label: 'Impresión', to: '/informes' },
    { id: 'auditoria', icon: 'bitacora', label: 'Auditoría', to: '/administracion/bitacora' },
  ]

  const irAEstado = (e: LoteEstado) => {
    if (e === 'CON_ERRORES') {
      navigate('/movimientos/lotes/NOM2')
      return
    }
    navigate('/movimientos/lotes')
  }

  return (
    <div className="page">
      <PageHeader
        title="Inicio"
        subtitle={`${state.session.company.codigo} — ${state.session.company.nombre} · NIT ${state.session.company.nit}`}
        icon="home"
        badge={
          <div className="row gap-8">
            <span className="small muted tnum">{state.session.year} · {state.session.periodName}</span>
            <PeriodBadge status={state.periodStatus} />
          </div>
        }
      />

      {(state.periodStatus === 'CERRADO' || state.massiveLock) && (
        <div className={`local-banner ${state.massiveLock ? 'local-banner-danger' : 'local-banner-warning'}`} role="alert">
          <Icon name={state.massiveLock ? 'clock' : 'lock'} size={15} />
          <span>
            {state.massiveLock ? (
              <>Proceso masivo en curso: <b>{state.massiveLock.proceso}</b> (iniciado por {state.massiveLock.usuario}). La compañía está bloqueada para captura y contabilización.</>
            ) : (
              <>El período <b>{state.session.periodName} {state.session.year}</b> está <b>cerrado</b>. La información es de solo lectura.</>
            )}
          </span>
        </div>
      )}

      <div className="page-grid">
        <div className="col-3">
          <div className="stat-card">
            <span className="stat-label"><Icon name="entrada" size={13} /> Débitos del mes</span>
            <span className="stat-value money">{money(debMes)}</span>
            <span className="stat-sub">{state.session.periodName} {state.session.year} · contabilizado</span>
          </div>
        </div>
        <div className="col-3">
          <div className="stat-card">
            <span className="stat-label"><Icon name="salida" size={13} /> Créditos del mes</span>
            <span className="stat-value money">{money(creMes)}</span>
            <span className="stat-sub">{state.session.periodName} {state.session.year} · contabilizado</span>
          </div>
        </div>
        <div className="col-2">
          <div className="stat-card">
            <span className="stat-label"><Icon name="libro" size={13} /> Diferencia</span>
            <span className={`stat-value money ${Math.abs(difMes) > 0.004 ? 'neg' : ''}`}>{money(difMes)}</span>
            <span className="stat-sub">{Math.abs(difMes) > 0.004 ? 'Revisar descuadre' : 'Cuadrado'}</span>
          </div>
        </div>
        <div className="col-2">
          <div className="stat-card">
            <span className="stat-label"><Icon name="doc" size={13} /> Documentos</span>
            <span className="stat-value tnum">{state.documentos.length.toLocaleString('es-CO')}</span>
            <span className="stat-sub">Contabilizados en el libro</span>
          </div>
        </div>
        <div className="col-2">
          <div className="stat-card">
            <span className="stat-label"><Icon name="calendario" size={13} /> Estado del mes</span>
            <div className="stat-value"><PeriodBadge status={state.periodStatus} /></div>
            <span className="stat-sub">{state.session.periodName} {state.session.year}</span>
          </div>
        </div>
      </div>

      <div className="page-grid">
        <div className="col-8">
          <Card title="Lotes por estado" icon="lote" pad={false}>
            <div className="lotes-estado-grid" style={{ padding: 12 }}>
              {estadosVisibles.map((e) => {
                const lotes = porEstado.get(e) ?? []
                const errores = sum(lotes.map((l) => l.issues.filter((i) => i.severidad === 'ERROR').length))
                return (
                  <button key={e} type="button" className="lote-card" onClick={() => irAEstado(e)} title={`Ver lotes en estado ${LOTE_ESTADOS[e]}`}>
                    <div className="lote-card-top">
                      <span className="small muted bold">{LOTE_ESTADOS[e]}</span>
                      <span className="lote-card-count">{lotes.length}</span>
                    </div>
                    {lotes.map((l) => (
                      <div
                        key={l.codigo}
                        className="lote-card-row"
                        role="button"
                        tabIndex={0}
                        onClick={(ev) => { ev.stopPropagation(); navigate(`/movimientos/lotes/${l.codigo}`) }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); navigate(`/movimientos/lotes/${l.codigo}`) } }}
                      >
                        <span className="lote-card-name">{l.codigo} — {l.nombre}</span>
                        {e === 'CON_ERRORES' && errores > 0 ? <Badge tone="danger">{errores} errores</Badge> : null}
                      </div>
                    ))}
                    {e === 'CON_ERRORES' && <span className="xs muted">Con errores · {errores} errores</span>}
                  </button>
                )
              })}
            </div>
          </Card>
        </div>
        <div className="col-4">
          <Card title="Accesos funcionales" icon="dashboard" pad={false}>
            <div className="access-grid" style={{ padding: 12 }}>
              {accesos.map((a) => (
                <button key={a.id} type="button" className="access-item" onClick={() => navigate(a.to)}>
                  <span className="access-icon"><Icon name={a.icon} size={18} /></span>
                  <b>{a.label}</b>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="page-grid">
        <div className="col-6">
          <Card title="Alertas contables" icon="bell" tone={alertas.length > 0 ? 'warning' : 'success'} pad={false}>
            {alertas.length === 0 ? (
              <div className="vc-empty"><Icon name="success" size={22} className="pos" /><span>Sin alertas: todo al día.</span></div>
            ) : (
              <div className="dash-list">
                {alertas.map((a) => (
                  <button key={a.id} type="button" className="dash-item" onClick={() => a.to && navigate(a.to)}>
                    <Icon name={a.icon} size={15} className={a.icon === 'warn' ? 'vc-warn' : 'neg'} />
                    <span className="dash-text small">{a.texto}</span>
                    {a.to ? <Icon name="chevronR" size={13} className="muted" /> : null}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="col-6">
          <Card title="Tareas pendientes" icon="list" pad={false}>
            {tareas.length === 0 ? (
              <div className="vc-empty"><Icon name="success" size={22} className="pos" /><span>Sin tareas pendientes.</span></div>
            ) : (
              <div className="dash-list">
                {tareas.map((t) => (
                  <div
                    key={t.id}
                    className="dash-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(t.to)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(t.to) }}
                  >
                    <Icon name={t.icon} size={15} className="muted" />
                    <span className="dash-text small">{t.texto}</span>
                    <Button size="sm" variant="subtle">{t.accion}</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

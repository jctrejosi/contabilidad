/* ============================================================
   CONTABDSI · Reprocesos y auditoría
   Dos áreas: Auditar y Corregir/Recalcular. Cada proceso tiene
   un modal con Alcance → Simulación → Respaldo → Aprobación →
   Progreso → Resultado. Los procesos largos activan el bloqueo
   masivo global (SET_MASSIVE_LOCK).
   ============================================================ */

import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmModal,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  NoPermissionState,
  PageHeader,
  ProgressBar,
  Select,
} from '@/components/ui'
import { downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { money, nombreMes } from '@/core/format'

interface ProcesoDef {
  key: string
  nombre: string
  descripcion: string
  riesgo: 'Bajo' | 'Medio' | 'Alto'
  largo: boolean
  ok: boolean
  motivoFallo?: string
}

interface Diferencia {
  descripcion: string
  valor: number
  moneda?: boolean
}

const AUDITAR: ProcesoDef[] = [
  { key: 'mov-cuentas', nombre: 'Movimiento vs cuentas válidas', descripcion: 'Detecta líneas imputadas a cuentas no afectables o inexistentes en el plan.', riesgo: 'Bajo', largo: false, ok: true },
  { key: 'doc-mov', nombre: 'Documentos vs movimiento', descripcion: 'Cruza los documentos contabilizados contra el movimiento mensual y detecta huérfanos.', riesgo: 'Medio', largo: true, ok: true },
  { key: 'auditoria-reval', nombre: 'Auditoría de revalorización', descripcion: 'Verifica la trazabilidad y las bases de las revalorizaciones aplicadas.', riesgo: 'Medio', largo: false, ok: true },
]

const CORREGIR: ProcesoDef[] = [
  { key: 'repro-mensual', nombre: 'Reproceso mensual', descripcion: 'Recalcula el movimiento del período: comprobantes, saldos y totalizadores.', riesgo: 'Alto', largo: true, ok: true },
  { key: 'reval-cuentas', nombre: 'Revalorización de cuentas/centros', descripcion: 'Revaloriza saldos por cuenta y centro según la tasa configurada.', riesgo: 'Alto', largo: true, ok: true },
  { key: 'reval-opt', nombre: 'Revalorización mensual optimizada', descripcion: 'Versión optimizada que revaloriza solo las cuentas con movimiento en el período.', riesgo: 'Alto', largo: true, ok: false, motivoFallo: 'El período 202602 está cerrado para revalorización. Reabra el período y reintente.' },
  { key: 'crear-cuentas', nombre: 'Creación asistida de cuentas faltantes', descripcion: 'Crea en el plan las cuentas inexistentes que el movimiento ya está usando.', riesgo: 'Medio', largo: false, ok: true },
]

const DIFERENCIAS: Record<string, Diferencia[]> = {
  'mov-cuentas': [
    { descripcion: 'Líneas en cuentas no afectables (5105 — grupo)', valor: 3200000, moneda: true },
    { descripcion: 'Líneas en cuentas inexistentes', valor: 850000, moneda: true },
    { descripcion: 'Total detectado', valor: 4050000, moneda: true },
  ],
  'doc-mov': [
    { descripcion: 'Documentos contabilizados sin movimiento asociado', valor: 3 },
    { descripcion: 'Movimientos sin documento oficial', valor: 2 },
    { descripcion: 'Lotes contabilizados a conciliar', valor: 1 },
  ],
  'auditoria-reval': [
    { descripcion: 'Revalorizaciones sin evento de respaldo', valor: 1200000, moneda: true },
    { descripcion: 'Revalorizaciones con base de cálculo distinta', valor: 340000, moneda: true },
  ],
  'repro-mensual': [
    { descripcion: 'Comprobantes a recalcular', valor: 128 },
    { descripcion: 'Movimientos a regenerar', valor: 1450 },
    { descripcion: 'Saldos por cuenta/tercero/centro a reconstruir', valor: 31 },
  ],
  'reval-cuentas': [
    { descripcion: 'Cuentas a revalorizar', valor: 26 },
    { descripcion: 'Centros involucrados', valor: 6 },
    { descripcion: 'Diferencia estimada de revalorización', valor: 48200000, moneda: true },
  ],
  'reval-opt': [
    { descripcion: 'Cuentas con movimiento en el período', valor: 9 },
    { descripcion: 'Diferencia estimada (optimizada)', valor: 12400000, moneda: true },
  ],
  'crear-cuentas': [
    { descripcion: 'Cuentas faltantes detectadas en el movimiento', valor: 4 },
    { descripcion: 'Líneas afectadas que quedarán cuadradas', valor: 11 },
  ],
}

type Fase = 'CONFIGURAR' | 'SIMULAR' | 'RESPALDO' | 'CONFIRMAR' | 'EJECUTANDO' | 'RESULTADO'

export function ReprocesosPage() {
  usePageTitle('Reprocesos y auditoría')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('reprocesos.auditar')

  const [proceso, setProceso] = useState<ProcesoDef | null>(null)
  const [fase, setFase] = useState<Fase>('CONFIGURAR')
  const [periodo, setPeriodo] = useState('202602')
  const [cuentas, setCuentas] = useState('510506, 236540, 250505')
  const [centro, setCentro] = useState('')
  const [respaldoOk, setRespaldoOk] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pct, setPct] = useState(0)
  const [pasoText, setPasoText] = useState('')
  const [ejecutado, setEjecutado] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const abrir = (p: ProcesoDef) => {
    setProceso(p)
    setFase('CONFIGURAR')
    setPeriodo('202602')
    setCuentas('510506, 236540, 250505')
    setCentro('')
    setRespaldoOk(false)
    setConfirmOpen(false)
    setPct(0)
    setEjecutado(false)
  }

  const simular = () => {
    setFase('SIMULAR')
    const t = window.setTimeout(() => setFase('RESPALDO'), 900)
    timers.current.push(t)
  }

  const ejecutar = (p: ProcesoDef) => {
    setConfirmOpen(false)
    setFase('EJECUTANDO')
    if (p.largo) {
      dispatch({ type: 'SET_MASSIVE_LOCK', lock: { activo: true, proceso: p.nombre, usuario: state.session.user.nombre } })
    }
    const pasos = [
      'Bloqueando captura y contabilización…',
      'Preparando transacción atómica…',
      'Recalculando registros…',
      'Verificando cuadre débito/crédito…',
      'Actualizando totalizadores…',
    ]
    let i = 0
    setPct(10)
    setPasoText(pasos[0])
    const iv = window.setInterval(() => {
      i += 1
      if (i < pasos.length) {
        setPct(10 + i * 18)
        setPasoText(pasos[i])
      } else {
        window.clearInterval(iv)
        setPct(100)
        window.setTimeout(() => {
          dispatch({ type: 'SET_MASSIVE_LOCK', lock: null })
          setEjecutado(true)
          setFase('RESULTADO')
          if (p.ok) {
            audit('Ejecución de reproceso', p.nombre, `Período ${periodo} · resultado exitoso`, 'EXITO')
            toast('success', 'Proceso terminado', `${p.nombre} finalizó correctamente sobre el período ${periodo}.`)
          } else {
            audit('Ejecución de reproceso', p.nombre, 'La ejecución falló y fue revertida', 'FALLO')
          }
        }, 400)
      }
    }, 550)
    timers.current.push(iv)
  }

  const exportarResultado = (p: ProcesoDef) => {
    downloadCsv(
      [['Descripción', 'Valor'], ...(DIFERENCIAS[p.key] ?? []).map((d) => [d.descripcion, String(d.valor)])],
      `resultado-${p.key}.csv`,
    )
    audit('Exportación de resultado', p.nombre, `Resultado exportado a CSV`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Reprocesos y auditoría" subtitle="Procesos de control y recálculo" icon="reproceso" />
        <NoPermissionState perm="reprocesos.auditar" />
      </div>
    )
  }

  const bloqueado = state.massiveLock?.activo ?? false

  return (
    <div className="page">
      <PageHeader
        title="Reprocesos y auditoría"
        subtitle="Audite la integridad del movimiento o corrija/recalcule con procesos controlados."
        icon="reproceso"
        badge={<Badge tone="brand" icon="reproceso">Control de integridad</Badge>}
      />

      {bloqueado && (
        <Card tone="warning" icon="lock" title="Proceso masivo en curso">
          <span className="small">
            <b>{state.massiveLock?.proceso}</b> (iniciado por {state.massiveLock?.usuario}) bloquea la compañía. No puede iniciar
            otro reproceso hasta que termine.
          </span>
        </Card>
      )}

      <div className="page-grid">
        <div className="col-6">
          <Card title="Auditar" icon="eye" pad>
            <div className="stack gap-8">
              {AUDITAR.map((p) => (
                <div key={p.key} className="proceso-row">
                  <div className="grow">
                    <div className="row gap-8">
                      <b className="small">{p.nombre}</b>
                      <Badge tone={p.riesgo === 'Alto' ? 'danger' : p.riesgo === 'Medio' ? 'warning' : 'info'}>{p.riesgo}</Badge>
                    </div>
                    <div className="xs muted">{p.descripcion}</div>
                  </div>
                  <Button size="sm" icon="eye" disabled={bloqueado} onClick={() => abrir(p)}>Auditar</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="col-6">
          <Card title="Corregir / Recalcular" icon="reclasificar" pad>
            <div className="stack gap-8">
              {CORREGIR.map((p) => (
                <div key={p.key} className="proceso-row">
                  <div className="grow">
                    <div className="row gap-8">
                      <b className="small">{p.nombre}</b>
                      <Badge tone={p.riesgo === 'Alto' ? 'danger' : p.riesgo === 'Medio' ? 'warning' : 'info'}>{p.riesgo}</Badge>
                      {p.largo && <Badge tone="outline" icon="clock">Proceso largo</Badge>}
                    </div>
                    <div className="xs muted">{p.descripcion}</div>
                  </div>
                  <Button size="sm" variant="primary" icon="play" disabled={bloqueado} onClick={() => abrir(p)}>Ejecutar</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={proceso !== null}
        onClose={fase === 'EJECUTANDO' ? () => {} : () => setProceso(null)}
        title={proceso?.nombre ?? ''}
        icon="reproceso"
        width={640}
        footer={
          fase === 'CONFIGURAR' ? (
            <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => setProceso(null)}>Cancelar</Button>
              <Button variant="primary" iconRight="chevronR" onClick={simular}>Simular</Button>
            </div>
          ) : fase === 'RESPALDO' ? (
            <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => setProceso(null)}>Cancelar</Button>
              <Button variant="primary" disabled={!respaldoOk} iconRight="chevronR" onClick={() => setConfirmOpen(true)}>Solicitar aprobación</Button>
            </div>
          ) : fase === 'RESULTADO' ? (
            <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => setProceso(null)}>Cerrar</Button>
            </div>
          ) : undefined
        }
      >
        {proceso && fase === 'CONFIGURAR' && (
          <div className="stack gap-8">
            <p className="small muted">{proceso.descripcion}</p>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <Field label="Período" required>
                <Select
                  value={periodo}
                  options={[{ value: '202602', label: `${nombreMes(2)} 2026` }, { value: '202601', label: `${nombreMes(1)} 2026` }]}
                  onChange={setPeriodo}
                  width={160}
                />
              </Field>
              <Field label="Cuentas (lista)" hint="Separadas por coma. Vacío = todas.">
                <Input value={cuentas} onChange={setCuentas} monospace width={240} />
              </Field>
              <Field label="Centro (opcional)">
                <Select
                  value={centro}
                  placeholder="Todos"
                  options={state.centros.map((c) => ({ value: c.code, label: `${c.code} — ${c.nombre}` }))}
                  onChange={setCentro}
                  width={200}
                />
              </Field>
            </div>
          </div>
        )}

        {proceso && fase === 'SIMULAR' && (
          <div className="stack gap-8">
            <LoadingState label={`Simulando ${proceso.nombre.toLowerCase()}…`} />
            <ProgressBar pct={40} label="Progreso de simulación" />
          </div>
        )}

        {proceso && fase === 'RESPALDO' && (
          <div className="stack gap-8">
            <p className="small bold">Resultado de la simulación</p>
            <div className="table-scroll" style={{ maxHeight: 240 }}>
              <table className="mini-table">
                <thead>
                  <tr><th>Diferencia detectada</th><th className="right">Valor</th></tr>
                </thead>
                <tbody>
                  {(DIFERENCIAS[proceso.key] ?? []).map((d) => (
                    <tr key={d.descripcion}>
                      <td>{d.descripcion}</td>
                      <td className="right tnum">{d.moneda ? money(d.valor) : d.valor.toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="check-row" style={{ borderColor: respaldoOk ? 'var(--success-600)' : undefined }}>
              <Checkbox checked={respaldoOk} onChange={setRespaldoOk} label={<b className="small">He realizado el respaldo completo de la compañía (obligatorio)</b>} />
            </div>
            <p className="xs muted">Sin el respaldo confirmado no es posible solicitar la aprobación del proceso.</p>
          </div>
        )}

        {proceso && fase === 'EJECUTANDO' && (
          <div className="stack gap-8">
            <p className="small bold">{pasoText}</p>
            <ProgressBar pct={pct} tone={proceso.ok ? 'success' : 'warning'} label="Progreso del proceso" />
            {proceso.largo && (
              <p className="xs muted">
                El bloqueo masivo está activo: la compañía queda bloqueada para captura y contabilización hasta finalizar.
              </p>
            )}
          </div>
        )}

        {proceso && fase === 'RESULTADO' && (
          <div className="stack gap-8">
            {proceso.ok && ejecutado ? (
              <>
                <p className="small">
                  El proceso <b>{proceso.nombre}</b> terminó sobre el período {periodo} con resultado <Badge tone="success" icon="check">EXITOSO</Badge>.
                </p>
                <div className="table-scroll" style={{ maxHeight: 220 }}>
                  <table className="mini-table">
                    <thead>
                      <tr><th>Elemento</th><th className="right">Resultado</th></tr>
                    </thead>
                    <tbody>
                      {(DIFERENCIAS[proceso.key] ?? []).map((d) => (
                        <tr key={d.descripcion}>
                          <td>{d.descripcion}</td>
                          <td className="right tnum">{d.moneda ? money(d.valor) : d.valor.toLocaleString('es-CO')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row gap-8">
                  <Button size="sm" icon="download" onClick={() => exportarResultado(proceso)}>Exportar resultado</Button>
                </div>
              </>
            ) : (
              <ErrorState
                title="El proceso no se pudo completar"
                detail={proceso.motivoFallo ?? 'Ocurrió un error inesperado y la transacción fue revertida.'}
                onRetry={() => { setFase('CONFIGURAR'); setRespaldoOk(false) }}
              />
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => proceso && ejecutar(proceso)}
        title={`Aprobar ${proceso?.nombre ?? ''}`}
        danger={proceso?.riesgo !== 'Bajo'}
        confirmLabel="Sí, ejecutar"
        message={
          <>
            Confirme la ejecución del proceso sobre el período <b>{periodo}</b>
            {cuentas ? <> para las cuentas <code>{cuentas}</code></> : null}. La operación quedará registrada en la bitácora y, si
            es un proceso largo, bloqueará la compañía durante su ejecución.
          </>
        }
      />
    </div>
  )
}

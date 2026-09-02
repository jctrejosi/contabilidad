/* ============================================================
   CONTABDSI · Administración → Reorganización de datos
   Requiere permiso: admin.reorganizacion
   ============================================================ */

import { useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Modal,
  NoPermissionState,
  PageHeader,
  ProgressBar,
} from '@/components/ui'
import { DangerConfirmation, InfoStrip, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { fechaHora } from '@/core/format'

export function ReorganizacionPage() {
  usePageTitle('Reorganización de datos')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('admin.reorganizacion')
  const [preparando, setPreparando] = useState(false)
  const [respaldoOk, setRespaldoOk] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [ejecutando, setEjecutando] = useState<{ paso: string; pct: number } | null>(null)
  const [resultado, setResultado] = useState<{ duracion: string; tablas: number } | null>(null)
  const timerRef = useRef<number | null>(null)

  const masivo = state.massiveLock

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Reorganización de datos" icon="reorganizar" />
        <Card><NoPermissionState perm="admin.reorganizacion" /></Card>
      </div>
    )
  }

  const iniciar = (motivo: string) => {
    setConfirmar(false)
    setPreparando(false)
    dispatch({
      type: 'SET_MASSIVE_LOCK',
      lock: { activo: true, proceso: 'Reorganización de índices / compactación', usuario: state.session.user.nombre },
    })
    setEjecutando({ paso: 'Cerrando sesiones de otros usuarios…', pct: 10 })
    const pasos = ['Verificando respaldo completo…', 'Reorganizando índices primarios…', 'Compactando tablas de movimiento…', 'Recalculando acumulados…', 'Liberando bloqueos…']
    let i = 0
    const inicio = Date.now()
    timerRef.current = window.setInterval(() => {
      i += 1
      if (i < pasos.length) {
        setEjecutando({ paso: pasos[i], pct: 10 + i * 20 })
      } else {
        if (timerRef.current) window.clearInterval(timerRef.current)
        const duracion = Math.round((Date.now() - inicio) / 1000)
        dispatch({ type: 'SET_MASSIVE_LOCK', lock: null })
        dispatch({ type: 'REGEN_ACUMULADOS' })
        setEjecutando(null)
        setResultado({ duracion: `${duracion} s`, tablas: 14 })
        toast('success', 'Reorganización completada', 'Índices reorganizados y tablas compactadas correctamente.')
        audit('Reorganización de índices / compactación', 'Reorganización', `Motivo: ${motivo} · 14 tablas · duración ${duracion} s · modo mantenimiento activado durante la operación`)
      }
    }, 600)
  }

  const sim = [
    { descripcion: 'Tablas de movimiento (documentos, líneas)', valor: '6 tablas' },
    { descripcion: 'Tablas de acumulados (cuenta/tercero/centro)', valor: '3 tablas' },
    { descripcion: 'Tablas maestras (índices)', valor: '5 tablas' },
    { descripcion: 'Registros estimados a compactar', valor: '24.310' },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Reorganización de datos"
        subtitle="Mantenimiento de índices y compactación · permiso admin.reorganizacion"
        icon="reorganizar"
        badge={<Badge tone="danger" icon="shield">Acceso elevado</Badge>}
      />

      {masivo && (
        <div className="maint-banner" role="status">
          <Badge tone="danger" icon="clock">Modo mantenimiento</Badge>
          Proceso en curso: {masivo.proceso} · iniciado por {masivo.usuario}. El sistema está bloqueado para otros usuarios.
        </div>
      )}

      <InfoStrip
        items={[
          { label: 'Compañía', value: `${state.session.company.codigo} — ${state.session.company.nombre}` },
          { label: 'Última reorganización', value: '2026-01-31 18:10' },
          { label: 'Acumulados regenerados', value: fechaHora(state.acumuladosFecha) },
        ]}
      />

      <Card
        title="Reorganización de índices / compactación"
        icon="reorganizar"
        footer={
          <span className="xs muted">
            Exclusividad: durante la operación <b>se cerrarán las sesiones de otros usuarios</b> y se activará el modo mantenimiento.
          </span>
        }
      >
        <div className="stack gap-12">
          <p className="small">
            Reorganiza los índices de las tablas contables y compacta el espacio de almacenamiento. Mejora el rendimiento de consultas y reduce el tamaño de la base de datos.
          </p>
          <div className="row gap-8" style={{ alignItems: 'center' }}>
            <Button variant="danger" icon="reorganizar" onClick={() => { setPreparando(true); setRespaldoOk(false) }} disabled={masivo?.activo}>
              Iniciar reorganización
            </Button>
            {masivo?.activo && <Badge tone="warning" icon="clock">Sistema en mantenimiento</Badge>}
          </div>
          {resultado && (
            <div className="state state-success" style={{ padding: 16 }}>
              <div className="state-icon"><Badge tone="success" icon="check">Éxito</Badge></div>
              <h4 className="state-title">Reorganización finalizada</h4>
              <p className="state-detail small">{resultado.tablas} tablas procesadas · duración {resultado.duracion} · acumulados regenerados · evento registrado en bitácora.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Preparación: respaldo obligatorio */}
      <Modal
        open={preparando}
        onClose={() => setPreparando(false)}
        title="Preparación de la reorganización"
        icon="db"
        width={520}
        tone="warning"
        footer={
          <>
            <Button onClick={() => setPreparando(false)}>Cancelar</Button>
            <Button variant="danger" icon="chevronR" disabled={!respaldoOk} onClick={() => setConfirmar(true)}>Continuar</Button>
          </>
        }
      >
        <div className="stack gap-12">
          <p className="modal-message">
            Antes de reorganizar debe existir un <b>respaldo completo y verificado</b> de la compañía. La operación cerrará las sesiones de los demás usuarios.
          </p>
          <Field label="Verificación de respaldo" required>
            <Checkbox checked={respaldoOk} onChange={setRespaldoOk} label="Confirmo que el respaldo completo fue verificado y está actualizado" />
          </Field>
          <div className="note-strip">
            <Badge tone="warning" icon="warn">Exclusividad</Badge>
            Se cerrarán las sesiones de otros usuarios durante la operación.
          </div>
        </div>
      </Modal>

      <DangerConfirmation
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={(motivo) => iniciar(motivo)}
        title="Reorganización de índices / compactación"
        descripcion="Se reorganizarán los índices y se compactarán las tablas contables. Las sesiones de otros usuarios se cerrarán y el sistema entrará en modo mantenimiento hasta finalizar."
        tablasAfectadas={['Documentos contables', 'Líneas de movimiento', 'Acumulados', 'Lotes', 'Índices de tablas maestras']}
        confirmText="REORGANIZAR"
        simulacion={sim}
        confirmLabel="Reorganizar"
      />

      {/* Progreso */}
      <Modal open={ejecutando !== null} onClose={() => undefined} title="Reorganizando datos" icon="clock" width={480}>
        <div className="stack gap-12">
          <ProgressBar pct={ejecutando?.pct ?? 0} tone="brand" label="Progreso de la reorganización" />
          <p className="small muted">{ejecutando?.paso}</p>
          <div className="maint-banner" style={{ fontSize: 12 }}>
            Modo mantenimiento activo: los demás usuarios no pueden operar.
          </div>
        </div>
      </Modal>
    </div>
  )
}

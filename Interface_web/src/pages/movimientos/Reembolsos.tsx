/* ============================================================
   CONTABDSI · Reembolsos de caja menor
   Encabezado + detalle editable + Guardar / Crear lote / Cancelar.
   ============================================================ */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  NoPermissionState,
  PageHeader,
  Select,
} from '@/components/ui'
import { InfoStrip, usePageTitle } from '@/components/accounting/Widgets'
import { AccountingEntryGrid, DebitCreditSummary } from '@/components/accounting/DataGrid'
import { ThirdPartyPicker, VoucherPicker } from '@/components/accounting/Combobox'
import { useCan, useStore, validarLote } from '@/state/AppStore'
import { makeLinea } from '@/data/mock'
import { money, nombreMes, nowISO, uid } from '@/core/format'
import type { LineaMovimiento, Lote } from '@/core/types'

const CAJAS = [
  { value: 'CAJA-1', label: 'CAJA-1 — Caja menor general' },
  { value: 'CAJA-2', label: 'CAJA-2 — Caja menor operaciones' },
  { value: 'CAJA-3', label: 'CAJA-3 — Caja menor ventas' },
]

export function ReembolsosPage() {
  usePageTitle('Reembolsos')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('mov.reembolsos')

  const [nit, setNit] = useState('')
  const [periodo, setPeriodo] = useState(String(state.session.period))
  const [fecha, setFecha] = useState('2026-02-28')
  const [comprobante, setComprobante] = useState('CE')
  const [caja, setCaja] = useState('CAJA-1')
  const [lineas, setLineas] = useState<LineaMovimiento[]>([
    makeLinea({ comprobante: 'CE', fecha: '2026-02-28', concepto: '', origen: 'REEMBOLSO' }),
  ])
  const [creado, setCreado] = useState<string | null>(null)

  const periodoFull = `${state.session.year}${periodo.padStart(2, '0')}`

  const issues = useMemo(() => {
    const tmp: Lote = {
      codigo: 'TMP',
      nombre: 'Reembolso',
      periodo: periodoFull,
      usuario: state.session.user.nombre,
      origen: 'REEMBOLSO',
      fecha,
      lineas,
      estado: 'BORRADOR',
      issues: [],
      audit: [],
    }
    return validarLote(tmp, state.accounts, state.terceros, state.centros, state.documentos)
  }, [lineas, state.accounts, state.terceros, state.centros, state.documentos, periodoFull, state.session.user.nombre, fecha])

  const totalDeb = lineas.reduce((a, l) => a + l.debito, 0)
  const totalCre = lineas.reduce((a, l) => a + l.credito, 0)

  const agregarLinea = () => {
    setLineas((ls) => [...ls, makeLinea({ comprobante, fecha, origen: 'REEMBOLSO', concepto: '' })])
  }

  const guardarBorrador = () => {
    audit('Guardar borrador de reembolso', 'Reembolsos', `Caja ${caja} · ${lineas.length} líneas`, 'EXITO')
    toast('success', 'Borrador guardado', 'El reembolso quedó en el borrador local del comprobante activo (simulado).')
  }

  const crearLote = () => {
    const codigo = nextCode(state.lotes, 'RE')
    const lote: Lote = {
      codigo,
      nombre: `Reembolso ${caja} — ${nombreMes(Number(periodo)).toLowerCase()}`,
      periodo: periodoFull,
      usuario: state.session.user.nombre,
      origen: 'REEMBOLSO',
      fecha,
      comprobante,
      documento: `RE-${state.session.year}-${periodo.padStart(2, '0')}-${String(Number(codigo.slice(2)) || 1).padStart(3, '0')}`,
      lineas: lineas.filter((l) => l.cuenta || l.debito !== 0 || l.credito !== 0),
      estado: 'BORRADOR',
      issues: [],
      audit: [{ id: uid('a'), fecha: nowISO(), usuario: state.session.user.nombre, rol: state.role, accion: 'Creación del lote', detalle: `Lote ${codigo} creado desde Reembolsos (caja ${caja})`, resultado: 'INFO' }],
    }
    lote.issues = validarLote(lote, state.accounts, state.terceros, state.centros, state.documentos)
    lote.estado = lote.issues.some((i) => i.severidad === 'ERROR') ? 'CON_ERRORES' : 'VERIFICADO'
    dispatch({ type: 'ADD_LOTE', lote })
    setCreado(codigo)
    audit('Creación de lote de reembolso', 'Reembolsos', `Lote ${codigo} · ${lote.lineas.length} líneas`, 'EXITO')
    toast('success', 'Lote creado', `Lote ${codigo} listo. Verifíquelo y envíelo a aprobación para contabilizar.`)
  }

  const cancelar = () => {
    setNit('')
    setFecha('2026-02-28')
    setLineas([makeLinea({ comprobante, fecha: '2026-02-28', origen: 'REEMBOLSO' })])
    setCreado(null)
    toast('info', 'Reembolso cancelado', 'Los cambios no guardados fueron descartados.')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Reembolsos" subtitle="Reembolsos de caja menor" icon="reembolso" />
        <NoPermissionState perm="mov.reembolsos" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Reembolsos"
        subtitle="Registre el reembolso de caja menor y envíelo como lote para su ciclo de aprobación."
        icon="reembolso"
        badge={<Badge tone="brand" icon="reembolso">Caja menor</Badge>}
      />

      <Card title="Encabezado del reembolso" icon="terceros">
        <div className="row gap-12" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Empleado / tercero" required>
            <ThirdPartyPicker value={nit} onChange={setNit} width={240} />
          </Field>
          <Field label="Período" required>
            <Select
              value={periodo}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${nombreMes(i + 1)} ${state.session.year}` }))}
              onChange={setPeriodo}
              width={160}
            />
          </Field>
          <Field label="Fecha" required>
            <Input type="date" value={fecha} onChange={setFecha} width={140} />
          </Field>
          <Field label="Comprobante" required>
            <VoucherPicker value={comprobante} onChange={setComprobante} width={200} />
          </Field>
          <Field label="Caja menor" required>
            <Select value={caja} options={CAJAS} onChange={setCaja} width={240} />
          </Field>
        </div>
      </Card>

      <Card
        title="Detalle del reembolso"
        icon="lote"
        actions={<Button size="sm" icon="plus" onClick={agregarLinea}>Agregar línea</Button>}
      >
        <AccountingEntryGrid
          lineas={lineas}
          onChange={setLineas}
          issues={issues}
          height={320}
          extraActions={<span className="xs muted">Documento de soporte: ingréselo en «Doc. afectado»</span>}
        />
        <div className="row gap-8" style={{ marginTop: 10 }}>
          <DebitCreditSummary debito={totalDeb} credito={totalCre} compact />
          <span className="spacer" />
          {issues.length > 0 && (
            <Badge tone={issues.some((i) => i.severidad === 'ERROR') ? 'danger' : 'warning'} icon="warn">
              {issues.length} issue(s) pendientes
            </Badge>
          )}
        </div>
      </Card>

      <Card>
        <div className="row gap-8">
          <Button icon="save" onClick={guardarBorrador} disabled={lineas.every((l) => !l.cuenta)}>Guardar (borrador)</Button>
          <Button variant="primary" icon="lote" onClick={crearLote} disabled={lineas.every((l) => !l.cuenta)}>Crear lote / Contabilizar</Button>
          <Button variant="ghost" icon="x" onClick={cancelar}>Cancelar</Button>
          <span className="spacer" />
          <span className="xs muted">El lote pasa por verificación, aprobación y contabilización antes de afectar el libro.</span>
        </div>
      </Card>

      {creado && (
        <Card tone="success" icon="check" title="Reembolso convertido en lote">
          <InfoStrip
            items={[
              { label: 'Lote', value: <Link to={`/movimientos/lotes/${creado}`}>{creado}</Link> },
              { label: 'Total débito', value: money(totalDeb) },
              { label: 'Total crédito', value: money(totalCre) },
              { label: 'Estado', value: <Badge tone={issues.some((i) => i.severidad === 'ERROR') ? 'danger' : 'success'}>{issues.some((i) => i.severidad === 'ERROR') ? 'CON ERRORES' : 'VERIFICADO'}</Badge> },
            ]}
          />
        </Card>
      )}
    </div>
  )
}

function nextCode(lotes: Lote[], prefix: string): string {
  const nums = lotes.map((l) => l.codigo).filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length)) || 0)
  return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`
}

/* ============================================================
   CONTABDSI · Configuración → Renglones de renta
   CRUD de renglones + generador de informe por renglones
   ============================================================ */

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Switch,
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { ExportMenu, ReportPreview, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { AccountPicker } from '@/components/accounting/Combobox'
import { useStore } from '@/state/AppStore'
import { money, sum } from '@/core/format'
import type { ReportColumn } from '@/core/types'

interface RenglonRenta {
  code: string
  nombre: string
  cuenta: string
  signo: 1 | -1
  activo: boolean
}

const INICIALES: RenglonRenta[] = [
  { code: 'REN01', nombre: 'Ingresos operacionales', cuenta: '41', signo: -1, activo: true },
  { code: 'REN02', nombre: 'Costo de ventas', cuenta: '61', signo: 1, activo: true },
  { code: 'REN03', nombre: 'Gastos de administración', cuenta: '51', signo: 1, activo: true },
  { code: 'REN04', nombre: 'Gastos de ventas', cuenta: '52', signo: 1, activo: true },
  { code: 'REN05', nombre: 'Ingresos no operacionales', cuenta: '42', signo: -1, activo: true },
  { code: 'REN06', nombre: 'Gastos financieros', cuenta: '53', signo: 1, activo: true },
]

const VACIO: RenglonRenta = { code: '', nombre: '', cuenta: '', signo: 1, activo: true }

export function RenglonesRentaPage() {
  usePageTitle('Renglones de renta')
  const { state, toast, audit } = useStore()
  const [renglones, setRenglones] = useState<RenglonRenta[]>(INICIALES)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: RenglonRenta } | null>(null)
  const [eliminar, setEliminar] = useState<RenglonRenta | null>(null)

  // Generador de informe
  const [genSel, setGenSel] = useState<Set<string>>(new Set(INICIALES.map((r) => r.code)))
  const [cuentaDesde, setCuentaDesde] = useState('')
  const [cuentaHasta, setCuentaHasta] = useState('')
  const [orden, setOrden] = useState<'codigo' | 'nombre' | 'total'>('codigo')
  const [conDetalle, setConDetalle] = useState(false)
  const [preview, setPreview] = useState<Record<string, string | number>[][] | null>(null)

  const balanceDe = (code: string): number => {
    const a = state.accounts.find((x) => x.code === code)
    if (!a) return 0
    return a.saldoInicial + sum(a.meses)
  }

  const generar = () => {
    const rengs = renglones.filter((r) => genSel.has(r.code) && r.activo)
    const filas: Record<string, string | number>[][] = []
    for (const r of rengs) {
      const total = balanceDe(r.cuenta) * r.signo
      filas.push([
        { key: 'codigo', value: r.code },
        { key: 'nombre', value: r.nombre },
        { key: 'cuenta', value: r.cuenta },
        { key: 'signo', value: r.signo > 0 ? 'Suma' : 'Resta' },
        { key: 'total', value: total },
      ])
    }
    if (conDetalle) {
      const cuentas = state.accounts.filter((a) => {
        if (cuentaDesde && a.code < cuentaDesde) return false
        if (cuentaHasta && a.code > cuentaHasta) return false
        return a.afectable
      })
      for (const a of cuentas) {
        const r = rengs.find((x) => a.code.startsWith(x.cuenta))
        if (!r) continue
        filas.push([
          { key: 'codigo', value: `· ${a.code}` },
          { key: 'nombre', value: a.nombre },
          { key: 'cuenta', value: a.code },
          { key: 'signo', value: '—' },
          { key: 'total', value: balanceDe(a.code) * r.signo },
        ])
      }
    }
    const ordenado = [...filas].sort((x, y) => {
      const vx = String(x.find((c) => c.key === orden)?.value ?? '')
      const vy = String(y.find((c) => c.key === orden)?.value ?? '')
      if (orden === 'total') return Number(vy) - Number(vx)
      return vx.localeCompare(vy)
    })
    const totalGeneral = sum(rengs.map((r) => balanceDe(r.cuenta) * r.signo))
    ordenado.push([
      { key: 'codigo', value: 'TOTAL' },
      { key: 'nombre', value: 'Total renta líquida' },
      { key: 'cuenta', value: '' },
      { key: 'signo', value: '' },
      { key: 'total', value: totalGeneral },
    ])
    setPreview(ordenado)
    toast('success', 'Informe generado', `${rengs.length} renglones procesados · ${filas.length - 1} filas.`)
    audit('Generación de informe por renglones', 'Renglones de renta', `${rengs.length} renglones · rango ${cuentaDesde || '—'} a ${cuentaHasta || '—'}`)
  }

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim() || !draft.cuenta) {
      toast('error', 'Datos incompletos', 'Código, nombre y cuenta son obligatorios.')
      return
    }
    if (modo === 'crear') {
      if (renglones.some((r) => r.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe el renglón ${draft.code}.`)
        return
      }
      setRenglones((prev) => [{ ...draft, code: draft.code.trim() }, ...prev])
      toast('success', 'Renglón creado', `Se creó el renglón ${draft.code} — ${draft.nombre}.`)
      audit('Creación de renglón de renta', 'Renglones de renta', `Renglón ${draft.code} — ${draft.nombre} creado`)
    } else {
      setRenglones((prev) => prev.map((r) => (r.code === draft.code ? draft : r)))
      toast('success', 'Renglón actualizado', `El renglón ${draft.code} quedó actualizado.`)
      audit('Actualización de renglón de renta', 'Renglones de renta', `Renglón ${draft.code} — ${draft.nombre} modificado`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setRenglones((prev) => prev.filter((r) => r.code !== eliminar.code))
    toast('success', 'Renglón eliminado', `Se eliminó el renglón ${eliminar.code}.`)
    audit('Eliminación de renglón de renta', 'Renglones de renta', `Renglón ${eliminar.code} — ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const columns: GridColumn<RenglonRenta>[] = [
    { key: 'code', label: 'Código', width: 100, sortable: true, render: (r) => <span className="mono bold">{r.code}</span> },
    { key: 'nombre', label: 'Renglón', sortable: true },
    { key: 'cuenta', label: 'Cuenta', width: 110, render: (r) => <span className="mono">{r.cuenta}</span> },
    { key: 'signo', label: 'Signo', width: 90, align: 'center', render: (r) => (r.signo > 0 ? <Badge tone="neutral">Suma (+)</Badge> : <Badge tone="info">Resta (−)</Badge>) },
    { key: 'activo', label: 'Estado', width: 90, align: 'center', render: (r) => (r.activo ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>), searchValue: (r) => (r.activo ? 'activo' : 'inactivo') },
  ]

  const previewColumns: ReportColumn[] = [
    { key: 'codigo', label: 'Código', width: 130 },
    { key: 'nombre', label: 'Nombre' },
    { key: 'cuenta', label: 'Cuenta', width: 110 },
    { key: 'signo', label: 'Signo', width: 80, align: 'center' },
    { key: 'total', label: 'Total', money: true, align: 'right', width: 160 },
  ]

  const totalRenglones = sum(renglones.filter((r) => genSel.has(r.code) && r.activo).map((r) => balanceDe(r.cuenta) * r.signo))

  return (
    <div className="page">
      <PageHeader
        title="Renglones de renta"
        subtitle="Renglones de la declaración de renta y generador de informe"
        icon="renta"
        actions={
          <>
            <ExportMenu
              filename="renglones-renta"
              onExport={() =>
                downloadCsv(
                  [['Código', 'Nombre', 'Cuenta', 'Signo', 'Activo'], ...renglones.map((r) => [r.code, r.nombre, r.cuenta, r.signo > 0 ? 'Suma' : 'Resta', r.activo ? 'Sí' : 'No'])],
                  'renglones-renta.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO } })}>Crear</Button>
          </>
        }
      />

      <Card pad={false} title="Renglones" icon="list">
        <AccountingDataGrid
          rows={renglones}
          columns={columns}
          rowKey={(r) => r.code}
          selectable
          selected={sel}
          onSelect={setSel}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          onRowDoubleClick={(r) => setModal({ modo: 'editar', draft: { ...r } })}
          height={320}
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Acciones">
                <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                  const r = renglones.find((x) => x.code === [...sel][0])
                  if (r) setModal({ modo: 'editar', draft: { ...r } })
                }}>Modificar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                  const r = renglones.find((x) => x.code === [...sel][0])
                  if (r) setEliminar(r)
                }}>Eliminar</Button>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>

      <Card title="Generador de informe por renglones" icon="informe">
        <div className="stack gap-12">
          <div className="querybar">
            <Field label="Renglones a incluir" width={420} hint={`${genSel.size} seleccionados`}>
              <div className="row gap-8" style={{ flexWrap: 'wrap', maxWidth: 480 }}>
                {renglones.map((r) => (
                  <Badge key={r.code} tone={genSel.has(r.code) ? 'brand' : 'neutral'}>{r.code} — {r.nombre}</Badge>
                ))}
              </div>
            </Field>
            <Field label="Cuenta desde" width={160}>
              <AccountPicker value={cuentaDesde} onChange={setCuentaDesde} placeholder="Todas" />
            </Field>
            <Field label="Cuenta hasta" width={160}>
              <AccountPicker value={cuentaHasta} onChange={setCuentaHasta} placeholder="Todas" />
            </Field>
            <Field label="Ordenar por" width={170}>
              <Select
                value={orden}
                onChange={(v) => setOrden(v as 'codigo' | 'nombre' | 'total')}
                options={[{ value: 'codigo', label: 'Código' }, { value: 'nombre', label: 'Nombre' }, { value: 'total', label: 'Total (desc)' }]}
              />
            </Field>
            <Switch checked={conDetalle} onChange={setConDetalle} label="Detalle de cuentas" />
            <Button variant="primary" icon="play" onClick={generar}>Generar</Button>
          </div>

          <div className="row gap-8">
            {renglones.map((r) => (
              <label key={r.code} className="checkbox">
                <input
                  type="checkbox"
                  checked={genSel.has(r.code)}
                  onChange={(e) => {
                    const next = new Set(genSel)
                    if (e.target.checked) next.add(r.code)
                    else next.delete(r.code)
                    setGenSel(next)
                  }}
                />
                <span className="checkbox-box" />
                <span className="checkbox-label small">{r.code}</span>
              </label>
            ))}
            <span className="spacer" />
            <span className="small">Total preliminar: <b className="money">{money(totalRenglones)}</b></span>
          </div>

          {preview && (
            <ReportPreview
              titulo="Informe por renglones de renta"
              columns={previewColumns}
              rows={preview}
              pageSize={20}
              company={`${state.session.company.codigo} — ${state.session.company.nombre} · NIT ${state.session.company.nit}`}
            />
          )}
        </div>
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo renglón de renta' : `Renglón ${modal?.draft.code ?? ''}`}
        icon="renta"
        width={520}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={guardar}>Guardar</Button>
          </>
        }
      >
        {modal && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <Field label="Código" required width={130}>
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v.toUpperCase() } })} placeholder="REN01" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Signo" required width={160}>
                <Select
                  value={modal.draft.signo > 0 ? '1' : '-1'}
                  onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, signo: v === '-1' ? -1 : 1 } })}
                  options={[{ value: '1', label: 'Suma (+)' }, { value: '-1', label: 'Resta (−)' }]}
                />
              </Field>
            </div>
            <Field label="Nombre" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Ingresos operacionales" />
            </Field>
            <Field label="Cuenta o grupo de cuentas" required hint="Se totaliza la cuenta y todas sus subcuentas.">
              <AccountPicker value={modal.draft.cuenta} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, cuenta: v } })} />
            </Field>
            <Switch checked={modal.draft.activo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, activo: v } })} label="Renglón activo" />
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar renglón"
        danger
        message={`¿Desea eliminar el renglón ${eliminar?.code} — ${eliminar?.nombre}?`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

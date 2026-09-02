/* ============================================================
   CONTABDSI · Configuración → Configuración de retenciones
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
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { ExportMenu, MoneyInput, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { AccountPicker } from '@/components/accounting/Combobox'
import { useStore } from '@/state/AppStore'
import { money } from '@/core/format'
import type { ConceptoRetencion } from '@/core/types'

interface ConceptoLocal extends ConceptoRetencion {
  validada: boolean
}

const INICIALES: ConceptoLocal[] = [
  { code: 'R01', nombre: 'Compras generales', tarifa: 2.5, cuenta: '236540', baseMinima: 917000, validada: true },
  { code: 'R02', nombre: 'Servicios', tarifa: 4, cuenta: '236540', baseMinima: 917000, validada: true },
  { code: 'R03', nombre: 'Honorarios', tarifa: 10, cuenta: '236540', baseMinima: 0, validada: false },
  { code: 'R04', nombre: 'Salarios', tarifa: 10, cuenta: '236540', baseMinima: 0, validada: true },
  { code: 'R05', nombre: 'Arrendamientos', tarifa: 3.5, cuenta: '236540', baseMinima: 917000, validada: false },
]

const VACIO: ConceptoLocal = { code: '', nombre: '', tarifa: 0, cuenta: '', baseMinima: 0, validada: false }

export function ConfigRetencionesPage() {
  usePageTitle('Configuración de retenciones')
  const { state, toast, audit } = useStore()
  const [conceptos, setConceptos] = useState<ConceptoLocal[]>(INICIALES)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: ConceptoLocal } | null>(null)
  const [eliminar, setEliminar] = useState<ConceptoLocal | null>(null)

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El código y el nombre del concepto son obligatorios.')
      return
    }
    if (!draft.cuenta) {
      toast('error', 'Cuenta requerida', 'Seleccione la cuenta contable de retención.')
      return
    }
    if (modo === 'crear') {
      if (conceptos.some((c) => c.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe el concepto ${draft.code}.`)
        return
      }
      setConceptos((prev) => [{ ...draft, code: draft.code.trim() }, ...prev])
      toast('success', 'Concepto de retención creado', `Se creó el concepto ${draft.code} (${draft.tarifa}%).`)
      audit('Creación de concepto de retención', 'Retenciones', `Concepto ${draft.code} — ${draft.tarifa}% creado`)
    } else {
      const previo = conceptos.find((c) => c.code === draft.code)
      const cambiaTarifa = previo && previo.tarifa !== draft.tarifa
      setConceptos((prev) => prev.map((c) => (c.code === draft.code ? draft : c)))
      toast('success', 'Concepto actualizado', `El concepto ${draft.code} quedó actualizado.`)
      audit(
        'Actualización de concepto de retención',
        'Retenciones',
        cambiaTarifa
          ? `Concepto ${draft.code} — tarifa modificada de ${previo?.tarifa}% a ${draft.tarifa}% (Pendiente de validación funcional)`
          : `Concepto ${draft.code} — ${draft.nombre} modificado`,
        cambiaTarifa ? 'INFO' : 'EXITO',
      )
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setConceptos((prev) => prev.filter((c) => c.code !== eliminar.code))
    toast('success', 'Concepto eliminado', `Se eliminó el concepto ${eliminar.code}.`)
    audit('Eliminación de concepto de retención', 'Retenciones', `Concepto ${eliminar.code} — ${eliminar.tarifa}% eliminado`)
    setEliminar(null)
  }

  const columns: GridColumn<ConceptoLocal>[] = [
    { key: 'code', label: 'Código', width: 90, sortable: true, render: (c) => <span className="mono bold">{c.code}</span> },
    { key: 'nombre', label: 'Concepto', sortable: true },
    { key: 'tarifa', label: 'Tarifa', width: 100, align: 'right', sortable: true, render: (c) => <span className="tnum bold">{c.tarifa}%</span> },
    { key: 'baseMinima', label: 'Base mínima', width: 140, align: 'right', money: true, render: (c) => <span className="tnum">{c.baseMinima > 0 ? money(c.baseMinima) : '—'}</span> },
    {
      key: 'cuenta',
      label: 'Cuenta',
      width: 220,
      render: (c) => {
        const a = state.accounts.find((x) => x.code === c.cuenta)
        return <span className="mono">{c.cuenta} <span className="muted small">{a?.nombre ?? ''}</span></span>
      },
    },
    {
      key: 'validada',
      label: 'Validación',
      width: 220,
      render: (c) => (c.validada ? <Badge tone="info">Regla definida</Badge> : <Badge tone="warning" icon="warn">Pendiente de validación funcional</Badge>),
      searchValue: (c) => (c.validada ? 'definida' : 'pendiente de validación funcional'),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Configuración de retenciones"
        subtitle="Conceptos, tarifas, bases mínimas y cuentas de retención en la fuente"
        icon="retencion"
        actions={
          <>
            <ExportMenu
              filename="retenciones"
              onExport={() =>
                downloadCsv(
                  [['Código', 'Nombre', 'Tarifa', 'Base mínima', 'Cuenta'], ...conceptos.map((c) => [c.code, c.nombre, `${c.tarifa}%`, String(c.baseMinima), c.cuenta])],
                  'retenciones.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO } })}>Crear</Button>
          </>
        }
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={conceptos}
          columns={columns}
          rowKey={(c) => c.code}
          selectable
          selected={sel}
          onSelect={setSel}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          onRowDoubleClick={(c) => setModal({ modo: 'editar', draft: { ...c } })}
          height="calc(100vh - 320px)"
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Acciones">
                <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                  const c = conceptos.find((x) => x.code === [...sel][0])
                  if (c) setModal({ modo: 'editar', draft: { ...c } })
                }}>Modificar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                  const c = conceptos.find((x) => x.code === [...sel][0])
                  if (c) setEliminar(c)
                }}>Eliminar</Button>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo concepto de retención' : `Concepto ${modal?.draft.code ?? ''}`}
        icon="retencion"
        width={540}
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
              <Field label="Código" required width={120}>
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v.toUpperCase() } })} placeholder="R01" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Tarifa (%)" required width={130}>
                <Input
                  type="number"
                  value={modal.draft.tarifa}
                  onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, tarifa: Number(v) || 0, validada: false } })}
                />
              </Field>
            </div>
            <Field label="Concepto" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Servicios" />
            </Field>
            <Field label="Base mínima (COP)" hint="0 = sin base mínima.">
              <MoneyInput value={modal.draft.baseMinima} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, baseMinima: v } })} width={200} />
            </Field>
            <Field label="Cuenta contable" required>
              <AccountPicker value={modal.draft.cuenta} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, cuenta: v } })} />
            </Field>
            {!modal.draft.validada && (
              <div className="note-strip">
                <Badge tone="warning" icon="warn">Pendiente de validación funcional</Badge>
                La tarifa cambió o la regla no está definida: un analista tributario debe confirmar la base legal antes de aplicar.
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar concepto de retención"
        danger
        message={`¿Desea eliminar el concepto ${eliminar?.code} — ${eliminar?.nombre} (${eliminar?.tarifa}%)?`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

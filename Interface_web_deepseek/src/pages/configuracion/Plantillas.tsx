/* ============================================================
   CONTABDSI · Configuración → Plantillas contables
   ============================================================ */

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Textarea,
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { ExportMenu, MoneyInput, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { AccountPicker } from '@/components/accounting/Combobox'
import { useStore } from '@/state/AppStore'
import { makeLinea } from '@/data/mock'
import { money, uid } from '@/core/format'
import type { Lote } from '@/core/types'

interface LineaPlantilla {
  id: string
  cuenta: string
  concepto: string
  debito: number
  credito: number
}

interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  lineas: LineaPlantilla[]
}

const INICIALES: Plantilla[] = [
  {
    id: 'p1',
    nombre: 'Nómina mensual',
    descripcion: 'Registro estándar de nómina con retención y salarios por pagar.',
    lineas: [
      { id: 'l1', cuenta: '510506', concepto: 'Sueldos del período', debito: 12000000, credito: 0 },
      { id: 'l2', cuenta: '236540', concepto: 'Retención en la fuente por salarios', debito: 0, credito: 1200000 },
      { id: 'l3', cuenta: '250505', concepto: 'Salarios por pagar', debito: 0, credito: 10800000 },
    ],
  },
  {
    id: 'p2',
    nombre: 'Compra con IVA y retención',
    descripcion: 'Compra nacional con IVA 19% y retefuente 2,5%.',
    lineas: [
      { id: 'l1', cuenta: '510506', concepto: 'Compra de insumos', debito: 5000000, credito: 0 },
      { id: 'l2', cuenta: '240805', concepto: 'IVA compras 19%', debito: 950000, credito: 0 },
      { id: 'l3', cuenta: '236540', concepto: 'Retefuente 2,5%', debito: 0, credito: 125000 },
      { id: 'l4', cuenta: '111005', concepto: 'Pago neto banco', debito: 0, credito: 5825000 },
    ],
  },
  {
    id: 'p3',
    nombre: 'Causación de arrendamiento',
    descripcion: 'Gasto de arriendo con retención del 3,5%.',
    lineas: [
      { id: 'l1', cuenta: '510506', concepto: 'Arrendamiento oficina', debito: 3500000, credito: 0 },
      { id: 'l2', cuenta: '236540', concepto: 'Retefuente arrendamientos', debito: 0, credito: 122500 },
      { id: 'l3', cuenta: '250505', concepto: 'Arriendo por pagar', debito: 0, credito: 3377500 },
    ],
  },
]

const VACIO: Plantilla = { id: '', nombre: '', descripcion: '', lineas: [] }

export function PlantillasPage() {
  usePageTitle('Plantillas contables')
  const { state, dispatch, toast, audit } = useStore()
  const [plantillas, setPlantillas] = useState<Plantilla[]>(INICIALES)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: Plantilla } | null>(null)
  const [eliminar, setEliminar] = useState<Plantilla | null>(null)
  const [usando, setUsando] = useState<Plantilla | null>(null)

  const usarPlantilla = () => {
    if (!usando) return
    const codigo = `TPL-${Date.now().toString(36).slice(-4).toUpperCase()}`
    const lineas = usando.lineas.map((l) =>
      makeLinea({
        cuenta: l.cuenta,
        concepto: l.concepto,
        debito: l.debito,
        credito: l.credito,
        origen: 'PLANTILLA',
        documento: `${codigo}-${state.session.period}`,
        fecha: `2026-02-28`,
      }),
    )
    const lote: Lote = {
      codigo,
      nombre: `Plantilla ${usando.nombre}`,
      periodo: `${state.session.year}${String(state.session.period).padStart(2, '0')}`,
      usuario: state.session.user.nombre,
      origen: 'PLANTILLA',
      fecha: '2026-02-28',
      lineas,
      estado: 'BORRADOR',
      issues: [],
      audit: [],
    }
    dispatch({ type: 'ADD_LOTE', lote })
    toast('success', 'Plantilla aplicada', `Se generó el lote ${codigo} con ${lineas.length} líneas en estado BORRADOR.`)
    audit('Uso de plantilla contable', 'Plantillas', `Plantilla «${usando.nombre}» aplicada → lote ${codigo}`)
    setUsando(null)
  }

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El nombre de la plantilla es obligatorio.')
      return
    }
    if (draft.lineas.length === 0) {
      toast('error', 'Sin líneas', 'Agregue al menos una línea a la plantilla.')
      return
    }
    if (modo === 'crear') {
      const nuevo = { ...draft, id: uid('p') }
      setPlantillas((prev) => [nuevo, ...prev])
      toast('success', 'Plantilla creada', `Se creó la plantilla «${draft.nombre}» con ${draft.lineas.length} líneas.`)
      audit('Creación de plantilla', 'Plantillas', `Plantilla «${draft.nombre}» creada`)
    } else {
      setPlantillas((prev) => prev.map((p) => (p.id === draft.id ? draft : p)))
      toast('success', 'Plantilla actualizada', `La plantilla «${draft.nombre}» quedó actualizada.`)
      audit('Actualización de plantilla', 'Plantillas', `Plantilla «${draft.nombre}» modificada`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setPlantillas((prev) => prev.filter((p) => p.id !== eliminar.id))
    toast('success', 'Plantilla eliminada', `Se eliminó la plantilla «${eliminar.nombre}».`)
    audit('Eliminación de plantilla', 'Plantillas', `Plantilla «${eliminar.nombre}» eliminada`)
    setEliminar(null)
  }

  const columns: GridColumn<Plantilla>[] = [
    { key: 'nombre', label: 'Plantilla', sortable: true, render: (p) => <b>{p.nombre}</b> },
    { key: 'descripcion', label: 'Descripción', render: (p) => <span className="muted small">{p.descripcion}</span> },
    { key: 'lineas', label: 'Líneas', width: 90, align: 'center', render: (p) => <Badge tone="brand">{p.lineas.length}</Badge>, searchValue: (p) => String(p.lineas.length) },
    {
      key: 'debito',
      label: 'Total débito',
      width: 150,
      align: 'right',
      money: true,
      render: (p) => <span className="tnum">{money(p.lineas.reduce((a, l) => a + l.debito, 0))}</span>,
    },
    {
      key: 'accion',
      label: '',
      width: 130,
      align: 'center',
      render: (p) => (
        <Button size="sm" variant="subtle" icon="play" onClick={() => setUsando(p)}>Usar plantilla</Button>
      ),
    },
  ]

  const setLinea = (id: string, patch: Partial<LineaPlantilla>) => {
    if (!modal) return
    setModal({ ...modal, draft: { ...modal.draft, lineas: modal.draft.lineas.map((l) => (l.id === id ? { ...l, ...patch } : l)) } })
  }

  return (
    <div className="page">
      <PageHeader
        title="Plantillas contables"
        subtitle="Modelos de registro reutilizables en la captura de lotes"
        icon="plantilla"
        actions={
          <>
            <ExportMenu
              filename="plantillas"
              onExport={() =>
                downloadCsv(
                  [['Plantilla', 'Descripción', 'Líneas'], ...plantillas.map((p) => [p.nombre, p.descripcion, String(p.lineas.length)])],
                  'plantillas.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO, id: uid('p') } })}>Crear</Button>
          </>
        }
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={plantillas}
          columns={columns}
          rowKey={(p) => p.id}
          selectable
          selected={sel}
          onSelect={setSel}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          onRowDoubleClick={(p) => setModal({ modo: 'editar', draft: { ...p, lineas: p.lineas.map((l) => ({ ...l })) } })}
          height="calc(100vh - 320px)"
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Acciones">
                <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                  const p = plantillas.find((x) => x.id === [...sel][0])
                  if (p) setModal({ modo: 'editar', draft: { ...p, lineas: p.lineas.map((l) => ({ ...l })) } })
                }}>Modificar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                  const p = plantillas.find((x) => x.id === [...sel][0])
                  if (p) setEliminar(p)
                }}>Eliminar</Button>
                <Button size="sm" icon="play" disabled={sel.size !== 1} onClick={() => {
                  const p = plantillas.find((x) => x.id === [...sel][0])
                  if (p) setUsando(p)
                }}>Usar plantilla</Button>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>

      {/* Modal crear/editar plantilla */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nueva plantilla' : `Plantilla ${modal?.draft.nombre ?? ''}`}
        icon="plantilla"
        width={760}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={guardar}>Guardar</Button>
          </>
        }
      >
        {modal && (
          <div className="stack gap-12">
            <Field label="Nombre" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Nómina mensual" />
            </Field>
            <Field label="Descripción">
              <Textarea value={modal.draft.descripcion} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, descripcion: v } })} rows={2} />
            </Field>
            <div className="stack gap-4">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="small bold">Líneas de ejemplo</span>
                <Button size="sm" icon="plus" onClick={() => setModal({ ...modal, draft: { ...modal.draft, lineas: [...modal.draft.lineas, { id: uid('l'), cuenta: '', concepto: '', debito: 0, credito: 0 }] } })}>Agregar línea</Button>
              </div>
              <table className="sim-table">
                <thead>
                  <tr><th style={{ width: 200 }}>Cuenta</th><th>Concepto</th><th style={{ width: 120 }}>Débito</th><th style={{ width: 120 }}>Crédito</th><th style={{ width: 40 }} /></tr>
                </thead>
                <tbody>
                  {modal.draft.lineas.map((l) => (
                    <tr key={l.id}>
                      <td><AccountPicker value={l.cuenta} onChange={(v) => setLinea(l.id, { cuenta: v })} /></td>
                      <td><Input value={l.concepto} onChange={(v) => setLinea(l.id, { concepto: v })} placeholder="Concepto" /></td>
                      <td><MoneyInput value={l.debito} onChange={(v) => setLinea(l.id, { debito: v })} width={110} /></td>
                      <td><MoneyInput value={l.credito} onChange={(v) => setLinea(l.id, { credito: v })} width={110} /></td>
                      <td><IconButton icon="trash" label="Quitar línea" danger size={24} onClick={() => setModal({ ...modal, draft: { ...modal.draft, lineas: modal.draft.lineas.filter((x) => x.id !== l.id) } })} /></td>
                    </tr>
                  ))}
                  {modal.draft.lineas.length === 0 && (
                    <tr><td colSpan={5} className="muted center small" style={{ padding: 12 }}>Sin líneas. Agregue al menos una.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmar usar plantilla */}
      <ConfirmModal
        open={usando !== null}
        onClose={() => setUsando(null)}
        onConfirm={usarPlantilla}
        title="Usar plantilla"
        message={`Se generará un lote BORRADOR a partir de la plantilla «${usando?.nombre}» (${usando?.lineas.length ?? 0} líneas) en el período ${state.session.periodName} ${state.session.year}.`}
        confirmLabel="Generar lote"
      />

      {/* Confirmar eliminación */}
      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar plantilla"
        danger
        message={`¿Desea eliminar la plantilla «${eliminar?.nombre}»? Los lotes generados previamente no se ven afectados.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

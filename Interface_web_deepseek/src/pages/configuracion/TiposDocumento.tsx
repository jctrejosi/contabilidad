/* ============================================================
   CONTABDSI · Configuración → Tipos de documento
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
import { ExportMenu, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { useStore } from '@/state/AppStore'
import type { TipoDocumento } from '@/core/types'

const VACIO: TipoDocumento = { code: '', nombre: '', numeracion: 'MANUAL', consecutivo: 1, terceroObligatorio: true, centroObligatorio: false }

export function TiposDocumentoPage() {
  usePageTitle('Tipos de documento')
  const { state, toast, audit } = useStore()
  const [tipos, setTipos] = useState<TipoDocumento[]>(() => state.tiposDocumento.map((t) => ({ ...t })))
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: TipoDocumento } | null>(null)
  const [eliminar, setEliminar] = useState<TipoDocumento | null>(null)

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El código y el nombre del tipo de documento son obligatorios.')
      return
    }
    if (modo === 'crear') {
      if (tipos.some((t) => t.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe el tipo ${draft.code}.`)
        return
      }
      setTipos((prev) => [{ ...draft, code: draft.code.trim() }, ...prev])
      toast('success', 'Tipo de documento creado', `Se creó el tipo ${draft.code} — ${draft.nombre}.`)
      audit('Creación de tipo de documento', 'Tipos de documento', `Tipo ${draft.code} — ${draft.nombre} creado`)
    } else {
      setTipos((prev) => prev.map((t) => (t.code === draft.code ? draft : t)))
      toast('success', 'Tipo de documento actualizado', `El tipo ${draft.code} quedó actualizado.`)
      audit('Actualización de tipo de documento', 'Tipos de documento', `Tipo ${draft.code} — ${draft.nombre} modificado`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setTipos((prev) => prev.filter((t) => t.code !== eliminar.code))
    toast('success', 'Tipo de documento eliminado', `Se eliminó el tipo ${eliminar.code}.`)
    audit('Eliminación de tipo de documento', 'Tipos de documento', `Tipo ${eliminar.code} — ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const columns: GridColumn<TipoDocumento>[] = [
    { key: 'code', label: 'Código', width: 90, sortable: true, render: (t) => <span className="mono bold">{t.code}</span> },
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'numeracion',
      label: 'Numeración',
      width: 130,
      align: 'center',
      render: (t) => (t.numeracion === 'AUTOMATICA' ? <Badge tone="info">Automática</Badge> : <Badge tone="neutral">Manual</Badge>),
    },
    { key: 'consecutivo', label: 'Consecutivo', width: 110, align: 'right', sortable: true, render: (t) => <span className="tnum">{t.consecutivo.toLocaleString('es-CO')}</span> },
    {
      key: 'terceroObligatorio',
      label: 'Tercero obligatorio',
      width: 150,
      align: 'center',
      render: (t) => (t.terceroObligatorio ? <Badge tone="warning" icon="user">Obligatorio</Badge> : <span className="muted">—</span>),
    },
    {
      key: 'centroObligatorio',
      label: 'Centro obligatorio',
      width: 150,
      align: 'center',
      render: (t) => (t.centroObligatorio ? <Badge tone="warning" icon="centro">Obligatorio</Badge> : <span className="muted">—</span>),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Tipos de documento"
        subtitle="Numeración, consecutivos y obligatoriedad de tercero/centro por tipo"
        icon="doc"
        actions={
          <>
            <ExportMenu
              filename="tipos-documento"
              onExport={() =>
                downloadCsv(
                  [['Código', 'Nombre', 'Numeración', 'Consecutivo', 'Tercero oblig.', 'Centro oblig.'], ...tipos.map((t) => [t.code, t.nombre, t.numeracion, String(t.consecutivo), t.terceroObligatorio ? 'Sí' : 'No', t.centroObligatorio ? 'Sí' : 'No'])],
                  'tipos-documento.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO } })}>Crear</Button>
          </>
        }
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={tipos}
          columns={columns}
          rowKey={(t) => t.code}
          selectable
          selected={sel}
          onSelect={setSel}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          onRowDoubleClick={(t) => setModal({ modo: 'editar', draft: { ...t } })}
          height="calc(100vh - 320px)"
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Acciones">
                <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                  const t = tipos.find((x) => x.code === [...sel][0])
                  if (t) setModal({ modo: 'editar', draft: { ...t } })
                }}>Modificar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                  const t = tipos.find((x) => x.code === [...sel][0])
                  if (t) setEliminar(t)
                }}>Eliminar</Button>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo tipo de documento' : `Tipo ${modal?.draft.code ?? ''}`}
        icon="doc"
        width={560}
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
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v.toUpperCase() } })} placeholder="NOM" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Nombre" required className="grow">
                <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Nómina" />
              </Field>
            </div>
            <div className="row gap-8">
              <Field label="Numeración" required width={220}>
                <Select
                  value={modal.draft.numeracion}
                  onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, numeracion: v as TipoDocumento['numeracion'] } })}
                  options={[{ value: 'MANUAL', label: 'Manual' }, { value: 'AUTOMATICA', label: 'Automática' }]}
                />
              </Field>
              <Field label="Consecutivo actual" required width={180}>
                <Input type="number" value={modal.draft.consecutivo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, consecutivo: Number(v) || 0 } })} />
              </Field>
            </div>
            <div className="row gap-16">
              <Switch checked={modal.draft.terceroObligatorio} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, terceroObligatorio: v } })} label="Tercero obligatorio" />
              <Switch checked={modal.draft.centroObligatorio} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, centroObligatorio: v } })} label="Centro de costo obligatorio" />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar tipo de documento"
        danger
        message={`¿Desea eliminar el tipo ${eliminar?.code} — ${eliminar?.nombre}? Los documentos ya emitidos con este tipo no se ven afectados.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

/* ============================================================
   CONTABDSI · Configuración → Comprobantes (tipos y consecutivos)
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
import type { Voucher } from '@/core/types'

const VACIO: Voucher = { code: '', nombre: '', consecutivo: 1, consecutivoFin: undefined, activo: true, tipoDocumentoDefecto: '' }

export function ComprobantesPage() {
  usePageTitle('Comprobantes')
  const { state, toast, audit } = useStore()
  const [vouchers, setVouchers] = useState<Voucher[]>(() => state.vouchers.map((v) => ({ ...v })))
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: Voucher } | null>(null)
  const [eliminar, setEliminar] = useState<Voucher | null>(null)

  const tiposDoc = state.tiposDocumento.map((t) => ({ value: t.code, label: `${t.code} — ${t.nombre}` }))

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El código y el nombre del comprobante son obligatorios.')
      return
    }
    if (modo === 'crear') {
      if (vouchers.some((v) => v.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe el comprobante ${draft.code}.`)
        return
      }
      setVouchers((prev) => [{ ...draft, code: draft.code.trim() }, ...prev])
      toast('success', 'Comprobante creado', `Se creó el comprobante ${draft.code} — ${draft.nombre}.`)
      audit('Creación de comprobante', 'Comprobantes', `Comprobante ${draft.code} — ${draft.nombre} creado`)
    } else {
      setVouchers((prev) => prev.map((v) => (v.code === draft.code ? draft : v)))
      toast('success', 'Comprobante actualizado', `El comprobante ${draft.code} quedó actualizado.`)
      audit('Actualización de comprobante', 'Comprobantes', `Comprobante ${draft.code} — ${draft.nombre} modificado`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setVouchers((prev) => prev.filter((v) => v.code !== eliminar.code))
    toast('success', 'Comprobante eliminado', `Se eliminó el comprobante ${eliminar.code}.`)
    audit('Eliminación de comprobante', 'Comprobantes', `Comprobante ${eliminar.code} — ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const columns: GridColumn<Voucher>[] = [
    { key: 'code', label: 'Código', width: 100, sortable: true, render: (v) => <span className="mono bold">{v.code}</span> },
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'consecutivo', label: 'Consecutivo', width: 110, align: 'right', sortable: true, render: (v) => <span className="tnum">{v.consecutivo.toLocaleString('es-CO')}</span> },
    { key: 'consecutivoFin', label: 'Consecutivo final', width: 130, align: 'right', render: (v) => <span className="tnum">{v.consecutivoFin ? v.consecutivoFin.toLocaleString('es-CO') : '—'}</span> },
    { key: 'tipoDocumentoDefecto', label: 'Tipo doc. defecto', width: 150, render: (v) => <span className="mono">{v.tipoDocumentoDefecto || '—'}</span> },
    {
      key: 'activo',
      label: 'Estado',
      width: 100,
      align: 'center',
      render: (v) => (v.activo ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>),
      searchValue: (v) => (v.activo ? 'activo' : 'inactivo'),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Comprobantes"
        subtitle="Tipos de comprobante y control de consecutivos de la compañía"
        icon="comprobante"
        actions={
          <>
            <ExportMenu
              filename="comprobantes"
              onExport={() =>
                downloadCsv(
                  [['Código', 'Nombre', 'Consecutivo', 'Final', 'Tipo doc.', 'Activo'], ...vouchers.map((v) => [v.code, v.nombre, String(v.consecutivo), v.consecutivoFin ? String(v.consecutivoFin) : '', v.tipoDocumentoDefecto, v.activo ? 'Sí' : 'No'])],
                  'comprobantes.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO, consecutivoFin: undefined } })}>Crear</Button>
          </>
        }
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={vouchers}
          columns={columns}
          rowKey={(v) => v.code}
          selectable
          selected={sel}
          onSelect={setSel}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          onRowDoubleClick={(v) => setModal({ modo: 'editar', draft: { ...v } })}
          height="calc(100vh - 320px)"
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Acciones">
                <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                  const v = vouchers.find((x) => x.code === [...sel][0])
                  if (v) setModal({ modo: 'editar', draft: { ...v } })
                }}>Modificar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                  const v = vouchers.find((x) => x.code === [...sel][0])
                  if (v) setEliminar(v)
                }}>Eliminar</Button>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo comprobante' : `Comprobante ${modal?.draft.code ?? ''}`}
        icon="comprobante"
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
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v.toUpperCase() } })} placeholder="CE" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Nombre" required className="grow">
                <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Comprobante de egreso" />
              </Field>
            </div>
            <div className="row gap-8">
              <Field label="Consecutivo actual" required width={180}>
                <Input type="number" value={modal.draft.consecutivo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, consecutivo: Number(v) || 0 } })} />
              </Field>
              <Field label="Consecutivo final (opcional)" width={180} hint="Dejar vacío para numeración indefinida.">
                <Input type="number" value={modal.draft.consecutivoFin ?? ''} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, consecutivoFin: v ? Number(v) : undefined } })} />
              </Field>
            </div>
            <Field label="Tipo de documento por defecto">
              <Select value={modal.draft.tipoDocumentoDefecto} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, tipoDocumentoDefecto: v } })} options={tiposDoc} placeholder="Seleccionar…" />
            </Field>
            <Switch checked={modal.draft.activo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, activo: v } })} label="Comprobante activo" />
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar comprobante"
        danger
        message={`¿Desea eliminar el comprobante ${eliminar?.code} — ${eliminar?.nombre}? Los documentos ya emitidos conservan su numeración.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

/* ============================================================
   CONTABDSI · Configuración → Configuración de IVA
   ============================================================ */

import { useState } from 'react'
import {
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
import { ExportMenu, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { AccountPicker } from '@/components/accounting/Combobox'
import { useStore } from '@/state/AppStore'
import type { TarifaIVA } from '@/core/types'

const VACIO: TarifaIVA = { code: '', nombre: '', tarifa: 19, cuenta: '' }

export function ConfigIVAPage() {
  usePageTitle('Configuración de IVA')
  const { state, toast, audit } = useStore()
  const [tarifas, setTarifas] = useState<TarifaIVA[]>(() => state.tarifasIVA.map((t) => ({ ...t })))
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: TarifaIVA } | null>(null)
  const [eliminar, setEliminar] = useState<TarifaIVA | null>(null)

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El código y el nombre de la tarifa son obligatorios.')
      return
    }
    if (!draft.cuenta) {
      toast('error', 'Cuenta requerida', 'Seleccione la cuenta contable de IVA.')
      return
    }
    if (modo === 'crear') {
      if (tarifas.some((t) => t.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe la tarifa ${draft.code}.`)
        return
      }
      setTarifas((prev) => [{ ...draft, code: draft.code.trim() }, ...prev])
      toast('success', 'Tarifa de IVA creada', `Se creó la tarifa ${draft.code} (${draft.tarifa}%).`)
      audit('Creación de tarifa de IVA', 'IVA', `Tarifa ${draft.code} — ${draft.tarifa}% creada`)
    } else {
      setTarifas((prev) => prev.map((t) => (t.code === draft.code ? draft : t)))
      toast('success', 'Tarifa de IVA actualizada', `La tarifa ${draft.code} quedó actualizada.`)
      audit('Actualización de tarifa de IVA', 'IVA', `Tarifa ${draft.code} — ${draft.tarifa}% modificada`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setTarifas((prev) => prev.filter((t) => t.code !== eliminar.code))
    toast('success', 'Tarifa eliminada', `Se eliminó la tarifa ${eliminar.code}.`)
    audit('Eliminación de tarifa de IVA', 'IVA', `Tarifa ${eliminar.code} — ${eliminar.tarifa}% eliminada`)
    setEliminar(null)
  }

  const columns: GridColumn<TarifaIVA>[] = [
    { key: 'code', label: 'Código', width: 100, sortable: true, render: (t) => <span className="mono bold">{t.code}</span> },
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'tarifa', label: 'Tarifa', width: 100, align: 'right', sortable: true, render: (t) => <span className="tnum bold">{t.tarifa}%</span> },
    {
      key: 'cuenta',
      label: 'Cuenta contable',
      width: 220,
      render: (t) => {
        const a = state.accounts.find((x) => x.code === t.cuenta)
        return <span className="mono">{t.cuenta} <span className="muted small">{a?.nombre ?? ''}</span></span>
      },
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Configuración de IVA"
        subtitle="Tarifas de IVA y sus cuentas contables asociadas"
        icon="iva"
        actions={
          <>
            <ExportMenu
              filename="tarifas-iva"
              onExport={() =>
                downloadCsv(
                  [['Código', 'Nombre', 'Tarifa', 'Cuenta'], ...tarifas.map((t) => [t.code, t.nombre, `${t.tarifa}%`, t.cuenta])],
                  'tarifas-iva.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO } })}>Crear</Button>
          </>
        }
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={tarifas}
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
                  const t = tarifas.find((x) => x.code === [...sel][0])
                  if (t) setModal({ modo: 'editar', draft: { ...t } })
                }}>Modificar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                  const t = tarifas.find((x) => x.code === [...sel][0])
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
        title={modal?.modo === 'crear' ? 'Nueva tarifa de IVA' : `Tarifa ${modal?.draft.code ?? ''}`}
        icon="iva"
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
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v.toUpperCase() } })} placeholder="IV19" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Tarifa (%)" required width={130}>
                <Input type="number" value={modal.draft.tarifa} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, tarifa: Number(v) || 0 } })} />
              </Field>
            </div>
            <Field label="Nombre" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="IVA general" />
            </Field>
            <Field label="Cuenta contable" required hint="Cuenta de IVA por pagar/generado donde se registra esta tarifa.">
              <AccountPicker value={modal.draft.cuenta} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, cuenta: v } })} />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar tarifa de IVA"
        danger
        message={`¿Desea eliminar la tarifa ${eliminar?.code} (${eliminar?.tarifa}%)? Los documentos contabilizados conservan su cálculo.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

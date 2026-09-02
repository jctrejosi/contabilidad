/* ============================================================
   CONTABDSI · Configuración → Parámetros de operación
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
  Switch,
  Textarea,
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { ExportMenu, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { useStore } from '@/state/AppStore'

interface Parametro {
  code: string
  nombre: string
  valor: string
  descripcion: string
  activo: boolean
  reglaDefinida: boolean
}

const PARAMETROS_INICIALES: Parametro[] = [
  { code: 'DIAS_MORA_BLOQUEO', nombre: 'Días de mora para bloqueo', valor: '90', descripcion: 'Días de vencimiento de cartera que disparan el bloqueo automático de terceros.', activo: true, reglaDefinida: true },
  { code: 'CUENTA_CIERRE', nombre: 'Cuenta de cierre del ejercicio', valor: '590505', descripcion: 'Cuenta de pérdidas y ganancias usada al ejecutar el cierre anual.', activo: true, reglaDefinida: true },
  { code: 'TARIFA_RETENCION_DEFECTO', nombre: 'Tarifa de retención por defecto', valor: '2.5', descripcion: 'Porcentaje aplicado cuando la compra no trae concepto de retención asociado.', activo: true, reglaDefinida: false },
  { code: 'BASE_MINIMA_RETENCION', nombre: 'Base mínima de retención', valor: '917000', descripcion: 'Base gravable mínima (en UVT) para aplicar retención en la fuente.', activo: true, reglaDefinida: false },
  { code: 'CONSECUTIVO_EGRESO', nombre: 'Consecutivo comprobante de egreso', valor: '245', descripcion: 'Próximo consecutivo del comprobante CE.', activo: true, reglaDefinida: true },
  { code: 'PERIODO_DEFECTO', nombre: 'Período contable por defecto', valor: '02', descripcion: 'Mes propuesto en la captura de documentos.', activo: true, reglaDefinida: true },
  { code: 'CUENTA_IVA_DEFECTO', nombre: 'Cuenta de IVA por defecto', valor: '240805', descripcion: 'Cuenta destino cuando la línea no trae cuenta de IVA asociada.', activo: true, reglaDefinida: false },
  { code: 'DIAS_VENCIMIENTO_CARTERA', nombre: 'Días de vencimiento de cartera', valor: '30', descripcion: 'Plazo estándar de pago usado en el análisis de edades de cartera.', activo: true, reglaDefinida: true },
  { code: 'CANTIDAD_DECIMALES', nombre: 'Decimales en valores', valor: '2', descripcion: 'Cantidad de decimales usados en saldos y documentos.', activo: true, reglaDefinida: true },
  { code: 'COMPANIA_DEFECTO', nombre: 'Compañía por defecto', valor: '001', descripcion: 'Compañía preseleccionada al iniciar sesión.', activo: true, reglaDefinida: true },
]

const VACIO: Parametro = { code: '', nombre: '', valor: '', descripcion: '', activo: true, reglaDefinida: true }

export function ParametrosPage() {
  usePageTitle('Parámetros')
  const { toast, audit } = useStore()
  const [params, setParams] = useState<Parametro[]>(PARAMETROS_INICIALES)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: Parametro } | null>(null)
  const [eliminar, setEliminar] = useState<Parametro | null>(null)

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El código y el nombre del parámetro son obligatorios.')
      return
    }
    if (modo === 'crear') {
      if (params.some((p) => p.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe un parámetro con el código ${draft.code}.`)
        return
      }
      setParams((prev) => [{ ...draft, code: draft.code.trim() }, ...prev])
      toast('success', 'Parámetro creado', `Se creó el parámetro ${draft.code}.`)
      audit('Creación de parámetro', 'Parámetros', `Parámetro ${draft.code} — ${draft.nombre} creado`)
    } else {
      setParams((prev) => prev.map((p) => (p.code === draft.code ? draft : p)))
      toast('success', 'Parámetro actualizado', `El parámetro ${draft.code} quedó actualizado.`)
      audit('Actualización de parámetro', 'Parámetros', `Parámetro ${draft.code} — ${draft.nombre} modificado`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setParams((prev) => prev.filter((p) => p.code !== eliminar.code))
    toast('success', 'Parámetro eliminado', `Se eliminó el parámetro ${eliminar.code}.`)
    audit('Eliminación de parámetro', 'Parámetros', `Parámetro ${eliminar.code} — ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const exportarXlsx = () => {
    downloadCsv(
      [
        ['Código', 'Nombre', 'Valor', 'Descripción', 'Activo', 'Regla funcional'],
        ...params.map((p) => [p.code, p.nombre, p.valor, p.descripcion, p.activo ? 'Sí' : 'No', p.reglaDefinida ? 'Definida' : 'Pendiente de validación funcional']),
      ],
      'parametros.csv',
    )
  }

  const columns: GridColumn<Parametro>[] = [
    { key: 'code', label: 'Código', width: 190, sortable: true, render: (p) => <span className="mono">{p.code}</span> },
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'valor', label: 'Valor', width: 110, render: (p) => <span className="mono tnum">{p.valor}</span> },
    { key: 'descripcion', label: 'Descripción', render: (p) => <span className="muted small">{p.descripcion}</span> },
    {
      key: 'activo',
      label: 'Estado',
      width: 90,
      align: 'center',
      render: (p) => (p.activo ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>),
      searchValue: (p) => (p.activo ? 'activo' : 'inactivo'),
    },
    {
      key: 'regla',
      label: 'Regla funcional',
      width: 220,
      render: (p) =>
        p.reglaDefinida ? <Badge tone="info">Definida</Badge> : <Badge tone="warning" icon="warn">Pendiente de validación funcional</Badge>,
      searchValue: (p) => (p.reglaDefinida ? 'definida' : 'pendiente de validación funcional'),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Parámetros de operación"
        subtitle="Reglas globales del sistema contable · Los cambios aplican a todas las compañías"
        icon="parametros"
        actions={
          <>
            <ExportMenu filename="parametros" onExport={() => exportarXlsx()} />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO } })}>Crear</Button>
          </>
        }
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={params}
          columns={columns}
          rowKey={(p) => p.code}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          onRowDoubleClick={(p) => setModal({ modo: 'editar', draft: { ...p } })}
          selectable
          selected={sel}
          onSelect={setSel}
          height="calc(100vh - 320px)"
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Acciones">
                <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                  const p = params.find((x) => x.code === [...sel][0])
                  if (p) setModal({ modo: 'editar', draft: { ...p } })
                }}>Modificar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                  const p = params.find((x) => x.code === [...sel][0])
                  if (p) setEliminar(p)
                }}>Eliminar</Button>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>

      {/* Modal crear/editar */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo parámetro' : `Parámetro ${modal?.draft.code ?? ''}`}
        icon="parametros"
        width={600}
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
              <Field label="Código" required width={200}>
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v.toUpperCase() } })} placeholder="CODIGO" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Valor" required className="grow">
                <Input value={modal.draft.valor} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, valor: v } })} placeholder="Valor" monospace />
              </Field>
            </div>
            <Field label="Nombre" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Nombre del parámetro" />
            </Field>
            <Field label="Descripción" hint="Explique qué controla este parámetro y en qué módulos aplica.">
              <Textarea value={modal.draft.descripcion} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, descripcion: v } })} rows={3} placeholder="Descripción funcional…" />
            </Field>
            <div className="row gap-16">
              <Switch checked={modal.draft.activo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, activo: v } })} label="Parámetro activo" />
              <Switch checked={modal.draft.reglaDefinida} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, reglaDefinida: v } })} label="Regla funcional definida" />
            </div>
            {!modal.draft.reglaDefinida && (
              <div className="note-strip">
                <Badge tone="warning" icon="warn">Pendiente de validación funcional</Badge>
                La regla de negocio asociada a este parámetro aún no ha sido validada por el área funcional.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirmación de eliminación */}
      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar parámetro"
        danger
        message={`¿Desea eliminar el parámetro ${eliminar?.code} — ${eliminar?.nombre}? Esta acción queda registrada en la bitácora.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

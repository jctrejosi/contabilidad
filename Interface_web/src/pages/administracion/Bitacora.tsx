/* ============================================================
   CONTABDSI · Administración → Bitácora de auditoría
   Requiere permiso: admin.bitacora
   ============================================================ */

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  NoPermissionState,
  PageHeader,
  Select,
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { fechaHora } from '@/core/format'
import type { BitacoraEntry } from '@/core/types'

export function BitacoraPage() {
  usePageTitle('Bitácora')
  const { state, toast, audit } = useStore()
  const puede = useCan('admin.bitacora')
  const [busqueda, setBusqueda] = useState('')
  const [fUsuario, setFUsuario] = useState('')
  const [fModulo, setFModulo] = useState('')
  const [fResultado, setFResultado] = useState('')
  const [error, setError] = useState(false)

  const filtradas = useMemo(() => {
    let out = state.bitacora
    if (fUsuario) out = out.filter((b) => b.usuario === fUsuario)
    if (fModulo) out = out.filter((b) => b.modulo === fModulo)
    if (fResultado) out = out.filter((b) => b.resultado === fResultado)
    return out
  }, [state.bitacora, fUsuario, fModulo, fResultado])

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Bitácora" icon="bitacora" />
        <Card><NoPermissionState perm="admin.bitacora" /></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <PageHeader title="Bitácora" icon="bitacora" />
        <Card>
          <ErrorState
            title="No se pudo cargar la bitácora"
            detail="El almacenamiento de auditoría no respondió. Reintente la carga."
            onRetry={() => setError(false)}
          />
        </Card>
      </div>
    )
  }

  const usuarios = [...new Set(state.bitacora.map((b) => b.usuario))].sort()
  const modulos = [...new Set(state.bitacora.map((b) => b.modulo))].sort()

  const columns: GridColumn<BitacoraEntry>[] = [
    { key: 'fecha', label: 'Fecha', width: 140, sortable: true, render: (b) => <span className="tnum small">{fechaHora(b.fecha)}</span> },
    { key: 'usuario', label: 'Usuario', width: 150, sortable: true, render: (b) => <b className="small">{b.usuario}</b> },
    { key: 'rol', label: 'Rol', width: 110, render: (b) => <Badge tone="neutral">{b.rol}</Badge> },
    { key: 'accion', label: 'Acción', width: 220, render: (b) => <span className="small bold">{b.accion}</span> },
    { key: 'modulo', label: 'Módulo', width: 130, sortable: true, render: (b) => <Badge tone="brand">{b.modulo}</Badge> },
    { key: 'detalle', label: 'Detalle', minWidth: 320, render: (b) => <span className="muted small">{b.detalle}</span> },
    {
      key: 'resultado', label: 'Resultado', width: 110, align: 'center', sortable: true,
      render: (b) => (b.resultado === 'EXITO' ? <Badge tone="success" icon="check">Éxito</Badge> : b.resultado === 'FALLO' ? <Badge tone="danger" icon="error">Fallo</Badge> : <Badge tone="info" icon="info">Info</Badge>),
      searchValue: (b) => b.resultado,
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Bitácora de auditoría"
        subtitle={`${state.bitacora.length} eventos · la bitácora crece en vivo: cambie de rol y ejecute acciones sensibles para verlo`}
        icon="bitacora"
        actions={
          <Button
            icon="excel"
            onClick={() => {
              downloadCsv(
                [['Fecha', 'Usuario', 'Rol', 'Acción', 'Módulo', 'Detalle', 'Resultado'], ...filtradas.map((b) => [fechaHora(b.fecha), b.usuario, b.rol, b.accion, b.modulo, b.detalle, b.resultado])],
                'bitacora.csv',
              )
              toast('success', 'Bitácora exportada', `${filtradas.length} eventos exportados a XLSX (simulado).`)
              audit('Exportación de bitácora', 'Bitácora', `${filtradas.length} eventos exportados a XLSX`)
            }}
          >
            Exportar XLSX
          </Button>
        }
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={filtradas}
          columns={columns}
          rowKey={(b) => b.id}
          selectable={false}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          height="calc(100vh - 340px)"
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Filtros">
                <Field label="Usuario" width={170}>
                  <Select value={fUsuario} onChange={setFUsuario} options={usuarios.map((u) => ({ value: u, label: u }))} placeholder="Todos" />
                </Field>
                <Field label="Módulo" width={150}>
                  <Select value={fModulo} onChange={setFModulo} options={modulos.map((m) => ({ value: m, label: m }))} placeholder="Todos" />
                </Field>
                <Field label="Resultado" width={140}>
                  <Select
                    value={fResultado}
                    onChange={setFResultado}
                    options={[{ value: 'EXITO', label: 'Éxito' }, { value: 'FALLO', label: 'Fallo' }, { value: 'INFO', label: 'Info' }]}
                    placeholder="Todos"
                  />
                </Field>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>
    </div>
  )
}

/* ============================================================
   CONTABDSI · Administración → Usuarios y permisos
   Requiere permiso: admin.usuarios
   ============================================================ */

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmModal,
  Field,
  Input,
  Modal,
  NoPermissionState,
  PageHeader,
  Select,
  Tabs,
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { ROLES, USERS } from '@/data/mock'
import type { Role, User } from '@/core/types'

const PERMISOS: { key: string; label: string }[] = [
  { key: 'mov.capturar', label: 'Captura' },
  { key: 'mov.lotes', label: 'Lotes' },
  { key: 'mov.lotes.aprobar', label: 'Aprobar lotes' },
  { key: 'mov.lotes.contabilizar', label: 'Contabilizar' },
  { key: 'mov.anular', label: 'Anular' },
  { key: 'mov.importar', label: 'Importar' },
  { key: 'mov.nomina', label: 'Nómina' },
  { key: 'mov.reembolsos', label: 'Reembolsos' },
  { key: 'consulta.ver', label: 'Consulta' },
  { key: 'informes.ver', label: 'Informes' },
  { key: 'informes.exportar', label: 'Exportar informes' },
  { key: 'impuestos.retenciones', label: 'Retenciones' },
  { key: 'impuestos.iva', label: 'IVA' },
  { key: 'impuestos.medios', label: 'Medios magnéticos' },
  { key: 'reprocesos.auditar', label: 'Auditar reprocesos' },
  { key: 'reprocesos.corregir', label: 'Corregir reprocesos' },
  { key: 'cierres.ejecutar', label: 'Cierres' },
  { key: 'consolidacion.ejecutar', label: 'Consolidación' },
  { key: 'config.ver', label: 'Ver configuración' },
  { key: 'config.editar', label: 'Editar configuración' },
  { key: 'config.especiales', label: 'Funciones especiales' },
  { key: 'config.reclasificaciones', label: 'Reclasificaciones' },
  { key: 'admin.usuarios', label: 'Usuarios' },
  { key: 'admin.bitacora', label: 'Bitácora' },
  { key: 'admin.integraciones', label: 'Integraciones' },
  { key: 'admin.reorganizacion', label: 'Reorganización' },
  { key: 'presupuesto.ver', label: 'Presupuesto' },
]

const PERMISOS_POR_ROL: Record<Role, string[]> = {
  ADMIN: PERMISOS.map((p) => p.key),
  CONTADOR: ['mov.capturar', 'mov.lotes', 'mov.lotes.aprobar', 'mov.lotes.contabilizar', 'mov.anular', 'mov.importar', 'mov.nomina', 'mov.reembolsos', 'consulta.ver', 'informes.ver', 'informes.exportar', 'impuestos.retenciones', 'impuestos.iva', 'impuestos.medios', 'reprocesos.auditar', 'reprocesos.corregir', 'cierres.ejecutar', 'consolidacion.ejecutar', 'config.ver', 'config.editar', 'admin.bitacora', 'presupuesto.ver'],
  AUXILIAR: ['mov.capturar', 'mov.lotes', 'mov.importar', 'mov.nomina', 'mov.reembolsos', 'consulta.ver', 'informes.ver'],
  AUDITOR: ['consulta.ver', 'informes.ver', 'informes.exportar', 'reprocesos.auditar', 'reprocesos.corregir', 'admin.bitacora'],
  TRIBUTARIO: ['consulta.ver', 'informes.ver', 'informes.exportar', 'impuestos.retenciones', 'impuestos.iva', 'impuestos.medios', 'config.ver'],
  GERENCIA: ['consulta.ver', 'informes.ver'],
}

const VACIO: User = { id: '', nombre: '', role: 'AUXILIAR', iniciales: '' }

export function UsuariosPermisosPage() {
  usePageTitle('Usuarios y permisos')
  const { toast, audit } = useStore()
  const puede = useCan('admin.usuarios')
  const [usuarios, setUsuarios] = useState<User[]>(USERS)
  const [tab, setTab] = useState('usuarios')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: User } | null>(null)
  const [eliminar, setEliminar] = useState<User | null>(null)
  const [matriz, setMatriz] = useState<Record<Role, Set<string>>>(() => {
    const m = {} as Record<Role, Set<string>>
    ROLES.forEach((r) => { m[r.key] = new Set(PERMISOS_POR_ROL[r.key]) })
    return m
  })

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Usuarios y permisos" icon="usuarios" />
        <Card><NoPermissionState perm="admin.usuarios" /></Card>
      </div>
    )
  }

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.nombre.trim() || !draft.role) {
      toast('error', 'Datos incompletos', 'El nombre y el rol del usuario son obligatorios.')
      return
    }
    const iniciales = draft.nombre.split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
    if (modo === 'crear') {
      const nuevo = { ...draft, id: `u${Date.now().toString(36).slice(-5)}`, iniciales }
      setUsuarios((prev) => [...prev, nuevo])
      toast('success', 'Usuario creado', `Se creó el usuario ${nuevo.nombre} (${ROLES.find((r) => r.key === nuevo.role)?.label}).`)
      audit('Creación de usuario', 'Usuarios', `Usuario ${nuevo.nombre} · rol ${nuevo.role} creado`)
    } else {
      setUsuarios((prev) => prev.map((u) => (u.id === draft.id ? { ...draft, iniciales } : u)))
      toast('success', 'Usuario actualizado', `El usuario ${draft.nombre} quedó actualizado.`)
      audit('Actualización de usuario', 'Usuarios', `Usuario ${draft.nombre} · rol ${draft.role} modificado`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setUsuarios((prev) => prev.filter((u) => u.id !== eliminar.id))
    toast('success', 'Usuario eliminado', `Se eliminó el usuario ${eliminar.nombre}.`)
    audit('Eliminación de usuario', 'Usuarios', `Usuario ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const togglePermiso = (rol: Role, perm: string) => {
    setMatriz((prev) => {
      const next = new Set(prev[rol])
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      const m = { ...prev, [rol]: next }
      audit('Edición de permisos por rol', 'Usuarios', `Rol ${rol} · permiso ${perm} ${next.has(perm) ? 'concedido' : 'revocado'} (simulado)`)
      return m
    })
  }

  const columns: GridColumn<User>[] = [
    { key: 'nombre', label: 'Usuario', sortable: true, render: (u) => <b className="small">{u.nombre}</b> },
    { key: 'iniciales', label: 'Iniciales', width: 100, align: 'center', render: (u) => <Badge tone="brand">{u.iniciales}</Badge> },
    {
      key: 'role', label: 'Rol', width: 190, sortable: true,
      render: (u) => {
        const rol = ROLES.find((r) => r.key === u.role)
        return <Badge tone="info">{rol?.label ?? u.role}</Badge>
      },
    },
  ]

  const rolesDelSistema = ROLES.map((r) => r.key)

  return (
    <div className="page">
      <PageHeader
        title="Usuarios y permisos"
        subtitle="Gestión de usuarios y matriz de permisos por rol · edición simulada con auditoría"
        icon="usuarios"
        actions={<Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO } })}>Crear usuario</Button>}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'usuarios', label: 'Usuarios', icon: 'user', badge: usuarios.length },
          { key: 'permisos', label: 'Matriz de permisos', icon: 'shield' },
        ]}
      />

      {tab === 'usuarios' && (
        <Card pad={false}>
          <AccountingDataGrid
            rows={usuarios}
            columns={columns}
            rowKey={(u) => u.id}
            selectable
            selected={sel}
            onSelect={setSel}
            searchText={busqueda}
            onSearchChange={setBusqueda}
            onRowDoubleClick={(u) => setModal({ modo: 'editar', draft: { ...u } })}
            height="calc(100vh - 360px)"
            toolbar={
              <Toolbar>
                <ToolbarGroup label="Acciones">
                  <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                    const u = usuarios.find((x) => x.id === [...sel][0])
                    if (u) setModal({ modo: 'editar', draft: { ...u } })
                  }}>Modificar</Button>
                  <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                    const u = usuarios.find((x) => x.id === [...sel][0])
                    if (u) setEliminar(u)
                  }}>Eliminar</Button>
                </ToolbarGroup>
              </Toolbar>
            }
          />
        </Card>
      )}

      {tab === 'permisos' && (
        <Card title="Matriz de permisos por rol" icon="shield" pad={false}>
          <div className="perm-matrix">
            <table className="perm-table">
              <thead>
                <tr>
                  <th>Permiso</th>
                  {rolesDelSistema.map((r) => (
                    <th key={r}>{ROLES.find((x) => x.key === r)?.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISOS.map((p) => (
                  <tr key={p.key}>
                    <td className="perm-label"><span className="mono">{p.key}</span> <span className="muted xs">— {p.label}</span></td>
                    {rolesDelSistema.map((r) => (
                      <td key={r}>
                        <Checkbox
                          checked={matriz[r].has(p.key)}
                          onChange={() => togglePermiso(r, p.key)}
                          disabled={r === 'ADMIN'}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="xs muted" style={{ padding: '10px 14px' }}>
            El rol ADMIN tiene todos los permisos y no se puede editar. Los cambios se registran en la bitácora (simulación: no modifican los permisos reales de la sesión).
          </p>
        </Card>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo usuario' : `Usuario ${modal?.draft.nombre ?? ''}`}
        icon="user"
        width={480}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={guardar}>Guardar</Button>
          </>
        }
      >
        {modal && (
          <div className="stack gap-12">
            <Field label="Nombre completo" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Laura Gómez" />
            </Field>
            <Field label="Rol" required>
              <Select
                value={modal.draft.role}
                onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, role: v as Role } })}
                options={ROLES.map((r) => ({ value: r.key, label: `${r.label} — ${r.description}` }))}
              />
            </Field>
            <p className="xs muted">Las iniciales se calculan automáticamente a partir del nombre.</p>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar usuario"
        danger
        message={`¿Desea eliminar el usuario ${eliminar?.nombre} (${ROLES.find((r) => r.key === eliminar?.role)?.label})?`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

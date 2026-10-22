import { useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { FINANCIAL_MODULES, MODULE_ORDER } from '../../../data/finance';
import { USUARIO } from '../../../data/mock';
import { useFinance } from '../../../finance/store';
import type { PermissionLevel, Role } from '../../../finance/types';

const LEVELS: PermissionLevel[] = ['Administrar', 'Aprobar', 'Editar', 'Ver', 'Sin acceso'];

export default function Permisos({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);

  function levelOf(roleId: string, module: string): PermissionLevel {
    return state.rolePermissions.find(row => row.roleId === roleId && row.module === module)?.level ?? 'Sin acceso';
  }

  function setLevel(roleId: string, module: string, level: PermissionLevel) {
    update(draft => {
      const existing = draft.rolePermissions.find(row => row.roleId === roleId && row.module === module);
      if (existing) {
        existing.level = level;
      } else {
        draft.rolePermissions.push({ id: `perm-${roleId}-${module}`, roleId, module: module as typeof MODULE_ORDER[number], level });
      }
    }, `Permiso ${module} de rol actualizado`, 'auditoria');
  }

  function toggleRole(id: string) {
    update(draft => {
      const role = draft.roles.find(item => item.id === id);
      if (role) role.active = !role.active;
    }, 'Estado de rol actualizado', 'auditoria');
    showToast('Rol actualizado.');
  }

  function create(payload: { name: string; description: string; users: string }) {
    const role: Role = {
      id: `rol-${Date.now()}`,
      name: payload.name,
      description: payload.description,
      users: payload.users.split(',').map(user => user.trim()).filter(Boolean),
      active: true,
    };
    update(draft => {
      draft.roles.push(role);
    }, `Rol ${payload.name} creado`, 'auditoria');
    setOpen(false);
    showToast(`Rol ${payload.name} creado.`);
  }

  const columns: Column<Role>[] = [
    {
      header: 'Rol',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.name}</div>
          <div className="text-[10px] text-gray-400">{row.description}</div>
        </div>
      ),
    },
    {
      header: 'Usuarios',
      cell: row => (
        <div className="flex flex-wrap gap-1">
          {row.users.map(user => (
            <span key={user} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{user}</span>
          ))}
        </div>
      ),
    },
    {
      header: 'Módulos',
      align: 'center',
      cell: row => (
        <span className="tabular text-[11px] text-gray-600">
          {state.rolePermissions.filter(permission => permission.roleId === row.id && permission.level !== 'Sin acceso').length}
        </span>
      ),
    },
    { header: 'Estado', cell: row => <Badge tone={row.active ? 'green' : 'gray'}>{row.active ? 'Activo' : 'Inactivo'}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => <Button size="sm" onClick={() => toggleRole(row.id)}>{row.active ? 'Desactivar' : 'Activar'}</Button>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Roles" value={String(state.roles.length)} detail={`${state.roles.filter(role => role.active).length} activos`} tone="cyan" />
        <KpiCard label="Usuarios asignados" value={String(new Set(state.roles.flatMap(role => role.users)).size)} detail="Con al menos un rol" tone="blue" />
        <KpiCard label="Permisos configurados" value={String(state.rolePermissions.length)} detail="Combinaciones rol · módulo" tone="violet" />
        <KpiCard label="Administradores" value={String(state.roles.filter(role => role.name === 'Administrador').length)} detail="Acceso total a la suite" tone="amber" />
      </div>

      <Card>
        <SectionTitle
          title="Roles y usuarios"
          detail="Perfiles con acceso a la suite y usuarios asignados"
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Nuevo rol
            </Button>
          }
        />
        <div className="p-4">
          <DataTable columns={columns} rows={state.roles} rowKey={row => row.id} empty="No hay roles definidos." />
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="Matriz de permisos"
          detail="Nivel de acceso por rol y módulo; los cambios se guardan de inmediato"
        />
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-semibold">Módulo</th>
                {state.roles.map(role => (
                  <th key={role.id} className="px-3 py-2 text-left font-semibold">{role.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-800">Suite completa</td>
                {state.roles.map(role => (
                  <td key={role.id} className="px-3 py-2">
                    <FilterSelect value={levelOf(role.id, 'suite')} onChange={event => setLevel(role.id, 'suite', event.target.value as PermissionLevel)}>
                      {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                    </FilterSelect>
                  </td>
                ))}
              </tr>
              {MODULE_ORDER.map(module => (
                <tr key={module}>
                  <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-800">{FINANCIAL_MODULES[module].shortName}</td>
                  {state.roles.map(role => (
                    <td key={role.id} className="px-3 py-2">
                      <FilterSelect value={levelOf(role.id, module)} onChange={event => setLevel(role.id, module, event.target.value as PermissionLevel)}>
                        {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                      </FilterSelect>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
          Última modificación por {USUARIO.nombre}. Los permisos son de interfaz y no bloquean el backend.
        </div>
      </Card>

      {open && (
        <Modal title="Nuevo rol" subtitle="Defina nombre, descripción y usuarios." onClose={() => setOpen(false)}>
          <RoleForm onCancel={() => setOpen(false)} onSave={create} />
        </Modal>
      )}
    </div>
  );
}

function RoleForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (payload: { name: string; description: string; users: string }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState('');
  const valid = name.trim().length >= 3;

  return (
    <div className="space-y-4">
      <Field label="Nombre del rol">
        <input className={INPUT} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Compras" />
      </Field>
      <Field label="Descripción">
        <input className={INPUT} value={description} onChange={event => setDescription(event.target.value)} placeholder="Responsabilidad del rol" />
      </Field>
      <Field label="Usuarios" hint="Separe los nombres con coma.">
        <input className={INPUT} value={users} onChange={event => setUsers(event.target.value)} placeholder="Laura Gómez, Carlos Pérez" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ name: name.trim(), description: description.trim(), users })}>
          Crear rol
        </Button>
      </div>
    </div>
  );
}

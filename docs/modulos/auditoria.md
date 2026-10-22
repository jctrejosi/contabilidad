# Auditoría y control

Módulo transversal de trazabilidad y control de acceso. Expone la bitácora de
acciones de la suite y una matriz de permisos por rol y módulo.

## Rutas

| Submenú | Ruta | Qué resuelve |
|---|---|---|
| Bitácora de eventos | `auditoria/bitacora` | Eventos por usuario, módulo, fecha y acción |
| Roles y permisos | `auditoria/permisos` | Roles, usuarios asignados y matriz de acceso |

## Modelo de datos

### `AuditEntry`

Ya existía en `FinanceState`. Cada mutación de la suite agrega una entrada con:

- `at`: fecha y hora.
- `user`: usuario activo.
- `module`: módulo de origen o `suite`.
- `action`: descripción de la acción.

La bitácora conserva los últimos 80 eventos por compañía y se ordena del más
reciente al más antiguo.

### `Role`

- `name`, `description`, `users`, `active`.

### `RolePermission`

- `roleId`, `module` (`FinancialModuleId` o `suite`), `level`.

Niveles: `Administrar`, `Aprobar`, `Editar`, `Ver` y `Sin acceso`. Si no existe
registro para una combinación, se asume `Sin acceso`.

## Funcionalidad

### Bitácora

- KPIs de eventos, usuarios, módulos y último evento.
- Búsqueda por usuario, acción o módulo.
- Filtro por módulo.
- Exportación simulada de la bitácora.
- Tabla con fecha, usuario, módulo y acción.

### Roles y permisos

- Tabla de roles con descripción, usuarios, módulos con acceso y estado.
- Creación de rol con nombre, descripción y usuarios separados por coma.
- Activación o desactivación de un rol.
- Matriz rol × módulo con un selector por celda.
- Fila especial **Suite completa** para el permiso global.
- Los cambios se guardan de inmediato en el estado de la suite.

## Reglas de negocio

- Cada cambio de permiso queda registrado en la bitácora.
- Un rol inactivo conserva sus permisos y su histórico.
- El permiso de suite no reemplaza automáticamente los permisos por módulo: la
  pantalla los muestra de forma independiente.
- La bitácora es de solo lectura desde la interfaz; no se edita ni se borra.

## Datos iniciales

- Cinco roles: Administrador, Dirección financiera, Tesorería, Contabilidad y
  Auditoría.
- Permisos por módulo para cada rol, con administrador global y auditoría en
  modo consulta.

## Verificación

- `npx tsc --noEmit`
- `npm run build`
- `node scripts/verify-finance.mjs` — sección 14: bitácora, exportación y matriz
  de permisos.

## Límites

- Los permisos son de interfaz: no bloquean endpoints ni operaciones del
  backend.
- No hay autenticación real por rol; el usuario activo es fijo en la demo.
- La bitácora no es inmutable ni está firmada; vive en `localStorage`.
- La exportación no genera un archivo, solo confirma la acción.

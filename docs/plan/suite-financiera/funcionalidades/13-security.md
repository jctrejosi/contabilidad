# Funcionalidades — `security`

Origen funcional (inventario de partida): grupos, ACL y reglas de registro de
Odoo `base`/`account` (Community); audit trail y secure entries de `account`
(Community, v20).

## F-SEC-001 — Usuarios

**Debe hacer.** Crear, editar, bloquear e inactivar usuarios con login, nombre,
correo, estado y último acceso.

**Reglas.** Login único; correo válido; contraseña con hash fuerte; usuario con
movimientos no se elimina; el bloqueo impide iniciar sesión.

**Datos/API.** `sec.usuario`; CRUD en `/api/v1/security/usuarios`.

**Aceptación.** No se duplica el login; la contraseña nunca se guarda en claro;
el bloqueo surte efecto de inmediato.

---

## F-SEC-002 — Roles

**Debe hacer.** Crear roles con nombre, descripción y estado; asignarlos por
compañía.

**Reglas.** Código único; un usuario puede tener roles distintos por compañía;
un rol en uso no se elimina; los cambios se auditan.

**Datos/API.** `sec.rol`, `sec.usuario_compania`;
CRUD en `/api/v1/security/roles`.

**Aceptación.** El rol aplica solo a la compañía asignada; no se elimina en uso;
el cambio queda auditado.

---

## F-SEC-003 — Permisos por módulo y acción

**Debe hacer.** Definir permisos `ver`, `crear`, `editar`, `aprobar`, `postear`,
`pagar`, `cerrar`, `exportar`, `administrar`.

**Reglas.** El permiso se evalúa en el servicio, no solo en la UI; un permiso
denegado devuelve 403; los permisos se agrupan por módulo; el cambio es auditado.

**Datos/API.** `sec.permiso`, `sec.rol_permiso`.

**Aceptación.** Un usuario sin `postear` no puede contabilizar; el backend aplica
la regla; la UI oculta la acción.

---

## F-SEC-004 — Alcance por compañía

**Debe hacer.** Limitar datos y acciones a las compañías asignadas al usuario.

**Reglas.** Toda consulta filtra por compañía; un usuario no puede inferir otra
compañía; RLS opcional; el cambio de compañía se registra.

**Datos/API.** `sec.usuario_compania`; filtro transversal en repositorios.

**Aceptación.** Consulta de otra compañía devuelve 403/vacío; el reporte no mezcla
compañías; el cambio queda auditado.

---

## F-SEC-005 — Segregación de funciones

**Debe hacer.** Impedir que el mismo usuario cree y apruebe/pague/cierre una
operación cuando la política lo exige.

**Reglas.** Creador ≠ aprobador; aprobador ≠ pagador en montos altos; cierre ≠
reapertura; la regla es configurable por compañía.

**Datos/API.** Validación en servicios de propuestas, pagos y cierres.

**Aceptación.** El creador no aprueba su propuesta; el pago requiere rol
diferente; la reapertura exige otro rol.

---

## F-SEC-006 — Auditoría de acciones

**Debe hacer.** Registrar actor, fecha, compañía, módulo, entidad, acción,
antes/después, motivo y request ID.

**Reglas.** Append-only; sin edición ni borrado; consulta filtrada; exportable;
los datos sensibles se enmascaran.

**Datos/API.** `sec.auditoria`; `GET /api/v1/security/auditoria`.

**Aceptación.** Toda escritura deja registro; el antes/después es correcto; la
exportación coincide.

---

## F-SEC-007 — Inalterabilidad con hash

**Debe hacer.** Encadenar las filas de auditoría y los asientos con un hash que
permita detectar alteraciones.

**Reglas.** Hash de la fila anterior + contenido; verificación periódica; una
alteración se reporta; el hash no se recalcula silenciosamente.

**Datos/API.** `sec.auditoria.hash_anterior/hash`, `led.asiento.hash`;
`GET /api/v1/security/integridad`.

**Aceptación.** Alterar una fila rompe la cadena; la verificación lo detecta; el
reporte es exportable.

---

## F-SEC-008 — Sesiones y autenticación

**Debe hacer.** Iniciar/cerrar sesión, expirar por inactividad, revocar y limitar
intentos.

**Reglas.** Token con expiración; bloqueo tras intentos fallidos; cierre de
sesión invalida el token; el registro incluye IP y user agent.

**Datos/API.** `sec.sesion`; `POST /api/v1/security/sesiones`.

**Aceptación.** Token expirado se rechaza; el bloqueo se activa; el cierre
invalida la sesión.

---

## F-SEC-009 — Acciones sensibles con motivo

**Debe hacer.** Exigir motivo en reversión, anulación, reapertura, castigo,
ajuste manual, cambio de permisos y levantamiento de bloqueo.

**Reglas.** Motivo de longitud mínima; queda en auditoría; sin motivo se rechaza;
la acción se notifica si es crítica.

**Datos/API.** Validación transversal en comandos sensibles.

**Aceptación.** Sin motivo se rechaza; el motivo queda visible; la notificación se
envía.

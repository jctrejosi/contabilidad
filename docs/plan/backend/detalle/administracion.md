# Detalle: administracion (bloques D5, D6 y D7)

Once rutas nuevas para Usuarios y permisos (H7), Bitacora (mitad de H8) e
Integraciones (la otra mitad de H8).

Tablas: `roles`, `permisos`, `rol_permisos`, `usuarios`, `usuario_companias`,
`auditoria` e `integraciones` ya existen
(`db/postgresql/schema/08_seguridad.sql:11`, `21`, `28`, `37`, `96`, `56`, `79`).
No hay DDL nuevo.

Tres precisiones que valen para todo el archivo:

1. El modelo **no guarda contrasenas**: `usuarios` tiene nombre, correo, rol,
   iniciales y estado, y nada mas. La matriz lo pide explicitamente: "no copiar
   permisos permisivos ni claves en claro" (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`,
   VISUSU y CONOPER). La autenticacion real queda fuera de alcance (seccion 6 del
   plan principal).
2. La comprobacion de permisos del original devolvia verdadero y ese atajo no se
   traslada (P28). Por eso la verificacion efectiva es una pieza transversal
   nueva y no un `if` mas.
3. La contraparte legada de `usuario_companias` no existe: el acceso por empresa
   es aporte del modelo (`08_seguridad.sql:94-101`).

---

## 0. Patron comun

- `GET` sin `cia` cuando el recurso es global (`roles`, `permisos`,
  `auditoria`, `integraciones` en su `GET`); `cia` cuando el recurso es por
  compania (`usuario_companias`). Es la misma distincion que ya hace
  `GET /api/tipos-documento` sin `cia` (`backend/app.py:369`).
- Todas las escrituras llevan `usuario` y `motivo`; las bajas son logicas
  (`usuarios.eliminado_en`, `08_seguridad.sql:44`).
- Respuestas: lista `{"items": [...], "count": n, "source": "TABLA"}`,
  elemento `{"item": {...}, "source": "TABLA"}`, baja 204.
- Auditado: `trg_usuarios_auditoria` e `trg_integraciones_auditoria`
  (`08_seguridad.sql:111-114`) mas la fila de `auditoria` de cada accion
  sensible.
- Aceptacion: normal, vacio e invalido, con el caso invalido propio de cada ruta.

---

## 1. Usuarios, roles y permisos (D5)

### 1.1 `GET /api/usuarios`

**Proposito.** Listar los usuarios con su rol, su estado y sus companias.

**Request.** `q` (opcional, `max_length=60`), `estado`
(`Literal["todos", "activo", "inactivo"]`, por defecto `todos`), `page` y
`pageSize` (`le=200`), con los mismos nombres que `GET /api/terceros`
(`backend/app.py:324-330`).

**Response (200)**

```json
{
  "items": [
    { "id": 4, "nombre": "Laura Gomez", "email": "laura@example.com", "rol": "CONTADOR", "iniciales": "LG", "activo": true, "companias": ["001", "002"] }
  ],
  "count": 1,
  "source": "usuarios"
}
```

**Consume.** UsuariosPermisos: estado inicial (`UsuariosPermisos.tsx:92-102`, hoy
`useState` con cuatro usuarios fijos).

**Reglas.** Excluye `eliminado_en`. `companias` viene de `usuario_companias`; un
usuario sin companias asignadas no ve datos en ninguna (y la interfaz lo advierte
antes de guardarlo asi). En Advantage se lee de VISUSU, sin la lista de
companias, y la respuesta lo declara con `companias: null`.

**Criterio de aceptacion**

1. Normal: devuelve los usuarios con rol y companias.
2. Vacio: instalacion sin usuarios devuelve `items: []`, `count: 0`.
3. Invalido: `estado` distinto de los tres valores, 422.

### 1.2 `POST /api/usuarios`

**Proposito.** Crear un usuario.

**Request.** Cuerpo `UserWrite`: `nombre` (`1..60`), `email` (`1..60`),
`rol` (codigo existente en `roles`), `iniciales` (`max_length=4`), `activo`
(booleano, por defecto `true`), `companias` (`list[str]`, `min_length=1`),
`usuario`, `motivo`.

**Response (201)**

```json
{ "item": { "id": 6, "nombre": "Carlos Perez", "email": "carlos@example.com", "rol": "AUXILIAR", "activo": true, "companias": ["001"] }, "source": "usuarios" }
```

**Consume.** UsuariosPermisos: crear (`UsuariosPermisos.tsx:129-137`, hoy
`setUsuarios(prev => [...prev, {...}])` con aviso "Usuario X creado").

**Reglas**

- El correo es unico (`usuarios_email_uk`, `08_seguridad.sql:50`): repetido, 409.
  Se valida el formato en el backend (la leccion de H18: la regla no puede vivir
  solo en el modal).
- `rol` debe existir; si no, 422.
- `companias` es obligatoria: crear un usuario sin acceso a ninguna compania no
  tiene uso y es una fuente de incidentes, asi que se rechaza con 422.
- No se envia ninguna clave: el usuario no tiene contrasena en el modelo y la
  interfaz no debe pedirla.

**Criterio de aceptacion**

1. Normal: usuario nuevo con una compania devuelve 201 y aparece en el `GET`
   con su rol.
2. Vacio: `companias: []` devuelve 422.
3. Invalido: correo repetido, 409; correo sin arroba, 422; rol inexistente, 422.

### 1.3 `PUT /api/usuarios/{id}`

**Proposito.** Modificar el usuario: nombre, correo, rol, iniciales o estado.

**Request.** `id` (path, `ge=1`) y cuerpo `UserWrite` sin `companias` (que tiene
su propia ruta, 1.7).

**Response (200).** `{"item": {...}, "source": "usuarios"}`.

**Consume.** UsuariosPermisos: editar (`UsuariosPermisos.tsx:129-137`).

**Reglas.** No se puede desactivar (ni eliminar) al ultimo usuario activo con rol
de administrador: 409 con el motivo. Es la unica regla de bloqueo de esta ruta, y
existe porque sin ella la instalacion puede quedar sin nadie que administre. El
cambio de rol aplica al control de acceso efectivo en la siguiente peticion, no
reescribe la bitacora ya escrita.

**Criterio de aceptacion**

1. Normal: cambio de rol devuelve 200 y la matriz de permisos refleja el rol
   nuevo.
2. Vacio: cuerpo `{}` devuelve 422.
3. Invalido: correo repetido, 409; unico administrador activo, 409; `id`
   inexistente, 404.

### 1.4 `DELETE /api/usuarios/{id}`

**Proposito.** Dar de baja al usuario.

**Request.** `id` (path), `motivo` (query, obligatorio), `usuario`.

**Response (204).**

**Consume.** UsuariosPermisos: eliminar (`UsuariosPermisos.tsx:141-145`, hoy
`setUsuarios(prev => prev.filter(...))`).

**Reglas.** Baja logica (`eliminado_en`). Se rechaza con 409 si es el ultimo
administrador activo. La bitacora del usuario **no** se toca: `auditoria.usuario_id`
sigue apuntando a su fila, porque la historia no cambia al dar de baja a quien la
produjo (la baja es logica justamente para eso).

**Criterio de aceptacion**

1. Normal: baja de un auxiliar devuelve 204 y el `GET` deja de listarlo.
2. Vacio: `id` inexistente, 404.
3. Invalido: ultimo administrador, 409; sin `motivo`, 422.

### 1.5 `GET /api/roles`

**Proposito.** Listar los roles con los permisos de cada uno.

**Request.** Sin parametros.

**Response (200)**

```json
{
  "items": [
    { "codigo": "CONTADOR", "nombre": "Contador principal", "permisos": ["mov.capturar", "mov.lotes.aprobar", "informes.generar"] }
  ],
  "count": 1,
  "permisos": [
    { "codigo": "mov.lotes.aprobar", "nombre": "Aprobar lotes", "modulo": "Lotes" }
  ],
  "source": "roles"
}
```

**Consume.** UsuariosPermisos: matriz de permisos (`UsuariosPermisos.tsx:147-151`,
hoy un `useState` de casillas).

**Reglas.** Los permisos son catalogo, no texto libre: `permisos.codigo` es unico
(`08_seguridad.sql:21-26`) y el catalogo se siembra con la migracion. La clave
`permisos` de la respuesta entrega el catalogo completo para que la interfaz
pueda dibujar la matriz sin otra llamada.

**Criterio de aceptacion**

1. Normal: devuelve roles y el catalogo de permisos.
2. Vacio: instalacion sin roles devuelve `items: []` y el catalogo de permisos
   completo (que es dato de sistema, no de usuario).
3. Invalido: no aplica (sin parametros).

### 1.6 `PUT /api/roles/{codigo}/permisos`

**Proposito.** Reemplazar los permisos de un rol.

**Request.** `codigo` (path, `1..20`), y cuerpo `RolePermissionList`:
`permisos` (`list[str]`, `max_length=200`), `usuario`, `motivo`.

**Response (200)**

```json
{ "item": { "codigo": "AUXILIAR", "permisos": ["mov.capturar"], "creados": 1, "retirados": 2 }, "source": "rol_permisos" }
```

**Consume.** UsuariosPermisos: marcar permisos en la matriz
(`UsuariosPermisos.tsx:147-151`).

**Reglas**

- Reemplazo en bloque (`rol_permisos`), con los conteos. Cada permiso debe existir
  en el catalogo: 422 si no.
- Un rol con usuarios activos se puede modificar, pero el cambio se anuncia: la
  respuesta incluye `usuariosAfectados` para que la interfaz lo advierta antes de
  guardar (los permisos rigen de inmediato).
- Quitar el ultimo permiso de un rol administrador no se permite (409): dejaria el
  sistema sin forma de administrar.
- `motor`: en Advantage la contraparte es VISUSU, que la matriz declara parcial
  ("agregar `usuario_companias` y homologacion de identificadores"); la rama de
  ADS escribe los permisos que el legado tenga y lo declara en la respuesta.

**Criterio de aceptacion**

1. Normal: dejar un permiso devuelve 200 con los conteos y la matriz queda asi.
2. Vacio: lista vacia retira todos los permisos del rol (200), salvo el caso
   invalido del punto siguiente.
3. Invalido: permiso inexistente en el catalogo, 422; dejar el rol `ADMIN` sin
   ningun permiso, 409.

### 1.7 `PUT /api/usuarios/{id}/companias`

**Proposito.** Fijar las companias a las que accede el usuario.

**Request.** `id` (path, `ge=1`) y cuerpo `UserCompanyList`: `companias`
(`list[str]`, `min_length=1`), `usuario`, `motivo`.

**Response (200)**

```json
{ "item": { "id": 6, "companias": ["001", "002"], "creadas": 1, "retiradas": 0 }, "source": "usuario_companias" }
```

**Consume.** UsuariosPermisos: campo de companias del formulario.

**Reglas.** Reemplazo en bloque. Cada compania debe existir: 422 si no. Es lo que
hace efectivo el aislamiento por empresa que P28 pide ("usuarios con companias
distintas no cruzan datos"). En Advantage no hay contraparte y la ruta responde
503 declarado.

**Criterio de aceptacion**

1. Normal: asignar dos companias devuelve 200 con los conteos.
2. Vacio: lista vacia devuelve 422 (`min_length=1`).
3. Invalido: compania inexistente, 422; `id` inexistente, 404.

### 1.8 Verificacion de permisos por operacion (pieza transversal, sin ruta)

**Proposito.** Que el permiso rija de verdad, que es el cierre de H7: hoy el
administrador cree haber revocado permisos y no rige nada.

**Como se implementa.** Una dependencia del backend que, antes de ejecutar una
ruta protegida, comprueba el permiso del rol y la compania del actor contra
`rol_permisos` y `usuario_companias`. Los permisos propuestos son los que la
matriz de la pantalla ya dibuja por modulo (`mov.*`, `informes.*`, `impuestos.*`,
`procesos.*`, `admin.*`).

**Reglas**

- Si no se puede determinar el rol o la compania del actor, la ruta responde 403 y
  registra el intento en `auditoria` con `resultado: 'FALLO'`
  (`08_seguridad.sql:65` admite `EXITO`, `FALLO` e `INFO`).
- Solo PostgreSQL: el legado devolvia verdadero y ese atajo no se traslada (P28).
- Es la ultima pieza de D5 y afecta a todas las rutas de escritura del plan: por
  eso va al final del bloque y no antes.

**Criterio de aceptacion**

1. Normal: un auxiliar sin `mov.lotes.aprobar` recibe 403 al contabilizar un lote
   y el intento queda en la bitacora como `FALLO`.
2. Vacio: usuario sin companias no accede a ninguna ruta con `cia` (403).
3. Invalido: actor inexistente o rol desconocido, 403 registrado, no 500.

---

## 2. Bitacora (D6)

### 2.1 `GET /api/auditoria`

**Proposito.** Publicar la bitacora real que el sistema ya escribe.

**Request.** `cia` (opcional: `auditoria.compania_id` admite nulo),
`fechaDesde` y `fechaHasta` (`max_length=10`, formato `YYYY-MM-DD`, con los
alias de `backend/app.py:644-654`), `modulo` (opcional), `usuario` (opcional),
`resultado` (`Literal["todos", "EXITO", "FALLO", "INFO"]`, por defecto `todos`),
`page` y `pageSize` (`le=200`).

**Response (200)**

```json
{
  "items": [
    { "id": 9182, "fecha": "2026-02-20T10:06:00", "usuario": "Laura Gomez", "rol": "Contador principal", "accion": "Contabilizacion", "modulo": "Contabilizacion", "detalle": "CE-000245 / NOM-2026-02", "resultado": "EXITO", "motivo": null }
  ],
  "count": 1,
  "source": "auditoria"
}
```

**Consume.** Bitacora: la tabla (hoy `EVENTOS` fijos, `Bitacora.tsx:14-24`) y el
texto de cabecera que la presenta como "registro inmutable de las acciones del
sistema" (`72`).

**Reglas**

- Lee la tabla `auditoria`, que ya se llena: el backend inserta desde
  `backend/postgres_writes.py:1186-1190` y los disparadores de fila. La auditoria
  no se inventa en esta ruta; solo se publica (es el punto exacto de H8).
- Orden por `creado_en` descendente, paginado: la tabla ya tiene el indice
  `auditoria_creado_en_idx` (`08_seguridad.sql:74`).
- `usuario` y `rol` se resuelven por `usuario_id` y `rol_id`; si el usuario fue
  dado de baja, su nombre se conserva (baja logica, ver 1.4).
- `motor`: en Advantage la bitacora vive en `VISAUDI`, y
  `backend/auditoria_repository.py` hoy solo escribe (`register_direct_posting`,
  `register_document_annulment`, `register_monthly_reprocess`). Esta ruta incluye
  la funcion de lectura que falta sobre esa tabla.

**Criterio de aceptacion**

1. Normal: contabilizar un lote genera al menos una fila y aparece en la consulta
   con usuario, modulo y resultado.
2. Vacio: filtro sin coincidencias devuelve `items: []` (no es error: es una
   consulta).
3. Invalido: `fechaDesde` con formato distinto de `YYYY-MM-DD`, 422; `pageSize`
   mayor que 200, 422.

### 2.2 `GET /api/auditoria/exportar`

**Proposito.** Exportar la bitacora filtrada.

**Request.** Los mismos filtros de 2.1 mas `formato`
(`Literal["xlsx", "csv"]`, obligatorio).

**Response (200).** Archivo, no JSON.

**Consume.** Bitacora: "Exportar XLSX" (`Bitacora.tsx:58-64`, hoy `setTimeout` de
un segundo que anuncia `bitacora-2026-02.xlsx generado (simulado)`).

**Reglas.** Mismos filtros que la consulta visible, sin filtros adicionales. El
`.xlsx` que genera es el del rango pedido, con la fecha del servidor en el
nombre, no una fecha fija escrita en el codigo. Cada exportacion deja fila en
`auditoria`: exportar la bitacora tambien es una accion auditable.

**Criterio de aceptacion**

1. Normal: descarga con las filas del filtro y el nombre refleja el rango.
2. Vacio: rango sin filas exporta un archivo con encabezados.
3. Invalido: `formato` distinto de `xlsx` o `csv`, 422; `pageSize` no aplica
   (exporta todo el filtro).

---

## 3. Integraciones (D7)

### 3.1 `GET /api/integraciones`

**Proposito.** Consultar el estado real de cada integracion de la compania.

**Request.** `cia`.

**Response (200)**

```json
{
  "items": [
    { "modulo": "Facturacion", "estado": "Desconectado", "ultimaSincronizacion": null, "configuracion": { "origen": "FADFACTU", "ruta": "" } }
  ],
  "count": 1,
  "source": "integraciones"
}
```

**Consume.** Integraciones: tabla de estado (`Integraciones.tsx:104-115`, hoy un
resultado fijo por modulo tras un `setTimeout`).

**Reglas**

- `estado` es uno de `Conectado | Desconectado | Bloqueado` (`08_seguridad.sql:83-84`)
  y `ultimaSincronizacion` es la real, o nula. La pantalla deja de afirmar un
  resultado que no consulto.
- La clave de la tabla es compania y modulo (`integraciones_uk`,
  `08_seguridad.sql:90`).
- No se inventa el catalogo de modulos: se devuelven las filas que existan. La
  siembra inicial (que modulos tiene una instalacion) es parte de la migracion,
  no de esta ruta.
- `motor`: requiere tabla nueva en ADS. La contraparte del legado esta declarada
  "Integracion requerida": `integraciones` guarda configuracion y estado, no los
  registros del modulo (P30).

**Criterio de aceptacion**

1. Normal: devuelve las filas de la compania con estado y fecha reales.
2. Vacio: compania sin integraciones configuradas, `items: []`, `count: 0`.
3. Invalido: sin `cia`, 422.

### 3.2 `PUT /api/integraciones/{modulo}`

**Proposito.** Cambiar el estado y la configuracion declarada de una integracion.

**Request.** `modulo` (path, `1..40`), `cia`, y cuerpo `IntegrationWrite`:
`estado` (`Literal["Conectado", "Desconectado", "Bloqueado"]`), `configuracion`
(objeto `jsonb` con las claves que el conector use), `usuario`, `motivo`.

**Response (200)**

```json
{ "item": { "modulo": "Facturacion", "estado": "Conectado", "configuracion": { "origen": "FADFACTU" } }, "source": "integraciones" }
```

**Consume.** Integraciones: configuracion del modulo (el boton "Probar conexion",
`Integraciones.tsx:116-125`, **no** lo consume: ver reglas).

**Reglas**

- **No** prueba la conexion ni sincroniza. "Probar conexion" y "Sincronizar"
  quedan fuera de alcance hasta que exista la definicion del conector (seccion 6
  del plan principal): el hallazgo H8 describe avisos "(simulado)" y este plan no
  los convierte en una afirmacion de conexion que no puede verificar.
- Esta ruta solo persiste lo que el administrador declara: el estado, la
  configuracion y el motivo. Es lo que permite que la pantalla deje de mostrar un
  resultado fijo y muestre lo configurado.
- No se puede pasar a `Conectado` sin `configuracion` no vacia (422): es la unica
  validacion posible sin conector.
- `ultimaSincronizacion` no se toca aqui; solo la escribe una sincronizacion real,
  que no existe todavia.
- `motor`: requiere tabla nueva en ADS, por lo mismo que 3.1.

**Criterio de aceptacion**

1. Normal: declarar `Conectado` con configuracion devuelve 200 y el `GET` de 3.1
   lo muestra con su motivo en la bitacora.
2. Vacio: `configuracion: {}` con estado `Desconectado` es valido y devuelve 200.
3. Invalido: `Conectado` sin configuracion, 422; `estado` distinto de los tres
   valores, 422; `modulo` inexistente en la compania, 404.

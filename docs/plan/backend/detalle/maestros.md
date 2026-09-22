# Detalle: maestros (bloque B1, B1b y B2)

Siete rutas nuevas. Cierran H14 (directorio de terceros), la parte de terceros de
H3 y los tres botones deshabilitados de Centros, Comprobantes y Tipos de
documento. Las tablas de las siete existen: no hay DDL nuevo en este archivo.

Orden interno: primero terceros (B1), porque `POST /api/terceros/importar` usa el
mismo contrato de escritura; despues los tres catalogos compartidos (B2).

---

## B1. Terceros

### B1.1 `PUT /api/terceros/{nit}`

**Proposito.** Modificar los datos del tercero del NIT indicado.

**Request**

- `nit` (path, obligatorio): `pattern=r"^[0-9]{1,10}$"`, igual que
  `ThirdPartyCreate.nit` (`backend/app.py:101`).
- `cia` (query): `pattern=r"^[0-9]{1,3}$"`. Obligatoria en PostgreSQL, porque el
  tercero es por compania; en ADS el maestro es global y se ignora, como ya hace
  el alta (`backend/app.py:339-349`).
- Cuerpo `ThirdPartyWrite`: los mismos campos de `ThirdPartyCreate` menos `nit`
  (que es la clave y no se modifica): `digito`, `tipoDocumento`, `nombre`,
  `nombreComercial`, `primerNombre`, `segundoNombre`, `primerApellido`,
  `segundoApellido`, `direccion`, `codigoCiudad`, `ciudad`, `telefono`, `correo`,
  `zona`, `cupo`, mas `estado` (`Activo` o `Bloqueado`) y `motivoBloqueo`.
  `model_config = ConfigDict(extra="forbid")`.

**Response (200)**

```json
{
  "item": {
    "nit": "900123456",
    "digito": "7",
    "nombre": "PRUEBA COMERCIAL S.A.S.",
    "tipoDocumento": "31",
    "ciudad": "Medellin",
    "correo": "info@example.com",
    "zona": "01",
    "estado": "Activo",
    "cupo": 5000.0,
    "saldo": 0.0
  },
  "source": "FADCLI",
  "sharedAcrossCompanies": true
}
```

**Consume.** Terceros, botones "Guardar" y "Guardar cambios" de los modales del
directorio (`Interface_web/src/pages/Terceros.tsx:184-203`), hoy sobre `useState`;
y `api/terceros.ts`, que hoy solo tiene `GET` (`44`) y `POST` (`76`).

**Reglas**

- Permisos: escritura de maestro, sujeta al control de acceso efectivo de D5
  cuando exista; mientras tanto el actor viaja en `usuario` de la consulta.
- El NIT es inmutable: viene en la ruta y no en el cuerpo (`extra="forbid"`
  devuelve 422 si se envia).
- Se aplica la regla de H18 en el backend: para `tipoDocumento` `"13"` se exigen
  primer nombre, primer apellido y segundo apellido; el correo, si viene, debe
  tener un solo `@` y un punto despues.
- Estado: `Bloqueado` exige `motivoBloqueo` no vacio. Es la via para un tercero
  que no se puede retirar (ver B1.2).
- Auditoria: en PostgreSQL el disparador `trg_terceros_auditoria`
  (`db/postgresql/schema/03_maestros.sql:298-299`) deja `actualizado_en` y
  `version`; en ADS el repositorio registra en `VISAUDI`
  (`backend/auditoria_repository.py`).
- Doble motor: la rama de PostgreSQL comprueba la compania; la de ADS escribe en
  `FADCLI` con los nombres fisicos del legado (`CNOMBRE`, `CCIUDAD`, `CTELEF`,
  `CEMAIL`, `CZONA`, `CCUPO`, ver `backend/terceros_repository.py:120-121`).

**Criterio de aceptacion**

1. Normal: `PUT` con ciudad y telefono nuevos devuelve 200 y, tras recargar el
   directorio (que si lee del backend, `Terceros.tsx`), la fila muestra los datos
   nuevos.
2. Vacio: cuerpo `{}` devuelve 422 por `nombre` obligatorio (`min_length=1`).
3. Invalido: NIT inexistente devuelve 404; `cupo` negativo o `tarifa` fuera de
   rango devuelve 422; `estado: "Bloqueado"` sin motivo devuelve 422.

### B1.2 `DELETE /api/terceros/{nit}`

**Proposito.** Retirar el tercero del directorio cuando no tiene historia
contable.

**Request**

- `nit` (path): `pattern=r"^[0-9]{1,10}$"`.
- `cia` (query): igual que en B1.1.
- `motivo` (query, obligatorio): entre 5 y 180 caracteres, siguiendo el patron de
  la anulacion de documento (`backend/app.py:161-173`).
- `dryRun` (query, opcional, por defecto `false`): informa que bloquearia la baja
  sin ejecutarla, siguiendo el patron de `backend/app.py:703`.

**Response (200)**

```json
{
  "item": { "nit": "900123456", "eliminado": true, "movimientos": 0, "saldo": 0.0 },
  "source": "FADCLI"
}
```

**Consume.** Terceros, boton "Eliminar" del modal (`Terceros.tsx:214-220`), hoy
`setTerceros(prev => prev.filter(...))` con aviso "Tercero X eliminado".

**Reglas**

- Baja logica: en PostgreSQL marca `terceros.eliminado_en`
  (`db/postgresql/schema/03_maestros.sql:75`). No hay `DELETE` fisico.
- Se rechaza con 409 si el NIT tiene partidas en `documento_lineas` o
  `lote_lineas` (o `MOV01`/`CONLOTES` en ADS) o si `saldo` es distinto de cero.
  El camino en ese caso es bloquear con B1.1, no borrar, porque el libro no puede
  perder la referencia.
- Diferencia de alcance declarada (R10): en PostgreSQL el tercero es por
  compania; en ADS `FADCLI` es comun a todas. Una baja en ADS afecta al
  directorio de todas las companias, asi que la rama de ADS exige ademas que el
  tercero no tenga movimiento en ninguna contabilidad y lo advierte en
  `sharedAcrossCompanies`.
- Auditoria: el motivo queda en `auditoria` (PostgreSQL,
  `db/postgresql/schema/08_seguridad.sql:56`) y en `VISAUDI` (ADS,
  `backend/auditoria_repository.py:74`).

**Criterio de aceptacion**

1. Normal: tercero sin movimiento ni saldo devuelve 200, desaparece del
   directorio y queda una fila en `auditoria` con el motivo.
2. Vacio: `dryRun=true` devuelve 200 con `eliminado: false` o `movimientos: n`, y
   la fila sigue visible.
3. Invalido: tercero con saldo distinto de cero devuelve 409 con el conteo de
   movimientos; sin `motivo` devuelve 422.

### B1.3 `PUT /api/terceros/{nit}/cupo`

**Proposito.** Fijar el cupo de cartera del tercero.

**Request**

- `nit` (path): `pattern=r"^[0-9]{1,10}$"`.
- `cia` (query): igual que B1.1.
- Cuerpo `ThirdPartyCreditLimit`: `cupo` (`Decimal`, `ge=0`, `decimal_places=2`,
  el mismo tipo de `ThirdPartyCreate.cupo`, `backend/app.py:116`) y `motivo`
  (opcional, hasta 180 caracteres).

**Response (200)**

```json
{ "item": { "nit": "900123456", "cupo": 8000.0, "saldo": 0.0 }, "source": "FADCLI" }
```

**Consume.** Terceros: "Cupos" en la cabecera (`Terceros.tsx:298`, deshabilitado)
y "Guardar cupos" en la ventana (`855`, hoy solo estado local).

**Reglas**

- El campo ya existe en los dos motores: `terceros.cupo`
  (`db/postgresql/schema/03_maestros.sql:70`) y `FADCLI.CCUPO`, que ya leen los
  dos repositorios (`backend/terceros_repository.py:120-121`,
  `backend/postgres_repository.py:365-372`) y ya escribe el alta
  (`backend/postgres_writes.py:150-155`).
- Es una ruta propia y no el `PUT` completo porque la ventana de cupos es
  masiva: cambia el cupo de varios terceros sin tocar el resto de la ficha. El
  cuerpo admite un NIT por llamada; la interfaz encadena las que el usuario
  confirmo y muestra el resumen, no una por una.
- El cupo no se puede reducir por debajo del saldo: si `cupo < saldo`, 409 con el
  saldo en el detalle. Es la regla de credito que la pantalla ya insinua al
  mostrar saldo y cupo juntos.
- Auditoria: en PostgreSQL el disparador de fila deja `version`; el motivo va a
  `auditoria`.

**Criterio de aceptacion**

1. Normal: `cupo` de 8000 con saldo 0 devuelve 200 y la columna de cupo del
   directorio cambia tras recargar.
2. Vacio: `cupo` de 0 es valido (retira el cupo de credito) y devuelve 200.
3. Invalido: `cupo` negativo, o `cupo` menor que el saldo, devuelve 422 y 409
   respectivamente; NIT inexistente devuelve 404.

### B1.4 `POST /api/terceros/importar`

**Proposito.** Dar de alta varios terceros desde un archivo, con el mapeo de
columnas confirmado antes de escribir.

**Request**

- `cia` (query): como en B1.1.
- Cuerpo `ThirdPartyImportRequest`: `archivo` (nombre del archivo ya leido),
  `hoja` (opcional), `mapeo` (`dict[str, str]`: columna del archivo contra campo
  del contrato de escritura) y `filas` (`list[ThirdPartyWrite]`, `min_length=1`,
  `max_length=5000`), siguiendo la forma de `ImportLotRequest`
  (`backend/app.py:214-223`).
- `dryRun` (query): valida y devuelve el informe sin escribir.

**Response (201, o 200 con `dryRun`)**

```json
{
  "item": { "creados": 41, "rechazados": 4, "errores": [{ "fila": 7, "detalle": "NIT duplicado 900123456" }] },
  "source": "FADCLI"
}
```

**Consume.** Terceros: "Importar" (`Terceros.tsx:296`, deshabilitado) y el modal
de importacion (`235-245`), hoy con aviso de exito sobre `useState`.

**Reglas**

- Reutiliza el lector de archivos que ya existe (`POST /api/importaciones/leer`,
  `backend/app.py:740`, con `read_import_file` en
  `backend/importaciones_repository.py`): la interfaz lee el archivo, muestra las
  columnas, el usuario confirma el mapeo y este endpoint recibe las filas ya
  normalizadas mas el mapeo usado, para dejarlo en la bitacora.
- Cada fila pasa por `normalize_third_party`
  (`backend/terceros_repository.py:181`) y por la regla de H18; la fila que falla
  no detiene el lote, se rechaza con su causa y su numero de fila.
- Idempotencia: el NIT repetido dentro del archivo o ya existente se rechaza con
  causa, no se actualiza. La importacion no hace `upsert` silencioso.
- Todo en una transaccion: si `dryRun` es falso y ninguna fila es valida, no se
  escribe nada.
- Auditoria: una fila en `auditoria` con el conteo, el archivo y el mapeo.

**Criterio de aceptacion**

1. Normal: archivo de 45 filas con 4 NIT invalidos devuelve 201 con
   `creados: 41` y `rechazados: 4` con la causa por fila.
2. Vacio: lista de filas vacia devuelve 422 (`min_length=1`).
3. Invalido: mismo archivo con `dryRun=true` devuelve 200, el informe identico y
   el directorio sin cambios; sin `mapeo` completo devuelve 422.

---

## B2. Catalogos compartidos

Los tres tienen la misma forma y comparten reglas: el `GET` ya existe, la tabla
ya existe y la contraparte legada esta nombrada. La unicidad es por compania y
codigo en los tres (`comprobantes_codigo_uk`, `centros_costos_codigo_uk`,
`tipos_documento_codigo_uk`, `db/postgresql/schema/03_maestros.sql:135`, `113`,
`172`).

### B2.1 `POST /api/centros`

**Proposito.** Crear un centro de costo de la compania activa.

**Request**

- `cia` (query, obligatorio): `pattern=r"^[0-9]{1,3}$"`.
- Cuerpo `CostCenterCreate`: `codigo` (`min_length=1`, `max_length=7`, el ancho
  de `CONCECOS.CODIGO`), `nombre` (`1..40`), `centroPadre` (opcional, codigo
  existente; el arbol ya esta modelado, `centros_costos.parent_id`), y los campos
  de parametrizacion que la pantalla ya declara (`CentroJerarquico`, ver
  `db/postgresql/schema/13_campos_contrato.sql:58-67`): `hist`, `tipo`, `valor`,
  `porcentaje`, `codigoItem`, `cuenta` y `concepto`.

**Response (201)**

```json
{ "item": { "codigo": "COM", "nombre": "Comercial", "centroPadre": "ADM" }, "source": "CONCECOS" }
```

**Consume.** Centros, boton "+ Crear centro" (`Centros.tsx:116`, deshabilitado
con la nota "se habilitara despues de validar las reglas de escritura").

**Reglas**

- Unicidad `(compania_id, codigo)`: duplicado devuelve 409, no 500.
- El centro padre debe existir en la misma compania; si no, 422. La jerarquia no
  puede tener ciclos: se comprueba subiendo por `parent_id`.
- Si se informa `cuenta`, debe existir en el plan de la compania (FK compuesta
  `centros_costos_cuenta_fk`, `13_campos_contrato.sql:76-78`); si no, 422.
- Auditoria: disparador `trg_centros_auditoria`
  (`db/postgresql/schema/03_maestros.sql`).
- Doble motor: ADS escribe en `CONCECOS` con `CIA` como parte de la clave, igual
  que la lectura actual (`backend/centros_repository.py`, que ya usa
  `GET /api/centros`, `app.py:352`).

**Criterio de aceptacion**

1. Normal: codigo nuevo devuelve 201 y el centro aparece en `GET /api/centros`
   del mismo `cia`.
2. Vacio: `codigo` o `nombre` vacios devuelven 422.
3. Invalido: codigo repetido devuelve 409; `centroPadre` inexistente devuelve
   422; `cia` de otra compania no ve el centro creado.

### B2.2 `POST /api/comprobantes`

**Proposito.** Crear un comprobante de la compania activa.

**Request**

- `cia` (query, obligatorio).
- Cuerpo `VoucherCreate`: `codigo` (`1..2`, el ancho de `CONTICOM`),
  `nombre` (`1..40`) y `descripcionAuxiliar` (`max_length=40`, el campo que el
  cliente ya consume, `db/postgresql/schema/13_campos_contrato.sql:51-52`).

**Response (201)**

```json
{ "item": { "codigo": "CE", "nombre": "Comprobante de egreso", "descripcionAuxiliar": "Egresos" }, "source": "CONTICOM" }
```

**Consume.** Comprobantes, boton "+ Crear comprobante" (`Comprobantes.tsx:79`,
deshabilitado).

**Reglas**

- Unicidad `(compania_id, codigo)`; duplicado, 409.
- No se crea comprobante con consecutivo: el consecutivo vive en
  `consecutivos_comprobantes` por compania, ano y comprobante
  (`db/postgresql/schema/03_maestros.sql:140-149`), y lo inicializa la primera
  contabilizacion. Declararlo aqui seria inventar un estado que el legado no
  tiene (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`: CONTICOM "validar significado de
  consecutivo actual/proximo").
- Auditoria: en PostgreSQL, `auditoria_antes_insert`
  (`db/postgresql/schema/01_dominios.sql:42-52`).

**Criterio de aceptacion**

1. Normal: codigo nuevo devuelve 201 y aparece en `GET /api/comprobantes`.
2. Vacio: `codigo` vacio devuelve 422.
3. Invalido: codigo de mas de 2 caracteres devuelve 422; codigo repetido, 409.

### B2.3 `POST /api/tipos-documento`

**Proposito.** Crear un tipo de documento de la compania activa.

**Request**

- `cia` (query, obligatorio).
- Cuerpo `DocumentTypeCreate`: `codigo` (`1..2`), `nombre` (`1..40`),
  `numeracion` (`Literal["Manual", "Automatica"]`, por defecto `Manual`),
  `terceroObligatorio` y `centroObligatorio` (booleanos, por defecto `false`)
  segun la tabla (`db/postgresql/schema/03_maestros.sql:154-175`), mas los
  atributos que el contrato de campos ya modelo (`13_campos_contrato.sql:39-46`):
  `modulo`, `naturaleza`, `prefijo`, `comprobante` (codigo existente),
  `generaContabilizacion`, `permiteConversion` y `conversionCodigo`.

**Response (201)**

```json
{ "item": { "codigo": "NC", "nombre": "Nota credito", "numeracion": "Manual", "comprobante": "CE" }, "source": "VISDOCUM" }
```

**Consume.** TiposDocumento, boton "+ Crear tipo" (`TiposDocumento.tsx:104`,
deshabilitado).

**Reglas**

- Unicidad `(compania_id, codigo)`; duplicado, 409.
- `comprobante`, si viene, debe existir: la tabla declara la FK compuesta
  (`tipos_documento_comprobante_fk`, `13_campos_contrato.sql:72-74`); si no
  existe, 422.
- `numeracion` es la unica llave de estado que afecta a la contabilizacion: un
  tipo `Automatica` obliga al backend a consumir el consecutivo del comprobante
  (`consecutivos_comprobantes`). Cambiar de `Manual` a `Automatica` con
  documentos ya contabilizados de ese tipo devuelve 409.
- Doble motor: ADS escribe en `VISDOCUM` y `CONTIDOC`; el modelo conserva el tipo
  documental separado del comprobante, que es la brecha declarada para
  `VISDOCUM` en `db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`.

**Criterio de aceptacion**

1. Normal: tipo nuevo con `comprobante` existente devuelve 201 y aparece en
   `GET /api/tipos-documento` (que es global, sin `cia`, `app.py:369`).
2. Vacio: sin `codigo` ni `nombre` devuelve 422.
3. Invalido: `comprobante` inexistente devuelve 422; `numeracion` distinta de
   `Manual` o `Automatica` devuelve 422; codigo repetido, 409.

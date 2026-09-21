# 12 · Escrituras contra PostgreSQL (etapa D)

Cómo se implementan las operaciones que **escriben** en el modelo nuevo, con qué
reglas y qué decisiones se tomaron. Cierra la etapa D de
[`08_plan_para_culminar.md`](08_plan_para_culminar.md).

## 1. Qué quedó migrado

| Endpoint | Operación | Apoyo |
|---|---|---|
| `POST /api/terceros` | crear tercero | `terceros` |
| `POST /api/cuentas`, `PUT /api/cuentas/{codigo}` | crear / modificar cuenta | `cuentas` |
| `PUT /api/parametros-operacion` | grabar parámetros | `parametros_operacion` |
| `POST /api/documentos/anular` | anular documento | `anular_documento` + `regenerar_acumulados` |
| `POST/PUT/DELETE /api/lotes…` | lote y partidas | `lotes`, `lote_lineas` |
| `POST /api/lotes/{l}/verificar` | verificar | `validar_lote` |
| `POST /api/lotes/{l}/actualizar` | contabilizar | `contabilizar_lote` |
| `POST /api/importaciones/lote` | importar lote | `lotes`, `lote_lineas` |
| `POST /api/movimientos/contabilizar` | captura directa | `documentos`, `documento_lineas`, saldos |
| `POST /api/reprocesos/mensual/simular` | comparar libro↔acumulados | lectura |
| `POST /api/reprocesos/mensual/ejecutar` | (bloqueado, ver §5) | — |

La implementación vive en `backend/postgres_writes.py`; `store.py` despacha y
`app.py` no cambia de contrato.

## 2. Principio: las reglas están en la base, no en Python

Las reglas de negocio de lotes y anulación **ya existían** como funciones del
esquema (`db/postgresql/funciones.sql`): `validar_lote`, `contabilizar_lote`,
`anular_documento`, `regenerar_acumulados`. La capa de escritura sólo traduce el
payload de la web a filas del modelo nuevo y las invoca.

**El candado `accounting_lock.py` desaparece.** En el legado existía porque dos
operaciones recalculaban los mismos acumulados en el proceso; en PostgreSQL cada
operación corre dentro de **una sola transacción** y las funciones toman la fila
con `FOR UPDATE` (lote, documento, consecutivo). Dos operaciones concurrentes se
serializan en la base, no en el proceso.

## 3. Decisiones

### 3.1 `documentos.fecha` es la fecha del documento (corrección de `funciones.sql`)

`contabilizar_lote` ponía en `documentos.fecha` la fecha **de captura** del lote
(`lotes.fecha`). El problema: `/api/documentos` filtra el período por
`documentos.fecha`, y la migración cargó ahí la fecha real (`CONDOCUM.DFECHA`).
Un documento nuevo no aparecía en el mes correcto.

**Corregido**: `documentos.fecha = fecha del movimiento del grupo`. `lotes.fecha`
sigue siendo la de captura. La `validate.sql` del esquema sigue en verde.

### 3.2 Los períodos se abren si faltan

`periodos_contables` sólo tenía los períodos que traían movimientos (el cargador
los creó desde `MOVxx`), y `lotes` tiene FK a esa tabla. El legado no tenía tal
tabla: habilitaba meses con `CONCTR.CTxx`. Para poder operar un período nuevo, la
capa de escritura **crea la fila** (`Abierto`) si falta (`_asegurar_periodo`).

### 3.3 Terceros: el maestro global pasó a ser por compañía

`FADCLI` era un directorio **global**; `terceros.compania_id` es `NOT NULL`. La
ruta web no envía compañía. Se añadió un parámetro **opcional** `cia` a
`POST /api/terceros`: si llega, se usa; si no, se resuelve cuando hay **una sola**
compañía activa y, si hay más, se exige explícitamente. React no necesita cambios
mientras el despliegue tenga una sola compañía.

### 3.4 Usuarios: iniciales del legado → `usuarios.id`

El legado guardaba iniciales en texto libre; el modelo nuevo normaliza
(`lotes.usuario_id`, `documentos.usuario_id`). `_usuario_id` busca por iniciales,
cae al primer usuario activo y, si no hay ninguno, crea uno con el primer rol.

### 3.5 Lotes: lo que el destino no conserva

`lotes` no tiene `HIST`, `BORRAR` ni `ARCHOK` (fueron a `migracion_filas`). En
consecuencia:

- **`delete_lot`**: no hay lote "protegido"; `force` se acepta pero no cambia
  nada. El destino no conserva `BORRAR`.
- **Editar** una partida o la cabecera devuelve el lote a `Borrador`, como hacía
  `_refresh_lot_totals` en el legado (cualquier edición invalida la verificación).
- **`post_lot`**: el flujo web va de Verificado a contabilizado; `contabilizar_lote`
  exige el estado `Aprobado` explícito, así que la capa lo promueve, y **conserva**
  el lote (el legado borraba `CONMOVI`/`CONLOTES`). Conservarlo es la razón de ser
  de la FK `documentos.lote_id`.
- Los **mensajes** de validación son los de `lote_validaciones` (los de la base),
  no los del Harbour; conservan categoría y significado.

### 3.6 Anulación: reversión, no borrado

El legado **borraba** cabecera y partidas. El modelo nuevo conserva el original
(`Anulado`) y crea el documento de reversión enlazado
(`documento_original_id`), con el efecto neto cero en los saldos. Es lo que
permite que la pista de auditoría no se pierda.

### 3.7 Captura directa: consecutivo del modelo nuevo

`POST /api/movimientos/contabilizar` numera con `consecutivos_comprobantes`
(el mismo que usa `contabilizar_lote`), **no** con `VISDOCUM.CONSE`. Si el tipo
documental es manual (`tipos_documento.numeracion = 'Manual'`) se exige el número;
si es automático se compone con el prefijo del tipo (o el código del tipo).

### 3.8 Reproceso mensual: la ejecución queda condicionada a la etapa F

En el legado el reproceso **reemplaza** `CONMAE`/`CONTERCE` desde `MOV01`. En el
modelo nuevo, `saldos_cuenta` conserva la **instantánea fiel de `CONMAE`**
(decisión de la etapa C5) y la copia migrada **no tiene el libro completo**
(faltan `MOV02`..`MOV18`, etapa F). Reescribir los acumulados desde un libro
parcial destruiría esa fidelidad.

Por eso:

- `simular` **sí está migrado**: compara el libro contra `saldos_cuenta` y
  `saldos_cuenta_tercero` por período/cuenta/tercero y reporta las diferencias.
- `ejecutar` con `dryRun` devuelve la simulación marcada «Validado sin grabar».
- `ejecutar` de verdad **se rechaza** con un mensaje explícito, hasta que el libro
  esté completo. No se inventan acumulados ni se destruye la instantánea.

### 3.9 `/api/cuentas` (lectura) y dos matices de fidelidad

- El plan (etapa C2) **no había listado** `/api/cuentas`; quedó migrado también,
  **lectura y escritura**, sobre `cuentas` + `saldos_cuenta` y reutilizando
  `_account_from_row`. Devuelve las mismas 4.046 cuentas de la copia y sus 12
  acumulados mensuales. La creación inserta con `nivel`, `parent_id` y `path`
  coherentes con las cuentas migradas (exige que exista el padre del nivel
  anterior) y traduce `tipoFiscal` a `clase_iva`/`clase_retencion`; la
  modificación no toca código, saldos ni acumulados. Con esto **ningún endpoint
  queda pendiente de Advantage**.
- **`import_lot` es más estricto que el legado**: resuelve y valida los maestros
  de cada partida al importar (el legado lo dejaba para la verificación). Es una
  divergencia consciente: preferimos rechazar una importación con cuentas
  inexistentes antes que crear un Borrador que no se podrá verificar. Se puede
  relajar si el flujo de trabajo lo pide.

### 3.10 Correcciones que descubrió el barrido de endpoints

- **`periodos_habilitados` (round-trip roto).** La lectura
  (`PERIODOS_ALIASES`) lee del jsonb las claves **`00`..`12`**, pero la escritura
  guardaba **`CT00`..`CT12`**: grabar los parámetros dejaba los meses ilegibles y
  `/api/periodo-operacion` respondía `422`. Corregido en
  `postgres_writes.update_operation_parameters` (se guarda `{code: bool}`).
  El seed de demostración también usaba `CT00`..`CT12` y no habilitaba ningún
  mes; corregido a `00`..`12` con los meses abiertos.
- **`seed.sql`**: `companias.codigo` era `'001'` y el cliente lo normaliza a
  `'1'`, así que la app no encontraba la compañía; ahora es `'1'`.

## 4. Verificación

**`scripts/validate.sql` sigue en verde** (11 validaciones: multidocumento,
descuadre por documento, idempotencia, anulación, conciliación) con el cambio de
`funciones.sql`.

**Guion E2E por HTTP** (`tmp/e2e_etapa_d.py`, sobre una base de ensayo
`seed.sql`): 32 llamadas, todas con el código esperado.

| Paso | Resultado |
|---|---|
| Crear tercero | `201` |
| Crear cuenta raíz y su hija; modificar la hija; duplicado; padre inexistente | `201`/`201`/`200`/`409`/`422` |
| Grabar parámetros | `200` |
| Lote `NOM2`: verificar (2 errores) → corregir partidas → verificar (`Verificado`) → contabilizar | `200` |
| Lote nuevo: crear, 2 partidas, verificar, contabilizar | `201`/`201`/`200`/`200` |
| Anular el documento del lote nuevo | `200` (reversión creada) |
| Borrar un lote ya contabilizado | `422` (rechazado) |
| Captura directa | `200` (aparece en `/api/documentos` del mes) |
| Reproceso: simular / ejecutar sin motivo / ejecutar con motivo | `200` / `422` / `422` |

Tras todas las escrituras, **el libro y los saldos coinciden por cuenta**
(consulta de conciliación: 0 cuentas descuadradas). Los 79 tests de
`backend/tests/` siguen en verde.

**Barrido de endpoints** (`tmp/smoke_endpoints.py`), que ejercita **todas** las
rutas y cubre lo que el guion anterior no tocaba (movimiento mensual, detalle de
documento, importaciones, alta/modificación de lote, borrado de partida y lote):

- Base de ensayo, con escrituras y *round-trip* de parámetros: **53/53** con el
  código esperado y 0 con `5xx`.
- Base migrada, sólo lectura y casos negativos: **22/22**.

## 5. Pendiente

- **Equivalencia motor a motor** (etapa E): comparar cada operación contra
  Advantage queda para cuando se monte el motor (aplazado por decisión del
  usuario).
- **Reproceso real** (etapa F): se habilita cuando el libro esté completo.
- **Textos de error**: se conserva el **tipo** de error (que fija el código HTTP)
  y el significado; la redacción exacta puede diferir del legado en algún mensaje.

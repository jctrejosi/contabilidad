# 11 · Lotes e importaciones (etapa C6)

Cómo se resuelve el flujo de lotes contra PostgreSQL. Cierra el punto C6 de
[`08_plan_para_culminar.md`](08_plan_para_culminar.md) **en su parte de lectura**;
la escritura es la etapa D.

## 1. Alcance y decisión

Los cuatro endpoints del flujo:

| Endpoint | Tipo | Motor nuevo |
|---|---|---|
| `GET /api/lotes` | lectura de `CONMOVI` | **migrado** → `lotes` |
| `GET /api/lotes/detalle` | lectura de `CONLOTES` | **migrado** → `lote_lineas` |
| `POST /api/importaciones/leer` | lee un archivo subido | **no aplica** (ver §4) |
| `POST/PUT/DELETE /api/lotes…`, `/verificar`, `/actualizar`, `/importaciones/lote` | escritura | etapa **D** |

**Decisión.** Se migra la lectura aunque las tablas estén vacías en la copia: cuesta
poco, mantiene la pantalla de Lotes en pie con `CONTABDSI_STORE=postgres` (sin un
`500`) y deja probado el mapeo `CONMOVI`/`CONLOTES` → `lotes`/`lote_lineas` que la
etapa D necesitará.

## 2. Las tablas están vacías en la copia (con evidencia)

- El extractor generó **15 CSV** y ni `CONMOVI` ni `CONLOTES` están entre ellos
  (`db/migration/staging/manifiesto.json`): no traían filas y no se exportaron.
- En `contabdsi_datos`: `lotes` = 0, `lote_lineas` = 0, `lote_validaciones` = 0.

Consecuencia: la implementación queda **estructuralmente verificada** (contrato,
tipos, orden, paginación, errores) pero **sin filas para comparar** contra el
origen. La conciliación con datos reales sólo será posible cuando la etapa D cree
lotes nuevos.

## 3. Mapeo (ya fijado por el contrato)

`homologacion/contrato_campos.json` ya resolvió campo a campo; la lectura lo respeta:

| `CONMOVI` | `lotes` |
|---|---|
| `LOTE` | `codigo` |
| `NOMBRE` | `nombre` |
| `MES` | `periodo` |
| `ESTADO` | `estado` (código de 1 carácter → estado del destino) |
| `USUA_I` / `USUA_F` | `creado_por` / `actualizado_por` (→ `usuarios.iniciales`) |
| `FECHA` | `fecha` |
| `HORA` | `creado_en` (hora del timestamp) |
| `DEBITOS`/`CREDITOS`/`ITEMS` | **derivado**: se recalculan de `lote_lineas` |
| `HIST`/`BORRAR`/`ARCHOK` | `migracion_filas` (sin columna en el destino) |
| `ID` | localizador en `migracion_filas` |

Para `CONLOTES` → `lote_lineas` el contrato hace lo mismo: `CUENTA`→`cuenta_id`,
`NIT`→`tercero_id`, `TFASE`→`centro_costo_id`, `TIPODOC`→`tipo_documento_id`,
`TFECHA`→`fecha`, `TCOMPR`→`comprobante` (texto), `TINCON` **descartado**.

### Lo que el destino no puede devolver igual

| Campo del contrato | En PostgreSQL | Por qué |
|---|---|---|
| `historico` (`HIST`) | `""` | no hay columna; iba a `migracion_filas` |
| `permiteBorrar` (`BORRAR`) | `""` | no hay columna; iba a `migracion_filas` |
| `archivoOk` (`ARCHOK`) | `""` | no hay columna; iba a `migracion_filas` |
| `estadoCodigo` | código del legado deducido de `lotes.estado` | el destino guarda el estado ya normalizado |
| `inconsistencia` (`TINCON`) | `""` | descartado por contrato (vacío en toda la copia) |

La **equivalencia de estado** se declara explícitamente
(`postgres_repository._LOT_STATE_CODES`): `Borrador`→`B`, `Con errores`→`E`,
`Verificado`→`V`, `Pendiente aprobacion`→`P`, `Contabilizado`→`C`, `Anulado`→`N`.
Los estados que el legado **no tenía** —`Aprobado`, `Contabilizando`, `Fallido`—
no tienen código de un carácter: se devuelven tal cual en `estadoCodigo` y `estado`
en vez de inventarles uno. El `estado` presentado reutiliza el mismo
`_state_label` del repositorio de Advantage.

## 4. `POST /api/importaciones/leer` no requiere cambio

`importaciones_repository.read_import_file` **no toca la base**: interpreta XLSX,
CSV o TXT en memoria y devuelve columnas y filas neutras. El mapeo contable y la
escritura ocurren después, en `lotes_repository` (etapa D). La única ruta que usa
motor es la de archivos `.ADT`, que abre Advantage por ODBC; eso es intrínseco a
ese formato de origen y no forma parte del modelo nuevo.

## 5. Verificación

Con `CONTABDSI_STORE=postgres` (`uvicorn` + `curl`):

| Petición | Resultado |
|---|---|
| `GET /api/lotes?cia=27` | `200` `{"items":[],"hasMore":false,…}` |
| `GET /api/lotes/detalle?cia=27&lote=AB01` | `200` `{"items":[],"pageDebit":0,"pageCredit":0,…}` |
| `GET /api/lotes/detalle?cia=27&lote=%20%20` | `422` «El código del lote no es válido.» |
| `GET /api/lotes?cia=99` | `404` «No existe la compañía 99.» |

Los 79 tests de `backend/tests/` siguen en verde.

## 6. Pendiente (etapa D)

Escrituras de lotes: crear, modificar, eliminar, verificar, actualizar
(contabilizar) e importar. Dependen de las funciones del esquema
(`contabilizar_lote`, `anular_documento`) y de sustituir `accounting_lock.py` por
transacción + `FOR UPDATE`. Ahí sí habrá filas para conciliar contra el origen.

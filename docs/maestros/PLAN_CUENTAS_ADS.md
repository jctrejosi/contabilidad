# Plan de cuentas conectado a Advantage Data Server

## 1. Objetivo funcional

El Plan de cuentas administra el catálogo que determina dónde se clasifican
los movimientos de la contabilidad. Cada cuenta define, además de su nombre y
posición jerárquica, qué información debe solicitar el sistema al registrar un
comprobante: tercero, centro de costo o base de IVA/retención.

Esta primera integración mantiene Advantage Data Server como fuente real. No
es todavía la migración a PostgreSQL; es una capa compatible que permite usar
la nueva interfaz sin cambiar el almacenamiento actual.

## 2. Componentes involucrados

| Componente | Responsabilidad |
|---|---|
| `Interface_web/src/pages/SeleccionCompania.tsx` | Solicita la compañía al ingresar y conserva su código como contexto obligatorio de la sesión. |
| `Interface_web/src/pages/PlanCuentas.tsx` | Presenta, filtra y pagina el catálogo; abre los formularios de creación y edición. |
| `Interface_web/src/api/companias.ts` | Consulta las compañías disponibles en `CONEMP`. |
| `Interface_web/src/api/cuentas.ts` | Define el contrato TypeScript y realiza las solicitudes HTTP. |
| `backend/app.py` | Expone los endpoints FastAPI, valida el JSON y traduce errores a respuestas HTTP. |
| `backend/ads_repository.py` | Abre ADO, ejecuta SQL, maneja transacciones y traduce CONMAE al modelo web. |
| `backend/.env` | Configuración local privada de ADS. Nunca debe agregarse a Git. |
| `CONEMP` | Tabla heredada de compañías; `EMPCOD` determina el valor que se compara con `CONMAE.CIA`. |
| `CONMAE` | Tabla heredada que contiene cuentas maestras, auxiliares por tercero, saldos y acumulados. |

## 3. Flujo de datos

```text
Usuario
  → SeleccionCompania.tsx
  → /api/companias → CONEMP
  → selecciona EMPCOD (por ejemplo 027)
  → PlanCuentas.tsx
  → /api/cuentas?cia=027
  → FastAPI (app.py)
  → repositorio ADO (ads_repository.py)
  → Advantage OLE DB
  → CONMAE, limitado por CIA = 27
```

En sentido de regreso, el repositorio transforma los nombres y formatos
heredados a un JSON estable. React nunca conoce credenciales, SQL ni objetos
COM/ADODB.

## 4. Reglas para identificar el catálogo correcto

Una cuenta se identifica dentro de una compañía. El código visible se obtiene
de `CONEMP.EMPCOD`, se presenta con tres posiciones (por ejemplo `027`) y se
compara numéricamente con `CONMAE.CIA` (`27`). La condición `CIA` es obligatoria
en listados, búsqueda de duplicados, validación del padre, creación y edición.

La consulta base es conceptualmente:

```sql
FROM CONMAE
WHERE CIA = :compania_seleccionada
  AND NIT = '           '
```

`CONMAE` no almacena solamente el catálogo. También puede contener filas
auxiliares asociadas a terceros. El proyecto original identifica el catálogo
con la condición:

```text
NIT = SPACE(11)
```

En SQL corresponde a `NIT = '           '` (11 espacios). Todas las consultas,
validaciones, inserciones y modificaciones de esta función conservan esa regla.
Omitirla podría actualizar un auxiliar en lugar de la cuenta maestra.

## 5. Mapeo de campos

| Campo CONMAE | Propiedad web | Significado contable | Uso |
|---|---|---|---|
| `CIA` | Contexto de sesión | Código de la compañía propietaria del catálogo. | Condición obligatoria al consultar, crear y modificar. |
| `CODIGO` | `codigo` | Código jerárquico de la cuenta. | Crear y consultar; inmutable después del alta. |
| `MNOMBRE` | `nombre` | Nombre que identifica la cuenta en comprobantes e informes. | Crear y modificar. |
| `NIT` | No se muestra | Distingue la fila maestra de auxiliares por tercero. | Siempre 11 espacios en esta función. |
| `MTC` | `afectable` | Indica si la cuenta puede recibir movimientos. | Crear y modificar. |
| `MCTAPAGOS` | `requiereTercero` | Obliga a identificar el tercero en la captura contable. | Crear y modificar. |
| `MCOSTOS` | `requiereCentro` | Obliga a informar un centro de costo. | Crear y modificar. |
| `MAJUSTE` | `ajuste` | Identifica cuentas que participan en ajustes por inflación. | Crear y modificar. |
| `MIVA_RET` | `tipoFiscal` | `O`: otra; `I`: IVA; `R`: retención. | Crear y modificar. |
| `MSALDO` | `saldoInicial` | Saldo anterior al movimiento del año consultado. | Solo lectura. |
| `MACMDEB01`…`12` | `movimientos[].debito` | Débitos acumulados por mes. | Solo lectura. |
| `MACMCRE01`…`12` | `movimientos[].credito` | Créditos acumulados por mes; ADS los guarda negativos. | Solo lectura; la API entrega su valor absoluto. |

`requiereBase` no es un campo independiente en esta función: se deriva de
`MIVA_RET`. Una cuenta clasificada como IVA o retención requiere base.

Campos de selección provenientes de `CONEMP`:

| Campo CONEMP | Propiedad web | Uso |
|---|---|---|
| `EMPCOD` | `codigo` | Identificador que se envía como `cia`; se muestra con tres posiciones. |
| `EMPNOM` | `nombre` | Nombre visible de la compañía. |
| `EMPNIT` | `nit` | Identificación tributaria mostrada al usuario. |
| `HABILITA` | `habilitada` | Permite destacar y ordenar primero la compañía vigente. No elimina el acceso histórico a las demás. |

## 6. Jerarquía de códigos

Los niveles permitidos, heredados de `PLANMAES.PRG`, son:

| Longitud | Ejemplo | Padre esperado |
|---:|---|---|
| 1 | `1` | Sin padre |
| 2 | `11` | `1` |
| 4 | `1105` | `11` |
| 6 | `110505` | `1105` |
| 9 | `110505001` | `110505` |
| 12 | `110505001001` | `110505001` |

Al crear, el backend rechaza códigos duplicados, longitudes diferentes y
cuentas cuyo padre todavía no exista. En edición, el código y el nivel están
bloqueados porque cambiarlos alteraría la estructura y las referencias de los
movimientos históricos.

## 7. Operaciones HTTP

### `GET /api/health`

Abre ADO y ejecuta una lectura mínima sobre `CONMAE`. Sirve para diferenciar un
problema de conexión de un problema de interfaz.

### `GET /api/companias`

Devuelve las compañías registradas en `CONEMP`, con la vigente en primer lugar.

### `GET /api/cuentas?cia=027`

Devuelve las cuentas maestras de la compañía seleccionada, ordenadas por
código, incluyendo saldo inicial y acumulados de enero a diciembre.

### `POST /api/cuentas?cia=027`

Crea una cuenta. Antes de escribir valida formato, duplicado y cuenta padre.
Las validaciones se hacen dentro de la misma compañía. El registro inicia con
`CIA = 27`, `MSALDO = 0` y `NIT` maestro.

### `PUT /api/cuentas/{codigo}?cia=027`

Modifica solamente la fila que coincida con compañía, código y NIT maestro. No
permite cambiar CIA, código, NIT, saldo ni acumulados mensuales.

## 8. Transacciones y manejo de errores

Las operaciones de escritura siguen este orden:

1. Validación del JSON con Pydantic.
2. Validación de reglas contables en el repositorio.
3. Apertura de la conexión ADO.
4. Inicio de transacción con `BeginTrans`.
5. Ejecución parametrizada de `INSERT` o `UPDATE`.
6. `CommitTrans` si termina correctamente.
7. `RollbackTrans` ante cualquier excepción.

Los valores modificables viajan como parámetros ADODB. El código se incorpora
en consultas puntuales solamente después de validarse como numérico.

Respuestas principales:

| Estado HTTP | Significado |
|---:|---|
| `200` | Consulta o modificación correcta. |
| `201` | Cuenta creada. |
| `404` | No existe la compañía o la cuenta maestra dentro de esa compañía. |
| `409` | El código ya existe. |
| `422` | Datos o jerarquía inválidos. |
| `503` | No fue posible comunicarse con Advantage. |

## 9. Configuración de conexión

El backend no depende de scripts externos. Construye la conexión ADO desde
`backend/.env` o desde variables del proceso:

```text
ADS_PROVIDER=Advantage.OLEDB.1
ADS_DATA_SOURCE=C:\ruta\empresa.add
ADS_USER_ID=usuario
ADS_PASSWORD=clave
ADS_SERVER_TYPE=ADS_REMOTE_SERVER
```

Las variables del sistema tienen precedencia sobre `.env`. También puede
usarse `ADS_CONNECTION_STRING` para proporcionar la cadena completa. La
plantilla pública se encuentra en `backend/.env.example`.

## 10. Comportamiento de la interfaz

- Al abrir o recargar, exige seleccionar una compañía consultada de `CONEMP`.
- Prioriza visualmente la compañía con `HABILITA`, pero exige confirmar el ingreso.
- Mantiene visibles código, nombre y NIT de la compañía seleccionada.
- Permite regresar al selector mediante **Cambiar compañía**.
- Presenta el estado de conexión y la cantidad total de cuentas.
- Pagina de 100 en 100 para no crear miles de filas simultáneamente.
- Permite búsqueda por código o nombre.
- Filtra afectables, cuentas base, IVA y retenciones.
- Abre por defecto la vista de árbol completamente desplegada, con sangría para
  distinguir cuenta, subcuenta y niveles auxiliares.
- Reconstruye la jerarquía a partir de los prefijos de `CODIGO` mediante un
  índice calculado una sola vez. El árbol permanece fijo y expandido: sus ramas
  no se pueden contraer.
- Virtualiza la lista jerárquica: las 4.061 cuentas conservan su orden, altura y
  desplazamiento, pero React solo mantiene en el DOM las filas del área visible
  y un margen de seguridad. La búsqueda sigue incluyendo todo el catálogo.
- Permite exportar el catálogo visible a CSV.
- Muestra saldos y acumulados como información de consulta.
- Advierte antes de cambiar controles de una cuenta que ya tiene historia.
- No ofrece eliminación: todavía no se ha definido ni autorizado su regla
  contable para la nueva aplicación.

## 11. Verificación realizada

- Pruebas unitarias de configuración, validaciones y jerarquía.
- Compilación de producción del frontend.
- Consulta real de 27 compañías y 4.061 cuentas maestras para la CIA 027.
- Confirmación de que una solicitud sin `cia` es rechazada y que la CIA 026 no
  recibe por error las cuentas de la CIA 027.
- Prueba transaccional reversible de `INSERT`, `UPDATE` y `ROLLBACK`.
- Verificación visual de listado, formulario de creación y formulario de edición.

### Rendimiento del listado

La lectura inicial no recorre ADO celda por celda. El repositorio utiliza
`Recordset.GetRows()` para transferir el resultado completo y después construir
los objetos Python en memoria. Además, la capa web comparte solicitudes que
estén en curso para evitar la doble consulta causada por `React.StrictMode` en
desarrollo.

Medición local para 4.061 cuentas de la CIA 027:

| Medición | Antes | Después |
|---|---:|---:|
| API directa | 10,71 s | 0,78–1,04 s |
| API a través del proxy web | 11,87 s | 0,65–0,92 s |
| Clic hasta tabla visible en navegador | Aproximadamente 25 s reportados | 0,50 s |
| Solicitudes a `CONMAE` por apertura | 2 en desarrollo | 1 |

En la vista de árbol virtualizada se comprobaron 4.061 nodos lógicos, una altura
de desplazamiento de 129.952 px y solo 26 filas montadas para una ventana de
448 px. La búsqueda `caja` respondió en 244 ms, encontró 11 cuentas y mostró 32
nodos al incluir sus cuentas superiores.

No se agregó caché persistente: cada apertura posterior vuelve a consultar ADS,
por lo que no se ocultan cambios contables realizados por otros procesos.

Una prueba automática no debe crear registros permanentes en la base de datos
productiva. Las pruebas de escritura deben ejecutarse siempre dentro de una
transacción que finalice con `ROLLBACK`.

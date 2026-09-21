# Extractor del legado (`ADD_CONTAB/`)

Pieza de la **fase 5** del plan de migración («Extractor y staging», ver
[`../03_plan_de_carga.md`](../03_plan_de_carga.md) §3): leer las tablas del
legado directamente de los archivos, sin depender del motor de Advantage, y
dejar un manifiesto reproducible.

> **Corrección de premisa (verificada).** Este documento decía que leer los `.adt`
> era imposible sin el motor. **Es falso para esta copia**: el formato está
> entendido y los datos se leen en texto plano. Ver §3 y
> [`decodificar_adt.py`](decodificar_adt.py). El «no se puede» venía de
> `ecommerce/db/` (§3.2), donde el camino probado fue exportar por ODBC; aquí se
> comprobó que **la extracción no necesita el driver**.

## 1. Lo que ya está verificado

`inspect_adt.py` lee la cabecera de los 48 archivos (solo lectura) y reporta:

```bash
python db/migration/extractor/inspect_adt.py [--json informe_cabeceras.json]
```

| Comprobación | Resultado |
|---|---|
| Archivos analizados | 48 |
| Tablas `.ADT` | **20**, todas con la firma `Advantage Table\0` |
| Índices `.adi` | 20 (uno por tabla; p. ej. `MOV01.adi` = 358 MB) |
| Memo `.adm` / `.am` | 6 (uno por tabla con campos MEMO) |
| Diccionario | `PUBLIDATA.add` (0.98 MB) + `PUBLIDATA.ai` + `PUBLIDATA.am` |
| Fuentes | `MOVICON.prg`, `MOVICONN.prg` |

**Todas las tablas están ligadas a diccionario**: su cabecera referencia
`PUBLIDATA.add`. En la práctica significa que el **mapa de campos no está en el
`.ADT`**, sino en el diccionario (o en el catálogo ya extraído, §2).

## 2. El mapa de campos ya existe (para 15 de las 20 tablas)

`../old_db/DICCIONARIO_DEPURADO_CONTABDSI.md` trae, por tabla, la lista ordenada
de campos con **tipo, longitud y decimales** — exactamente lo que necesita un
decodificador:

```
### C:\VISADS\CONTAB\CONEMP.ADT
6 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | EMPCOD   | CHARACTER |  3 | 0 |
| 2 | EMPNOM   | CHARACTER | 40 | 0 |
| 3 | EMPNIT   | CHARACTER | 12 | 0 |
| 4 | EMPCLAV  | CHARACTER |  5 | 0 |
| 5 | REASIGNA | CHARACTER |  1 | 0 |
| 6 | HABILITA | LOGICAL   |  1 | 0 |
```

De ahí sale el largo de registro (en CONEMP, `3+40+12+5+1+1 = 62`). Las 5 tablas
que **no** tienen catálogo son las que el diccionario no documenta:
`CATALOGO2`, `CONLOTES`, `TIDEAN`, `P_A_100_50`, `P_A_102_50` (para ellas habrá
que leer el `.add`).

> ⚠️ **No dar por hecho que el catálogo coincide con esta copia.** Que la copia
> incluya tablas que el diccionario no conoce sugiere que viene de una versión
> más nueva del legado. Hay que **verificar campo a campo contra la cabecera**
> antes de cargar: es la fase 2 del plan («homologación funcional»), y un
> desfase de anchos desplazaría todos los valores de la fila.

## 3. Método real: leer los archivos (verificado)

### 3.1 El formato, ya entendido

La cabecera del `.adt` guarda lo necesario para leerlo, y el invariante
**cuadra en las 20 tablas**:

| Offset | Campo | Significado |
|---|---|---|
| `0x00` | 16 bytes | firma `Advantage Table\0` |
| `0x18` | uint32 | ranuras de registro |
| `0x20` | uint32 | dónde empieza el área de registros |
| `0x24` | uint32 | largo físico del registro |

```
tamaño_del_archivo == inicio + ranuras * largo
```

Los registros son de longitud fija y van uno tras otro desde `inicio`:
`[5 bytes fijos] [3 bytes: código de contabilidad, sólo en las tablas que lo llevan]
[campos, en el orden y con los anchos del diccionario] [4 bytes]`.

Los campos son **texto plano** con relleno de espacios, y los numéricos son
`double`/entero *little-endian*. `CONEMP` sale así, sin motor ni conversión:

```
EMPCOD=' 27'  EMPNOM='COMERCIALIZADORA MERCALDAS AÑO 2025'
EMPNIT='900273686'  EMPCLAV='2025'  HABILITA=True
```

```bash
python db/migration/extractor/decodificar_adt.py                 # informe de las 20 tablas
python db/migration/extractor/decodificar_adt.py --tabla CONEMP --filas 4
```

### 3.2 El catálogo real: el diccionario `PUBLIDATA.add`

El inventario de [`../old_db/`](../old_db/) **no describe esta copia**: sus
anchos no cuadran con el registro físico (P-7). La verdad está en el propio
diccionario, que también se lee sin motor:

```bash
python db/migration/extractor/leer_diccionario.py --validar   # 17/17 cuadran
python db/migration/extractor/leer_diccionario.py --tabla CONMAE
```

[`leer_diccionario.py`](leer_diccionario.py) parsea `PUBLIDATA.add`
(`magic(5) + id(4) + padre(4) + etiqueta(10) + nombre[200] + tipo/largo/decimales`)
y reconstruye cada tabla. Dos hallazgos que costó ver:

- **El orden físico es `id` descendente**, no el orden del archivo. Se comprobó
  porque `ID` (el autoincremental, id más bajo) queda justo en los 4 bytes
  finales del registro.
- **El «ajuste» para varias contabilidades está en el dato**: las tablas de
  movimiento y `CONDOCUM` declaran `CONCIA`(3), `CONANO`(double) y `CONMES`(double).
  En `CONCECOS` y demás el campo se llama `CIA`.

El invariante de cierre cuadra **con delta 0 en las 17 tablas con datos**:

```
largo_del_registro == 5 + suma(anchos declarados, incluido el autoincremental)
```

Y el catálogo resultante queda en
[`catalogo_publidata.json`](catalogo_publidata.json), que es el que debe usar
todo lo demás. Las diferencias con el inventario son grandes: `CONMAE` tiene
**74 campos / 496 B** (el inventario dice 127 / 964), `MOV00` 31 (no 27),
`FADCLI` 105 (no 61), `VISDOCUM` 89 (no 69), `TIDSAL` 273.

> **Efecto sobre el paso 1:** el contrato campo → destino debe **re-anclarse** a
> este catálogo. Hay campos reales que el inventario no lista y campos del
> inventario que no existen en la copia.

### 3.3 Lo que ya se leyó de los datos

| Dato | Resultado |
|---|---|
| Contabilidad | Una, activa: `" 27"` = `COMERCIALIZADORA MERCALDAS AÑO 2025`, NIT `900273686` |
| Períodos del libro | `MOV00` = 2024·12 · `MOV01` = 2025·01…04. **Faltan `MOV02`..`MOV18`** (P-8) |
| Centinelas de NULL | Numéricos `-2147483648` / `-32768`; textos rellenos de bytes `00` (P-9) |
| `CONCECOS` | 222 centros con nombre y carpeta |
| `CONTICOM` | 28 comprobantes |
| `CONMAE` | 4.061 cuentas |

### 3.4 Método descartado: exportar por ODBC en Windows

Se conserva como alternativa para *consultar* la base con SQL (y para el
backend), no para extraer. En `ecommerce/db/` se recorrió ese camino:

| Evidencia en `ecommerce/db/` | Qué dice |
|---|---|
| `scripts/ads-local.sh` | «Ese formato es propietario de SAP/Sybase (producto descontinuado): **NO se puede leer sin el motor ADS**. El driver ODBC de Advantage solo existe para Windows» |
| `adt-reader/upload-addt.py` | No lee nada: **sube** `db/ADDT` por SMB a la máquina Windows (el log quedó en `VENTAS.ADT` al 4.8 %, ETA 7 h 43 min) |
| `adt-reader/export-publidata.ps1` | El extractor real: PowerShell en Windows, `Driver={Advantage ODBC Driver}` + `ServerTypes=ADS_LOCAL_SERVER` → CSV |
| `ads/README.md` | El ADS en Docker quedó «pendiente del instalador»: descontinuado y sin fuente pública |

De ese mismo repo salen los **datos de conexión del diccionario**: `UID=AdsSys`,
`PWD=Pubdata`, y la ruta `C:\VISADS_25\ADD\Publidata.add`.

Por eso existe también [`export_ads_to_csv.ps1`](export_ads_to_csv.ps1): exporta
cada tabla a CSV con SQL y deja un manifiesto con filas, bytes y SHA-256. Sigue
siendo útil si algún día se quiere validar la lectura directa **contra el
motor** — es la mejor conciliación posible — pero **ya no es el camino
bloqueante**, y en este equipo no puede correr: no hay driver ODBC registrado
(`ERROR [IM002]`).

Lo que sigue abierto y hay que resolver **con datos**:

1. **Campos MEMO**: `FADCLI` (161 MB) tiene `.adm`; por ODBC el motor resuelve el
   memo, pero hay que comprobar que el CSV traiga el texto completo.
2. **Fechas y lógicos**: el CSV sale como texto; la conversión (`AAAAMMDD`,
   `LOGICAL`) se decide en la carga, con datos a la vista.
3. **Codificación**: `SELECT *` por ODBC entrega ya decodificado; verificar
   tildes y `ñ` en el CSV antes de cargar.

(La incógnita de qué tablas contables había en el servidor y la de las 5 tablas
sin catálogo **ya no aplican**: ver §3.2 y §4.)

## 4. Lo que ya no hace falta, y lo que falta

**Ya no hace falta la máquina con ADS para extraer.** Las tablas contables están
en `ADD_CONTAB/` de este repositorio, y se leen. El inventario real (ranuras por
tabla) sale de `decodificar_adt.py`:

| Tabla | Registros | Tabla | Registros |
|---|---:|---|---:|
| `MOV01` | 4.280.033 | `CONMAE` | 4.061 |
| `COCENTRO` | 2.432.688 | `CONPUC` | 2.633 |
| `CONTERCE` | 765.754 | `CONCECOS` | 222 |
| `MOV00` | 768.904 | `VISDOCUM` | 127 |
| `CONDOCUM` | 735.976 | `CONTICOM` | 28 |
| `FADCLI` | 126.009 | `CONEMP` | 27 |
| `TIDSAL` | 17.667 | `TIDEAN` | 6 |
| `CONCTR` | **1** | `CONMOVI` | **0** |
| `CATALOGO2`, `CONLOTES`, `P_A_100_50`, `P_A_102_50` | **0** (vacías) | | |

Dos consecuencias inmediatas:

- **Las 5 tablas sin catálogo en el diccionario (P-6) dejan de importar**: cuatro
  están **vacías** y `TIDEAN` tiene 6 filas. No hay estructura que re-derivar.
- **`CONMOVI` está vacía**: no hay lotes pendientes en esta copia. `CONCTR` tiene
  una sola fila: es la configuración de la contabilidad activa.

Lo que **sí** falta:

1. **Re-derivar del `.add` los campos de las 8 tablas cuyo catálogo no coincide**
   (§3.2), empezando por `MOV00`/`MOV01`: son el libro.
2. **Campos MEMO**: `FADCLI` tiene `.adm`. Por lectura directa hay que resolver el
   puntero al memo para traer el texto completo; por ODBC lo haría el motor.
3. **Codificación**: el texto es Latin-1/CP1252 (`AÑO` sale como `A\xd1O`). Fijarla
   antes de cargar o las tildes se pierden.
4. **Rejilla de fechas y lógicos**: `TFECHA`/`TFECDOC` son `INTEGER` `AAAAMMDD` y
   los `LOGICAL` llegan como `'T'`/`'F'`; se convierten en la carga, con datos a la
   vista.
5. **Conciliación con el motor** (opcional): cuando haya un equipo con el driver,
   `export_ads_to_csv.ps1` permite contrastar la lectura directa contra SQL. Es la
   validación más fuerte disponible y no bloquea nada.

## 5. El extractor: `exportar_csv.py`

```bash
python db/migration/extractor/exportar_csv.py                  # todas las tablas con datos
python db/migration/extractor/exportar_csv.py --tabla CONEMP   # una sola
python db/migration/extractor/exportar_csv.py --si             # sin pedir permiso en las grandes
python db/migration/extractor/exportar_csv.py --reanudar       # salta lo que no cambió
python db/migration/extractor/exportar_csv.py --verificar      # revalida conteos y hashes
python db/migration/extractor/exportar_csv.py --reanotar       # recalcula el contexto del manifiesto
```

Salida en `../staging/` (fuera de Git): un CSV por tabla, en **UTF-8**, con una
columna `_loc` (índice físico del registro) más los campos del diccionario. El
autoincremental `ID` se decodifica como entero y es el mejor localizador de fila.

Cumplimiento del contrato del §8 del plan maestro:

| Condición | Cómo se cumple |
|---|---|
| Sólo lectura del origen | Nunca se abre `ADD_CONTAB/` para escritura |
| Salida cruda a staging | Los campos salen como están declarados; no se homologa nada |
| Manifiesto por archivo | `staging/manifiesto.json`: ruta, tabla, contabilidad, año, períodos, bytes, filas leídas y descartadas, SHA-256 de origen y de CSV |
| Rechazos con causa | Los campos que no decodifican se cuentan con `tipo_error` y causa; nunca se inventa un valor |
| Idempotencia | `--verificar` rehashea los CSV y confirma que reproducen el manifiesto (verificado en las 15 tablas, 1,7 GB) |
| Reanudable | `--reanudar` salta la tabla cuyo origen no cambió (compara el SHA-256) |

### Las dos únicas decisiones de staging

1. **Centinelas de NULL (P-9)** → campo vacío, contados por columna en el
   manifiesto. `-2147483648` en `INTEGER`, `-32768` en `SHORTINT`, y texto con
   bytes `00`. No es sustituir por un valor por defecto: es no inventar.
2. **Precisión decimal** → los `DOUBLE` salen con los decimales que declara el
   diccionario; si el valor traía más, se **cuenta** en el manifiesto en vez de
   perderse en silencio.

Y una marca que no es decisión sino constancia: los campos **MEMO** salen vacíos
pero se cuentan aparte (`memos_no_resueltos`), porque en el registro sólo hay un
puntero al `.adm`. En esta copia el único memo del piloto (`FADCLI.NOVEDAD`) tiene
los 126.009 punteros en cero, así que no hay contenido que perder.

### Resultado de la corrida completa

| Tabla | Filas | MB | Contabilidad | Año | Períodos |
|---|---:|---:|---|---|---|
| `MOV01` | 4.280.033 | 675,3 | 27 | 2025 | 1–4 |
| `COCENTRO` | 2.432.688 | 644,4 | 27 | — | — |
| `MOV00` | 768.904 | 112,5 | 27 | 2024 | 12 |
| `CONTERCE` | 765.754 | 159,4 | 27 | — | — |
| `CONDOCUM` | 735.976 | 73,1 | 27 | — | — |
| `FADCLI` | 126.009 | 36,4 | — | — | — |
| `TIDSAL` | 17.667 | 18,8 | — | — | — |
| `CONMAE` | 4.061 | 1,1 | 27 | — | — |
| `CONPUC` | 2.633 | 0,1 | — | — | — |
| `CONCECOS` | 222 | 0,0 | 27 | — | — |
| `VISDOCUM` | 127 | 0,0 | — | — | — |
| `CONTICOM` | 28 | 0,0 | 27 | — | — |
| `CONEMP` | 27 | 0,0 | — | — | — |
| `TIDEAN` | 6 | 0,0 | — | — | — |
| `CONCTR` | 1 | 0,0 | — | — | — |
| **Total** | **9.134.136** | **1.721** | | | |

- **0 filas descartadas y 0 recortes de precisión**: los datos decodifican limpios.
- `--verificar` confirma que las 15 tablas reproducen su hash: la extracción es
  idempotente.
- Las 4 tablas vacías (`CATALOGO2`, `CONLOTES`, `P_A_100_50`, `P_A_102_50`) y
  `CONMOVI` (0 lotes) se omiten solas.
- El volumen confirma **P-8**: `MOV01` llega hasta el período 04, así que los
  meses 05..08 que `CONDOCUM` registra no están en la copia.

## 6. Conciliación y lo que queda

El staging ya está en disco, así que la conciliación del §6 de
[`../03_plan_de_carga.md`](../03_plan_de_carga.md) se puede preparar **antes** de
que exista el cargador, contra estos mismos CSV:

| Comprobación | Cómo |
|---|---|
| Conteos por tabla | `filas_leidas` del manifiesto contra las filas del CSV |
| Cuadratura del libro | Suma de `TVALOR` por documento y período: debe dar cero por grupo. Medido al cargar: los grupos cuadran salvo el de `SI00`/2024·12, que cierra en −0,12 — desbalance del propio origen, no del cargue (`MOV01` neto 0,00) |
| Cabeceras contra detalle | Todo grupo (`CONCIA`,`CONANO`,`CONMES`,`TIPODOC`,`TCOMPR`,`TDOCUM`) de `MOVxx` debe tener su fila en `CONDOCUM`; los huérfanos se reportan, no se descartan |
| Apertura | `MOV00` (2024·12) contra `CONMAE.MSALDO`: no sumar las dos (T11) |

Lo que sigue abierto en el extractor:

1. **Campos MEMO.** El catálogo real declara 7, y el único en una tabla del
   piloto es `FADCLI.NOVEDAD`: en el registro sólo hay un puntero de 9 bytes al
   `.adm`. Se **verificó fila a fila** que los 126.009 punteros de `FADCLI` son
   cero, así que el memo está vacío en todo el origen y **no hay pérdida**. Aun
   así el extractor lo marca como `memos_no_resueltos` en el manifiesto, no como
   campo vacío: si una copia futura trae memos con contenido, hay que verlo.
2. **Codificación**: se asume Latin-1/CP1252. Si hay campos con otra página de
   código, se verá al comparar contra el motor.
3. **`MOV02`..`MOV18` y demás tablas ausentes** (P-8): no están en la copia.
4. **Conciliación contra el motor** (opcional): `export_ads_to_csv.ps1` en un
   equipo con el driver permite contrastar fila a fila. Es la validación más
   fuerte y sigue pendiente.

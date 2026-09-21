# Migración de datos — CONTABDSI

Registro de la **evaluación y el plan para migrar los datos** del legado
Advantage (VISION/FORTUNER) al modelo nuevo. El diseño del destino y la
validación funcional viven en [`../old_db/`](../old_db/) y
[`../general/`](../general/) (contexto congelado, no se edita); este directorio
los traslada a un plan de ejecución y los contrasta con la fuente que **hoy
existe realmente** en el repositorio.

## 1. Veredicto — ¿se puede usar `ADD_CONTAB` para migrar?

**Sirve para un piloto del núcleo contable; no para una migración completa.**

`ADD_CONTAB/` es una copia **parcial** del diccionario del legado: trae **15 de
las 139 tablas** documentadas en
[`../old_db/DICCIONARIO_DEPURADO_CONTABDSI.md`](../old_db/DICCIONARIO_DEPURADO_CONTABDSI.md),
unos 3.4 GB. Alcanza para construir y validar el ETL de la contabilidad general
(catálogos, terceros, cuentas, centros, comprobantes, documentos y los
movimientos de los dos períodos presentes), pero falta el resto: años
anteriores, impuestos, seguridad, activos, exógena, reembolsos, presupuesto…

| Pregunta | Respuesta |
|---|---|
| ¿Hay datos del legado en el repositorio? | Sí: `ADD_CONTAB/` (3.4 GB, fuera de Git por `.gitignore`) |
| ¿Alcanza para las 60 tablas del modelo nuevo? | **No**: solo 15 tablas fuente presentes |
| ¿Alcanza para el piloto del núcleo contable? | **Sí** — ver [`01_inventario_fuente.md`](01_inventario_fuente.md) |
| ¿Se puede extraer hoy? | **No**: falta el motor/proveedor de Advantage (ver §4) |
| ¿Basta migrar los datos para que el backend use PostgreSQL? | **No**: los servicios hablan ADS/ADO — ver [`04_transicion_del_backend.md`](04_transicion_del_backend.md) |
| ¿Se puede pasar a producción con esto? | **No**: el dictamen de `old_db` sigue en **NO-GO** (bloqueos B01–B15) |

## 2. Archivos de este directorio

| Archivo | Contenido |
|---|---|
| [`01_inventario_fuente.md`](01_inventario_fuente.md) | Qué trae y qué no trae `ADD_CONTAB`, con destino candidato y ausencias por impacto |
| [`02_consideraciones_previas.md`](02_consideraciones_previas.md) | Qué tener en cuenta **antes** de migrar: fuente, alcance, destino, transformaciones, conciliación y seguridad |
| [`03_plan_de_carga.md`](03_plan_de_carga.md) | Fases, orden de carga, contrato del cargador, pruebas, corte y reversión |
| [`04_transicion_del_backend.md`](04_transicion_del_backend.md) | Cómo llevar los servicios del backend de Advantage a PostgreSQL |
| [`05_montar_advantage_local.md`](05_montar_advantage_local.md) | Qué instalar (proveedor 11.1 de 64 bits) y cómo abrir `ADD_CONTAB` en local |
| [`06_referencia_campos.md`](06_referencia_campos.md) | **Referencia campo a campo Advantage → PostgreSQL**, generada desde el contrato |
| [`07_decisiones_del_libro.md`](07_decisiones_del_libro.md) | **Registro de las decisiones del libro** (`CONDOCUM` + `MOVxx`): evidencia medida, alternativas descartadas y correcciones a lo que suponía el plan |
| [`cargador/`](cargador/README.md) | **Cargador del staging a PostgreSQL**: orden de entidades, decisiones de carga y estado de la corrida |
| [`extractor/`](extractor/README.md) | Formato `.adt` entendido, catálogo real del `.add`, y el contrato del extractor |
| [`extractor/leer_diccionario.py`](extractor/leer_diccionario.py) | **Parser de `PUBLIDATA.add`**: los campos reales de la copia, verificados contra los `.adt` |
| [`extractor/catalogo_publidata.json`](extractor/catalogo_publidata.json) | Catálogo real de las 20 tablas (888 campos), en orden físico — **sustituye al inventario de `old_db/`** |
| [`extractor/decodificar_adt.py`](extractor/decodificar_adt.py) | **Lee las tablas sin Advantage** y decodifica sus filas |
| [`extractor/exportar_csv.py`](extractor/exportar_csv.py) | **Extrae a CSV + manifiesto** con el contrato del plan (idempotente y reanudable) |
| `extractor/staging/` | Salida: 15 CSV (1,7 GB) + `manifiesto.json`. Fuera de Git |
| [`homologacion/reglas.py`](homologacion/reglas.py) | **Contrato curado** campo → destino de las tablas del piloto: la única fuente de la decisión |
| [`homologacion/contrato_campos.json`](homologacion/contrato_campos.json) | Contrato de los **888 campos del catálogo real**, con clase y destino por campo |
| [`homologacion/contrato_campos.py`](homologacion/contrato_campos.py) | Aplica `reglas.py` y **falla** si un campo del piloto queda sin decisión |
| [`homologacion/generar_referencia.py`](homologacion/generar_referencia.py) | Renderiza `06_referencia_campos.md` desde el contrato (no se edita a mano) |
| [`homologacion/PENDIENTES.md`](homologacion/PENDIENTES.md) | **Registro de las decisiones** del contrato de campos (y las que añadió el libro) con qué evidencia se cerró cada una |

## 3. Relación con `old_db/` (aquí no se duplica)

El plan maestro es
[`../old_db/PLAN_MIGRACION_POSTGRESQL.md`](../old_db/PLAN_MIGRACION_POSTGRESQL.md):
dictamen, bloqueos B01–B15, diseño destino recomendado, reglas de
transformación y preservación, plan por fases, contrato del cargador, pruebas
T01–T18 y condiciones GO/NO-GO. **Este directorio lo referencia y solo concreta
lo que depende de esta instalación.**

Complementos en `old_db/`:

| Documento | Aporte |
|---|---|
| `MATRIZ_TABLAS_Y_BRECHAS.md` | 98 tablas/familias del legado → destino candidato, estado y brecha, con códigos de proceso P01–P30 |
| `HOMOLOGACION_CAMPOS.md` | 2.663 nombres de campo: destino, estado y transformación |
| `MATRIZ_PROCESOS_Y_OPCIONES.md` | 36 familias de procesos y 161 acciones de menú |
| `TRAZABILIDAD_FUNCIONES_Y_BOTONES.md` | 969 funciones y 572 acciones adicionales del original |
| `EXCLUSIONES_CONTABDSI.md` | Qué se excluyó del inventario y con qué criterio |
| `ESQUEMA_DEPURADO_CONTABDSI.md` / `.json` | Esquema funcional depurado y catálogo legible por máquina |

> `old_db/` es **contexto congelado**: no se edita. Cualquier corrección o
> ampliación de este plan se escribe aquí, no allí.

## 4. El motor de Advantage: quién lo necesita (y quién no)

**Corrección de premisa.** Este documento afirmaba que leer `ADD_CONTAB` exigía el
motor. Se verificó que **no**: el formato de los `.adt` está entendido y los datos
se leen en texto plano. Ver [`extractor/README.md`](extractor/README.md) §3 y
[`extractor/decodificar_adt.py`](extractor/decodificar_adt.py).

| Quién | ¿Necesita Advantage? | Por qué |
|---|---|---|
| **La extracción / el ETL** | **No** | Los `.adt` se decodifican: cabecera de 3 enteros, registros de largo fijo y campos de texto |
| **El backend actual**, mientras siga escribiendo en el legado | **Sí** | Habla OLEDB/ODBC por nombre de proveedor (`Advantage.OLEDB.1`), no por formato de archivo |
| **El backend nuevo** sobre PostgreSQL | No | Es el destino y ya está funcionando con `CONTABDSI_STORE=postgres` |

```
$ node dev.js --check
   Advantage      motor no instalado      <- sólo bloquea el backend contra el legado
   Diccionario    ADD_CONTAB/PUBLIDATA.add
```

Es decir: la migración **no** paga el peaje del motor. Sólo lo sigue necesitando
la operación contra el legado, y sólo mientras el corte no se complete.

Guía para instalarlo (sólo si se quiere operar contra Advantage)
[`05_montar_advantage_local.md`](05_montar_advantage_local.md).

## 5. Estado y siguiente paso

| Fase del plan maestro | Estado |
|---|---|
| 0. Cerrar alcance | **Resuelto con datos** (§5.3): una contabilidad activa. Falta formalizar la firma |
| 1. Perfilado solo lectura | **Hecho por lectura directa**: los `.adt` se decodifican sin motor; el perfilado real está en [`01_inventario_fuente.md`](01_inventario_fuente.md), [`extractor/`](extractor/README.md) y [`07_decisiones_del_libro.md`](07_decisiones_del_libro.md) |
| 2. Homologación funcional | **Cerrado**: 888 campos con clase, 0 pendientes; las 42 decisiones resueltas con datos, `docs/` e `Interface_web/` ([`homologacion/PENDIENTES.md`](homologacion/PENDIENTES.md)) |
| 3. Esquema y servicios | **B04/B05/B13 verificados como ya corregidos**; añadido lo que el contrato exige: trazabilidad del cargador y `cuentas.clasificacion_corriente` |
| 4. Ensayo del motor | No iniciada |
| 5. Extractor y staging | **Hecho**: 15 CSV (9.134.136 filas, 1,7 GB) con manifiesto, idempotente y verificado |
| 6. Carga piloto | **Hecho para la copia disponible**: catálogos y libro cargados y conciliados (735.762 documentos, 5.025.890 renglones, 3.355 de 3.355 pares con diferencia 0,00). Ver [`cargador/README.md`](cargador/README.md) y [`07_decisiones_del_libro.md`](07_decisiones_del_libro.md) |
| 7-10 | No iniciadas |

### 5.1 Qué se cerró (pasos 1 y 2)

**Paso 1 — contrato campo a campo.** Pasó por tres versiones, y las dos
correcciones valen más que el resultado:

| Versión | Campos del piloto | Qué falló |
|---|---:|---|
| Estimación inicial | 279 | No salía de ningún artefacto |
| Sobre el inventario de `old_db/` | 439 | Ese inventario **no describe esta copia** |
| **Sobre el catálogo real del `.add`** | **467** | Es la lista buena |

El catálogo real tiene **888 campos** en 20 tablas, contra los 791 del inventario:
**130 campos existen en la copia sin figurar en el inventario** y **98 del
inventario ya no existen**. Al re-anclar, y tras cerrar las 42 decisiones, el
contrato quedó en: `directo` 79, `despivot` 63, `derivado` 98, `catalogo` 10,
`procedencia` 168, `fuera_nucleo` 404 y `descartado` 66 — **`pendiente` 0**. La
decisión vive en [`homologacion/reglas.py`](homologacion/reglas.py) y
[`contrato_campos.py`](homologacion/contrato_campos.py) **falla** si algún campo
queda sin regla, de modo que el contrato no se puede degradar en silencio.

Las decisiones se cerraron con tres fuentes, no con criterio propio: **los datos**
(qué está vacío en 5,05 M de filas), **`docs/`** (14 especificaciones: sin
multimoneda, sin períodos 13–18) y **`Interface_web/`** (sus tipos y módulos de
API son el contrato de facto de lo que el backend debe servir). Ese cruce
corrigió tres clasificaciones que el nombre del campo había inducido a error
(`CTCLAVE1` no es una clave sino «contabilidad de conciliación», `CLAVE` es un
`LOGICAL`…) e identificó 23 columnas que faltaban. Todo en
[`homologacion/PENDIENTES.md`](homologacion/PENDIENTES.md).

**Paso 2 — esquema.** Al aplicar el contrato se encontró que lo que el plan
maestro describe como bloqueos de carga (B04/B05) **ya estaba corregido** en el
esquema, y que B13 también (`documentos`, `lotes`, `saldos_cuenta` y
`periodos_contables` admiten los períodos `00` y `13..18`). Lo que sí faltaba,
y el contrato exige:

| Añadido | Por qué |
|---|---|
| `schema/12_migracion.sql` — 5 tablas | El §4 del plan exige por fila localizador, clave cruda, valores originales, resultado y destino; equivalencias persistentes; y ajustes con motivo aprobado. Estas tablas son las que permiten preservar los campos sin destino tipado (`TINCON`, `TSALDO`, `TCV`…) **sin inventar columnas de negocio** |
| `cuentas.clasificacion_corriente` | `CONMAE.CTCTABASE` tiene destino decidido en [`02_consideraciones_previas.md`](02_consideraciones_previas.md) §4 y **no** es `cuenta_base_id`; la columna no existía |
| `schema/13_campos_contrato.sql` — 23 columnas en 4 tablas | Lo que exige la interfaz web: identidad desglosada de terceros, atributos del tipo documental, descripción auxiliar del comprobante y distribución del centro de costo |

Verificado **aplicándolo desde cero** (`docker compose down -v && up -d --wait`):
la base queda con 65 tablas y 37 funciones, las **11 validaciones de
`scripts/validate.sql` pasan** y las cuatro restricciones nuevas muerden (rechazo
sin causa, equivalencia global duplicada, ejecución terminada sin fecha y ajuste
sin motivo: todas rechazadas).

### 5.2 Qué reveló la lectura directa (P-1, P-3 y P-6)

**P-1 — ámbito: una sola contabilidad.** Las tablas que dependen de la
contabilidad llevan un **código de 3 bytes** al inicio de cada registro, y en la
muestra es **constante `" 27"`** en todas: `MOV00` y `MOV01` (5,05 M de registros
entre ambas), `CONMAE`, `CONDOCUM`, `CONCECOS`, `COCENTRO`, `CONTERCE` y
`CONTICOM`. No hay más de una contabilidad dentro de los archivos.

`CONEMP` es un **catálogo de contabilidades, no de empresas**: 27 filas, todas
del mismo NIT, una por año (2006–2025) y por variante (local / NIIF / pruebas).
**Una sola está activa**: `" 27"` → `COMERCIALIZADORA MERCALDAS AÑO 2025`,
NIT `900273686`. El resto son históricas (`HABILITA='F'`).

> Consecuencia para el modelo: `companias` debe quedar con **una** fila
> (Mercaldas) y `compania_anios` con el año cargado. El código de 3 bytes **es la
> dimensión de contabilidad** que faltaba en `saldos_cuenta` (D-CONMAE-6): existe
> en el origen y no en el destino.

**P-3 — año.** Está **dentro de cada registro**: el ajuste añadió `CONCIA`,
`CONANO` y `CONMES` a las tablas de movimiento y a `CONDOCUM`. Medido: `MOV00` =
2024·12 y `MOV01` = 2025·01…04. Con eso aparece **P-8**: la copia no trae
`MOV02`..`MOV18`, así que los meses 05..08 de 2025 —que `CONDOCUM` sí registra—
no están en el movimiento.

**P-6 — tablas sin catálogo.** Se disuelve: `CATALOGO2`, `CONLOTES`,
`P_A_100_50` y `P_A_102_50` están **vacías** (0 registros) y `TIDEAN` tiene 6.

**P-7 — el catálogo real.** El inventario de `old_db/` no describe esta copia.
[`extractor/leer_diccionario.py`](extractor/leer_diccionario.py) parsea
`PUBLIDATA.add` y el invariante `largo == 5 + suma(anchos)` **cuadra con delta 0
en las 17 tablas con datos**. El resultado, en
[`extractor/catalogo_publidata.json`](extractor/catalogo_publidata.json),
difiere mucho del inventario: `CONMAE` **74 campos / 496 B** (no 127 / 964),
`MOV00` 31 (no 27), `FADCLI` 105 (no 61), `VISDOCUM` 89 (no 69).

**P-9 — centinelas de NULL.** En los datos reales los vacíos numéricos llegan
como `-2147483648` / `-32768` y los textos como bytes `00`. Traducirlos a `NULL`
en la carga, por tipo.

### 5.3 Siguiente paso

1. **Re-anclar el contrato del paso 1**: **hecho.** El contrato quedó anclado al
   catálogo real ([`extractor/catalogo_publidata.json`](extractor/catalogo_publidata.json))
   en 888 campos con clase y 0 pendientes.
2. **Resolver P-8**: pedir o ubicar `MOV02`..`MOV18` si el alcance incluye los
   meses 05..08 de 2025. El libro ya está cargado y declara ese alcance: sin esos
   archivos, 615.290 documentos migrados quedan sin partidas.
3. ✅ **Extractor y staging: hecho.** `extractor/exportar_csv.py` dejó 15 CSV
   (9.134.136 filas, 1,7 GB) con manifiesto, sin un solo rechazo y verificado
   como idempotente. Ver [`extractor/README.md`](extractor/README.md) §5.
4. **El cargador** (paso 3): **hecho.** Cargó catálogos y libro sobre una base sin
   el seed, con los conteos, las sumas y la conciliación verificados. Ver
   [`cargador/README.md`](cargador/README.md) y
   [`07_decisiones_del_libro.md`](07_decisiones_del_libro.md).
5. **Pendiente del extractor**: los campos MEMO de `FADCLI` (`.adm` de 161 MB)
   salen vacíos por lectura directa; hay que resolver el puntero.

Avance paralelo: el backend ya alterna de motor (`CONTABDSI_STORE`) y tiene
`/api/health` y `/api/companias` leyendo de PostgreSQL — ver
[`04_transicion_del_backend.md`](04_transicion_del_backend.md) §8.

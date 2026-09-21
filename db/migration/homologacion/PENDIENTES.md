# Decisiones del contrato de campos

> El archivo se llamaba `PENDIENTES.md` y ya no hay pendientes: **los 888 campos
> del catálogo real tienen decisión**. Se conserva el nombre porque está
> referenciado desde todo el plan, pero el contenido es ahora el registro de
> **cómo se cerró cada decisión y con qué evidencia**.

```bash
python db/migration/homologacion/contrato_campos.py   # falla si algún campo queda sin regla
```

## 1. Estado

| | Campos |
|---|---:|
| Catálogo real (20 tablas) | **888** |
| **Sin decisión** | **0** |
| Del piloto (13 tablas) | 484 |

Clases en todo el catálogo: `directo` 79 · `despivot` 63 · `derivado` 98 ·
`catalogo` 10 · `procedencia` 168 · `fuera_nucleo` 404 · `descartado` 66.

Se definieron **42 decisiones** (33 de tabla y 9 transversales) y **todas están
cerradas**. Ninguna se cerró por criterio propio: cada una tiene detrás un dato
del archivo, un documento de `docs/` o una funcionalidad de `Interface_web/`.

## 2. De dónde salió cada respuesta

| Fuente | Qué resolvió |
|---|---|
| **Los datos** (`.adt` decodificados) | La contabilidad activa, el año y el período por registro, los centinelas de NULL, qué campos están vacíos en las 5.048.937 filas de movimiento |
| **El diccionario real** (`PUBLIDATA.add`) | La lista de campos de la copia: cerró el desajuste de 130 campos nuevos y 98 retirados |
| **`docs/`** (14 especificaciones funcionales) | Que **no hay multimoneda**, que **no hay períodos 13–18**, y qué campos usan las 14 pantallas documentadas |
| **`Interface_web/`** | Qué campos exige el backend nuevo: sus tipos y módulos de API son el contrato de facto |

## 3. Decisiones transversales

| ID | Era | Cómo se cerró | Evidencia |
|---|---|---|---|
| **P-1** | ¿Una compañía o varias? | **Una contabilidad activa** (`" 27"`, Mercaldas 2025); `CONEMP` lista 27 contabilidades del mismo NIT, una por año/variante | Código de 3 bytes por registro, constante en 5,05 M de filas |
| **P-2** | ¿`EMPCOD` y `CTCODCIA` son lo mismo? | **Sí**: `CTCODCIA` es la forma numérica de `EMPCOD`, de sólo lectura en la interfaz (`codigoInterno`) | `src/data/parametrosOperacion.ts` |
| **P-3** | ¿De dónde sale el año? | Viaja **dentro de cada registro**: `CONCIA`/`CONANO`/`CONMES` | Medido: `MOV00` = 2024·12, `MOV01` = 2025·01…04 |
| **P-4** | ¿Multimoneda? | **No existe.** Ni los 14 documentos ni la interfaz la contemplan | `docs/` sin una sola mención; consolidación declara la conversión de moneda como «sección futura» |
| **P-5** | ¿Períodos `13..18`? | **No existen en la copia** | Sólo `00..12` en `CONMAE` y en los períodos medidos |
| **P-6** | Tablas sin catálogo | **Resuelto**: cuatro están vacías y `TIDEAN` tiene 6 filas | Volumetría leída de las cabeceras |
| **P-7** | El catálogo no coincidía | **Resuelto**: se lee el real del `.add` y cuadra con delta 0 en las 17 tablas con datos | `extractor/leer_diccionario.py --validar` |
| **P-8** | Faltan `MOV02`..`MOV18` | **Declarado como alcance, no como bloqueo**: la copia es un fragmento y se trabaja así | `CONDOCUM` llega a 2025·08·13; el movimiento sólo al período 04 |
| **P-9** | Centinelas de NULL | **Resuelto por el extractor**: `-2147483648` / `-32768` / bytes `00` → campo vacío, contados por columna en el manifiesto | `extractor/exportar_csv.py` |

## 4. Decisiones de tabla

### Cerradas por la interfaz web

Estas tres son correcciones de la primera versión del contrato, que había
clasificado mal por el nombre del campo:

| ID | Campo | Se tenía como | Es en realidad | Evidencia |
|---|---|---|---|---|
| **D-CONCTR-1** | `CTCLAVE1` | «clave de acceso» → descartado | **`contabilidadConciliacion`** (texto) | `src/data/parametrosOperacion.ts` |
| **D-CONCTR-2** | `CTPUC` | pendiente | **`controlaUsuarioLotes`** (booleano) | ídem |
| **D-CONCTR-3** | `CTLEY1` | pendiente | **`comentarioCertificado`** (texto) | ídem |
| **D-CONCTR-4** | resto de `CONCTR` | 34 pendientes | **Se modelan los 13 que la interfaz lee**; los demás se conservan en `procedencia` | ídem + `docs/` (sólo citan `CTANO` y `CT00..CT12`) |
| **D-VISDOCUM-1** | `CLAVE`, `CLAVE2` | «secretos» → descartados | `CLAVE` es `LOGICAL`: es una **bandera**, no una contraseña | Catálogo real del `.add` |
| **D-VISDOCUM-2** | `MODULO`, `TIPO`, `PREFIJO`, `COMPRO`, `ICONTAB`, `CONVER`, `DOCCONVER` | pendientes | **Se modelan** en `tipos_documento` | `docs/TIPOS_DOCUMENTO_ADS.md` |
| **D-VISDOCUM-3** | 39 banderas de integración | pendientes | Se conservan en `procedencia`; ningún documento las mapea a un campo | `docs/` (aparecen en prosa, sin nombre de campo) |
| **D-FADCLI-1** | `CSOCIAL`, `CNOM1`, `CNOM2`, `CAPE1`, `CAPE2`, `CCODCIU` | «pendiente» / «fuera del núcleo» | **Se modelan**: la interfaz los exige al crear un tercero | `TerceroCreate` en `src/api/terceros.ts` |
| **D-FADCLI-2** | resto de identidad y contacto | 14 pendientes | Se conserva en `procedencia` | Ni `docs/` ni la interfaz los usan |
| **D-FADCLI-3** | 72 campos comerciales y de crédito | fuera del núcleo | **Confirmado**: ni una pantalla los consume | `docs/TERCEROS_ADS.md` y el tipo `Tercero` |
| **D-CONCECOS-1** | `VALOR`, `PORCEN`, `VLRPOR`, `CODITEM`, `CUENTA`, `CONCEPTO` | 6 pendientes | **Se modelan** en `centros_costos` | `CentroJerarquico` en `src/data/configCentros.ts` los declara uno por uno |
| **D-CONTICOM-1** | `CTABDES` | pendiente | **Se modela**: `comprobantes.descripcion_auxiliar` | `descripcionAuxiliar` en `src/api/comprobantes.ts` |
| **D-CONMOVI-1/2** | `BORRAR`, `USUA_F` | pendientes | `USUA_F` → `lotes.actualizado_por`; `BORRAR` → conservado (la tabla está vacía) | Volumetría: `CONMOVI` = 0 filas |
| **D-CONDOCUM-1/2** | `DDOCUMI`, `DDOCUM2` | pendientes | Conservados: no aparecen en `docs/` ni en la interfaz | Búsqueda en la interfaz sin coincidencias |
| **D-CONEMP-1** | `REASIGNA` | pendiente | Conservado: la interfaz no expone ninguna reasignación | `src/data/configCompanias.ts` |
| **D-CONPUC-1** | `MFLAG` | pendiente | Conservado: sin semántica documentada | `docs/PLAN_CUENTAS_ADS.md` |
| **D-CONCTR-3** | `CTCOMNOM1..3` / `CTDOCNOM1..3` | pendiente (orden) | Se cargan en `parametros_nomina`; el orden queda por confirmar **cuando exista la pantalla de nómina** | `interface: Nomina.tsx` (sin conexión aún) |

### Cerradas por los datos

| ID | Campo(s) | Cómo se cerró | Evidencia |
|---|---|---|---|
| **D-MOV-1** | `TESTADO`, `TCV`, `TABMNIT`, `TINCON`, `TSUBCTA` | **Vacíos en las 5.048.937 filas** → descartados | Conteo sobre los CSV de staging |
| **D-MOV-1** | `TSALDO` | Tiene valor en **todas** las filas → no se carga, **se recalcula y se concilia** | ídem |
| **D-CONMAE-6** | bloque NIIF (39 campos) | **No existe en la copia** → `CONMAE` tiene 74 campos, no 127 | Diccionario real |
| **D-CONMAE-8** | `MSALDO` vs `MACMDEB00` | Cargar el período `00`; `MSALDO` sólo si `00` viene vacío | `CONMAE` sólo declara meses `01..12` |
| **D-CONLOTES-1** | `TINCON` | Se cae con D-MOV-1 (y la tabla está vacía) | Volumetría |
| **D-MOV-2** | `TIVA_RET` | **No es la clase del destino**: se traduce `I` -> `IVA`, `R` -> `Retencion`, `O` -> `Otro` y vacío -> `''` | Dominio contado sobre las 5.048.937 filas: `O` 2.945.663, `I` 2.047.372, `R` 47.365, vacío 8.537. Cargar el carácter crudo violaba el CHECK de `documento_lineas.clase`; no es el mismo dominio que `CONMAE.MIVA_RET` (`Generado`/`Renta`/vacío). [`07_decisiones_del_libro.md`](../07_decisiones_del_libro.md) §5 |
| **D-CONDOCUM-3** | `DDOCUM` (índice `documentos_contabilizado_uk`) | **La etiqueta no es única**: `DDOCUM` se conserva tal cual y el índice excluye la historia migrada (`origen <> 'Migracion'`) | 73.236 colisiones de `(anio, documento)`; con comprobante, tipo documental, fecha y valor aún colisionan 29.059 filas, y ninguna combinación de columnas del legado es única. [`07_decisiones_del_libro.md`](../07_decisiones_del_libro.md) §1 |

El libro añadió y cerró **D-MOV-2** y **D-CONDOCUM-3**, ambas con los datos del
lado del origen; su evidencia completa, las alternativas descartadas y las
demás decisiones del libro están en
[`07_decisiones_del_libro.md`](../07_decisiones_del_libro.md).

### Cerradas por la interfaz: qué NO se modela

| ID | Campos | Decisión | Por qué |
|---|---|---|---|
| **D-CONMAE-1…5, 7** | 37 campos de `CONMAE` (exógena, distribución por centro, costeo ABC, dimensiones, metadatos NIIF) | Conservados | El tipo `Cuenta` de la interfaz sólo declara código, nombre, nivel, afectable, requiereTercero/Centro/Base, ajuste, clase de IVA y retención y saldo |
| **D-CONCTR** | 30 parámetros no leídos por la interfaz | Conservados | «Lo más completo que podamos tener la base»: se guardan íntegros en vez de inventar 30 columnas que nadie lee |

## 5. Qué se añadió al esquema por estas decisiones

Un solo archivo, [`../postgresql/schema/13_campos_contrato.sql`](../postgresql/schema/13_campos_contrato.sql),
con 23 columnas, cada una pedida por una funcionalidad concreta:

| Tabla | Columnas | Quién las pide |
|---|---:|---|
| `terceros` | 6 | `TerceroCreate` (`src/api/terceros.ts`) |
| `tipos_documento` | 7 | `docs/TIPOS_DOCUMENTO_ADS.md` |
| `centros_costos` | 9 | `CentroJerarquico` (`src/data/configCentros.ts`) |
| `comprobantes` | 1 | `descripcionAuxiliar` (`src/api/comprobantes.ts`) |

Verificado desde base vacía: 65 tablas, las **11 validaciones** de
`scripts/validate.sql` en verde, y las FK compuestas nuevas respetando el
aislamiento por compañía (B05).

## 6. Cómo se conserva lo que no se modela

La clase `procedencia` (168 campos) no descarta nada: **el renglón original
completo queda en `migracion_filas.valores_originales`** (`jsonb`), con el motivo
escrito campo por campo en `reglas.py`. Es el mecanismo que el §4 del plan de
carga define para lo que no tiene semántica acreditada, y deja la base lo más
completa posible sin columnas que nadie lee: se puede consultar el valor original
de cualquier campo del legado desde PostgreSQL.

## 7. Lo único que sigue abierto

Nada del contrato de campos. Lo que queda es **alcance**, no decisión:

| Tema | Estado |
|---|---|
| `MOV02`..`MOV18` (P-8) | La copia es un fragmento; los meses 05..08 de 2025 no están. Se carga lo que hay y se declara |
| Orden de `CTCOMNOMn` (D-CONCTR-3) | Se confirmará cuando la pantalla de Nómina tenga backend |
| Conciliación contra el motor | Opcional: `export_ads_to_csv.ps1` en un equipo con el driver |

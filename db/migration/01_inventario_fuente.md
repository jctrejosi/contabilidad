# Inventario de la fuente disponible (`ADD_CONTAB/`)

Fecha de inventario: 20 de septiembre de 2026.

## 1. Método

Comparación entre las tablas documentadas en
[`../old_db/DICCIONARIO_DEPURADO_CONTABDSI.md`](../old_db/DICCIONARIO_DEPURADO_CONTABDSI.md)
(encabezados `### C:\VISADS\…\TABLA.ADT`) y los archivos presentes en
`ADD_CONTAB/`:

```bash
grep -E "^### .*\.(ADT|adt|DBF|dbf)$" db/old_db/DICCIONARIO_DEPURADO_CONTABDSI.md \
  | sed -E 's/.*[\\/]([^\\/]+)\.(ADT|adt|DBF|dbf).*/\1/' | tr 'a-z' 'A-Z' | sort -u > /tmp/dict.txt
ls ADD_CONTAB | sed -E 's/\.[A-Za-z]{3}$//' | tr 'a-z' 'A-Z' | sort -u > /tmp/have.txt
comm -12 /tmp/dict.txt /tmp/have.txt   # presentes
comm -23 /tmp/dict.txt /tmp/have.txt   # ausentes
```

| Medición | Valor |
|---|---:|
| Tablas documentadas en el diccionario del legado | **139** |
| Archivos en `ADD_CONTAB/` | 48 |
| Nombres base distintos (tablas, diccionario y fuentes) | 23 |
| Tablas presentes **y** documentadas | **15** |
| Tablas documentadas **ausentes** | **124** |
| Tamaño total de la carpeta | ~3.4 GB |

> El diccionario del legado está congelado en `old_db/`. Las 139 entradas son
> nombres físicos localizados en su día bajo `C:\VISADS\…`; no todas pertenecen
> a contabilidad (hay compras, inventario, POS y nómina).

## 2. Requisito de acceso: motor Advantage

Los `.ADT`/`.add` **no se leen sin el motor**. Estado comprobado en este equipo:

| Comprobación | Resultado |
|---|---|
| Servicio `*dvantage*` | No existe |
| Clave `HKLM\SOFTWARE\Classes\Advantage.OLEDB.1` | No registrada |
| `adsloc64.dll`, `ace64.dll`, `ads*.dll` | No encontradas |
| `C:\Program Files*\Advantage*`, `C:\VISION20` | No existen |

`node dev.js` ya lo reporta (`Advantage → motor no instalado`) y `--require-ads`
hace fallar el arranque si se exige. Sin este motor, ni el backend actual ni el
extractor del ETL pueden abrir el diccionario.

## 3. Tablas presentes (15) y su destino candidato

Tamaños redondeados. «Proceso» es el código P01–P30 de
[`../old_db/MATRIZ_TABLAS_Y_BRECHAS.md`](../old_db/MATRIZ_TABLAS_Y_BRECHAS.md).

| Archivo | Tamaño | Legado | Destino candidato en el modelo nuevo | Proceso |
|---|---:|---|---|---|
| `CONEMP.ADT` | 4 KB | CONEMP | `companias`, `compania_anios` | P01 |
| `CONCTR.ADT` | 17 KB | CONCTR | `parametros_operacion`, `periodos_contables`, `companias` | P02 |
| `CONPUC.ADT` | 150 KB | CONPUC | `cuentas` (catálogo base) | P03 |
| `CONMAE.ADT` | 2 MB | CONMAE | `cuentas`, `saldos_cuenta`, `saldos_cuenta_tercero` | P03 |
| `VISDOCUM.ADT` | 100 KB | VISDOCUM | `tipos_documento`, `consecutivos_comprobantes`, `plantillas_contables`, `plantilla_lineas` | P04 |
| `CONTICOM.ADT` | 4 KB | CONTICOM | `comprobantes`, `consecutivos_comprobantes` | P04 |
| `FADCLI.ADT` | 161 MB | FADCLI | `terceros`, `tercero_etiquetas` | P05 |
| `CONCECOS.ADT` | 34 KB | CONCECOS | `centros_costos` | P07 |
| `CONDOCUM.ADT` | 89 MB | CONDOCUM | `documentos` | P09 |
| `MOV00.ADT` | 213 MB | MOV00 | `documento_lineas`, `documentos` | P09 |
| `mov01.ADT` | 1.16 GB | MOV01 | `documento_lineas`, `documentos` | P09 |
| `CONTERCE.adt` | 202 MB | CONTERCE | `saldos_cuenta_tercero`, `acumulados_tercero` | P14 |
| `COCENTRO.ADT` | 812 MB | COCENTRO | `saldos_cuenta_centro`, `acumulados_centro` | P14 |
| `CONMOVI.ADT` | 4 KB | CONMOVI | `lotes` | P08 |
| `TIDSAL.adt` | 41 MB | TIDSAL | `integraciones` (módulo de inventario) | P30 |

Archivos auxiliares del diccionario: `PUBLIDATA.add` (diccionario), `PUBLIDATA.ai`,
`PUBLIDATA.am`.

## 4. Archivos presentes que el diccionario **no** documenta

Deben confirmarse con el cliente antes de decidir su destino:

| Archivo | Observación |
|---|---|
| `MOVICON.prg` (300 KB), `MOVICONN.prg` (155 KB) | **Código fuente Harbour del legado.** Es la referencia de reglas de negocio más valiosa del paquete; el plan maestro ya cita `MOVICON.prg:6521` y `:6581-6583` para el signo de `TVALOR`. No es dato a migrar, pero explica el dato. |
| `CONLOTES.adt` | Tabla de lotes físicos, no aparece en el diccionario (`CONMOVI` sí). Aclarar si es de esta versión o de un desarrollo posterior. |
| `CATALOGO2.adt`, `P_A_100_50.adt`, `P_A_102_50.adt` | Nombres de catálogo/selección; sin correspondencia en el diccionario. |
| `TIDEAN.ADT` | Tabla de inventario con nombre similar a la familia `TID*`; confirmar propietario (¿otro módulo?). |

## 5. Ausencias por impacto en el modelo nuevo

De las 124 tablas ausentes, estas son las que **bloquean cobertura funcional**
(no basta con derivarlas):

| Área | Tablas ausentes | Destino que quedaría sin fuente |
|---|---|---|
| **Años anteriores** | `MOV02` … `MOV18` | `documento_lineas` de períodos previos. **Solo hay MOV00 y MOV01** |
| **Lotes** | `MC<lote>` (26 nombres) | `lotes`, `lote_lineas` (P08). Pueden ser estructuras de trabajo creadas a demanda — los nombres del diccionario (`MCDDD`, `MCAAAA`) lo sugieren — pero **hay que confirmarlo**: de ellas depende el detalle de los lotes pendientes |
| **Impuestos** | `CONRET`, `CONIVA`, `CONTIRET`, `CONTIIVA` | `acumulados_retencion`, `acumulados_iva`, `conceptos_retencion`, `tarifas_iva` (B03, P16, P17) |
| **Seguridad y auditoría** | `VISUSU`, `CONOPER`, `VISAUDI` | `usuarios`, `roles`, `permisos`, `auditoria` (B14, P28). Los documentos sitúan `VISAUDI` en `C:\VISADS\VISAUDI.ADT`, **fuera** de este diccionario |
| **Activos y amortizaciones** | `AFIART`, `AFITAB`, `AFITAB2`, `AMORART`, `AMORTAB`, `AMORTAB2` | `activos`, `activo_cuotas`, `activo_reglas_contables`, `activo_distribuciones` (B10, P24) |
| **Exógena** | `CONMAG1/2/3`, `CONMAGIT`, `CONMAGDT` | `formatos_exogenos` y derivados (B12, P19, P20) |
| **Formatos documentales** | `CONGENF`, `CONFORMA`, `CONFACTU` | `formatos_documentales`, `formato_elementos` (B12, P21) |
| **Declaraciones y ajustes** | `CONDECLA`, `CONAJUS` | `renglones_renta` (P18), reglas de ajuste (P22) |
| **Reembolsos** | `CONREMAE`, `CONREITE` | `reembolsos`, `reembolso_lineas` (B10, P12) |
| **Presupuesto** | `TIDPRESU` | `presupuestos`, `presupuesto_rubros`, `presupuesto_valores` (B13, P29) |
| **Consolidación** | `CONSOLID` | `consolidaciones`, `consolidacion_origenes` (P27) |
| **Informes y selecciones** | `CONINF1`, `CONMAE2`, `CONCECO2`, `INFORMES`, `POSINFOR` | definiciones de informe y selecciones por usuario (B12, P15) |
| **Terceros: bancos y catálogos** | `FADCTAS`, `VISTDOC`, `CIUDAD`, `ACTIVIDA` | `tercero_cuentas_bancarias` (P06) y catálogos codificados (B11, P05) |
| **Detalle de documentos** | `CONTIDOC` | segunda parte de `tipos_documento`/plantillas (P04) |
| **Otros módulos (23 dependencias)** | `CAD*`, `COM*`, `FAD*`, `TID*`, `XAD*`, `NOMCALEN`, `VEDVEN`, `VISBODE`, `EVENTOS`, `FAESPERA`… | `integraciones` (P30) — decisión de integración o réplica pendiente |

## 6. Qué hay que pedir para una migración completa

1. **Copia íntegra del diccionario en uso**, no una muestra: las 139 tablas, con
   **todos los años** (`MOV00`…`MOV18`) y los `.ai`/`.am` de cada una.
2. **Confirmación de empresas y años**: `CONEMP` de la copia dirá cuántas
   contabilidades hay; el legado guardaba una carpeta por empresa
   (`C:\VISION20\CONTAB\001\`), y aquí hay **una sola** carpeta sin identificar.
3. **`VISAUDI` y `VISUSU`** (bitácora y usuarios), que viven fuera del
   diccionario contable.
4. **Los archivos referenciados por rutas documentales** (`XADPDF` y anexos):
   una ruta guardada no devuelve el archivo (regla 6.4 del plan maestro).
5. **Credenciales de solo lectura** del diccionario y **ventana** para tomar la
   instantánea.

## 7. Conclusión del inventario

`ADD_CONTAB` es **suficiente para el piloto del núcleo** (empresas, cuentas,
terceros, centros, comprobantes, tipos documentales, documentos y movimientos de
MOV00/MOV01) y **no lo es para el resto del modelo**. Antes de dimensionar el
ETL conviene cerrar la lista de la sección 6; mientras tanto, el piloto se puede
montar con lo que hay y sirve para validar transformaciones, conciliaciones y el
contrato del cargador.

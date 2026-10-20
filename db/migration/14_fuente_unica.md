# Fuente única del legado: `db/ADD_CONTAB`

Decisión: **se conserva una sola copia de la base Advantage** para pruebas y
verificación, la enriquecida de ~11 GB en `db/ADD_CONTAB/`. La copia reducida de
~3,4 GB que vivía en la raíz del repositorio (`ADD_CONTAB/`) se eliminó del disco
el 2026-10-20.

## 1. Por qué se eliminó la copia reducida

Se comparó el **contenido** de las dos copias (hash blake2b de 8 bytes por
registro completo, no sólo conteos) y la copia nueva resultó ser superconjunto
estricto de la reducida:

| Tabla | Filas copia vieja | Filas copia nueva | Registros exclusivos de la vieja |
|---|---:|---:|---:|
| `MOV00` | 768.904 | 2.017.444 | **0** |
| `MOV01` | 4.280.033 | 13.131.965 | **0** |
| `CONDOCUM` | 735.976 | 1.287.466 | **0** |
| `CONCECOS` | 222 | 449 | **0** |
| `FADCLI` | 126.009 | 126.011 | **0** |
| `CONPUC` | 2.633 | 2.633 | **0** |
| `CONTICOM` / `TIDEAN` | 28 / 6 | 28 / 6 | **0** |
| `CONEMP` | 27 | 27 | **0** |
| `CONLOTES` | 0 | 900 | — |
| `CONTERCE` | 765.754 | 765.759 | **0 claves** |
| `CONMAE` | 4.061 | 8.221 | **0 claves** |
| `COCENTRO` | 2.432.688 | 2.432.693 | 1 |
| `CATALOGO2`, `P_A_100_50`, `P_A_102_50` | 0 | 0 | — |

Notas de lectura:

- En `CONTERCE` y `CONMAE` no falta ninguna clave de negocio
  (`CIA + cuenta [+ NIT]`). Las filas que difieren cambian **sólo** las columnas
  acumuladoras mensuales `MACMDEBnn` / `MACMCREnn`, es decir, son la misma fila
  actualizada, no un registro complementario.
- `CONCTR` (control de operación) tiene una fila en cada copia y difiere: la
  nueva apunta a la compañía **2026** con períodos abiertos; la vieja, a 2025.
  Es estado corriente, no historia.
- Los `.adi` (índices) difieren porque se reconstruyen; el dato autoritativo es
  el `.adt`. `PUBLIDATA.add` difiere porque el diccionario nuevo declara 25
  tablas más.

Conclusión: **no había nada que fusionar**. Una unión de las dos bases habría
duplicado 4,28 M de renglones y 1,54 M de documentos. La copia vieja era una
foto parcial (sólo compañía 27) del mismo servidor, dos días anterior.

## 2. Qué aporta la copia conservada

- Compañía **26** completa (`COMERCIALIZADORA MERCALDAS PRUEBAS`, año 2024):
  1.248.540 documentos y 8.851.924 renglones, más 227 centros de costo y 4.160
  cuentas con saldo.
- Compañía 27: la misma historia que la copia vieja, más 8 renglones, 5 terceros,
  900 lotes pendientes (`HDOA`), 2 clientes y 48 `VISDOCUM`.
- 25 tablas de módulos satélite: pedidos (`PED*`), facturación/delivery (`FAD*`),
  visitas y rutas (`VISBODE`, `RUTA*`), vendedores (`VED*`), cotizaciones
  (`COT*`), informes (`CONINF1`, `CONRE*`) y consecutivos por sucursal/bodega
  (`TIDBODE`, `TIDDIA`, `TIDMES`, `TIDSUCUR`, `TIDTAB`).

## 3. Cambios de formato que introduce el diccionario nuevo

`PUBLIDATA.add` pasó de 20 a 45 tablas y de 888 a 1.599 campos. En las tablas
que ya se migraban hay dos cambios estructurales:

- **`TIDSAL`**: 273 → 296 campos. Entran `INSUC`, `INBODEGA`, `INCATECO` y una
  familia `S01..Sxx` (multibodega/multisucursal); salen `INCOSNIIF`,
  `INSALNIIF`, `INVALNIIF`, `INROTNIIF`, `INCANNIIF` y `NIFCOSTO00`.
- **`VISDOCUM`**: 89 → 88 campos. Salen `NOIMP` e `ID`, entra `SUC`.

Ninguno de los dos afecta al cargador del núcleo: `TIDSAL` está declarada fuera
del núcleo (réplica comercial, sin equivalente contable) y `cargar.py` no usa
`NOIMP` ni `ID` de `VISDOCUM`.

## 4. Consecuencias operativas

- `db/migration/extractor/catalogo_publidata.json` se regeneró desde el
  diccionario nuevo: ahora describe **45 tablas / 1.599 campos**. Con el catálogo
  anterior, el extractor omitía `TIDSAL` y `VISDOCUM` por no cuadrar el registro.
- Las rutas por defecto de `decodificar_adt.py`, `leer_diccionario.py`,
  `homologacion/contrato_campos.py` y `dev.js` apuntan a `db/ADD_CONTAB`.
- `/db/ADD_CONTAB/` está en `.gitignore` (son 11 GB de datos del cliente). La
  regla `/ADD_CONTAB` de la raíz quedó sin efecto y se conserva por si vuelve a
  copiarse una carpeta suelta.
- La base PostgreSQL ya migrada (`contabdsi_datos`) **no se toca**: sigue
  correspondiendo a la compañía 27 con la foto del 21-sep. Cargar la compañía 26
  sería una decisión de alcance distinta (multi-compañía) y no se tomó aquí.

## 5. Estado de las etapas

Sin cambios respecto a [`13_informe_final.md`](13_informe_final.md). Este
documento sólo cambia **dónde vive la fuente**, no el modelo ni los datos ya
cargados.

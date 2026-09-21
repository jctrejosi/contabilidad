# Extractor del legado (`ADD_CONTAB/`)

Pieza de la **fase 5** del plan de migración («Extractor y staging», ver
[`../03_plan_de_carga.md`](../03_plan_de_carga.md) §3): leer las tablas del
legado directamente de los archivos, sin depender del motor de Advantage, y
dejar un manifiesto reproducible.

> **El método probado no es leer los archivos.** El formato `.adt`/`.add` es
> propietario y el driver solo existe para Windows. En el proyecto hermano
> (`ecommerce/db/`) se resolvió **exportando a CSV desde la máquina Windows con
> el driver ODBC de Advantage** y cargando ese CSV en PostgreSQL; sus scripts lo
> documentan (`scripts/ads-local.sh` y `adt-reader/export-publidata.ps1`).
> Ver §3 y §4.

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

## 3. Método real: exportar por ODBC en Windows (no parsear los archivos)

Leer los `.adt`/`.add` sin el motor está descartado, y no por falta de voluntad:
el formato es propietario y el driver ODBC solo existe para Windows. En
`ecommerce/db/` ya se recorrió ese camino y quedó documentado:

| Evidencia en `ecommerce/db/` | Qué dice |
|---|---|
| `scripts/ads-local.sh` | «Ese formato es propietario de SAP/Sybase (producto descontinuado): **NO se puede leer sin el motor ADS**. El driver ODBC de Advantage solo existe para Windows» |
| `adt-reader/upload-addt.py` | No lee nada: **sube** `db/ADDT` por SMB a la máquina Windows (el log quedó en `VENTAS.ADT` al 4.8 %, ETA 7 h 43 min) |
| `adt-reader/export-publidata.ps1` | El extractor real: PowerShell en Windows, `Driver={Advantage ODBC Driver}` + `ServerTypes=ADS_LOCAL_SERVER` → CSV |
| `ads/README.md` | El ADS en Docker quedó «pendiente del instalador»: descontinuado y sin fuente pública |

De ese mismo repo salen los **datos de conexión del diccionario**: `UID=AdsSys`,
`PWD=Pubdata`, y la ruta `C:\VISADS_25\ADD\Publidata.add`.

Por eso el extractor de contabilidad es [`export_ads_to_csv.ps1`](export_ads_to_csv.ps1):
exporta cada tabla a CSV y deja un manifiesto con filas, bytes y SHA-256. Se
ejecuta **en la máquina Windows con ADS**, no en este equipo.

Lo que sigue abierto y hay que resolver **con datos**, no por suposición:

1. **Qué contiene el diccionario.** El listado de `C:\VISADS_25\ADD` que tenemos
   es el de POS/inventario (`TID*`, `TEM*`, `PROVEE`, `VISBODE`…): **no aparecen
   `CONMAE`, `MOV00/01`, `CONEMP` ni `CONCTR`**. Hay que ubicar las tablas
   contables en esa máquina. Para eso el script tiene `-Mode List`.
2. **Campos MEMO**: `FADCLI` (161 MB) tiene `.adm`; por ODBC el motor resuelve el
   memo, pero hay que comprobar que el CSV traiga el texto completo.
3. **Fechas y lógicos**: el CSV sale como texto; la conversión (`AAAAMMDD`,
   `LOGICAL`) se decide en la carga, con datos a la vista.
4. **Codificación**: `SELECT *` por ODBC entrega ya decodificado; verificar
   tildes y `ñ` en el CSV antes de cargar.
5. **Las 5 tablas sin catálogo** (`CATALOGO2`, `CONLOTES`, `TIDEAN`, `P_A_*`): el
   CSV trae sus columnas, así que el catálogo se completa desde ahí.

## 4. Qué necesitamos de la máquina con ADS

1. **Confirmar dónde están las tablas contables** en esa máquina
   (`C:\VISADS_25\CONTAB\`? ¿el `ADD_CONTAB` del repo salió de ahí?).
2. **Poder ejecutar el script allí**: primero `-Mode List` (segundos, sin datos)
   y después `-Mode Export`. Si el driver instalado es
   `Advantage StreamlineSQL ODBC` (el que usa el backend) en lugar de
   `Advantage ODBC Driver`, se pasa con `-Driver`.
3. **Traer de vuelta los CSV + `manifiesto.json`**, no los `.adt`: así el
   manifiesto viaja con los datos y la carga se concilia sin el motor.

## 5. Contrato que debe cumplir el extractor

Del §8 del plan maestro, aplicado aquí:

- **Solo lectura** sobre `ADD_CONTAB/` (no se toca ni se reorganiza el origen).
- **Salida cruda a staging** (CSV/JSONL), sin transformar: la homologación va
  después, en la carga.
- **Manifiesto por archivo**: ruta, tabla, empresa/año, tamaño, hash SHA-256,
  número de registros leídos y descartados.
- **Rechazos explícitos** con causa (registro marcado como borrado, fecha
  inválida, longitud inesperada), nunca sustituidos por valores por defecto.
- **Reproducible e idempotente**: repetir la extracción produce los mismos
  conteos y hashes.
- **Reanudable** por tabla, con puntos de control (importante en `MOV01`:
  1.16 GB).

## 6. Orden sugerido

| Paso | Tabla | Por qué |
|---:|---|---|
| 1 | `CONEMP` | 4 KB, 6 campos: valida el decodificador completo (incluido `LOGICAL`) |
| 2 | `CONCTR`/`CONCECOS`/`VISDOCUM`/`CONTICOM`/`CONPUC` | Catálogos pequeños, sin memo |
| 3 | `CONMAE` (1.9 MB) | Muchas filas, sin memo: prueba de rendimiento |
| 4 | `CONTERCE`, `COCENTRO` | Grandes y derivables (solo como instantánea de conciliación) |
| 5 | `CONDOCUM`, `MOV00`, `MOV01` | El libro: 1.16 GB + 358 MB de índice, con memo y fechas |
| 6 | `FADCLI` | 161 MB con `.adm`: ejercita los MEMO |
| 7 | `TIDSAL`, `CATALOGO2`, `CONLOTES`, `TIDEAN`, `P_A_*` | Sin catálogo en el diccionario; requieren leer el `.add` |

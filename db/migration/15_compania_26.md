# Carga de la compañía 26 (contabilidad 2026)

Fecha: 2026-10-21. Fuente: `db/ADD_CONTAB/` (la copia enriquecida de ~11 GB,
45 tablas y 24.896.272 filas). Objetivo: que la base buena tenga **todos** los
datos contables de esa copia, no sólo la compañía 27.

## 1. Respaldos

**Antes** de escribir nada se generó un respaldo con el estado validado de la
migración (740.689 documentos · 5.043.942 renglones · 125.993 terceros):

```bash
DATABASE_URL=postgres://contabdsi:contabdsi@127.0.0.1:5434/contabdsi_datos \
  node dev.js --backup
```

Quedó como `db/backups/partes/contabdsi_datos_20261021.dump.part00|01`
(126.962.562 bytes, SHA-256 `0c1fe268…`; hoy está en el historial de git y como
`.dump` completo en `db/backups/contabdsi_datos_pre26_20261021.dump`, ignorado por
git). Las partes se verificaron uniéndolas de nuevo y con `pg_restore -l`
(609 entradas TOC, 65 tablas con datos).

**Después** de la carga se generó el respaldo vigente, ya con la compañía 26
(1.296.376 documentos · 15.136.640 renglones · 125.995 terceros):

```bash
DATABASE_URL=postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos \
  node dev.js --backup
```

`contabdsi_datos_20261022.dump.part00…04` (312.102.488 bytes, SHA-256
`ac7d3ddb…`), verificado uniendo las partes (hash idéntico al manifiesto) y con
`pg_restore -l` (620 entradas TOC, 65 tablas con datos). Es el respaldo que
describe `db/backups/partes/README.md`.

## 2. Qué faltaba

| Bloque | Filas en el origen | Estado previo |
|---|---:|---|
| Núcleo de la compañía **27** (2025) | ~5,9 M | cargado y conciliado |
| Núcleo de la compañía **26** | 10,100,464 movimientos + 551,488 cabeceras | **ausente** |
| Lotes pendientes (`CONLOTES`/`CONMOVI`) | 904 | ausente |
| Inventario y comercial (`TID*`, `PED*`, `FAD*`, `VIS*`, `VED*`, `RUTA*`, `COT*`) | ~5,1 M | fuera del dominio contable |

Esta carga cubre el **núcleo de la compañía 26**. Los lotes pendientes y los
módulos de inventario/comercial quedan fuera (ver §8).

## 3. Hallazgo: la 26 es la contabilidad de 2026

`CONEMP` rotula la fila 26 como `COMERCIALIZADORA MERCALDAS PRUEBAS`, año 2024 y
`HABILITA='F'`. Sus tablas dicen otra cosa:

- `MOV00` (26): 1.248.540 filas, **2025·12** (apertura).
- `MOV01` (26): 8.851.924 filas, **2026·01…09**.
- `TFECHA` de las primeras filas: `20260102`.
- `CONMAE` (26): acumuladores con valores en los meses 01…09.

Es decir, la 26 es la contabilidad **2026** (la que abrió `CONCTR`, que apunta a
`…AÑO 2026` con períodos 00–10 habilitados). La 27 es 2025. El rótulo de
`CONEMP` está desactualizado, no la data.

## 4. Decisión de modelo: una compañía, dos años

`companias` tiene `UNIQUE (nit, digito)` y las dos contabilidades son la misma
razón social (NIT 900273686). El diseño ya documentado en
[`README.md`](README.md#L179-L187) lo dice: **una fila en `companias` y los años
en `compania_anios`**. Cargar la 26 como compañía nueva habría exigido romper esa
restricción y duplicar el NIT.

Por eso el cargador estrena dos parámetros:

- `--compania 26`: qué contabilidad del legado se lee (filtra el staging).
- `--codigo-destino 27`: sobre qué compañía de PostgreSQL se escribe.

Resultado: `companias` sigue con una fila y `compania_anios` queda en
**2025, 2026**. No se toca el nombre ni el estado de la compañía existente.

## 5. Staging por compañía

El cargador copia los CSV a tablas temporales y resuelve claves por compañía;
no filtra por `CIA`. En vez de reescribir ese camino ya verificado, se parte el
staging:

```bash
python db/migration/cargador/dividir_por_compania.py \
  --origen db/migration/staging/completa \
  --destino db/migration/staging/cia26 --compania 26
```

- Filtra por `CIA`/`CONCIA`: `CONCECOS`, `CONMAE`, `CONDOCUM`, `MOV00`, `MOV01`.
- No filtra: `CONEMP` (el cargador busca su fila), `FADCLI` y `VISDOCUM` (no
  traen compañía), y `CONTICOM` (ver §6.1).
- `CONCTR`: sólo se copia para la compañía de control (27). Para la 26 queda
  sólo cabecera, porque el legado no guarda parámetros por contabilidad.
- Genera un `manifiesto.json` propio con años, períodos y hashes de los CSV
  filtrados, que es lo que consume el cargador.

## 6. Decisiones de mapeo

1. **`CONTICOM` es de la instalación, no de la compañía.** La copia sólo trae los
   28 comprobantes de la 27, pero los documentos de la 26 usan 25 de esos mismos
   códigos (`00`–`26` y `50`). Se copia el catálogo entero; filtrarlo habría
   rechazado las 551.488 cabeceras por «sin comprobante».
2. **`CONCTR` no tiene fila de la 26.** No se inventan parámetros de operación
   para 2026: `parametros_operacion` queda sin fila de ese año y la conciliación
   lo reporta. La pantalla de parámetros de 2026 habrá que capturarla.
3. **Tipos documentales.** `VISDOCUM` es compartido (175 códigos). Los documentos
   de la 26 usan 64 códigos que no están ahí; `documentos.tipo_documento_id` es
   `NULL`-able, así que quedan sin tipo en vez de rechazarse o inventarse.
4. **65 cabeceras rechazadas**: 64 con `DCOMPRO` vacío y 1 con `JU`, códigos que
   no existen en `CONTICOM` y que `documentos.comprobante_id` no admite nulos.
   Quedan en `migracion_filas` con su causa.
5. **4.264 cabeceras sintéticas** (`legado.SINTETICA=true`) para los renglones
   con valor que no tienen cabecera en `CONDOCUM`, con el mismo criterio de la
   etapa B.
6. **7.766 renglones rechazados** (valor cero o sin mapeo a cuenta/comprobante),
   registrados con causa.

## 7. Resultados

| Medición | Antes | Después |
|---|---:|---:|
| `documentos` | 740.689 | **1.296.376** |
| `documento_lineas` | 5.043.942 | **15.136.640** |
| `compania_anios` | 2025 | **2025, 2026** |
| `cuentas` | 4.046 | 4.156 |
| `centros_costos` | 222 | 227 |
| `terceros` | 125.993 | 125.995 |
| `consecutivos_comprobantes` | 79 | 183 (104 nuevos) |

Del libro de la 26: 551.423 cabeceras reales + 4.264 sintéticas = 555.687
documentos nuevos, y 10.092.698 renglones nuevos. El cuadre interno del cargador
cerró exacto en ambas tablas.

Débitos y créditos del libro completo: 9.949.656.676.397,38 / …397,03 (la
diferencia de 0,35 es del propio origen).

### Conciliación (`saldos_cuenta` vs libro)

Global: 9.430 de 9.638 pares cuadran. Por año:

| Año | Pares | Cuadran | Comentario |
|---|---:|---:|---|
| 2025 | 3.555 | 3.385 | el cierre 2025·12 de la 26 entra en el año 2025 y no está en la instantánea de la 27 |
| 2026 | 6.083 | 6.045 | 38 pares con diferencia **del propio origen** |

La diferencia de 2026 está verificada contra los CSV, no es de la carga. Ejemplo,
cuenta `110505913`, período 09:

- `CONMAE` (instantánea): `MACMDEB09` = 1.111.127.673,00.
- `MOV01` (movimientos): suma de débitos = 1.339.589.408,00.
- La base reproduce **exactamente** ambos valores.

Por eso la entidad `conciliacion` admite `--tolerar-conciliacion`, que reporta la
diferencia y no aborta una carga ya verificada por entidad. El modo estricto
sigue siendo el de omisión.

## 8. Lo que no se migró (y por qué)

- **Inventario**: `TIDMES` (5.018.868), `TIDDIA` (50.058), `TIDSAL` (51.938),
  `TIDBODE`, `TIDSUCUR`, `TIDTAB`, `TIDEAN`. Es el kárdex y su configuración; no
  tiene destino en el modelo contable.
- **Comercial**: `PED*` (pedidos), `FAD*` (delivery/facturación), `VIS*`
  (visitas), `VED*` (vendedores), `RUTA*`, `COT*`, `CONINF1`/`CONRE*`. Su modelo
  vive en el proyecto ecommerce.
- **`COCENTRO`/`CONTERCE`**: acumulados de cierre del legado; el modelo los
  deriva del libro (`regenerar_acumulados`) y mezclarlos con la instantánea
  daría totales inconsistentes.
- **Lotes pendientes** (`CONLOTES`: 3 lotes de 300 líneas, `HDOA`/`IMP1`/`JUAN`):
  no se cargaron. El cargador no tiene entidad de lotes; es trabajo en curso, no
  historia.

## 9. Incidencias operativas

- **Disco.** La carga del libro necesita ~8 GB libres (tablas temporales de 10 M
  de renglones). Se liberaron cachés regenerables (`~/.cache/pip`, `yarn`,
  `puppeteer`, `chromium`, `~/.npm`) y se borró el `.dump` completo del respaldo.
  `db_new/data` (2,6 GB) **no** se pudo borrar: pertenece al usuario `advantage`.
  Es otra copia de la instantánea vieja (735.976 / 768.904 / 4.280.033).
- **`dev.js` y el puerto.** `dev.js` prefería el contenedor `contabdsi-db` cuando
  estaba arriba e **ignoraba el host/puerto de `DATABASE_URL`** para comprobar la
  base. Con el clúster local en 5434, `dev.js` no vio `contabdsi_datos`, creó una
  base vacía y restauró el respaldo **dentro del contenedor**. No hubo pérdida:
  el clúster local quedó intacto y después se volcó la base cargada y se restauró
  en el contenedor (1.296.376 documentos). **Corregido**: `dbCommandsInContainer(url)`
  sólo usa el contenedor si la URL apunta a su puerto publicado (5433) en un host
  local; con cualquier otra URL usan el cliente del anfitrión.
- **Balance por año.** `postgres_repository.build_trial_balance` exigía que el
  año pedido fuera el de `parametros_operacion.anio_operacion` (2025) y
  respondía «CONMAE contiene los acumulados del ejercicio 2025». Ahora comprueba
  que existan `saldos_cuenta` de ese año y, si no, informa los años cargados.
  Verificado: 2025 → 177 líneas, 2026 → 174, 2024 → error explicativo.

## 10. Verificación final

Con `node dev.js --db-postgres` y `DATABASE_URL=…/contabdsi_datos` (contenedor,
5433). Repetido el 2026-10-22 tras corregir la precedencia de `dev.js` y
generar el respaldo nuevo:

```
GET /api/health                                             200  store=postgres
GET /api/companias                                          200  anios=[2025,2026]
GET /api/informes/balance-comprobacion?cia=027&anio=2025&mesHasta=12  200  177 filas
GET /api/informes/balance-comprobacion?cia=027&anio=2026&mesHasta=12  200  174 filas
GET /api/documentos?cia=027&periodo=2026-01                 200  con datos
GET /api/terceros?cia=027                                   200  con datos
GET / (interfaz web, 8448)                                  200
```

`cia`, `anio` y `mesHasta` son obligatorios en el balance. En documentos sólo
`cia` es obligatorio; `page`, `pageSize`, `periodo`, `comprobante`,
`tipoDocumento`, `nit`, `fechaDesde` y `fechaHasta` son opcionales, pero exige
al menos un filtro.

La precedencia nueva de `dev.js` se probó con una URL a un puerto sin base
(5999): avisa «no existe o no tiene esquema» y **no** toca el contenedor ni las
partes del respaldo (antes habría volcado la base del contenedor).

## 11. Pendiente

1. Parámetros de operación de 2026 (`parametros_operacion`): el legado no los
   tiene; hay que capturarlos en la aplicación.
2. Decidir si se cargan los 3 lotes pendientes y si se quiere registrar la
   copia de inventario/comercial (fuera de esta base).
3. ~~Corregir en `dev.js` la precedencia contenedor vs `DATABASE_URL`.~~ Hecho:
   `dbCommandsInContainer(url)` usa el contenedor sólo si la URL apunta al puerto
   que éste publica (por omisión 5433) en un host local. Con la base buena en
   5433 el camino no cambia; con una URL a 5434 u otro host ya no opera sobre la
   instancia equivocada.
4. ~~Generar un respaldo nuevo con los datos ya cargados.~~ Hecho (ver §1).
5. Liberar espacio: `db/postgresql/.pgdata` (7,1 GB, el clúster temporal en 5434)
   sigue con la misma carga. La base de referencia es el contenedor (5433); el
   clúster puede apagarse o borrarse cuando se confirme que no se necesita para
   rehacer la carga.

# Cargador del staging a PostgreSQL

Carga en el modelo nuevo los CSV que dejó
[`../extractor/`](../extractor/README.md), siguiendo el contrato campo → destino
de [`../homologacion/reglas.py`](../homologacion/reglas.py). El detalle de cada
campo está en [`../06_referencia_campos.md`](../06_referencia_campos.md).

```bash
python db/migration/cargador/cargar.py --listar      # orden de carga
python db/migration/cargador/cargar.py --simulacion  # ensaya sin escribir
python db/migration/cargador/cargar.py --hasta cuentas
python db/migration/cargador/cargar.py --entidad terceros
python db/migration/cargador/cargar.py               # todo
```

Con el intérprete del backend, que es el que tiene `psycopg`:

```bash
backend/.venv/Scripts/python.exe db/migration/cargador/cargar.py --url "postgres://..."
```

## 1. La base tiene que estar **sin el seed**

`db/postgresql/docker-compose.yml` y `scripts/up.sh` cargan `seed.sql`, que trae
una compañía de demostración (`001 · Compañía Demo S.A.S.`) con sus propios
comprobantes `00`–`04`. Cargar la migración encima **mezclarías dos contabilidades
distintas**: el cargador lo detecta y se niega.

Para una base limpia, se crea al vuelo desde los mismos archivos del esquema:

```bash
docker exec contabdsi-db createdb -U contabdsi contabdsi_datos
cd db/postgresql
for f in schema/*.sql funciones.sql; do
  docker exec -i contabdsi-db psql -U contabdsi -d contabdsi_datos -v ON_ERROR_STOP=1 -q -f - < "$f"
done
```

Y se carga ahí:

```bash
backend/.venv/Scripts/python.exe db/migration/cargador/cargar.py \
  --url "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos"
```

La base `contabdsi` (con seed) se sigue usando para el backend y para
`scripts/validate.sql`. Son dos cosas distintas: **la de desarrollo** y **la de la
migración**.

## 2. Qué hace y qué garantiza

| Propiedad | Cómo |
|---|---|
| **Idempotente** | Claves naturales del destino (`UNIQUE`) con `ON CONFLICT DO NOTHING`, más `idempotency_key` en documentos. Comprobado en la corrida real: repetir `--entidad libro` deja 0 filas nuevas, los mismos 735.762 documentos y 5.025.890 renglones, y las mismas sumas (débitos 4.174.358.551.269,84; créditos 4.174.358.551.269,96) — verificado |
| **Reanudable** | Una transacción por entidad; `--entidad` y `--hasta` para reanudar donde quedó |
| **Trazable** | `migracion_ejecuciones` (con huella del staging + del contrato), `migracion_archivos` por CSV, `migracion_filas` por renglón excluido/fusionado y `migracion_ajustes` por cada valor que la carga cambió |
| **Sin inventar** | Lo que no encaja se marca `Excluido`, `Fusionado` o `Rechazado` con la causa escrita; nada se sustituye por un valor por defecto |
| **Sin escribir en simulación** | `--simulacion` descarta la transacción; la conexión va sin `autocommit` justamente para eso. En la entidad del libro la simulación **no** registra las excepciones ni comprueba los cierres de cuadre: sin archivos de migración no hay `migracion_filas.archivo_id`, que es obligatorio. La simulación comprueba el cargue, no la trazabilidad |

## 3. Orden de carga

El del §3 del [plan](../03_plan_de_carga.md):

| # | Entidad | Origen | Destino |
|---:|---|---|---|
| 1 | `companias` | `CONEMP` | `companias`, `compania_anios` |
| 2 | `periodos` | `MOV00`/`MOV01` (manifiesto) | `periodos_contables` |
| 3 | `parametros` | `CONCTR` | `parametros_operacion`, `parametros_nomina` |
| 4 | `comprobantes` | `CONTICOM` | `comprobantes` |
| 5 | `centros` | `CONCECOS` | `centros_costos` |
| 6 | `cuentas` | `CONMAE` | `cuentas`, `saldos_cuenta` |
| 7 | `terceros` | `FADCLI` | `terceros` |
| 8 | `tipos_documento` | `VISDOCUM` | `tipos_documento`, `plantillas_contables`, `plantilla_lineas`, `tarifas_iva`, `conceptos_retencion` |
| 9 | `libro` | `CONDOCUM` + `MOV00`/`MOV01` | `documentos`, `documento_lineas` |
| 10 | `consecutivos` | `documentos` | `consecutivos_comprobantes` |
| 11 | `conciliacion` | `documento_lineas` vs `saldos_cuenta` | (comprueba; no escribe) |

Estado de la última corrida: `documentos` 735.762 (más 214 cabeceras rechazadas
con causa) y `documento_lineas` 5.025.890 (más 23.047 renglones rechazados con
causa: 18.551 sin cabecera en `CONDOCUM`, 4.496 con valor cero, 0 sin cuenta).
`consecutivos_comprobantes` quedó con 79 filas (una por comprobante y año),
fijadas desde `max(documentos.numero)` sin tocar la numeración histórica. Hay
3.197 claves con varias cabeceras candidatas, y su elección y motivo quedan
registrados en `migracion_filas`. Todo el detalle en
[`../07_decisiones_del_libro.md`](../07_decisiones_del_libro.md).

## 4. Decisiones de carga que conviene conocer

- **Sólo la contabilidad con datos.** `CONEMP` lista 27 contabilidades del mismo
  NIT; sólo una está habilitada (`" 27"`). Las otras 26 se registran como
  `Excluido` con su motivo. Sus años se repiten (2015 aparece dos veces: local y
  NIIF), así que cargarlas chocaría con `compania_anios_uk`.
- **Los períodos salen del manifiesto**, no de recorrer 5 millones de filas: el
  extractor ya contó año y período de cada tabla de movimiento.
- **`CONMAE` trae tres cosas mezcladas**; ver el docstring de `cargar_cuentas`.
  El plan (clases 1–7) se carga; los auxiliares por tercero se excluyen y se
  registran; los códigos repetidos se fusionan y se registran.
- **Fechas validadas de verdad.** `2023-02-30` pasa un `día <= 31` pero no existe:
  la fecha se carga vacía y el cambio queda en `migracion_ajustes`. Hay 2.972
  filas de `FADCLI` con ese problema.
- **`terceros.estado`** sólo admite `Activo`/`Bloqueado`: `CESTADO='1'` es activo y
  el resto bloqueado, como documenta `docs/TERCEROS_ADS.md`.
- **`tipos_documento.numeracion`** sólo admite `Manual`/`Automatica` (sin tilde).
- **El libro, y lo que las fichas anteriores decían de él.** La ficha del contrato
  describía `CONDOCUM.DVALOR` como un control de cuadre que se recalcula sumando
  `MOVxx`; **es falso**: la suma con signo de las partidas es cero por partida
  doble. `DVALOR` es el **total de débitos** y coincide con la suma de `TVALOR > 0`
  en 121.216 de 123.678 claves de una sola cabecera (98,0%). Donde decía «214
  cabeceras con `DCOMPRO` vacío» ahora dice **nulas o inexistentes** en
  `comprobantes` (son las que se rechazan con causa). La unión renglón-cabecera
  **omitía el tipo documental** y habría duplicado partidas; ahora lo incluye.
  `MOVxx.TIVA_RET` no es la clase del destino: se traduce `I` -> `IVA`,
  `R` -> `Retencion`, `O` -> `Otro`, vacío -> `''`. `TSEC` está vacía en las
  5.048.937 filas, así que `numero_linea` se numera con el orden físico
  (`_archivo`, `_loc`). Evidencia medida y alternativas descartadas en
  [`../07_decisiones_del_libro.md`](../07_decisiones_del_libro.md).
- **Rendimiento del libro.** La entidad pasó de no terminar (más de 30 minutos
  colgada) a unos 16 minutos; la de renglones sola, unos 10. Las causas y las
  correcciones están en
  [`../07_decisiones_del_libro.md`](../07_decisiones_del_libro.md) §8.

## 5. Lo que queda por hacer

| Tema | Detalle |
|---|---|
| **El libro: faltan `MOV02`..`MOV18`** | Ya está cargado y verificado: 735.762 documentos, 5.025.890 renglones y la conciliación en 3.355 de 3.355 pares con diferencia 0,00. Lo que no está en el origen son los períodos que la copia no trae: sin `MOV02`..`MOV18`, 615.290 documentos migrados quedan sin partidas |
| **Clases 8 y 9 de `CONMAE`** | 727 + 25 códigos de 9 dígitos con nombres de sucursal y departamento. Hoy se cargan como cuentas porque ocupan niveles válidos, pero podrían ser centros de costo. Hay que decidirlo con datos antes de usar informes por cuenta |
| **Auxiliares por tercero de 9 dígitos** | Los que colisionan con un código real se fusionan; los que no, entran como cuenta. Distinguirlos pide una regla mejor que «longitud = nivel» |
| **`terceros` sin `codigo_legado`** | 10.4 M de filas de `FADCLI` traen `CTIPOCLI` vacío y quedan como `Juridica` (el `DEFAULT` del destino). Si el negocio necesita `Natural`/`Juridica` fiable, hay que derivarlo |

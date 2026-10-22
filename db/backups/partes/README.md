# Respaldo de la base en partes (para viajar por git)

Aquí quedan las **partes** de un respaldo de `pg_dump` de la base PostgreSQL de
referencia (`contabdsi_datos`), partido para que cada archivo esté por debajo
del límite de 100 MiB por archivo de GitHub. El `.dump` completo está en
`db/backups/` y **sí** se ignora: solo esta carpeta se versiona.

> **Contiene datos reales de contabilidad** (NITs, razones sociales, cifras).
> El repositorio debe seguir siendo **privado**.

## Contenido

| Parte | Bytes | SHA256 del conjunto |
|---|---|---|
| `contabdsi_datos_20261022.dump.part00` | 63 481 282 | — |
| `contabdsi_datos_20261022.dump.part01` | 63 481 282 | — |
| `contabdsi_datos_20261022.dump.part02` | 63 481 282 | — |
| `contabdsi_datos_20261022.dump.part03` | 63 481 282 | — |
| `contabdsi_datos_20261022.dump.part04` | 58 177 360 | — |
| **Total unido** | **312 102 488** | `ac7d3ddbec63dc194cb0dc6614388245f542789bff18a951ace7150ad7e6bbe8` |
| `respaldo.json` | — | Manifiesto que consume `dev.js`: partes, peso y SHA-256 |

Origen: PostgreSQL 18.4, formato `pg_dump -Fc -Z6`. Dump tomado el 2026-10-22,
**después** de cargar la compañía 26 (contabilidad 2026):
`documentos` 1 296 376, `documento_lineas` 15 136 640 y `terceros` 125 995.
La unión de las partes se verificó contra el SHA-256 del manifiesto y el volcado
se comprobó con `pg_restore -l` (620 entradas, 65 tablas con datos).

El respaldo **previo** a esa carga (740 689 documentos · 5 043 942 renglones)
queda en el historial de git (commit anterior a este). En la máquina que lo generó
sigue como `.dump` completo en `db/backups/contabdsi_datos_pre26_20261021.dump`,
que git ignora.

## Montarlo en otro PC

Con el repositorio al día, **`dev.js` lo hace solo**:

```bash
node dev.js --db-postgres
```

Si la base de `DATABASE_URL` no existe o está vacía, une las partes, verifica el
SHA-256 del manifiesto y restaura. Nunca toca la base de demostración (`contabdsi`,
con seed) ni una base que ya tenga documentos. Para omitirlo: `--no-restore`.
Funciona con el contenedor de `db/postgresql/docker-compose.yml` (el caso de
Windows, que no puede usar `scripts/up.sh`) y también con un PostgreSQL del
anfitrión.

Si solo quieres **llenar la base** sin levantar los servicios, el mismo paso es un
comando suelto:

```bash
node dev.js --restore
```

A mano, si se prefiere:

```bash
# 1. Unir las partes (el orden importa: part00, part01, ...)
cat db/backups/partes/contabdsi_datos_20261022.dump.part* \
  > /tmp/contabdsi_datos_20261022.dump

# 2. Verificar que la unión es idéntica al original (debe imprimir el SHA256 de arriba)
sha256sum /tmp/contabdsi_datos_20261022.dump

# 3. Restaurar en la base del contenedor (ver db/postgresql/docker-compose.yml)
pg_restore -d "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos" \
  --clean --if-exists --no-owner --no-privileges /tmp/contabdsi_datos_20261022.dump
```

La base destino debe existir; `--clean --if-exists` sirve tanto si está recién
creada como si ya tiene el esquema.

## Regenerarlo

En el PC que **tiene** la base cargada, `dev.js` produce el respaldo completo
—volcado, corte en partes y manifiesto— sin depender de `bash` (sirve en Windows):

```bash
DATABASE_URL=postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos \
  node dev.js --backup
```

Deja el `.dump` completo en `db/backups/` (ignorado por git) y las partes con el
`respaldo.json` en `db/backups/partes/` (versionadas). Para publicarlo:

```bash
git add db/backups/partes
git commit -m "Actualiza el respaldo de la migración"
git push
```

El corte por archivo lo fija `BACKUP_CHUNK_BYTES` (por defecto 63 481 282 B, por
debajo del límite de 100 MiB de GitHub).

## Cómo se generó (receta manual)

`node dev.js --backup` equivale a esta receta:

```bash
pg_dump -Fc -Z6 -d "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos" \
  -f db/backups/contabdsi_datos_20261022.dump
split -b 63481282 -d db/backups/contabdsi_datos_20261022.dump \
  db/backups/partes/contabdsi_datos_20261022.dump.part
```

`-Z9` se probó y solo baja de 121 a 119 MiB (el grueso es la columna `legado`
JSONB, que ya comprime al máximo), así que no alcanza para un archivo único.

`dev.js` usa el contenedor sólo si `DATABASE_URL` apunta a la instancia que éste
publica (por omisión, `127.0.0.1:5433`). Si la URL apunta a otro host o puerto,
usa el cliente del anfitrión, para no volcar ni restaurar en la base equivocada.

**Nota:** una vez empujado, el respaldo queda en el historial de git. Quitarlo
después exige reescribir la historia y forzar el push; no basta con borrar los
archivos.

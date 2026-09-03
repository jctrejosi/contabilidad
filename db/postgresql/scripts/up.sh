#!/usr/bin/env bash
# =====================================================================
# CONTABDSI · up.sh
# Levanta un clúster PostgreSQL local EFÍMERO (sin root), carga el
# esquema, las funciones y los datos de demostración.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGDATA="$ROOT/.pgdata"
PGLOG="$ROOT/.pglog"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-contabdsi}"
DB="${DB:-contabdsi}"

export PATH="/usr/lib/postgresql/18/bin:$PATH"

# 1. Inicializar el clúster si no existe
if [ ! -d "$PGDATA" ]; then
  echo ">> Inicializando clúster en $PGDATA"
  initdb -D "$PGDATA" -U "$PGUSER" --auth=trust --encoding=UTF8 --no-locale >/dev/null
fi

# 2. Arrancar (idempotente)
if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo ">> Clúster ya en ejecución"
else
  echo ">> Arrancando PostgreSQL en puerto $PGPORT"
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $PGDATA" -l "$PGLOG" -w start >/dev/null
fi

# 3. Recrear base (carga limpia y determinista)
dropdb -h localhost -p "$PGPORT" -U "$PGUSER" --if-exists "$DB"
createdb -h localhost -p "$PGPORT" -U "$PGUSER" "$DB"

# 4. Cargar objetos
echo ">> Cargando esquema"
for f in "$ROOT"/schema/*.sql; do
  echo "   $(basename "$f")"
  psql -h localhost -p "$PGPORT" -U "$PGUSER" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo ">> Cargando funciones"
psql -h localhost -p "$PGPORT" -U "$PGUSER" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/funciones.sql"

echo ">> Cargando datos de demostración"
psql -h localhost -p "$PGPORT" -U "$PGUSER" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/seed.sql"

echo ">> Ejecutando validación"
psql -h localhost -p "$PGPORT" -U "$PGUSER" -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/validate.sql"

echo "✅ Base de datos lista: postgres://$PGUSER@localhost:$PGPORT/$DB"

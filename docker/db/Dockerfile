# Imagen de PostgreSQL de CONTABDSI.
#
# Incluye el esquema del modelo nuevo (db/postgresql/schema), las funciones
# contables (validar/contabilizar/anular/regenerar) y, opcionalmente, el seed
# de demostración.
#
# Los archivos se copian a /docker-entrypoint-initdb.d y PostgreSQL los ejecuta
# en orden alfabético SOLO cuando el volumen está vacío:
#   01_dominios … 16_consolidacion_homologacion
#   20_funciones.sql
#   30_seed.sql  (solo con WITH_SEED=true)
#
# Construir desde la raíz del repo (contexto: ..):
#   docker compose -f docker/docker-compose.yml --profile db build
FROM postgres:18

ARG WITH_SEED=false

COPY db/postgresql/schema/ /docker-entrypoint-initdb.d/
COPY db/postgresql/funciones.sql /tmp/funciones.sql
COPY db/postgresql/seed.sql /tmp/seed.sql

RUN cp /tmp/funciones.sql /docker-entrypoint-initdb.d/20_funciones.sql \
    && if [ "$WITH_SEED" = "true" ]; then \
         cp /tmp/seed.sql /docker-entrypoint-initdb.d/30_seed.sql; \
       fi \
    && rm -f /tmp/funciones.sql /tmp/seed.sql

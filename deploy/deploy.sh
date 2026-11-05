#!/usr/bin/env bash
# ============================================================
# Despliegue de CONTABDSI en srv-prod (Debian 12, Docker Engine).
#
# Uso:
#   bash deploy/deploy.sh                 # despliega origin/dev
#   bash deploy/deploy.sh origin/dev      # ref explícito
#   bash deploy/deploy.sh <sha>           # commit concreto
#
# La rama local se deduce del ref objetivo (origin/dev -> dev), así que el
# auto-despliegue por sondeo no deja el checkout en una rama equivocada.
#
# Lo usan el timer `jcti-autodeploy` y el operador. El checkout vive en
# /home/deploy/contabilidad y `docker/.env` NO está versionado: hay que
# crearlo una vez (ver docker/.env.example y el README del workspace).
#
# La base de datos va en el perfil `db` del compose (contenedor
# `contabdsi_postgres`, sin puertos publicados). Se levanta si no existe y NO
# se recrea en cada despliegue: los datos viven en el volumen `contabdsi_pgdata`.
# ============================================================
set -Eeuo pipefail

ROOT="${DEPLOY_PATH:-/home/deploy/contabilidad}"
TARGET="${1:-origin/${DEPLOY_BRANCH:-dev}}"

case "$TARGET" in
  origin/*) BRANCH="${TARGET#origin/}" ;;
  *)        BRANCH="${DEPLOY_BRANCH:-dev}" ;;
esac

COMPOSE_FILE="$ROOT/docker/docker-compose.yml"
ENV_FILE="$ROOT/docker/.env"
APP_CONTAINER="contabdsi_app"
DB_CONTAINER="contabdsi_postgres"
EDGE_CONTAINER="edge_caddy"
PUBLIC_HOST="${PUBLIC_HOST:-contabilidad.jcti.xyz}"
PUBLIC_URL="${PUBLIC_URL:-https://${PUBLIC_HOST}/}"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log()  { printf '[deploy %s] %s\n' "$(timestamp)" "$*"; }
warn() { printf '[deploy %s] AVISO: %s\n' "$(timestamp)" "$*" >&2; }
die()  { printf '[deploy %s] ERROR: %s\n' "$(timestamp)" "$*" >&2; exit 1; }

cd "$ROOT" 2>/dev/null || die "No existe DEPLOY_PATH=$ROOT"
[[ -f "$COMPOSE_FILE" ]] || die "Falta $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]]     || die "Falta docker/.env (créalo desde docker/.env.example)"
command -v git    >/dev/null || die "git no está instalado"
command -v docker >/dev/null || die "docker no está instalado"
docker info >/dev/null 2>&1 || die "Docker no responde (revisa systemctl status docker)"

GIT_SSH_KEY="${GIT_SSH_KEY:-/etc/mercaldas/deploy_key}"
if [[ -r "$GIT_SSH_KEY" ]]; then
  export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -i $GIT_SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new}"
fi

git_here() {
  git -c safe.directory="$ROOT" -c core.hooksPath=/nonexistent -C "$ROOT" "$@"
}

log "Repositorio: $ROOT"
log "Objetivo   : $TARGET"

git_here fetch --prune origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
git_here rev-parse --verify --quiet "$TARGET^{commit}" >/dev/null \
  || die "El ref '$TARGET' no existe tras el fetch"

# Checkout determinista: en producción no se editan archivos versionados.
# docker/.env está ignorado y se conserva.
git_here checkout -f -B "$BRANCH" "$TARGET"
COMMIT="$(git_here rev-parse --short=12 HEAD)"
log "Checkout en $BRANCH: $COMMIT — $(git_here log -1 --pretty=%s)"

COMPOSE=(docker compose --project-directory "$ROOT/docker" -f "$COMPOSE_FILE" --profile db)
"${COMPOSE[@]}" config --quiet \
  || die "docker compose config falló (revisa docker/docker-compose.yml y docker/.env)"

# ── Base de datos (solo si no existe; nunca se recrea a la ligera) ──────────
if docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  log "Base de datos: $DB_CONTAINER ya existe (no se recrea)."
else
  log "Base de datos: creando $DB_CONTAINER (volumen contabdsi_pgdata)…"
  "${COMPOSE[@]}" up -d db
fi

# El backend necesita la BD arriba desde el arranque (el initdb del volumen
# vacío aplica el esquema y las funciones).
log "Esperando healthcheck de $DB_CONTAINER…"
DB_STATUS=""
for _ in $(seq 1 60); do
  DB_STATUS="$(docker inspect -f \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$DB_CONTAINER" 2>/dev/null || true)"
  [[ "$DB_STATUS" == "healthy" ]] && break
  if [[ "$DB_STATUS" == "unhealthy" || "$DB_STATUS" == "exited" || "$DB_STATUS" == "dead" ]]; then
    docker logs --tail 100 "$DB_CONTAINER" 2>&1 || true
    die "La base de datos quedó en estado '$DB_STATUS'."
  fi
  sleep 2
done
[[ "$DB_STATUS" == "healthy" ]] \
  || die "La base de datos no llegó a healthy (último estado: '${DB_STATUS:-desconocido}')."

# ── Aplicación ─────────────────────────────────────────────────────────────
log "Construyendo imagen contabdsi/app:latest…"
"${COMPOSE[@]}" build app

log "Levantando/actualizando $APP_CONTAINER…"
"${COMPOSE[@]}" up -d --force-recreate --no-deps app

log "Esperando healthcheck de $APP_CONTAINER (hasta 5 min)…"
STATUS=""
for _ in $(seq 1 60); do
  STATUS="$(docker inspect -f \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$APP_CONTAINER" 2>/dev/null || true)"
  case "$STATUS" in
    healthy)
      log "Contenedor healthy."
      break
      ;;
    unhealthy|exited|dead)
      docker logs --tail 150 "$APP_CONTAINER" 2>&1 || true
      die "El contenedor quedó en estado '$STATUS'."
      ;;
  esac
  sleep 5
done

if [[ "$STATUS" != "healthy" ]]; then
  docker logs --tail 150 "$APP_CONTAINER" 2>&1 || true
  die "Timeout esperando healthy (último estado: '${STATUS:-desconocido}')."
fi

# ── Edge (infraestructura aparte en /home/deploy/edge) ─────────────────────
if docker inspect "$EDGE_CONTAINER" >/dev/null 2>&1; then
  if ! docker exec "$EDGE_CONTAINER" sh -c \
      'grep -qsF contabdsi_app /etc/caddy/sites/*.caddy' 2>/dev/null; then
    warn "Ningún archivo de /etc/caddy/sites/ del edge menciona $APP_CONTAINER."
    warn "Añade edge/sites/contabilidad.caddy en manager y ejecuta scripts/sync-edge.sh."
  fi
else
  warn "No existe $EDGE_CONTAINER: nadie publica 80/443."
fi

# ── Comprobación de punta a punta por el edge (TLS + routing) ──────────────
if command -v curl >/dev/null 2>&1 && docker inspect "$EDGE_CONTAINER" >/dev/null 2>&1; then
  if curl -fsS --max-time 20 --cacert /etc/mercaldas/edge-tls/origin.pem \
      --resolve "${PUBLIC_HOST}:443:127.0.0.1" "$PUBLIC_URL" >/dev/null 2>&1; then
    log "HTTPS público OK: $PUBLIC_URL"
  else
    warn "El contenedor está sano, pero $PUBLIC_URL no respondió por el edge."
    warn "Revisa DNS A → IP pública, edge/sites/contabilidad.caddy y logs de $EDGE_CONTAINER."
  fi
fi

"${COMPOSE[@]}" ps
log "Despliegue completado: $COMMIT"

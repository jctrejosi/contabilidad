#!/usr/bin/env bash
# Arranque del contenedor único de CONTABDSI:
#   1. backend FastAPI     → 127.0.0.1:${BACKEND_PORT:-8001}   (interno)
#   2. ia-service FastAPI  → 127.0.0.1:${IA_SERVICE_PORT:-8003} (interno)
#   3. Caddy               → :${HTTP_PORT:-8080} / :${HTTPS_PORT:-8443}
#
# Caddy sirve la SPA y proxya /api/* y /bot-api/*. El Caddyfile se genera en
# runtime desde variables de entorno (gen_caddyfile.py), así que cambiar el
# dominio no requiere rebuild.
set -euo pipefail
umask 027

BACKEND_PORT="${BACKEND_PORT:-8001}"
IA_SERVICE_PORT="${IA_SERVICE_PORT:-8003}"
HTTP_PORT="${HTTP_PORT:-8080}"
HTTPS_PORT="${HTTPS_PORT:-8443}"
export BACKEND_PORT IA_SERVICE_PORT HTTP_PORT HTTPS_PORT

# ── Salvaguardas de seguridad (fail-closed) ─────────────────

# TLS=false publica el sitio sin cifrar. Es válido SOLO detrás del edge
# compartido (que termina TLS); hay que aceptarlo explícitamente.
TLS_MODE="${TLS:-true}"
if [ "$TLS_MODE" = "false" ] && [ "${ALLOW_INSECURE:-false}" != "true" ]; then
  echo "✘ TLS=false publica el sitio SIN cifrar (credenciales y sesiones en claro)." >&2
  echo "  Si vas a ir detrás del edge compartido, arranca con ALLOW_INSECURE=true." >&2
  exit 1
fi
if [ "$TLS_MODE" = "false" ]; then
  echo "⚠️  TLS desactivado (ALLOW_INSECURE=true): el edge compartido debe terminar TLS." >&2
fi

# Basic Auth opcional: si se activa, sin credenciales no se arranca.
PROTECT_APP="${PROTECT_APP:-false}"
if [ "$PROTECT_APP" = "true" ] && [ -z "${APP_PASSWORD_HASH:-}" ] && [ -z "${APP_PASSWORD:-}" ]; then
  echo "✘ PROTECT_APP=true pero falta APP_PASSWORD o APP_PASSWORD_HASH." >&2
  echo "  Define una en docker/.env o pon PROTECT_APP=false." >&2
  exit 1
fi

# En Linux (contenedor) el backend NO puede usar Advantage/OLEDB: el proveedor
# es una DLL COM de Windows. Para operar de verdad hay que usar PostgreSQL.
STORE="${CONTABDSI_STORE:-postgres}"
if [ "$STORE" != "postgres" ]; then
  if [ "${ALLOW_ADS_IN_CONTAINER:-false}" != "true" ]; then
    echo "✘ CONTABDSI_STORE=${STORE}: Advantage (ADS/OLEDB) solo existe en Windows." >&2
    echo "  Usa CONTABDSI_STORE=postgres (modelo nuevo). Si solo quieres levantar" >&2
    echo "  la UI para una prueba, arranca con ALLOW_ADS_IN_CONTAINER=true." >&2
    exit 1
  fi
  echo "⚠️  CONTABDSI_STORE=${STORE}: ADS no funciona en Linux; los datos fallarán." >&2
fi
if [ "$STORE" = "postgres" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "✘ CONTABDSI_STORE=postgres pero falta DATABASE_URL." >&2
  echo "  Ejemplo (BD incluida en el compose):" >&2
  echo "  DATABASE_URL=postgres://contabdsi:CLAVE@db:5432/contabdsi" >&2
  exit 1
fi

# Fortuner27 autoriza el acceso (AccessGate). En Docker Desktop/Windows el
# host está en host.docker.internal; si Fortuner es un contenedor, apunta a su
# nombre de servicio. El backend debe poder alcanzarlo.
export FORTUNER_API_URL="${FORTUNER_API_URL:-http://host.docker.internal:8004}"

# El widget del asistente usa el mismo origen a través de Caddy; CORS solo se
# usa si alguien lo consume directamente.
if [ -z "${CORS_ORIGIN:-}" ] && [ -n "${HOST_APP:-}" ]; then
  CORS_ORIGIN="${PUBLIC_SCHEME:-https}://${HOST_APP}"
  export CORS_ORIGIN
fi

echo "==> CONTABDSI (contenedor único)"
echo "    backend :${BACKEND_PORT} · ia-service :${IA_SERVICE_PORT} · Caddy :${HTTP_PORT}/:${HTTPS_PORT}"
echo "    store=${STORE} · TLS=${TLS_MODE} · Fortuner=${FORTUNER_API_URL}"

python3 /app/gen_caddyfile.py
caddy fmt --overwrite "${CADDYFILE_OUT:-/config/Caddyfile.generated}"

# ── Backend FastAPI ─────────────────────────────────────────
cd /app
echo "==> backend: uvicorn (:${BACKEND_PORT})"
/opt/contab-venv/bin/python -m uvicorn backend.app:app \
  --host 127.0.0.1 --port "$BACKEND_PORT" &
BACKEND_PID=$!

# ── ia-service (asistente contable) ─────────────────────────
cd /app/ia-service
echo "==> ia-service: uvicorn (:${IA_SERVICE_PORT})"
/opt/ia-venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 --port "$IA_SERVICE_PORT" &
IA_PID=$!

# ── Caddy (SPA + reverse proxy) ─────────────────────────────
cd /app
echo "==> caddy: ${CADDYFILE_OUT:-/config/Caddyfile.generated}"
caddy run --config "${CADDYFILE_OUT:-/config/Caddyfile.generated}" --adapter caddyfile &
CADDY_PID=$!

# Si cualquiera muere, se detiene todo (el orquestador reinicia el contenedor).
trap 'kill "$BACKEND_PID" "$IA_PID" "$CADDY_PID" 2>/dev/null || true' INT TERM EXIT

wait -n "$BACKEND_PID" "$IA_PID" "$CADDY_PID"

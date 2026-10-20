# syntax=docker/dockerfile:1
# ============================================================
# Imagen ÚNICA de CONTABDSI (un solo contenedor):
#   frontend React/Vite + backend FastAPI + ia-service FastAPI + Caddy.
#
# Caddy sirve la SPA y hace de reverse proxy:
#   /api/*     → backend FastAPI      (127.0.0.1:8001, interno)
#   /bot-api/* → ia-service FastAPI   (127.0.0.1:8003, interno, sin prefijo)
#   resto      → /srv/web (SPA)
#
# El contenedor NO corre como root y Caddy escucha en :8080/:8443; el compose
# los publica como puertos loopback propios (30380/30381) para que el edge
# compartido haga TLS y no choque con ecommerce ni con CRM.
#
# Construir: docker compose -f docker/docker-compose.yml build
# Contexto de build: la raíz del repo (ver .dockerignore).
# ============================================================

# ── 1. Frontend React/Vite ─────────────────────────────────
FROM node:22-bookworm-slim AS fronts

# VITE_FORTUNER_URL se hornea en el bundle: es la URL pública de Fortuner que
# muestra el botón "Ir a FORTUNER27" de AccessGate. Si se deja vacía, el front
# usa http://<hostname>:8444/ (poco útil detrás de HTTPS; configúrala).
ARG VITE_FORTUNER_URL=
ENV VITE_FORTUNER_URL=${VITE_FORTUNER_URL} \
    CI=true

# pnpm fijado (el proyecto usa pnpm 10.34.3 según Interface_web/.mise.toml).
RUN npm install -g pnpm@10.34.3

WORKDIR /fronts

# Dependencias primero (capa cacheable).
COPY Interface_web/package.json Interface_web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Fuente completa + build de producción.
COPY Interface_web/ ./
RUN pnpm run build

# ── 2. Runtime: Python + Caddy ─────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    BACKEND_PORT=8001 \
    IA_SERVICE_PORT=8003 \
    HTTP_PORT=8080 \
    HTTPS_PORT=8443 \
    XDG_DATA_HOME=/data \
    XDG_CONFIG_HOME=/config \
    CADDYFILE_OUT=/config/Caddyfile.generated

# curl: healthcheck y diagnóstico. ca-certificates: ACME/HTTPS saliente.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Caddy: reverse proxy + servidor de estáticos + TLS (modo directo).
ARG CADDY_VERSION=2.11.7
ARG TARGETARCH=amd64
RUN curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${TARGETARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin caddy \
    && chmod +x /usr/local/bin/caddy

WORKDIR /app

# Backend FastAPI.
COPY backend/ ./backend/
RUN python3 -m venv /opt/contab-venv \
    && /opt/contab-venv/bin/pip install --no-cache-dir -r ./backend/requirements.txt

# ia-service (asistente contable DeepSeek).
COPY ia-service/ ./ia-service/
RUN python3 -m venv /opt/ia-venv \
    && /opt/ia-venv/bin/pip install --no-cache-dir -r ./ia-service/requirements.txt

# Frontend compilado.
COPY --from=fronts /fronts/dist /srv/web

# Proxy + arranque.
COPY docker/entrypoint.sh ./entrypoint.sh
COPY docker/gen_caddyfile.py ./gen_caddyfile.py

# Normaliza CRLF (el repo se trabaja también en Windows), crea directorios
# persistentes y un usuario SIN privilegios.
RUN sed -i 's/\r$//' ./entrypoint.sh \
    && chmod +x ./entrypoint.sh \
    && mkdir -p /data /config /app/backend/logs \
    && groupadd --system --gid 10002 contab \
    && useradd --system --uid 10002 --gid contab --home-dir /app --shell /usr/sbin/nologin contab \
    && chown -R contab:contab /data /config /srv/web /app/backend/logs

USER contab

EXPOSE 8080 8443

CMD ["./entrypoint.sh"]

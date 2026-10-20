# `docker/` — despliegue de CONTABDSI en un contenedor único

Imagen única con **frontend React + backend FastAPI + ia-service + Caddy**.
Caddy sirve la SPA y hace de reverse proxy; solo el **edge compartido** publica
`80/443`, igual que ecommerce y CRM.

> **Referencia:** este despliegue replica el patrón de
> `ecommerce/docker/` (`mercaldas_app`) y convive con él y con
> `mercaldas-crm` sin compartir nombres, puertos, redes internas ni volúmenes.

---

## 0. Requisitos previos (verifícalos antes de desplegar)

| Requisito | Estado esperado |
|---|---|
| **DNS** | `A contabilidad.jcti.xyz → 170.254.229.68` (o el dominio que elijas). Hoy `mercaldas.jcti.xyz` resuelve, pero `contabilidad.jcti.xyz` **no existe**. |
| **Fortuner27** | Alcanzable desde el contenedor en `FORTUNER_API_URL`. En `dsi-vps` **no hay nada escuchando en `:8004`**; si Fortuner corre en otro equipo, apunta a esa IP/puerto y abre el firewall. Sin Fortuner, `AccessGate` bloquea la app (fail-closed). |
| **Datos** | PostgreSQL con los datos migrados (respaldo en `db/backups/partes`). El contenedor **no puede usar Advantage** (DLL COM de Windows). `WITH_SEED=true` solo para demo. |
| **Secretos** | `docker/.env` con `DATABASE_URL`, `POSTGRES_PASSWORD`, `FORTUNER_API_URL`, `IA_SERVICE_DEEPSEEK_API_KEY` y `VITE_FORTUNER_URL`. |
| **Docker** | Docker Engine/Desktop con Compose ≥ 2.24 (en `dsi-vps` es v5.6.0). |

---

## 1. Arquitectura

```mermaid
graph TD
    Internet["Internet :80/:443"] --> Edge["edge_caddy<br/>TLS Let's Encrypt<br/>red shared_edge"]
    Edge -->|"contabdsi_app:8080"| App

    subgraph App["contabdsi_app (un solo contenedor)"]
        Caddy["Caddy interno :8080<br/>SPA + reverse proxy"]
        Web["/srv/web<br/>React compilado"]
        API["backend FastAPI<br/>127.0.0.1:8001"]
        IA["ia-service FastAPI<br/>127.0.0.1:8003"]
        Caddy --> Web
        Caddy -->|"/api/*"| API
        Caddy -->|"/bot-api/*"| IA
        IA -->|"HTTP loopback"| API
    end

    subgraph Redes["Redes Docker"]
        EdgeNet["contabdsi_edge<br/>salida a internet"]
        Internal["contabdsi_internal<br/>internal: true"]
        Shared["shared_edge<br/>externa"]
    end

    App --- EdgeNet
    App --- Internal
    App --- Shared
    DB["contabdsi_postgres<br/>PostgreSQL 18<br/>perfil db"] --- Internal
```

- **`/api/*`** → backend FastAPI (`8001`).
- **`/bot-api/*`** → ia-service (`8003`), quitando el prefijo.
- **Todo lo demás** → SPA (`/srv/web`, fallback `index.html`).
- La BD **nunca se publica**: solo responde en `contabdsi_internal`.

---

## 2. Aislamiento respecto de ecommerce y CRM

| Proyecto | Contenedor app | Red interna | Puertos loopback | Volúmenes |
|---|---|---|---|---|
| ecommerce | `mercaldas_app` | `mercaldas_internal` | `30180/30181` | `mercaldas_*` |
| CRM | `mercaldas_crm_app` | `crm_internal` | `30280/30281` | propios |
| **contabilidad** | **`contabdsi_app`** | **`contabdsi_internal`** | **`30380/30381`** | **`contabdsi_*`** |
| edge | `edge_caddy` | `shared_edge` | `80/443` | `edge_caddy_*` |

Nada de lo anterior se reutiliza. El único punto de contacto es la red externa
`shared_edge`, que ya existe en `dsi-vps`.

---

## 3. Arranque rápido (servidor `dsi-vps`, Windows + Docker Desktop)

Conéctate y trabaja desde PowerShell:

```powershell
ssh dsi-vps
powershell
cd C:\Users\Desarrolo4\Documents\contabilidad\docker

Copy-Item .env.example .env
notepad .env          # dominio, TLS, contraseñas, Fortuner, DeepSeek

docker compose --profile db build
docker compose --profile db up -d
docker compose ps
docker compose logs -f app
```

Sin BD incluida (usando una PostgreSQL externa ya existente):

```powershell
# en .env: DATABASE_URL=postgres://usuario:clave@host:puerto/db
docker compose up -d
```

> El compose define `env_file: .env` como **opcional** (Compose ≥ 2.24).
> Sin `.env`, la app solo arranca si `DATABASE_URL` llega por el entorno, y la
> BD incluida exige `POSTGRES_PASSWORD`. Los valores críticos fallan de forma
> explícita (fail-closed).

### Qué debes editar sí o sí en `.env`

| Variable | Por qué |
|---|---|
| `HOST_APP` | Dominio público (debe coincidir con el DNS y con el edge). |
| `DATABASE_URL` | Conexión del modelo nuevo (PostgreSQL). |
| `POSTGRES_PASSWORD` | Si usas el perfil `db`. |
| `FORTUNER_API_URL` | El backend debe alcanzar Fortuner27 (AccessGate). |
| `IA_SERVICE_DEEPSEEK_API_KEY` | Asistente contable (opcional; sin clave el widget responde 503). |
| `VITE_FORTUNER_URL` | URL pública del botón “Ir a FORTUNER27” (se hornea en el build). |

---

## 4. Integración con el edge compartido

El contenedor **no publica 80/443**. Para que el dominio funcione:

1. **DNS**: crea `A contabilidad.jcti.xyz → IP pública del servidor`.
2. En `.env`: `HOST_APP=contabilidad.jcti.xyz`, `TLS=false`,
   `ALLOW_INSECURE=true`, `PUBLIC_SCHEME=https`.
3. Añade el bloque de `docker/edge/Caddyfile.contabilidad` al Caddyfile del
   edge compartido (en el servidor:
   `C:\Users\Desarrolo4\Documents\ecommerce\docker\edge\Caddyfile`).
4. Recarga Caddy **sin cortar** ecommerce/CRM:

```powershell
docker exec edge_caddy caddy reload --config /etc/caddy/Caddyfile
```

5. Verifica:

```powershell
docker network inspect shared_edge          # debe listar contabdsi_app
docker logs edge_caddy --tail 50
docker exec contabdsi_app curl -fsS http://127.0.0.1:8001/api/health
curl.exe -fsS -H "Host: contabilidad.jcti.xyz" http://127.0.0.1:30380/api/health
curl.exe -fsS -H "Host: contabilidad.jcti.xyz" http://127.0.0.1:30380/bot-api/health
```

El edge conserva el `Host`; el Caddy interno de contabilidad usa ese host para
servir la SPA y proxya el API. `ALLOW_INSECURE=true` es obligatorio porque el
tráfico entre edge y contenedor viaja por la red Docker privada sin TLS; el
navegador sigue viendo HTTPS.

### Modo directo (sin edge)

Solo válido si contabilidad fuera el único proyecto del servidor:

```env
TLS=true
PUBLIC_HTTP_PORT=80
PUBLIC_HTTPS_PORT=443
```

En `dsi-vps` **no lo uses**: `edge_caddy` ya ocupa `80/443`.

---

## 5. Base de datos

### Opción A — PostgreSQL incluido (perfil `db`)

```powershell
docker compose --profile db build
docker compose --profile db up -d
```

- Contenedor: `contabdsi_postgres` (sin puertos publicados).
- Volumen: `contabdsi_pgdata`.
- Imagen: `docker/db/Dockerfile` → esquema (16 archivos) + `funciones.sql`.
- `POSTGRES_DB=contabdsi_datos` y
  `DATABASE_URL=postgres://contabdsi:CLAVE@db:5432/contabdsi_datos`.
- Por defecto **no** carga `seed.sql` (datos demo). Para una demo:
  `WITH_SEED=true` en `.env`, reconstruye la imagen
  (`docker compose --profile db build --no-cache db`) y recrea el volumen
  **vacío** (destructivo): `docker compose --profile db down -v`
  (⚠ borra `contabdsi_pgdata`).

### Restaurar los datos migrados (respaldo real)

El respaldo de producción viaja versionado en `db/backups/partes` (dos partes,
122 MB, SHA-256 en `respaldo.json`). Contiene **740.689 documentos**,
**5.043.942 líneas** y **125.993 terceros**. El repositorio debe seguir siendo
privado: son datos reales.

Con el contenedor de PostgreSQL arriba:

```powershell
cd C:\Users\Desarrolo4\Documents\contabilidad\docker
powershell -ExecutionPolicy Bypass -File .\restore-db.ps1
```

El script:

1. une las partes y verifica tamaño + SHA-256 del manifiesto;
2. crea `contabdsi_datos` si no existe;
3. ejecuta `pg_restore --clean --if-exists --no-owner --no-privileges`;
4. valida conteos y cuadratura (`SUM(debito) - SUM(credito) = 0`).

> `--clean --if-exists` **reemplaza** el contenido de la base destino. Ejecútalo
> de forma intencional. Para una base con otro nombre:
> `-DbName otra_base`.

La restauración tarda varios minutos (5M de líneas). El contenedor no publica
puertos: todo se hace con `docker exec`/`docker cp`, sin exponer PostgreSQL.

### Opción B — PostgreSQL externo

No actives el perfil `db`; define `DATABASE_URL` apuntando a tu servidor. La
red `contabdsi_internal` sigue existiendo para el resto del stack.

### Limitación importante: Advantage

El backend puede operar contra **Advantage (ADS/OLEDB)** o **PostgreSQL**
(`CONTABDSI_STORE`). El proveedor de Advantage es una **DLL COM de Windows**:
no funciona en el contenedor Linux. Por eso:

- En el contenedor: `CONTABDSI_STORE=postgres` (el entrypoint falla si no).
- Para el legado ADS se sigue usando el equipo Windows / instalación existente.

---

## 6. Acceso, Fortuner y seguridad

### AccessGate

La SPA está envuelta por `Interface_web/src/components/AccessGate.tsx`:

- valida la sesión con `GET /api/access/session`;
- canjea un código de Fortuner (`POST /api/access/fortuner`);
- admite clave administrativa (`POST /api/access/administrator`).

Ambas vías consultan **Fortuner27** desde el backend (`FORTUNER_API_URL`).
Si Fortuner no es alcanzable, la app muestra “Ejecución incorrecta del
programa” y no deja pasar. Es intencional (fail-closed).

- Fortuner en el host Windows: `http://host.docker.internal:8004`.
- Fortuner en contenedor: usa su nombre de servicio y comparte red.
- El servicio de Fortuner debe escuchar en una interfaz alcanzable desde el
  contenedor (no solo `127.0.0.1`).
- `CONTABDSI_COOKIE_SECURE=true` es obligatorio detrás de HTTPS.

### Capas de seguridad aplicadas

| Capa | Medida |
|---|---|
| Red | Solo `edge_caddy` publica `80/443`; la app solo en loopback; BD en red `internal`. |
| Proceso | Usuario `contab` (UID 10002), `cap_drop: ALL`, `no-new-privileges`. |
| TLS | Let's Encrypt en el edge + HSTS; el Caddy interno usa HTTP solo dentro de la red Docker. |
| Cabeceras | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP, `-Server`. |
| Framing | Por defecto `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`. Si Fortuner27 embebe el módulo en un iframe, define `FRAME_ANCESTORS` con su origen; el generador omite `X-Frame-Options` y deja la restricción en CSP. |
| Cuerpo | `MAX_REQUEST_BODY` (50 MB por defecto). |
| Sesión | Cookie `HttpOnly`, `SameSite=Strict`, `Secure` (configurable). |
| Opcional | Basic Auth exterior (`PROTECT_APP=true`) si no hay Fortuner o se quiere doble barrera. |
| Logs | Rotación Docker (`10m × 5`). |

> Caddy no trae rate limiting nativo. Si necesitas limitar intentos, añade el
> plugin `caddy-ratelimit` o un WAF delante; no se incluye aquí para no ampliar
> la superficie.

---

## 7. Comandos útiles

```powershell
# Estado y salud
docker compose ps
docker inspect --format "{{.State.Health.Status}}" contabdsi_app
docker exec contabdsi_app curl -fsS http://127.0.0.1:8001/api/health
curl.exe -fsS -H "Host: contabilidad.jcti.xyz" http://127.0.0.1:30380/api/health
curl.exe -fsS -H "Host: contabilidad.jcti.xyz" http://127.0.0.1:30380/bot-api/health

# Logs
docker compose logs -f app
docker logs contabdsi_postgres --tail 100

# Reiniciar / actualizar
docker compose --profile db build
docker compose --profile db up -d
docker compose restart app

# Apagar (conserva volúmenes)
docker compose --profile db down

# Respaldo de la BD incluida
docker exec contabdsi_postgres pg_dump -U contabdsi -d contabdsi -Fc -f /tmp/contabdsi.dump
docker cp contabdsi_postgres:/tmp/contabdsi.dump .\backups\contabdsi.dump
```

---

## 8. Diagnóstico

| Síntoma | Causa probable | Solución |
|---|---|---|
| El edge devuelve **502** | `contabdsi_app` no está arriba o no está en `shared_edge` | `docker compose ps`; `docker network inspect shared_edge`; `docker compose up -d`. |
| `contabdsi_app` **unhealthy** | BD no responde o `DATABASE_URL` incorrecta | `docker logs contabdsi_app`; `docker logs contabdsi_postgres`; verifica host `db`. |
| El entrypoint aborta: `CONTABDSI_STORE=ads` | ADS es Windows-only | `CONTABDSI_STORE=postgres` en `.env`. |
| AccessGate bloquea | Fortuner no alcanzable | `docker exec contabdsi_app curl -v http://host.docker.internal:8004/`; revisa `FORTUNER_API_URL`. |
| La sesión no persiste | Cookie `Secure` sobre HTTP | Usa HTTPS o, solo en pruebas, `CONTABDSI_COOKIE_SECURE=false`. |
| `pnpm install` falla | Lockfile desincronizado | `pnpm install` local y commit de `pnpm-lock.yaml`; no editar el lock dentro de la imagen. |
| Cambié el dominio y no aplica | El Caddy interno se genera al arrancar | `docker compose restart app`. |
| Cambié `VITE_FORTUNER_URL` y no aplica | Es build-time | `docker compose build app` y `up -d`. |

---

## 9. Archivos

| Archivo | Rol |
|---|---|
| `Dockerfile` | Multi-stage: frontend Vite + runtime Python + Caddy. |
| `entrypoint.sh` | Arranca backend, ia-service y Caddy; salvaguardas fail-closed. |
| `gen_caddyfile.py` | Genera SPA + proxies + cabeceras + Basic Auth desde variables. |
| `docker-compose.yml` | Contenedor único + PostgreSQL opcional (perfil `db`). |
| `db/Dockerfile` | PostgreSQL 18 con esquema/funciones (seed opcional). |
| `restore-db.ps1` | Une/verifica el respaldo y restaura los datos migrados en `contabdsi_datos`. |
| `.env.example` | Plantilla de entorno (copiar a `.env`). |
| `edge/Caddyfile.contabilidad` | Bloque para el Caddyfile del edge compartido. |

# Stack tecnológico — Contabilidad (CONTABDSI)

> Inventario de herramientas y tecnologías realmente usadas en este repositorio.
> Fuentes: `package.json`, `requirements.txt`, `Dockerfile`/`docker-compose.yml`,
> `dev.js`, `README.md` y la documentación de `docs/` y `db/`.
> Última revisión: 2026-09-21.

CONTABDSI es la modernización del sistema contable legado (Advantage) hacia una
interfaz **React** y servicios **Python/FastAPI**, manteniendo durante la
transición el acceso al motor de origen **Advantage Database Server**.

---

## 1. Entorno de desarrollo

| Elemento | Detalle | Para qué |
|---|---|---|
| **Linux** | Máquina de desarrollo (`/home/jk/Proyectos/dsi/contabilidad`) | SO donde corre hoy el desarrollo |
| **Windows (RDP)** | Acceso remoto vía `xfreerdp` | El motor/proveedor de **Advantage** es una DLL COM solo de Windows; para operar contra el legado se usa esta vía. En Linux el backend corre contra PostgreSQL (`--db-postgres`) |
| **Bash** | Shell por defecto | Scripts (`db/postgresql/scripts/up.sh`, `dev.sh`) |
| **PowerShell** | Aparece en la documentación | Comandos de compatibilidad/legado en Windows (ej. `reg query` de los proveedores ADS) |
| **Zed** | Editor con IA generativa integrada | Entorno de desarrollo asistido; las sesiones se exportan a `docs/sesiones/` (hilo y modelo quedan registrados) |
| **Node.js 22** | Fijado por `mise` (`.mise.toml`) | Orquestador `dev.js`, tooling de la interfaz y scripts de BD |
| **pnpm 10.34.3** | Fijado por `mise` (`.mise.toml`) | Gestor de paquetes de la interfaz |
| **mise** | `.mise.toml` | Gestor de versiones de herramientas (Node + pnpm) |
| **Python 3.13 (64-bit)** | Entorno virtual en `backend/.venv` y `ia-service/.venv` | Backend y servicio de IA |
| **Docker + Docker Compose** | `db/postgresql/docker-compose.yml` | PostgreSQL de referencia local |
| **Git** | `.gitignore`, repositorio | Control de versiones |

**Puertos de desarrollo:** interfaz web `8448`, backend FastAPI `8001`,
servicio de IA `8003`, PostgreSQL de referencia `5433`.

Arranque: `node dev.js` (instala lo que falte, levanta PostgreSQL + backend +
interfaz + IA y libera la terminal). Modos: `--db-postgres`, `--db-advantage`
(por defecto), `--no-db`, `--no-ia`, `--check`, `--stop`.

---

## 2. Lenguajes

| Lenguaje | Uso |
|---|---|
| **Python 3** | Backend FastAPI, servicio de IA, scripts de migración/ETL, extractores |
| **TypeScript / JavaScript** | Interfaz web (React), scripts de base de datos y orquestador Node |
| **SQL** | Esquema PostgreSQL, funciones/triggers, diccionario Advantage (DDL ANSI) |
| **CSS (Tailwind)** | Estilos de la interfaz |

---

## 3. Frontend web

| Tecnología | Para qué |
|---|---|
| **React 19** | Interfaz principal (`Interface_web/`) |
| **Vite 8** | Bundler y dev server (proxy `/api` → backend 8001) |
| **TypeScript 5.7** | Tipado del frontend |
| **Tailwind CSS v4** (`@tailwindcss/vite`) | Estilos con utilidades |
| **Figma Make** | Generación inicial de la UI (proyecto `figma-make-app`) |
| **oxfmt** | Formateador de código |
| **Puppeteer-core** | Smoke test E2E (usa el Chromium del sistema) |

Interfaz de presentación aparte (`db/presentacion-web/`): **React 18 + Vite 5**,
página interactiva del esquema legado, el nuevo y la migración.

**Navegación:** por estado, sin router (`src/App.tsx`); datos simulados en
`src/data/`.

---

## 4. Backend

| Tecnología | Para qué |
|---|---|
| **FastAPI** | Framework de la API (`backend/app.py`) |
| **Uvicorn** | Servidor ASGI |
| **psycopg 3** | Driver PostgreSQL (modelo nuevo) |
| **pywin32 + ADODB/OLEDB** (`Advantage.OLEDB.1`) | Acceso al legado Advantage (solo Windows) |
| **ODBC `Advantage StreamlineSQL ODBC` + MSDASQL** | Vía alternativa para operaciones masivas |
| **python-multipart** | Carga de archivos/formularios |
| **openpyxl** | Lectura de importaciones XLSX |
| **reportlab** | Generación de PDF (informes) |
| **pypdf** | Lectura/mezcla de PDF |
| **python-dotenv** | Variables de entorno (`backend/.env`) |

**Patrón:** repositorios por dominio (`ads_repository.py`, `postgres_repository.py`,
`comprobantes_repository.py`, etc.) con un conmutador de motor
(`CONTABDSI_STORE=postgres|advantage`). `_win32com.py` permite importar los
repositorios de Advantage en Linux y fallar con un mensaje claro solo si se usan.

---

## 5. Inteligencia artificial

| Tecnología | Para qué |
|---|---|
| **DeepSeek API** | Asistente contable (`ia-service/`) que alimenta el widget de chat del encabezado |
| **FastAPI + Uvicorn** | Servicio `ia-service` |
| **httpx** | Cliente HTTP hacia DeepSeek |
| **python-dotenv** | Configuración de la API key |

---

## 6. Bases de datos

| Tecnología | Para qué |
|---|---|
| **PostgreSQL 18** | Motor destino (modelo nuevo), validado end-to-end (11 pruebas) |
| **Advantage Database Server (ADS)** | Motor de **origen** del legado (archivos `.ADT`/DBF, diccionario `PUBLIDATA.add`) |
| **ADO/OLEDB y ODBC de Advantage** | Acceso al legado desde Windows |
| **Docker PostgreSQL** | Clúster local de referencia (opcional para otros desarrolladores) |

**Diseño del modelo (`db/`):**
- `general/` — modelo lógico neutro (fuente de verdad: 60 entidades, `modelo.json`,
  ERD en **Mermaid**).
- `postgresql/` — implementación de referencia (schema + `funciones.sql` + `seed.sql`).
- `advantage/` — traducción del modelo a diccionario ADS (documental).
- `migration/` — plan y ejecución de la migración de datos (extractor, cargador,
  conciliación); incluye el bloqueo por el motor Advantage.
- `presentacion/`, `presentacion-web/` — material de presentación de la migración.

**Convenciones:** esquema único con `compania_id`, dinero `NUMERIC(18,2)`,
auditoría por fila con `version` (concurrencia optimista), idempotencia por
`idempotency_key`, documentos contabilizados inmutables (anulación con reversión).

---

## 7. Infra / DevOps

| Tecnología | Para qué |
|---|---|
| **`dev.js`** | Orquestador propio: verifica/instala dependencias y levanta los servicios |
| **Docker Compose** | PostgreSQL de referencia y clúster efímero de validación |
| **Bash (`up.sh`, `dev.sh`)** | Bootstrap del clúster local y arranque de servicios |
| **Markdown + `AGENTS.md`/`CLAUDE.md`** | Documentación y guía para agentes de IA |
| **Git** | Control de versiones |

**Rutas notables:** `logs/<servicio>.log` (salida de servicios), `tmp/`, `output/`,
`ADD_CONTAB/` (diccionario Advantage de origen, contexto congelado).

---

## 8. Testing y calidad

| Tecnología | Para qué |
|---|---|
| **pytest** | Pruebas del backend Python (`backend/tests/`) |
| **Node test runner** (`node --test` + `--experimental-strip-types`) | Tests TS de la interfaz (`pnpm test:parametros`) |
| **Puppeteer-core** | Smoke test E2E del flujo contable (`pnpm smoke`) |
| **`db/postgresql/scripts/validate.sql`** | Validación funcional del flujo contable (11/11) |
| **oxfmt** | Formato de código |

---

## 9. Notas y limitaciones

- **Advantage solo existe en Windows**: el proveedor OLEDB/ODBC es una DLL COM de
  Windows y SAP descontinuó el producto. En Linux se trabaja con PostgreSQL
  (`CONTABDSI_STORE=postgres`); para el legado se usa el equipo Windows por RDP.
- Durante la transición el backend puede operar indistintamente contra **Advantage
  (origen)** o **PostgreSQL (destino)**.
- Las rutas Windows/UNC se conservan como dato, pero no implican acceso al archivo
  desde la aplicación nueva (la migración documental de archivos es aparte).
- **No incluye apps móviles**: este proyecto no usa React Native ni genera APKs.

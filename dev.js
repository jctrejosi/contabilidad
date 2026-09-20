#!/usr/bin/env node
"use strict";

/**
 * dev.js — entorno de desarrollo local de CONTABDSI.
 *
 * Levanta las tres piezas del proyecto y devuelve la terminal:
 *   1. Base de datos PostgreSQL de referencia (db/postgresql, vía Docker).
 *   2. Backend FastAPI/uvicorn (backend/).
 *   3. Interfaz web React/Vite (Interface_web/).
 *
 * Antes de montar comprueba e instala lo que falte:
 *   - entorno virtual de Python + backend/requirements.txt,
 *   - node_modules de Interface_web (pnpm si existe; si no, npm).
 *
 * Todo ocurre en esta terminal: los servicios se lanzan desacoplados y su
 * salida se escribe SOLO en `logs/<servicio>.log`, nunca se canaliza a la
 * terminal ni hereda la consola (heredar o canalizar hace que Windows abra
 * consolas nuevas para procesos desacoplados). Al terminar, el script imprime
 * las URLs y sale: los servicios siguen corriendo.
 *
 * Uso:
 *   node dev.js                  instala lo que falte, levanta todo y libera la terminal
 *   node dev.js --check          solo verifica herramientas y dependencias
 *   node dev.js --stop           detiene los servicios levantados
 *   node dev.js --no-db          omite PostgreSQL
 *   node dev.js --no-install     no instala dependencias, solo verifica
 *   node dev.js --require-db     falla si la base de datos no puede iniciar
 *   node dev.js --no-reload      arranca uvicorn sin recarga automática
 *   node dev.js --keep-db        no detiene PostgreSQL al hacer --stop
 *   node dev.js --no-docker-autostart
 *                                no intenta abrir Docker Desktop
 *
 * Variables de entorno: BACKEND_PORT, WEB_PORT (o PORT), DB_PORT, DB_USER,
 * DB_NAME, DEV_TIMEOUT_MS, DOCKER_START_TIMEOUT_MS, NO_COLOR.
 *
 * Nota: el backend depende de Advantage Data Server vía OLEDB (pywin32), así
 * que está orientado a Windows; la base PostgreSQL de `db/postgresql` es el
 * modelo de referencia que usará el backend migrado.
 */

const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

// ─────────────────────────────────────────────────────────────────────────────
// Rutas y configuración
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = __dirname;
const BACKEND_DIR = path.join(ROOT, "backend");
const WEB_DIR = path.join(ROOT, "Interface_web");
const DB_DIR = path.join(ROOT, "db", "postgresql");
const LOGS_DIR = path.join(ROOT, "logs");
const PIDS_FILE = path.join(LOGS_DIR, ".pids.json");

const IS_WIN = process.platform === "win32";
const TASKKILL = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");

const CONFIG = {
  backendHost: "127.0.0.1",
  backendPort: Number(process.env.BACKEND_PORT || 8001),
  webPort: Number(process.env.WEB_PORT || process.env.PORT || 8443),
  dbPort: Number(process.env.DB_PORT || 5433),
  dbUser: process.env.DB_USER || "contabdsi",
  dbName: process.env.DB_NAME || "contabdsi",
  startupTimeoutMs: Number(process.env.DEV_TIMEOUT_MS || 120000),
  dockerTimeoutMs: Number(process.env.DOCKER_START_TIMEOUT_MS || 90000),
};

// Los paquetes que el backend necesita importar para considerarse instalado.
const BACKEND_IMPORTS = ["fastapi", "uvicorn", "openpyxl", "multipart", "reportlab", "pypdf"].concat(
  IS_WIN ? ["win32com.client"] : [],
);

const SERVICES = { backend: "backend", web: "web", db: "db" };

// ─────────────────────────────────────────────────────────────────────────────
// Salida en terminal
// ─────────────────────────────────────────────────────────────────────────────

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const c = {
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("34"),
  magenta: paint("35"),
  cyan: paint("36"),
};

const log = (message = "") => process.stdout.write(`${message}\n`);
const info = (message) => log(`${c.cyan("▸")} ${message}`);
const ok = (message) => log(`${c.green("✓")} ${message}`);
const warn = (message) => log(`${c.yellow("!")} ${message}`);
const fail = (message) => log(`${c.red("✗")} ${message}`);
const step = (title) => {
  log("");
  log(c.blue(`── ${title}`));
};
const rel = (target) => path.relative(ROOT, target).replace(/\\/g, "/") || ".";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de proceso
// ─────────────────────────────────────────────────────────────────────────────

function commandExists(command) {
  const finder = IS_WIN ? "where" : "which";
  try {
    return spawnSync(finder, [command], { stdio: "ignore", windowsHide: true }).status === 0;
  } catch {
    return false;
  }
}

/** Los .cmd de Windows (npm, pnpm, corepack) exigen pasar por cmd.exe. */
const SHELL_COMMANDS = new Set(["npm", "pnpm", "npx", "yarn", "corepack"]);

function quoteArg(value) {
  const text = String(value);
  return /[\s"^&|<>]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Resuelve cómo lanzar un comando sin `shell: true`, que en Node 21+ es
 * inseguro al concatenar argumentos y dispara DEP0190. En Windows los .cmd se
 * ejecutan mediante cmd.exe de forma explícita; el resto se invoca directo.
 */
function buildSpawn(command, args) {
  if (!IS_WIN || !SHELL_COMMANDS.has(command)) {
    return { command, args };
  }
  const line = [command, ...args].map(quoteArg).join(" ");
  return { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", line] };
}

/** Ejecuta en primer plano (instalaciones y comprobaciones). */
function run(command, args, options = {}) {
  const target = buildSpawn(command, args);
  const result = spawnSync(target.command, target.args, {
    cwd: options.cwd || ROOT,
    stdio: options.capture ? "pipe" : "inherit",
    env: { ...process.env, ...(options.env || {}) },
    windowsHide: true,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (options.capture) {
    return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
  }
  return result.status ?? 1;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function killPid(pid) {
  if (!pid) return;
  if (IS_WIN) {
    spawnSync(TASKKILL, ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* el proceso ya no existe */
    }
  }
}

/** PIDs que están escuchando en un puerto TCP (Windows). */
function listenersOnPort(port) {
  if (!IS_WIN) return [];
  const result = spawnSync("netstat", ["-ano"], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || !result.stdout) return [];

  const suffix = `:${port}`;
  const pids = new Set();
  for (const line of result.stdout.split("\n")) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5) continue;
    const [protocol, local, , state, pid] = columns;
    if (!protocol.startsWith("TCP") || state !== "LISTENING") continue;
    if (!local.endsWith(suffix) || !/^\d+$/.test(pid)) continue;
    pids.add(Number(pid));
  }
  return [...pids];
}

/**
 * Cierra lo que esté escuchando en el puerto y devuelve los pids cerrados.
 * El pid registrado puede quedar desfasado (uvicorn arranca un worker hijo, y
 * puede haber huérfanos de una sesión anterior), así que nos apoyamos en el
 * puerto. Unix: fuser -k; Windows: netstat + taskkill.
 */
function freePort(port) {
  if (!IS_WIN) {
    const result = spawnSync("fuser", ["-k", `${port}/tcp`], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      windowsHide: true,
    });
    const output = `${result.stdout || ""}`.trim();
    return output ? output.split(/\s+/).map(Number) : [];
  }

  const pids = listenersOnPort(port);
  for (const pid of pids) killPid(pid);
  return pids;
}

/**
 * Deja el puerto libre antes de arrancar un servicio: si quedó ocupado por una
 * ejecución previa, se cierra su proceso y se espera a que el sistema suelte
 * el socket.
 */
async function releasePort(label, port) {
  if (!(await portOpen(port))) return;

  warn(`El puerto ${port} (${label}) estaba en uso; liberándolo…`);
  const pids = freePort(port);
  if (pids.length) info(`Procesos cerrados: ${pids.join(", ")}`);

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (!(await portOpen(port))) {
      ok(`Puerto ${port} liberado.`);
      return;
    }
    await sleep(250);
  }

  throw new Error(
    `No se pudo liberar el puerto ${port} (${label}) tras cerrar sus procesos. ` +
      "Ciérralo manualmente o usa otro puerto (BACKEND_PORT / WEB_PORT).",
  );
}

function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const settle = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

async function waitForPort({ label, port, timeoutMs, quiet = false }) {
  const deadline = Date.now() + timeoutMs;
  if (!quiet) info(`Esperando a ${label} en el puerto ${port}…`);
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await sleep(400);
  }
  return false;
}

/** Devuelve el código HTTP, o `null` si el servicio aún no responde. */
function httpStatus(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre `logs/<nombre>.log` en modo append y deja una cabecera de sesión. El
 * descriptor se pasa al hijo (que escribe directo ahí) y luego se cierra en el
 * padre: el hijo conserva su propia copia.
 */
function openLog(name) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const logPath = path.join(LOGS_DIR, `${name}.log`);
  const fd = fs.openSync(logPath, "a");
  fs.writeSync(fd, `\n===== [${name}] ${new Date().toISOString()} =====\n`);
  return { fd, logPath };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend · Python
// ─────────────────────────────────────────────────────────────────────────────

function detectPython() {
  const candidates = IS_WIN
    ? [
        { cmd: "py", args: ["-3.13"] },
        { cmd: "py", args: ["-3"] },
        { cmd: "python", args: [] },
      ]
    : [
        { cmd: "python3", args: [] },
        { cmd: "python", args: [] },
      ];

  for (const candidate of candidates) {
    if (!commandExists(candidate.cmd)) continue;
    const target = buildSpawn(candidate.cmd, [...candidate.args, "--version"]);
    const probe = spawnSync(target.command, target.args, {
      stdio: "pipe",
      windowsHide: true,
      encoding: "utf8",
    });
    if (probe.status !== 0) continue;
    return { ...candidate, label: `${probe.stdout || probe.stderr || ""}`.trim() || candidate.cmd };
  }
  return null;
}

function venvPython() {
  return IS_WIN
    ? path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
    : path.join(BACKEND_DIR, ".venv", "bin", "python");
}

function requirementsAreInstalled(python) {
  const statement = `import ${BACKEND_IMPORTS.join(", ")}`;
  return run(python, ["-c", statement], { capture: true }).status === 0;
}

function ensureBackendEnvironment() {
  step("Backend · dependencias Python");

  const python = detectPython();
  if (!python) {
    throw new Error("No se encontró Python. Instálalo y vuelve a ejecutar el script.");
  }
  ok(`Python detectado: ${python.label}`);

  const pythonPath = venvPython();
  if (!fs.existsSync(pythonPath)) {
    info(`Creando entorno virtual en ${rel(path.join(BACKEND_DIR, ".venv"))}…`);
    const created = run(python.cmd, [...python.args, "-m", "venv", path.join(BACKEND_DIR, ".venv")]);
    if (created !== 0 || !fs.existsSync(pythonPath)) {
      throw new Error("No se pudo crear el entorno virtual del backend.");
    }
  }

  const requirements = path.join(BACKEND_DIR, "requirements.txt");
  const marker = path.join(BACKEND_DIR, ".venv", ".requirements.sha256");
  const digest = sha256(fs.readFileSync(requirements));
  const markerMatches = fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === digest;

  if (markerMatches && requirementsAreInstalled(pythonPath)) {
    ok("Dependencias del backend ya instaladas.");
    return;
  }

  info("Instalando backend/requirements.txt…");
  run(pythonPath, ["-m", "pip", "install", "--upgrade", "pip"]);
  const installed = run(pythonPath, ["-m", "pip", "install", "-r", requirements]);
  if (installed !== 0) throw new Error("La instalación de dependencias Python falló.");
  fs.writeFileSync(marker, digest);
  ok("Dependencias del backend instaladas.");
}

function verifyBackendEnvironment() {
  const pythonPath = venvPython();
  if (!fs.existsSync(pythonPath)) {
    throw new Error(`Falta el entorno virtual ${rel(path.join(BACKEND_DIR, ".venv"))}. Ejecuta sin --no-install.`);
  }
  if (!requirementsAreInstalled(pythonPath)) {
    throw new Error("Faltan dependencias Python del backend. Ejecuta sin --no-install.");
  }
  ok("Dependencias del backend presentes.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaz web · Node
// ─────────────────────────────────────────────────────────────────────────────

let PACKAGE_MANAGER = null;

function detectPackageManager() {
  if (PACKAGE_MANAGER) return PACKAGE_MANAGER;
  if (commandExists("pnpm")) {
    PACKAGE_MANAGER = { cmd: "pnpm", prefix: [] };
  } else if (commandExists("corepack")) {
    PACKAGE_MANAGER = { cmd: "corepack", prefix: ["pnpm"] };
  } else {
    PACKAGE_MANAGER = { cmd: "npm", prefix: [], fallback: true };
  }
  return PACKAGE_MANAGER;
}

function ensureFrontendEnvironment() {
  step("Interfaz web · dependencias Node");

  if (!fs.existsSync(WEB_DIR)) {
    throw new Error(`No existe la carpeta ${rel(WEB_DIR)}.`);
  }

  if (fs.existsSync(path.join(WEB_DIR, "node_modules"))) {
    ok("node_modules ya existe.");
    return;
  }

  const manager = detectPackageManager();
  if (manager.fallback) {
    warn("pnpm no está disponible; se usa npm y no se genera package-lock.json (el repo usa pnpm-lock.yaml).");
    info("Instalando node_modules con npm…");
    const status = run("npm", ["install", "--no-package-lock"], { cwd: WEB_DIR });
    if (status !== 0) throw new Error("La instalación de node_modules falló.");
  } else {
    const label = [manager.cmd, ...manager.prefix].join(" ");
    info(`Instalando node_modules con ${label}…`);
    const status = run(manager.cmd, [...manager.prefix, "install"], { cwd: WEB_DIR });
    if (status !== 0) throw new Error("La instalación de node_modules falló.");
  }
  ok("Dependencias de la interfaz instaladas.");
}

function verifyFrontendEnvironment() {
  if (!fs.existsSync(path.join(WEB_DIR, "node_modules"))) {
    throw new Error("Falta Interface_web/node_modules. Ejecuta sin --no-install.");
  }
  ok("Dependencias de la interfaz presentes.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Base de datos · PostgreSQL de referencia
// ─────────────────────────────────────────────────────────────────────────────

let dbStarted = false;

function dockerDaemonUp() {
  return commandExists("docker") && run("docker", ["info"], { capture: true }).status === 0;
}

function tryStartDockerDesktop() {
  if (!IS_WIN) return false;
  const candidates = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Docker", "Docker Desktop.exe"),
  ];
  const executable = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!executable) return false;

  info("Iniciando Docker Desktop…");
  try {
    // Desacoplado y con la salida a ningún sitio: no debe abrir consolas.
    spawn(executable, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return true;
  } catch {
    return false;
  }
}

async function waitForDockerDaemon(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  process.stdout.write(c.dim("  esperando al daemon "));
  while (Date.now() < deadline) {
    if (dockerDaemonUp()) {
      log("");
      return true;
    }
    await sleep(3000);
    process.stdout.write(c.dim("."));
  }
  log("");
  return false;
}

/**
 * `docker compose` se ejecuta en primer plano pero con su salida al archivo de
 * log: si heredara la consola, en Windows aparecerían ventanas adicionales.
 */
function compose(args, fd, timeout) {
  return spawnSync("docker", ["compose", ...args], {
    cwd: DB_DIR,
    stdio: ["ignore", fd, fd],
    windowsHide: true,
    timeout,
  });
}

async function ensureDatabase(options) {
  step("Base de datos · PostgreSQL de referencia");

  if (!fs.existsSync(path.join(DB_DIR, "docker-compose.yml"))) {
    warn(`No se encontró ${rel(path.join(DB_DIR, "docker-compose.yml"))}.`);
    if (options.requireDb) throw new Error("La base de datos es obligatoria (--require-db).");
    return false;
  }

  if (!commandExists("docker")) {
    warn("Docker no está instalado; se omite la base de datos.");
    if (options.requireDb) throw new Error("Docker es obligatorio para la base de datos (--require-db).");
    return false;
  }

  if (!dockerDaemonUp()) {
    warn("El daemon de Docker no responde.");
    if (options.dockerAutostart) tryStartDockerDesktop();
    if (!(await waitForDockerDaemon(CONFIG.dockerTimeoutMs))) {
      warn("No se pudo iniciar el daemon de Docker.");
      if (options.requireDb) throw new Error("El daemon de Docker no está disponible (--require-db).");
      warn("Se continúa sin base de datos; el backend usa Advantage Data Server.");
      return false;
    }
  }
  ok("Daemon de Docker disponible.");

  const { fd, logPath } = openLog(SERVICES.db);
  info(`Levantando PostgreSQL (docker compose up -d --wait) → ${rel(logPath)}`);

  let result = compose(["up", "-d", "--wait"], fd, 180000);
  if (result.status !== 0) {
    // Compose antiguo sin --wait: se arranca y se espera el puerto.
    warn("`up --wait` no funcionó; reintentando con `up -d` y espera de puerto.");
    result = compose(["up", "-d"], fd, 180000);
    if (result.status === 0) {
      const ready = await waitForPort({
        label: "PostgreSQL",
        port: CONFIG.dbPort,
        timeoutMs: CONFIG.startupTimeoutMs,
        quiet: true,
      });
      if (!ready) result = { status: 1 };
    }
  }

  const healthy = result.status === 0 && (await waitForPort({
    label: "PostgreSQL",
    port: CONFIG.dbPort,
    timeoutMs: 15000,
    quiet: true,
  }));

  if (healthy) {
    // Deja en db.log los logs del contenedor (la inicialización del esquema).
    compose(["logs", "--no-color", "--tail", "200"], fd, 30000);
    dbStarted = true;
  }

  fs.closeSync(fd);

  if (!healthy) {
    warn(`No se pudo levantar el contenedor de PostgreSQL (detalle en ${rel(logPath)}).`);
    if (options.requireDb) throw new Error("No se pudo levantar la base de datos (--require-db).");
    return false;
  }

  ok(`PostgreSQL listo en el puerto ${CONFIG.dbPort}.`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicios
// ─────────────────────────────────────────────────────────────────────────────

const startedPids = {};

/**
 * Lanza un servicio desacoplado con la salida directa al archivo de log.
 *
 * Importante: nada de `stdio: "inherit"` ni pipes. Un proceso desacoplado con
 * la consola heredada abre una consola propia en Windows; por eso aquí todo va
 * al descriptor del archivo y el padre se desentiende con `unref()`.
 */
function startService({ name, command, args, cwd, env }) {
  const { fd, logPath } = openLog(name);
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...(env || {}) },
    stdio: ["ignore", fd, fd],
    detached: true, // grupo propio: sobrevive al cierre de la terminal
    windowsHide: true,
  });

  child.on("error", (error) => fail(`${name}: no se pudo arrancar (${error.message})`));
  child.unref();
  fs.closeSync(fd);

  startedPids[name] = [child.pid];
  info(`[${name}] ▶ arrancado (pid ${child.pid}) · log: ${rel(logPath)}`);
  return child;
}

/**
 * Añade al registro los pids que realmente quedaron escuchando en el puerto.
 * En Windows el pid que devuelve `spawn` puede ser un lanzador intermedio (el
 * `python.exe` de un venv relanza el intérprete, por ejemplo), así que además
 * de la raíz del árbol guardamos al proceso que abrió el socket.
 */
function trackListeners(name, port) {
  const registered = startedPids[name] || (startedPids[name] = []);
  for (const pid of listenersOnPort(port)) {
    if (!registered.includes(pid)) registered.push(pid);
  }
}

function startBackend() {
  const args = [
    "-m",
    "uvicorn",
    "backend.app:app",
    "--host",
    CONFIG.backendHost,
    "--port",
    String(CONFIG.backendPort),
  ];
  if (options.reload) args.push("--reload");

  return startService({
    name: SERVICES.backend,
    command: venvPython(),
    args,
    cwd: ROOT,
  });
}

function startWeb() {
  // Se ejecuta el binario de Vite con el propio Node en lugar de `npm run dev`:
  // envolverlo en cmd.exe obliga a pasar por un shell y complica el cierre.
  const viteBin = path.join(WEB_DIR, "node_modules", "vite", "bin", "vite.js");
  if (!fs.existsSync(viteBin)) {
    throw new Error("No se encontró Vite en Interface_web/node_modules. Ejecuta sin --no-install.");
  }

  return startService({
    name: SERVICES.web,
    command: process.execPath,
    args: [viteBin, "--host", "0.0.0.0", "--port", String(CONFIG.webPort), "--strictPort"],
    cwd: WEB_DIR,
    env: {
      PORT: String(CONFIG.webPort),
      ADS_API_URL: `http://${CONFIG.backendHost}:${CONFIG.backendPort}`,
    },
  });
}

async function releaseServicePorts() {
  await releasePort("backend", CONFIG.backendPort);
  await releasePort("interfaz web", CONFIG.webPort);
}

function savePids() {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(PIDS_FILE, JSON.stringify(startedPids, null, 2));
}

function readPids() {
  try {
    return JSON.parse(fs.readFileSync(PIDS_FILE, "utf8"));
  } catch {
    return {};
  }
}

/** Cierra lo levantado por esta ejecución si el arranque se interrumpe. */
function abortStarted() {
  for (const value of Object.values(startedPids)) {
    for (const pid of Array.isArray(value) ? value : [value]) killPid(pid);
  }
  freePort(CONFIG.backendPort);
  freePort(CONFIG.webPort);
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen y parada
// ─────────────────────────────────────────────────────────────────────────────

function printUrls() {
  const backend = `http://${CONFIG.backendHost}:${CONFIG.backendPort}`;
  const web = `http://${CONFIG.backendHost}:${CONFIG.webPort}`;
  const database = `postgres://${CONFIG.dbUser}@127.0.0.1:${CONFIG.dbPort}/${CONFIG.dbName}`;
  const logNames = Object.values(SERVICES)
    .filter((name) => name !== SERVICES.db || dbStarted)
    .map((name) => `${name}.log`)
    .join(", ");

  log("");
  log(c.green("  Servicios en marcha"));
  log("");
  log(`   Interfaz web   ${c.cyan(web)}`);
  log(`   API backend    ${c.cyan(backend)} ${c.dim("(/docs para Swagger)")}`);
  log(`   PostgreSQL     ${dbStarted ? c.cyan(database) : c.yellow("no iniciado")}`);
  log("");
  log(`   Logs           ${rel(LOGS_DIR)}/ ${c.dim(`(${logNames})`)}`);
  log(c.dim("   Para detener todo: node dev.js --stop"));
  log("");
}

function stopAll() {
  step("Deteniendo servicios");

  const pids = readPids();
  const entries = Object.entries(pids);
  if (!entries.length) {
    info("No hay servicios registrados.");
  }
  for (const [name, value] of entries) {
    for (const pid of Array.isArray(value) ? value : [value]) {
      info(`Deteniendo ${name} (pid ${pid})…`);
      killPid(pid);
    }
  }

  // Red de seguridad: liberar los puertos aunque algún pid haya quedado viejo.
  freePort(CONFIG.backendPort);
  freePort(CONFIG.webPort);

  if (!options.keepDb && commandExists("docker") && dockerDaemonUp()) {
    info("Deteniendo PostgreSQL…");
    const { fd } = openLog(SERVICES.db);
    compose(["stop"], fd, 120000);
    fs.closeSync(fd);
  }

  try {
    fs.rmSync(PIDS_FILE, { force: true });
  } catch {
    /* sin archivo de pids */
  }

  ok("Servicios detenidos.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo --check
// ─────────────────────────────────────────────────────────────────────────────

async function runChecks() {
  step("Verificación del entorno");
  const pending = [];

  log(`   Node           ${process.version}`);
  log(`   Raíz           ${ROOT}`);

  const python = detectPython();
  if (python) {
    log(`   Python         ${python.label}`);
  } else {
    log(`   Python         ${c.red("no encontrado")}`);
    pending.push("Python");
  }

  const pythonPath = venvPython();
  if (fs.existsSync(pythonPath) && requirementsAreInstalled(pythonPath)) {
    log(`   Backend venv   ${c.green("listo")}`);
  } else {
    log(`   Backend venv   ${c.yellow("requiere instalación")}`);
    pending.push("backend/requirements.txt");
  }

  const manager = detectPackageManager();
  log(`   Gestor Node    ${[manager.cmd, ...manager.prefix].join(" ")}`);
  if (fs.existsSync(path.join(WEB_DIR, "node_modules"))) {
    log(`   node_modules   ${c.green("listo")}`);
  } else {
    log(`   node_modules   ${c.yellow("requiere instalación")}`);
    pending.push("Interface_web/node_modules");
  }

  if (!commandExists("docker")) {
    log(`   Docker         ${c.red("no instalado")}`);
    pending.push("Docker");
  } else if (dockerDaemonUp()) {
    log(`   Docker         ${c.green("daemon activo")}`);
  } else {
    log(`   Docker         ${c.yellow("daemon detenido")}`);
    pending.push("Docker daemon");
  }

  log("");
  if (pending.length === 0) {
    ok("Todo listo para `node dev.js`.");
    process.exitCode = 0;
  } else {
    warn(`Falta por resolver: ${pending.join(", ")}.`);
    process.exitCode = 1;
  }
}

function printHelp() {
  log("");
  log(c.blue("  dev.js · entorno de desarrollo de CONTABDSI"));
  log("");
  log("   node dev.js                  instala lo que falte, levanta db + backend + interfaz");
  log("                                e imprime las URLs; la terminal queda libre");
  log("   node dev.js --check          verifica herramientas y dependencias");
  log("   node dev.js --stop           detiene los servicios levantados");
  log("");
  log("   --no-db                      omite PostgreSQL");
  log("   --require-db                 falla si la base de datos no puede iniciar");
  log("   --no-install                 no instala dependencias");
  log("   --no-reload                  uvicorn sin recarga automática");
  log("   --keep-db                    no detiene PostgreSQL al hacer --stop");
  log("   --no-docker-autostart        no intenta abrir Docker Desktop");
  log("");
  log(c.dim("   Puertos: BACKEND_PORT, WEB_PORT/PORT, DB_PORT"));
  log(c.dim("   Si un puerto está ocupado, se libera antes de arrancar."));
  log(c.dim("   Logs: logs/<servicio>.log (backend, web, db)"));
  log("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Flujo principal
// ─────────────────────────────────────────────────────────────────────────────

let options = {};

function parseArgs(argv) {
  const parsed = {
    check: false,
    stop: false,
    help: false,
    db: true,
    install: true,
    requireDb: false,
    reload: true,
    keepDb: false,
    dockerAutostart: true,
  };

  for (const argument of argv) {
    switch (argument) {
      case "--check":
        parsed.check = true;
        break;
      case "--stop":
        parsed.stop = true;
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--no-db":
        parsed.db = false;
        break;
      case "--no-install":
        parsed.install = false;
        break;
      case "--require-db":
        parsed.requireDb = true;
        break;
      case "--no-reload":
        parsed.reload = false;
        break;
      case "--keep-db":
        parsed.keepDb = true;
        break;
      case "--no-docker-autostart":
        parsed.dockerAutostart = false;
        break;
      default:
        warn(`Opción desconocida: ${argument}`);
    }
  }
  return parsed;
}

async function main() {
  options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }
  if (options.stop) {
    stopAll();
    return;
  }
  if (options.check) {
    await runChecks();
    return;
  }

  log("");
  log(c.blue("  CONTABDSI · entorno de desarrollo"));
  log(c.dim(`  raíz: ${ROOT}`));

  if (options.install) {
    ensureBackendEnvironment();
    ensureFrontendEnvironment();
  } else {
    info("Instalación de dependencias omitida (--no-install).");
    verifyBackendEnvironment();
    verifyFrontendEnvironment();
  }

  if (options.db) {
    await ensureDatabase(options);
  } else {
    info("Base de datos omitida (--no-db).");
  }

  step("Levantando servicios");
  await releaseServicePorts();

  startBackend();
  startWeb();
  savePids();

  const ready = await Promise.all([
    waitForPort({ label: "backend", port: CONFIG.backendPort, timeoutMs: CONFIG.startupTimeoutMs, quiet: true }),
    waitForPort({ label: "interfaz web", port: CONFIG.webPort, timeoutMs: CONFIG.startupTimeoutMs, quiet: true }),
  ]);

  trackListeners(SERVICES.backend, CONFIG.backendPort);
  trackListeners(SERVICES.web, CONFIG.webPort);
  savePids();

  if (!ready[0]) warn(`El backend no respondió en el puerto ${CONFIG.backendPort}; revisa logs/backend.log.`);
  if (!ready[1]) warn(`La interfaz no respondió en el puerto ${CONFIG.webPort}; revisa logs/web.log.`);

  if (ready[0]) {
    const health = await httpStatus(`http://${CONFIG.backendHost}:${CONFIG.backendPort}/api/health`);
    if (health === null || health >= 400) {
      warn("El backend responde pero /api/health no confirma la conexión con Advantage.");
      warn("Revisa backend/.env (ADS_DATA_SOURCE, ADS_USER_ID, ADS_PASSWORD); la interfaz funciona sin datos reales.");
    }
  }

  printUrls();
  log(c.dim("  Los servicios quedan en segundo plano: puedes cerrar esta terminal."));
  log("");
}

process.on("SIGINT", () => {
  abortStarted();
  log("");
  info("Arranque interrumpido; se detuvo lo que ya estaba en marcha.");
  process.exit(130);
});

main().catch((error) => {
  fail(error.message);
  abortStarted();
  process.exit(1);
});

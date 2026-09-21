"""Herramientas (function calling) del asistente contable de CONTABDSI.

Este módulo es el punto de extensión del bot: el modelo solo puede ejecutar las
acciones declaradas aquí. El loop de ``app/deepseek.py`` las ejecuta en cuanto
se registran.

Para agregar una función:

1. Escribe el handler::

       async def buscar_cuenta(args: dict, ctx: dict) -> dict:
           ...

   - ``args``: argumentos que escribe el modelo (valídalos).
   - ``ctx``: estado de la conversación, con la compañía activa incluida.
   - **No consultes la base de datos**: usa ``app/backend.py``, que llama a la
     API del backend (``await backend.get("/api/cuentas", {"cia": cia})``).
   - Toma la compañía con ``backend.require_company(ctx)``.
   - **Resumen corto al modelo**: devuelve pocos campos agregados. Los datos
     grandes van a ``payload(ctx)``, que no se le envía al modelo sino al widget.
   - Envuelve la lógica en ``try/except backend.BackendError`` y devuelve
     ``backend.fail(exc)`` ante cualquier fallo.

2. Declara su esquema en ``TOOLS`` (nombre, descripción y parámetros JSON Schema).

3. Regístrala en ``FUNCTION_MAP``.

4. (Opcional) Añade una entrada a ``QUICK_OPTIONS`` como sugerencia del widget.
"""
import time
import unicodedata

from . import backend, config

# Máximo de coincidencias que se devuelven al modelo por consulta: mantiene el
# contexto corto y evita que el modelo transcriba listados enormes.
LIMITE_RESULTADOS = 10

# ─── Definiciones para DeepSeek ─────────────────────────────────

TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "buscar_cuenta",
            "description": (
                "Busca cuentas del plan de cuentas de la compañía activa por código "
                "o nombre. Úsala cuando el usuario mencione una cuenta (por código o "
                "por nombre) y necesites confirmar que existe y cuál es su código "
                "exacto. Devuelve hasta 10 coincidencias con código, nombre, nivel y "
                "si la cuenta es afectable."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "texto": {
                        "type": "string",
                        "description": "Código (completo o parcial) o parte del nombre de la cuenta.",
                    },
                },
                "required": ["texto"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_periodo",
            "description": (
                "Consulta el período contable habilitado de la compañía activa: año, "
                "mes sugerido y fecha sugerida. Úsala cuando no sepas en qué período "
                "está trabajando el usuario o antes de consultar movimientos."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_tercero",
            "description": (
                "Busca terceros (clientes y proveedores) por NIT, nombre o ciudad. "
                "Devuelve hasta 10 resultados con NIT, nombre, ciudad y estado."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "texto": {
                        "type": "string",
                        "description": "NIT, nombre o ciudad del tercero.",
                    },
                    "estado": {
                        "type": "string",
                        "enum": ["todos", "activo", "bloqueado"],
                        "description": "Filtra por estado del tercero. Por defecto, 'todos'.",
                    },
                },
                "required": ["texto"],
            },
        },
    },
]


# ─── Handlers ───────────────────────────────────────────────────

# Caché por compañía del catálogo resumido: (instante, cuentas).
_cuentas_cache: dict[str, tuple[float, list[dict]]] = {}


def _fold(texto: str) -> str:
    """Minúsculas sin tildes, para que 'lacteos' encuentre 'Lácteos'."""
    base = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in base if not unicodedata.combining(c)).lower().strip()


async def _cuentas_de(cia: str) -> list[dict]:
    """Catálogo de cuentas resumido y cacheado.

    ``/api/cuentas`` devuelve miles de filas (con sus movimientos mensuales);
    aquí se conserva solo lo que necesitan las herramientas y se reutiliza
    durante ``config.CATALOG_TTL_SECONDS``.
    """
    cacheado = _cuentas_cache.get(cia)
    if cacheado and time.monotonic() - cacheado[0] < config.CATALOG_TTL_SECONDS:
        return cacheado[1]

    data = await backend.get("/api/cuentas", {"cia": cia})
    resumen = [
        {
            "codigo": str(cuenta.get("codigo") or ""),
            "nombre": str(cuenta.get("nombre") or ""),
            "nivel": cuenta.get("nivel"),
            "afectable": bool(cuenta.get("afectable")),
        }
        for cuenta in (data.get("items") or [])
    ]
    _cuentas_cache[cia] = (time.monotonic(), resumen)
    return resumen


async def buscar_cuenta(args: dict, ctx: dict) -> dict:
    """Busca cuentas del plan por código (exacto o parcial) o por nombre."""
    texto = str(args.get("texto") or "").strip()
    if not texto:
        return {"ok": False, "mensaje": "Indica el código o el nombre de la cuenta a buscar."}

    try:
        cia = backend.require_company(ctx)
        cuentas = await _cuentas_de(cia)
    except backend.BackendError as exc:
        return backend.fail(exc)

    objetivo = _fold(texto)
    exactas: list[dict] = []
    por_codigo: list[dict] = []
    por_nombre: list[dict] = []
    for cuenta in cuentas:
        if cuenta["codigo"] == texto:
            exactas.append(cuenta)
        elif cuenta["codigo"].startswith(texto):
            por_codigo.append(cuenta)
        elif objetivo and objetivo in _fold(cuenta["nombre"]):
            por_nombre.append(cuenta)

    coincidencias = exactas + por_codigo + por_nombre
    if not coincidencias:
        return {
            "ok": True,
            "encontradas": 0,
            "mensaje": f"No hay cuentas que coincidan con '{texto}' en esta compañía.",
        }
    return {
        "ok": True,
        "encontradas": len(coincidencias[:LIMITE_RESULTADOS]),
        "totalCoincidencias": len(coincidencias),
        "cuentas": coincidencias[:LIMITE_RESULTADOS],
    }


async def consultar_periodo(args: dict, ctx: dict) -> dict:
    """Período contable habilitado para la compañía activa."""
    try:
        cia = backend.require_company(ctx)
        data = await backend.get("/api/periodo-operacion", {"cia": cia})
    except backend.BackendError as exc:
        return backend.fail(exc)

    item = data.get("item") or {}
    return {
        "ok": True,
        "anio": item.get("anio"),
        "periodoSugerido": item.get("periodoSugerido"),
        "fechaSugerida": item.get("fechaSugerida"),
        "mesesHabilitados": item.get("mesesHabilitados") or [],
    }


async def buscar_tercero(args: dict, ctx: dict) -> dict:
    """Busca terceros por NIT, nombre o ciudad."""
    texto = str(args.get("texto") or "").strip()
    if not texto:
        return {"ok": False, "mensaje": "Indica el NIT, el nombre o la ciudad del tercero."}

    estado = str(args.get("estado") or "todos").strip().lower()
    if estado not in ("todos", "activo", "bloqueado"):
        estado = "todos"

    try:
        data = await backend.get(
            "/api/terceros",
            {"q": texto, "estado": estado, "page": 1, "pageSize": LIMITE_RESULTADOS},
        )
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = data.get("items") or []
    return {
        "ok": True,
        "encontrados": len(items),
        "total": data.get("total"),
        "terceros": [
            {
                "nit": tercero.get("nit"),
                "nombre": tercero.get("nombre"),
                "ciudad": tercero.get("ciudad"),
                "estado": tercero.get("estado"),
            }
            for tercero in items
        ],
    }


# Nombre de la función -> handler ``async (args, ctx) -> dict``.
FUNCTION_MAP: dict = {
    "buscar_cuenta": buscar_cuenta,
    "consultar_periodo": consultar_periodo,
    "buscar_tercero": buscar_tercero,
}


def payload(ctx: dict) -> dict:
    """Depósito de datos estructurados para el frontend.

    Lo guardado aquí **no** se le envía al modelo: viaja en la respuesta de
    ``/chat`` para que el widget lo renderice (tablas, listas, enlaces).
    """
    return ctx.setdefault("payload", {})


# Opciones rápidas que muestra el widget mientras no hay conversación.
QUICK_OPTIONS: list[dict] = [
    {
        "id": "periodo",
        "label": "¿Cuál es el período habilitado?",
        "message": "¿Cuál es el período contable habilitado de esta compañía?",
    },
    {
        "id": "cuenta",
        "label": "Buscar una cuenta del plan",
        "message": "Busca en el plan de cuentas la cuenta de bancos.",
    },
    {
        "id": "tercero",
        "label": "Buscar un tercero",
        "message": "Busca el tercero con nombre GLOBEX.",
    },
    {
        "id": "comprobante",
        "label": "¿Cómo registro un comprobante contable?",
        "message": "Explícame los pasos para registrar un comprobante contable en CONTABDSI.",
    },
    {
        "id": "lote",
        "label": "¿Qué es un lote y cómo se verifica?",
        "message": "¿Qué es un lote de contabilización y cómo se verifica antes de contabilizar?",
    },
    {
        "id": "balance",
        "label": "¿Cómo consulto el balance de comprobación?",
        "message": "¿Cómo consulto e interpreto el balance de comprobación?",
    },
    {
        "id": "centro",
        "label": "¿Para qué sirve un centro de costo?",
        "message": "Explícame para qué sirve un centro de costo y cuándo debo usarlo.",
    },
]


async def get_enabled_quick_options() -> list[dict]:
    """Opciones rápidas vigentes (por ahora fijas, sin configuración por admin)."""
    return QUICK_OPTIONS

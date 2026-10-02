"""Herramientas (function calling) del asistente contable de CONTABDSI.

Este módulo es el punto de extensión del bot: el modelo solo puede ejecutar las
acciones declaradas aquí. El loop de ``app/deepseek.py`` las ejecuta en cuanto
se registran.

El servicio expone dos familias de herramientas: las **consultas del libro y el
movimiento** (plan de cuentas, movimiento mensual, documentos y su detalle) y las
**consultas de catálogos y parámetros** (período y parámetros de operación,
compañías, terceros, comprobantes, tipos de documento, centros de costo y lotes).

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
import re
import time
import unicodedata
from urllib.parse import quote

from . import backend, config

# Máximo de coincidencias que se devuelven al modelo por consulta: mantiene el
# contexto corto y evita que el modelo transcriba listados enormes.
LIMITE_RESULTADOS = 10

# Tamaño de página FIJO de las consultas de datos. El modelo no lo elige: así las
# respuestas que recibe son de tamaño predecible y no puede pedir volcados
# grandes. Para recorrer más filas el modelo avanza con ``page``.
PAGE_SIZE_MOVIMIENTOS = 50
PAGE_SIZE_DOCUMENTOS = 50

# Vida de la caché del período habilitado. Es corto porque el usuario puede
# cambiar de período mientras conversa.
PERIODO_TTL_SECONDS = 60.0

# Diferencia tolerada (en pesos) al comparar débitos y créditos de un documento.
TOLERANCIA_CUADRE = 0.01

# ─── Topes y patrones de las herramientas de catálogos y parámetros ───

ESTADOS_TERCERO = ("todos", "activo", "bloqueado")

# El código de lote comparte el patrón del backend (``lotes_repository.py``,
# LOT_CODE) acotado a los 10 caracteres que admite la ruta.
LOTE_PATTERN = re.compile(r"^[A-Za-z0-9 ._/-]{1,10}$")

# El modelo nunca pide páginas en los catálogos: un tope fijo evita que invente
# paginación o pida páginas vacías.
TOPE_COMPANIAS = 20
TOPE_TERCEROS = 10
TOPE_ERRORES_TABLA = 5

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
    {
        "type": "function",
        "function": {
            "name": "consultar_movimiento_mensual",
            "description": (
                "Consulta el movimiento contable (libro mensual) de un período: "
                "débitos, créditos y saldo, con filtros opcionales por rango de "
                "cuentas, tercero, comprobante, centro de costo o documento. "
                "Devuelve los totales del período completo (no solo de la página) "
                "y una muestra de los renglones. Si no indicas año o mes, usa el "
                "período habilitado. Es la función para preguntas como 'cuánto se "
                "movió la cuenta 4135 en marzo' o 'muéstrame el movimiento del mes'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {"type": "integer", "description": "Año del período, p. ej. 2025."},
                    "mes": {"type": "integer", "description": "Mes del período, de 1 a 12."},
                    "cuentaDesde": {"type": "string", "description": "Código de cuenta inicial del rango (solo dígitos)."},
                    "cuentaHasta": {"type": "string", "description": "Código de cuenta final del rango (solo dígitos)."},
                    "tercero": {"type": "string", "description": "NIT del tercero por el que se filtra."},
                    "comprobante": {"type": "string", "description": "Código del comprobante contable."},
                    "centro": {"type": "string", "description": "Código del centro de costo."},
                    "documento": {"type": "string", "description": "Número del documento contable."},
                    "page": {"type": "integer", "description": "Página a partir de 1. Cada página trae 50 renglones."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_documentos",
            "description": (
                "Lista los documentos contabilizados (cabeceras) con su fecha, "
                "comprobante, tipo documental, tercero y valor. Devuelve el total de "
                "documentos y el valor total de los que cumplen los filtros, más una "
                "muestra. Exige al menos un filtro; si no das ninguno usa el período "
                "habilitado. Úsala para ubicar un documento cuyo detalle quieras ver "
                "o para resumir la documentación de un período o de un tercero."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "periodo": {"type": "string", "description": "Período en formato AAAA-MM, p. ej. '2025-03'."},
                    "comprobante": {"type": "string", "description": "Código del comprobante contable."},
                    "tipoDocumento": {"type": "string", "description": "Código del tipo documental."},
                    "nit": {"type": "string", "description": "NIT del tercero del documento."},
                    "fechaDesde": {"type": "string", "description": "Fecha inicial en formato AAAA-MM-DD."},
                    "fechaHasta": {"type": "string", "description": "Fecha final en formato AAAA-MM-DD."},
                    "documento": {"type": "string", "description": "Número del documento contable."},
                    "page": {"type": "integer", "description": "Página a partir de 1. Cada página trae 50 documentos."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_documento_detalle",
            "description": (
                "Devuelve las partidas (renglones) de un documento contabilizado y "
                "verifica si cuadra (débitos iguales a créditos). Necesita la clave "
                "completa del documento —documento, comprobante, tipo documental y "
                "fecha— tal como aparece en consultar_documentos: no la adivines; si "
                "te falta un dato, pídelo al usuario o búscalo primero."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "documento": {"type": "string", "description": "Número del documento contable."},
                    "comprobante": {"type": "string", "description": "Código del comprobante contable."},
                    "tipoDocumento": {"type": "string", "description": "Código del tipo documental."},
                    "fecha": {"type": "string", "description": "Fecha del documento en formato AAAA-MM-DD."},
                },
                "required": ["documento", "comprobante", "tipoDocumento", "fecha"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_periodo_operacion",
            "description": (
                "Devuelve el período contable habilitado de la compañía activa: año, "
                "meses habilitados, período sugerido y fecha sugerida. Úsala siempre "
                "que el usuario pregunte en qué período está o cuando necesites ubicar "
                "una consulta en el tiempo. No la uses para saldos ni movimientos."
            ),
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_parametros_operacion",
            "description": (
                "Lee los parámetros de operación vigentes de la compañía activa "
                "(controles de captura, períodos habilitados y demás banderas de "
                "CONCTR). Úsala para responder si la compañía exige algo al "
                "contabilizar o si un período está habilitado. No la uses para "
                "modificar nada: la modificación no está disponible."
            ),
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_companias",
            "description": (
                "Lista las compañías que existen en el motor activo. Úsala cuando "
                "pregunten qué compañías hay, con cuál están trabajando o si existe un "
                "código de compañía. Si el origen que devuelve es DEMO, dilo: son "
                "datos de respaldo, no del sistema real."
            ),
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_comprobantes",
            "description": (
                "Lista los comprobantes contables definidos para la compañía activa. "
                "Úsala cuando pregunten qué comprobante usar para un tipo de operación "
                "o cuál es el código de un comprobante. No confundas comprobante con "
                "tipo de documento."
            ),
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_tipos_documento",
            "description": (
                "Lista los tipos de documento del catálogo global (se comparten entre "
                "compañías). Úsala cuando pregunten por el código de un tipo de "
                "documento, por ejemplo para consultar un documento específico."
            ),
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_centros",
            "description": (
                "Lista los centros de costo de la compañía activa con su nombre. Úsala "
                "cuando pregunten si existe un centro, cómo se llama o cuál usar. No la "
                "uses para saldos por centro: para eso está la pantalla de saldos "
                "cuenta-centro."
            ),
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "verificar_lote",
            "description": (
                "Verifica la consistencia de un lote (partidas descuadradas, documentos "
                "duplicados, totales). Es de lectura: no contabiliza nada. Úsala cuando "
                "pregunten si un lote está cuadrado o qué le falta antes de "
                "contabilizar. Si no sabes el código del lote, pídeselo al usuario o "
                "consúltalo en la pantalla de Lotes."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "lote": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 10,
                        "description": "Código exacto del lote, como aparece en CONMOVI.",
                    }
                },
                "required": ["lote"],
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
    mostradas = coincidencias[:LIMITE_RESULTADOS]

    _tabla(
        ctx,
        titulo=f"Cuentas: '{texto}'",
        subtitulo=f"Coincidencias: {len(mostradas)} de {len(coincidencias)}",
        columnas=[
            _columna("codigo", "Código"),
            _columna("nombre", "Nombre"),
            _columna("nivel", "Nivel", "entero"),
            _columna("afectable", "Afectable", "estado"),
        ],
        filas=[
            {
                "codigo": cuenta["codigo"],
                "nombre": cuenta["nombre"],
                "nivel": cuenta["nivel"],
                "afectable": "Sí" if cuenta["afectable"] else "No",
            }
            for cuenta in mostradas
        ],
    )

    if not coincidencias:
        return {
            "ok": True,
            "encontradas": 0,
            "mensaje": f"No hay cuentas que coincidan con '{texto}' en esta compañía.",
        }
    return {
        "ok": True,
        "encontradas": len(mostradas),
        "totalCoincidencias": len(coincidencias),
        "cuentas": mostradas,
    }


async def consultar_periodo(args: dict, ctx: dict) -> dict:
    """Período contable habilitado para la compañía activa."""
    try:
        cia = backend.require_company(ctx)
        data = await backend.get("/api/periodo-operacion", {"cia": cia})
    except backend.BackendError as exc:
        return backend.fail(exc)

    item = data.get("item") or {}
    _tabla_campos(
        ctx,
        titulo=f"Período habilitado · compañía {cia}",
        subtitulo="Período de operación",
        campos=[
            ["Año", item.get("anio")],
            ["Período sugerido", item.get("periodoSugerido")],
            ["Fecha sugerida", item.get("fechaSugerida")],
            ["Meses habilitados", ", ".join(str(mes) for mes in (item.get("mesesHabilitados") or []))],
        ],
    )
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
    if len(texto) > 60:
        return {"ok": False, "mensaje": "La búsqueda admite máximo 60 caracteres."}

    estado = str(args.get("estado") or "todos").strip().lower()
    if estado not in ESTADOS_TERCERO:
        estado = "todos"

    try:
        data = await backend.get(
            "/api/terceros",
            {"q": texto, "estado": estado, "page": 1, "pageSize": LIMITE_RESULTADOS},
        )
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = data.get("items") or []
    total = data.get("total")
    total_int = int(total) if total is not None else len(items)
    pagina = int(data.get("page") or 1)
    tamano = int(data.get("pageSize") or LIMITE_RESULTADOS)
    origen = str(data.get("source") or "FADCLI")
    compartido = bool(data.get("sharedAcrossCompanies", True))
    hay_mas = pagina * tamano < total_int

    nota = ""
    if not items:
        nota = (
            f"No hay terceros que coincidan con '{texto}' (estado {estado}). "
            "No supongas que el tercero existe con otro NIT."
        )
    elif hay_mas:
        nota = f"Se muestran {len(items)} de {total_int} coincidencias; acota la búsqueda."

    _tabla(
        ctx,
        titulo=f"Terceros: búsqueda '{texto}'",
        subtitulo=f"Estado: {estado} · Origen: {origen}",
        columnas=[
            _columna("nit", "NIT"),
            _columna("nombre", "Nombre"),
            _columna("tipo", "Tipo"),
            _columna("ciudad", "Ciudad"),
            _columna("telefono", "Teléfono"),
            _columna("estado", "Estado", "estado"),
            _columna("cupo", "Cupo", "moneda"),
        ],
        filas=[
            {
                "nit": tercero.get("nit"),
                "nombre": tercero.get("nombre"),
                "tipo": tercero.get("tipo"),
                "ciudad": tercero.get("ciudad"),
                "telefono": tercero.get("telefono"),
                "estado": tercero.get("estado"),
                "cupo": tercero.get("cupo"),
            }
            for tercero in items
        ],
        totales=[{"label": "Coincidencias", "valor": total_int, "tipo": "entero"}],
        nota=nota,
    )

    resultado = {
        "ok": True,
        "encontrados": len(items),
        "total": total,
        "count": total_int,
        "hayMas": hay_mas,
        "origen": origen,
        "compartidoEntreCompanias": compartido,
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
    if nota:
        resultado["nota"] = nota
    return resultado


# ─── Movimiento mensual y documentos (Fase 2) ───

# Caché por compañía del período habilitado: (instante, periodo).
_periodo_cache: dict[str, tuple[float, dict]] = {}


def _texto(valor) -> str:
    """Normaliza un argumento del modelo a texto sin espacios sobrantes."""
    return str(valor).strip() if valor is not None else ""


def _entero(valor, defecto: int | None = None) -> int | None:
    """Convierte un argumento numérico del modelo; ``None`` si no es un entero."""
    if valor is None or valor == "":
        return defecto
    try:
        return int(valor)
    except (TypeError, ValueError):
        return defecto


async def _periodo_actual(cia: str) -> dict:
    """Período habilitado de la compañía, cacheado unos segundos.

    Se usa para completar el período cuando el usuario no lo indica, en lugar de
    dejar que el modelo lo invente.
    """
    cacheado = _periodo_cache.get(cia)
    if cacheado and time.monotonic() - cacheado[0] < PERIODO_TTL_SECONDS:
        return cacheado[1]

    data = await backend.get("/api/periodo-operacion", {"cia": cia})
    item = data.get("item") or {}
    sugerido = _texto(item.get("periodoSugerido"))
    anio = _entero(item.get("anio"))
    mes = None
    if len(sugerido) == 7 and sugerido[4] == "-":
        anio = _entero(sugerido[:4], anio)
        mes = _entero(sugerido[5:7])
    periodo = {
        "anio": anio,
        "mes": mes,
        "sugerido": sugerido,
        "fechaSugerida": _texto(item.get("fechaSugerida")),
        "mesesHabilitados": item.get("mesesHabilitados") or [],
    }
    _periodo_cache[cia] = (time.monotonic(), periodo)
    return periodo


def _columna(key: str, label: str, tipo: str = "texto") -> dict:
    """Columna de una tabla del visor. ``tipo`` guía el formato en el frontend."""
    return {"key": key, "label": label, "tipo": tipo}


def _tabla(
    ctx: dict,
    *,
    titulo: str,
    subtitulo: str,
    columnas: list[dict],
    filas: list[dict],
    totales: list[dict] | None = None,
    nota: str = "",
) -> None:
    """Agrega una tabla al payload del visor (no viaja al modelo).

    Varias herramientas pueden aportar tablas en un mismo turno: el visor las
    muestra juntas, así el usuario pide el balance, el movimiento y el documento
    por separado y los revisa en un solo lugar.
    """
    payload(ctx).setdefault("bloques", []).append(
        {
            "tipo": "tabla",
            "titulo": titulo,
            "subtitulo": subtitulo,
            "columnas": columnas,
            "filas": filas,
            "totales": totales or [],
            "nota": nota,
        }
    )


_ETIQUETAS_FILTRO = {
    "cuentaDesde": "Cuenta desde",
    "cuentaHasta": "Cuenta hasta",
    "tercero": "Tercero",
    "comprobante": "Comprobante",
    "centro": "Centro",
    "documento": "Documento",
    "periodo": "Período",
    "tipoDocumento": "Tipo doc.",
    "nit": "NIT",
    "fechaDesde": "Desde",
    "fechaHasta": "Hasta",
}


# Recordatorio que se le da al modelo: la tabla completa la ve el usuario en el
# visor, así que transcribirla solo infla el contexto y baja la calidad.
_NOTA_VISOR = (
    "El detalle completo de la tabla ya está a la vista del usuario: no lo "
    "transcribas. Apóyate en los totales y en la muestra para tu respuesta."
)


def _descripcion_filtros(base: str, filtros: dict[str, str]) -> str:
    """Subtítulo de la tabla con los filtros realmente aplicados."""
    partes = [base]
    for clave, valor in filtros.items():
        if valor:
            partes.append(f"{_ETIQUETAS_FILTRO.get(clave, clave)}: {valor}")
    return " · ".join(partes)


async def consultar_movimiento_mensual(args: dict, ctx: dict) -> dict:
    """Movimiento contable del mes con totales reales del período completo."""
    try:
        cia = backend.require_company(ctx)
    except backend.BackendError as exc:
        return backend.fail(exc)

    anio = _entero(args.get("anio"))
    mes = _entero(args.get("mes"))
    periodo_asumido = False
    if anio is None or mes is None:
        try:
            periodo = await _periodo_actual(cia)
        except backend.BackendError as exc:
            return backend.fail(exc)
        if not periodo["anio"] or not periodo["mes"]:
            return {
                "ok": False,
                "mensaje": "No pude determinar el período habilitado de la compañía.",
            }
        anio = anio or periodo["anio"]
        mes = mes or periodo["mes"]
        periodo_asumido = True

    if not 1900 <= anio <= 2100:
        return {"ok": False, "mensaje": "El año del período debe estar entre 1900 y 2100."}
    if not 1 <= mes <= 12:
        return {"ok": False, "mensaje": "El mes del período debe estar entre 1 y 12."}

    page = _entero(args.get("page"), 1) or 1
    page = max(page, 1)

    filtros = {
        "cuentaDesde": _texto(args.get("cuentaDesde")),
        "cuentaHasta": _texto(args.get("cuentaHasta")),
        "tercero": _texto(args.get("tercero")),
        "comprobante": _texto(args.get("comprobante")),
        "centro": _texto(args.get("centro")),
        "documento": _texto(args.get("documento")),
    }

    try:
        data = await backend.get(
            "/api/movimiento-mensual",
            {
                "cia": cia,
                "anio": anio,
                "mes": mes,
                "page": page,
                "pageSize": PAGE_SIZE_MOVIMIENTOS,
                **filtros,
            },
        )
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = data.get("items") or []
    periodo_txt = f"{anio:04d}-{mes:02d}"
    debito = float(data.get("periodDebit") or 0)
    credito = float(data.get("periodCredit") or 0)
    saldo = float(data.get("periodSaldo") or 0)
    aplicados = {clave: valor for clave, valor in filtros.items() if valor}

    _tabla(
        ctx,
        titulo=f"Movimiento mensual · {periodo_txt}",
        subtitulo=_descripcion_filtros(f"Período {periodo_txt}", aplicados),
        columnas=[
            _columna("fecha", "Fecha", "fecha"),
            _columna("comprobante", "Comp."),
            _columna("documento", "Documento"),
            _columna("cuenta", "Cuenta"),
            _columna("nit", "Tercero"),
            _columna("concepto", "Concepto"),
            _columna("debito", "Débito", "moneda"),
            _columna("credito", "Crédito", "moneda"),
        ],
        filas=[
            {
                "fecha": item.get("fecha"),
                "comprobante": item.get("comprobante"),
                "documento": item.get("documento"),
                "cuenta": item.get("cuenta"),
                "nit": item.get("nit"),
                "concepto": item.get("concepto"),
                "debito": item.get("debito"),
                "credito": item.get("credito"),
            }
            for item in items
        ],
        totales=[
            {"label": "Débito (período)", "valor": debito, "tipo": "moneda"},
            {"label": "Crédito (período)", "valor": credito, "tipo": "moneda"},
            {"label": "Saldo (período)", "valor": saldo, "tipo": "moneda"},
        ],
        nota=(
            "Totales del período completo con los filtros aplicados, no solo de la "
            "página mostrada."
        ),
    )

    return {
        "ok": True,
        "periodo": periodo_txt,
        "periodoAsumido": periodo_asumido,
        "filtros": aplicados,
        "page": data.get("page"),
        "pageSize": data.get("pageSize"),
        "hasMore": bool(data.get("hasMore")),
        "filasEnPagina": len(items),
        "totalDebitoPeriodo": debito,
        "totalCreditoPeriodo": credito,
        "saldoPeriodo": saldo,
        "muestra": [
            {
                "fecha": item.get("fecha"),
                "cuenta": item.get("cuenta"),
                "concepto": item.get("concepto"),
                "debito": item.get("debito"),
                "credito": item.get("credito"),
            }
            for item in items[:LIMITE_RESULTADOS]
        ],
        "nota": _NOTA_VISOR,
    }


async def consultar_documentos(args: dict, ctx: dict) -> dict:
    """Cabeceras de documentos contabilizados, con totales de todos los filtrados."""
    try:
        cia = backend.require_company(ctx)
    except backend.BackendError as exc:
        return backend.fail(exc)

    page = _entero(args.get("page"), 1) or 1
    page = max(page, 1)

    filtros = {
        "periodo": _texto(args.get("periodo")),
        "comprobante": _texto(args.get("comprobante")),
        "tipoDocumento": _texto(args.get("tipoDocumento")),
        "nit": _texto(args.get("nit")),
        "fechaDesde": _texto(args.get("fechaDesde")),
        "fechaHasta": _texto(args.get("fechaHasta")),
        "documento": _texto(args.get("documento")),
    }

    periodo_asumido = False
    if not any(filtros.values()):
        try:
            periodo = await _periodo_actual(cia)
        except backend.BackendError as exc:
            return backend.fail(exc)
        if not periodo["sugerido"]:
            return {
                "ok": False,
                "mensaje": "No pude determinar el período habilitado de la compañía.",
            }
        filtros["periodo"] = periodo["sugerido"]
        periodo_asumido = True

    try:
        data = await backend.get(
            "/api/documentos",
            {
                "cia": cia,
                "page": page,
                "pageSize": PAGE_SIZE_DOCUMENTOS,
                **filtros,
            },
        )
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = data.get("items") or []
    total_documentos = int(data.get("totalDocumentos") or 0)
    total_valor = float(data.get("totalValor") or 0)
    aplicados = {clave: valor for clave, valor in filtros.items() if valor}

    _tabla(
        ctx,
        titulo="Documentos contabilizados",
        subtitulo=_descripcion_filtros("Todos los filtros aplicados", aplicados),
        columnas=[
            _columna("fecha", "Fecha", "fecha"),
            _columna("comprobante", "Comp."),
            _columna("tipoDocumento", "Tipo"),
            _columna("documento", "Documento"),
            _columna("nit", "NIT"),
            _columna("tercero", "Tercero"),
            _columna("detalle", "Detalle"),
            _columna("valor", "Valor", "moneda"),
        ],
        filas=[
            {
                "fecha": item.get("fecha"),
                "comprobante": item.get("comprobante"),
                "tipoDocumento": item.get("tipoDocumento"),
                "documento": item.get("documento"),
                "nit": item.get("nit"),
                "tercero": item.get("tercero"),
                "detalle": item.get("detalle"),
                "valor": item.get("valor"),
            }
            for item in items
        ],
        totales=[
            {"label": "Documentos", "valor": total_documentos, "tipo": "entero"},
            {"label": "Valor total", "valor": total_valor, "tipo": "moneda"},
        ],
        nota="Totales de todos los documentos que cumplen los filtros, no solo de la página.",
    )

    return {
        "ok": True,
        "periodoAsumido": periodo_asumido,
        "filtros": aplicados,
        "page": data.get("page"),
        "pageSize": data.get("pageSize"),
        "hasMore": bool(data.get("hasMore")),
        "filasEnPagina": len(items),
        "totalDocumentos": total_documentos,
        "totalValor": total_valor,
        "muestra": [
            {
                "fecha": item.get("fecha"),
                "comprobante": item.get("comprobante"),
                "tipoDocumento": item.get("tipoDocumento"),
                "documento": item.get("documento"),
                "nit": item.get("nit"),
                "valor": item.get("valor"),
            }
            for item in items[:LIMITE_RESULTADOS]
        ],
        "nota": (
            _NOTA_VISOR
            + " Si el usuario quiere ver el detalle de alguno, pide la clave completa "
            "(documento, comprobante, tipo documental y fecha) de ese renglón."
        ),
    }


async def consultar_documento_detalle(args: dict, ctx: dict) -> dict:
    """Partidas de un documento y verificación de cuadre débito/crédito."""
    try:
        cia = backend.require_company(ctx)
    except backend.BackendError as exc:
        return backend.fail(exc)

    documento = _texto(args.get("documento"))
    comprobante = _texto(args.get("comprobante"))
    tipo = _texto(args.get("tipoDocumento"))
    fecha = _texto(args.get("fecha"))
    if not all((documento, comprobante, tipo, fecha)):
        return {
            "ok": False,
            "mensaje": (
                "Para ver el detalle necesito la clave completa del documento: número, "
                "comprobante, tipo documental y fecha. Búscala con consultar_documentos "
                "y no la inventes."
            ),
        }

    try:
        data = await backend.get(
            "/api/documentos/detalle",
            {
                "cia": cia,
                "documento": documento,
                "comprobante": comprobante,
                "tipoDocumento": tipo,
                "fecha": fecha,
            },
        )
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = data.get("items") or []
    total_debito = round(sum(float(item.get("debito") or 0) for item in items), 2)
    total_credito = round(sum(float(item.get("credito") or 0) for item in items), 2)
    diferencia = round(total_debito - total_credito, 2)
    cuadra = abs(diferencia) < TOLERANCIA_CUADRE

    _tabla(
        ctx,
        titulo=f"Documento {documento}",
        subtitulo=f"Comprobante {comprobante} · Tipo {tipo} · {fecha}",
        columnas=[
            _columna("cuenta", "Cuenta"),
            _columna("nombreCuenta", "Nombre de la cuenta"),
            _columna("nit", "Tercero"),
            _columna("centro", "Centro"),
            _columna("concepto", "Concepto"),
            _columna("base", "Base", "moneda"),
            _columna("debito", "Débito", "moneda"),
            _columna("credito", "Crédito", "moneda"),
        ],
        filas=[
            {
                "cuenta": item.get("cuenta"),
                "nombreCuenta": item.get("nombreCuenta"),
                "nit": item.get("nit"),
                "centro": item.get("centro"),
                "concepto": item.get("concepto"),
                "base": item.get("base"),
                "debito": item.get("debito"),
                "credito": item.get("credito"),
            }
            for item in items
        ],
        totales=[
            {"label": "Partidas", "valor": len(items), "tipo": "entero"},
            {"label": "Débito", "valor": total_debito, "tipo": "moneda"},
            {"label": "Crédito", "valor": total_credito, "tipo": "moneda"},
            {"label": "Diferencia", "valor": diferencia, "tipo": "moneda"},
            {"label": "Cuadra", "valor": "Sí" if cuadra else "No", "tipo": "estado"},
        ],
        nota="El cuadre se calcula sobre los renglones devueltos por el sistema.",
    )

    return {
        "ok": True,
        "documento": documento,
        "comprobante": comprobante,
        "tipoDocumento": tipo,
        "fecha": fecha,
        "partidas": len(items),
        "totalDebito": total_debito,
        "totalCredito": total_credito,
        "diferencia": diferencia,
        "cuadra": cuadra,
        "nota": _NOTA_VISOR,
    }


# ─── Catálogos y parámetros de operación ───
#
# Herramientas de «Ola 1» (``docs/plan/bot/HERRAMIENTAS_PRIORIZADAS.md``, 3.1)
# sobre la arquitectura de ``backend.py``. Salvo las de alcance global
# (compañías y tipos de documento), todas exigen la compañía activa.


def _resumen(datos: dict, campos: tuple[str, ...]) -> dict:
    """Copia al resumen solo los campos que existen en la respuesta del backend."""
    return {campo: datos[campo] for campo in campos if campo in datos}


def _tabla_campos(ctx: dict, *, titulo: str, subtitulo: str, campos: list[list]) -> None:
    """Tabla de dos columnas (campo/valor) para las respuestas de un solo registro."""
    _tabla(
        ctx,
        titulo=titulo,
        subtitulo=subtitulo,
        columnas=[_columna("campo", "Campo"), _columna("valor", "Valor")],
        filas=[{"campo": str(campo), "valor": valor} for campo, valor in campos],
    )


# ---------------------------------------------------------------------------
# T-01 · C01 - Consultar el período de operación
# ---------------------------------------------------------------------------
async def consultar_periodo_operacion(args: dict, ctx: dict) -> dict:
    """Período contable habilitado de la compañía activa (CONCTR)."""
    try:
        cia = backend.require_company(ctx)
        data = await backend.get("/api/periodo-operacion", {"cia": cia})
    except backend.BackendError as exc:
        return backend.fail(exc)

    periodo = data.get("item")
    if not periodo:
        return {
            "ok": False,
            "mensaje": f"El backend no devolvió el período de operación de la compañía {cia}.",
        }

    origen = str(data.get("source") or "")
    meses = ", ".join(str(mes) for mes in (periodo.get("mesesHabilitados") or []))
    _tabla_campos(
        ctx,
        titulo=f"Período de operación · compañía {cia}",
        subtitulo=f"Origen: {origen}" if origen else "Período habilitado",
        campos=[
            ["Año", periodo.get("anio")],
            ["Meses habilitados", meses],
            ["Período sugerido", periodo.get("periodoSugerido")],
            ["Fecha sugerida", periodo.get("fechaSugerida")],
        ],
    )
    return {"ok": True, "periodo": periodo, "origen": origen}


# ---------------------------------------------------------------------------
# T-02 · C02 - Consultar los parámetros de operación
# ---------------------------------------------------------------------------
async def consultar_parametros_operacion(args: dict, ctx: dict) -> dict:
    """Parámetros de operación vigentes de la compañía activa (CONCTR)."""
    try:
        cia = backend.require_company(ctx)
        data = await backend.get("/api/parametros-operacion", {"cia": cia})
    except backend.BackendError as exc:
        return backend.fail(exc)

    parametros = data.get("item")
    if not parametros:
        return {
            "ok": False,
            "mensaje": f"El backend no devolvió los parámetros de operación de la compañía {cia}.",
        }

    origen = str(data.get("source") or "")
    periodos = parametros.get("periodosHabilitados") or {}
    habilitados = sorted(codigo_mes for codigo_mes, activo in periodos.items() if activo)
    _tabla_campos(
        ctx,
        titulo=f"Parámetros de operación · compañía {cia}",
        subtitulo=f"Origen: {origen}" if origen else "Parámetros vigentes",
        campos=[
            ["Nombre de empresa", parametros.get("nombreEmpresa")],
            ["NIT", parametros.get("nit")],
            ["Año de operación", parametros.get("anioOperacion")],
            ["Verifica documentos de lotes", parametros.get("verificaDocumentosLotes")],
            ["Terceros en documentos propios", parametros.get("tercerosDocumentosPropios")],
            ["Controla usuario de lotes", parametros.get("controlaUsuarioLotes")],
            ["Períodos habilitados", ", ".join(habilitados)],
        ],
    )
    return {"ok": True, "parametros": parametros, "origen": origen}


# ---------------------------------------------------------------------------
# T-03 · C03 - Listar compañías
# ---------------------------------------------------------------------------
async def listar_companias(args: dict, ctx: dict) -> dict:
    """Compañías del motor activo (CONEMP, tabla ``companias`` o respaldo DEMO)."""
    try:
        data = await backend.get("/api/companias")
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = list(data.get("items") or [])
    total = int(data.get("count") if data.get("count") is not None else len(items))
    origen = str(data.get("source") or "")
    mostradas = items[:TOPE_COMPANIAS]

    nota = ""
    if origen == "DEMO":
        nota = (
            "El backend respondió con compañías de respaldo (ADS_DEV_FALLBACK), "
            "no con las del sistema real: dilo al usuario."
        )
    elif len(mostradas) < total:
        nota = f"Se muestran {len(mostradas)} de {total} compañías."

    _tabla(
        ctx,
        titulo="Compañías del motor activo",
        subtitulo=f"Origen: {origen}" if origen else "Motor activo",
        columnas=[
            _columna("codigo", "Código"),
            _columna("nombre", "Nombre"),
            _columna("nit", "NIT"),
            _columna("habilitada", "Habilitada", "estado"),
        ],
        filas=[
            {
                "codigo": item.get("codigo"),
                "nombre": item.get("nombre"),
                "nit": item.get("nit"),
                "habilitada": item.get("habilitada"),
            }
            for item in mostradas
        ],
        totales=[{"label": "Compañías", "valor": total, "tipo": "entero"}],
        nota=nota,
    )

    resultado = {"ok": True, "items": mostradas, "count": total, "origen": origen}
    if len(mostradas) < total:
        resultado["nota"] = nota
    if origen == "DEMO":
        resultado["aviso"] = nota
    return resultado


# ---------------------------------------------------------------------------
# T-05 · C06 - Consultar comprobantes
# ---------------------------------------------------------------------------
async def consultar_comprobantes(args: dict, ctx: dict) -> dict:
    """Comprobantes contables definidos para la compañía activa (CONTICOM)."""
    try:
        cia = backend.require_company(ctx)
        data = await backend.get("/api/comprobantes", {"cia": cia})
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = list(data.get("items") or [])
    total = int(data.get("count") if data.get("count") is not None else len(items))
    origen = str(data.get("source") or "")

    _tabla(
        ctx,
        titulo=f"Comprobantes · compañía {cia}",
        subtitulo=f"Origen: {origen}" if origen else "Comprobantes contables",
        columnas=[
            _columna("codigo", "Código"),
            _columna("nombre", "Nombre"),
            _columna("historico", "Histórico"),
            _columna("descripcionAuxiliar", "Descripción auxiliar"),
        ],
        filas=[
            {
                "codigo": item.get("codigo"),
                "nombre": item.get("nombre"),
                "historico": item.get("historico"),
                "descripcionAuxiliar": item.get("descripcionAuxiliar"),
            }
            for item in items
        ],
        totales=[{"label": "Comprobantes", "valor": total, "tipo": "entero"}],
    )
    return {"ok": True, "items": items, "count": total, "origen": origen}


# ---------------------------------------------------------------------------
# T-06 · C07 - Consultar tipos de documento
# ---------------------------------------------------------------------------
async def consultar_tipos_documento(args: dict, ctx: dict) -> dict:
    """Tipos de documento del catálogo global (VISDOCUM)."""
    try:
        data = await backend.get("/api/tipos-documento")
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = list(data.get("items") or [])
    total = int(data.get("count") if data.get("count") is not None else len(items))
    origen = str(data.get("source") or "")

    _tabla(
        ctx,
        titulo="Tipos de documento (catálogo global)",
        subtitulo=f"Origen: {origen}" if origen else "Catálogo global",
        columnas=[
            _columna("codigo", "Código"),
            _columna("nombre", "Nombre"),
            _columna("nombreModulo", "Módulo"),
            _columna("prefijo", "Prefijo"),
            _columna("comprobante", "Comprobante"),
            _columna("consecutivo", "Consecutivo"),
        ],
        filas=[
            {
                "codigo": item.get("codigo"),
                "nombre": item.get("nombre"),
                "nombreModulo": item.get("nombreModulo"),
                "prefijo": item.get("prefijo"),
                "comprobante": item.get("comprobante"),
                "consecutivo": item.get("consecutivo"),
            }
            for item in items
        ],
        totales=[{"label": "Tipos", "valor": total, "tipo": "entero"}],
    )
    return {"ok": True, "items": items, "count": total, "origen": origen}


# ---------------------------------------------------------------------------
# T-07 · C08 - Consultar centros de costo
# ---------------------------------------------------------------------------
async def consultar_centros(args: dict, ctx: dict) -> dict:
    """Centros de costo de la compañía activa (CONCECOS)."""
    try:
        cia = backend.require_company(ctx)
        data = await backend.get("/api/centros", {"cia": cia})
    except backend.BackendError as exc:
        return backend.fail(exc)

    items = list(data.get("items") or [])
    total = int(data.get("count") if data.get("count") is not None else len(items))
    origen = str(data.get("source") or "")

    _tabla(
        ctx,
        titulo=f"Centros de costo · compañía {cia}",
        subtitulo=f"Origen: {origen}" if origen else "Centros de costo",
        columnas=[
            _columna("codigo", "Código"),
            _columna("nombre", "Nombre"),
            _columna("nivel", "Nivel", "entero"),
            _columna("padre", "Padre"),
            _columna("habilita", "Habilitado", "estado"),
        ],
        filas=[
            {
                "codigo": item.get("codigo"),
                "nombre": item.get("nombre"),
                "nivel": item.get("nivel"),
                "padre": item.get("padre"),
                "habilita": item.get("habilita"),
            }
            for item in items
        ],
        totales=[{"label": "Centros", "valor": total, "tipo": "entero"}],
    )
    return {"ok": True, "items": items, "count": total, "origen": origen}


# ---------------------------------------------------------------------------
# T-08 · C27 - Verificar un lote
# ---------------------------------------------------------------------------
async def verificar_lote(args: dict, ctx: dict) -> dict:
    """Verifica la consistencia de un lote. Es lectura: no contabiliza nada."""
    lote = _texto(args.get("lote"))
    if not lote:
        return {
            "ok": False,
            "mensaje": (
                "Falta el argumento 'lote': escribe el código exacto del lote, tal "
                "como aparece en la pantalla de Lotes."
            ),
        }
    if not LOTE_PATTERN.fullmatch(lote):
        return {
            "ok": False,
            "mensaje": (
                "El código del lote no es válido: admite de 1 a 10 caracteres (letras, "
                "dígitos, espacio, punto, guion bajo, barra o guion) y ningún comodín."
            ),
        }

    try:
        cia = backend.require_company(ctx)
        # El endpoint recibe ``cia`` como query param y ``backend.post`` no admite
        # ``params``, así que el filtro va en la ruta junto con el lote escapado.
        ruta = f"/api/lotes/{quote(lote, safe='')}/verificar?cia={quote(cia, safe='')}"
        data = await backend.post(ruta)
    except backend.BackendError as exc:
        return backend.fail(exc)

    verificacion = data.get("item") or {}
    if not verificacion:
        return {"ok": False, "mensaje": f"El backend no devolvió la verificación del lote {lote}."}

    errores = list(verificacion.get("errores") or [])
    truncado = len(errores) > TOPE_ERRORES_TABLA
    mostrados = errores[:TOPE_ERRORES_TABLA] if truncado else errores
    cuadra = bool(verificacion.get("valido"))

    nota = ""
    if truncado:
        nota = (
            f"El lote tiene {len(errores)} inconsistencias y la tabla muestra las "
            "primeras."
        )
    elif not errores:
        nota = "La verificación no reportó inconsistencias."

    _tabla(
        ctx,
        titulo=f"Verificación del lote {verificacion.get('lote') or lote} · compañía {cia}",
        subtitulo=f"Origen: CONLOTES · {verificacion.get('estado') or ('válido' if cuadra else 'con inconsistencias')}",
        columnas=[
            _columna("categoria", "Categoría"),
            _columna("linea", "Línea", "entero"),
            _columna("documento", "Documento"),
            _columna("mensaje", "Mensaje"),
        ],
        filas=[
            {
                "categoria": error.get("categoria"),
                "linea": error.get("lineaId"),
                "documento": error.get("documento"),
                "mensaje": error.get("mensaje"),
            }
            for error in mostrados
        ],
        totales=[
            {"label": "Inconsistencias", "valor": len(errores), "tipo": "entero"},
            {"label": "Débito", "valor": verificacion.get("debito"), "tipo": "moneda"},
            {"label": "Crédito", "valor": verificacion.get("credito"), "tipo": "moneda"},
            {"label": "Diferencia", "valor": verificacion.get("diferencia"), "tipo": "moneda"},
            {"label": "Cuadra", "valor": "Sí" if cuadra else "No", "tipo": "estado"},
        ],
        nota=nota,
    )

    resultado = {
        "ok": True,
        "lote": verificacion.get("lote") or lote,
        **_resumen(
            verificacion,
            (
                "valido",
                "estado",
                "items",
                "documentos",
                "documentosDuplicados",
                "debito",
                "credito",
                "diferencia",
            ),
        ),
        "errores": mostrados,
        "erroresTotales": len(errores),
        "erroresTruncados": truncado,
        "origen": "CONLOTES",
    }
    if truncado:
        resultado["nota"] = nota
    return resultado


# Nombre de la función -> handler ``async (args, ctx) -> dict``.
FUNCTION_MAP: dict = {
    "buscar_cuenta": buscar_cuenta,
    "consultar_periodo": consultar_periodo,
    "buscar_tercero": buscar_tercero,
    "consultar_movimiento_mensual": consultar_movimiento_mensual,
    "consultar_documentos": consultar_documentos,
    "consultar_documento_detalle": consultar_documento_detalle,
    "consultar_periodo_operacion": consultar_periodo_operacion,
    "consultar_parametros_operacion": consultar_parametros_operacion,
    "listar_companias": listar_companias,
    "consultar_comprobantes": consultar_comprobantes,
    "consultar_tipos_documento": consultar_tipos_documento,
    "consultar_centros": consultar_centros,
    "verificar_lote": verificar_lote,
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
        "id": "movimiento-mensual",
        "label": "Ver el movimiento del mes",
        "message": "Muéstrame el movimiento contable del período habilitado.",
    },
    {
        "id": "documentos",
        "label": "Documentos del período",
        "message": "Lista los documentos contabilizados del período habilitado.",
    },
    {
        "id": "documento-detalle",
        "label": "Detalle de un documento",
        "message": "Quiero ver las partidas de un documento contabilizado.",
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
    {
        "id": "companias",
        "label": "¿Qué compañías existen?",
        "message": "Lista las compañías que existen en el motor de datos.",
    },
    {
        "id": "comprobantes",
        "label": "¿Qué comprobantes puedo usar?",
        "message": "Lista los comprobantes definidos para la compañía activa.",
    },
]


async def get_enabled_quick_options() -> list[dict]:
    """Opciones rápidas vigentes (por ahora fijas, sin configuración por admin)."""
    return QUICK_OPTIONS

"""Herramientas (function calling) del asistente contable de CONTABDSI.

Este módulo es el punto de extensión del bot: el modelo solo puede ejecutar las
acciones declaradas aquí. Están habilitadas las **ocho herramientas de solo
texto** de la «Ola 1» de ``docs/catalogo/HERRAMIENTAS_PRIORIZADAS.md`` (apartado
3.1): las que el modelo puede resumir en su respuesta antes de que exista la fase
2 (el render del ``payload`` en el widget).

Para agregar una función:

1. Escribe el handler::

       async def consultar_saldo(args: dict, ctx: dict) -> dict:
           ...

   - ``args``: argumentos que escribe el modelo (valídalos antes de llamar).
   - ``ctx``: estado de la conversación. Guarda en ``ctx["payload"]`` lo que
     ``/chat`` deba devolver al frontend para renderizarlo (forma acordada en
     ``app/payload.py``).
   - Devuelve un dict serializable; usa ``{"ok": False, "mensaje": "..."}``
     cuando la llamada no sea válida, para que el modelo pueda corregir.

2. Declara su esquema en ``TOOLS`` (nombre, descripción y parámetros JSON Schema).

3. Regístrala en ``FUNCTION_MAP``.

4. (Opcional) Añade una entrada a ``QUICK_OPTIONS`` como sugerencia del widget.

Reglas que valen para todas las herramientas:

- Los datos llegan del **backend por HTTP** (``app/backend_client.py``), nunca de
  la base de datos ni de la memoria del modelo.
- La compañía activa sale del contexto de sesión (``ctx["context"]["compania"]``):
  no es un argumento y **nunca** se asume una por defecto.
- Los errores del backend se devuelven tal cual, con ``ok: false``. Un fallo no se
  convierte en un éxito narrado.
- El dict que vuelve al modelo lleva el resumen; la tabla completa va al
  ``payload``, para no gastar contexto con muchas filas.
"""
from __future__ import annotations

import re
from urllib.parse import quote

from . import backend_client, payload

# La compañía activa se valida con el mismo patrón que el backend usa en sus
# rutas (``backend/app.py``, Query con pattern ``^[0-9]{1,3}$``).
COMPANIA_PATTERN = re.compile(r"^[0-9]{1,3}$")

# El código de lote comparte el patrón del backend (``lotes_repository.py``,
# LOT_CODE) acotado a los 10 caracteres que admite la ruta.
LOTE_PATTERN = re.compile(r"^[A-Za-z0-9 ._/-]{1,10}$")

ESTADOS_TERCERO = ("todos", "activo", "bloqueado")

# Topes del handler (el modelo nunca pide páginas: un argumento de paginación
# solo invita a inventarlo o a pedir páginas vacías).
TOPE_COMPANIAS = 20
TOPE_TERCEROS = 10
TOPE_ERRORES_TABLA = 5


def _compania(ctx: dict) -> str:
    """Código de la compañía activa del contexto de sesión ('' si no viene)."""
    contexto = ctx.get("context") or {}
    return str(contexto.get("compania") or "").strip()


def _error(mensaje: str) -> dict:
    """Respuesta de rechazo para que el modelo pueda corregir."""
    return {"ok": False, "mensaje": mensaje}


def _compania_activa(ctx: dict) -> tuple[str, dict | None]:
    """Valida la compañía del contexto. Devuelve ``(codigo, error)``."""
    codigo = _compania(ctx)
    if not codigo:
        return "", _error(
            "No recibo la compañía activa en el contexto de la sesión. Pide al "
            "usuario que seleccione una compañía; no asumas ninguna."
        )
    if not COMPANIA_PATTERN.fullmatch(codigo):
        return "", _error(
            f"El código de compañía '{codigo}' no es válido: se esperan de 1 a 3 dígitos."
        )
    return codigo, None


def _resumen(datos: dict, campos: tuple[str, ...]) -> dict:
    """Copia al resumen solo los campos que existen en la respuesta del backend."""
    return {campo: datos[campo] for campo in campos if campo in datos}


# ---------------------------------------------------------------------------
# T-01 · C01 - Consultar el período de operación
# ---------------------------------------------------------------------------
async def consultar_periodo_operacion(args: dict, ctx: dict) -> dict:
    """Período contable habilitado de la compañía activa (CONCTR)."""
    codigo, error = _compania_activa(ctx)
    if error:
        return error

    respuesta = await backend_client.peticion(
        "GET", "/api/periodo-operacion", params={"cia": codigo}
    )
    if not respuesta["ok"]:
        return respuesta

    datos = respuesta["data"]
    periodo = datos.get("item")
    if not periodo:
        return _error(
            f"El backend no devolvió el período de operación de la compañía {codigo}."
        )

    origen = str(datos.get("source") or "")
    meses = ", ".join(str(mes) for mes in (periodo.get("mesesHabilitados") or []))
    payload.guardar(
        ctx,
        payload.registro(
            titulo=f"Período de operación, compañía {codigo}",
            campos=[
                ["Año", periodo.get("anio")],
                ["Meses habilitados", meses],
                ["Período sugerido", periodo.get("periodoSugerido")],
                ["Fecha sugerida", periodo.get("fechaSugerida")],
            ],
            origen=origen,
            filtros=respuesta["filtros"],
        ),
    )
    return {"ok": True, "periodo": periodo, "origen": origen}


# ---------------------------------------------------------------------------
# T-02 · C02 - Consultar los parámetros de operación
# ---------------------------------------------------------------------------
async def consultar_parametros_operacion(args: dict, ctx: dict) -> dict:
    """Parámetros de operación vigentes de la compañía activa (CONCTR)."""
    codigo, error = _compania_activa(ctx)
    if error:
        return error

    respuesta = await backend_client.peticion(
        "GET", "/api/parametros-operacion", params={"cia": codigo}
    )
    if not respuesta["ok"]:
        return respuesta

    datos = respuesta["data"]
    parametros = datos.get("item")
    if not parametros:
        return _error(
            f"El backend no devolvió los parámetros de operación de la compañía {codigo}."
        )

    origen = str(datos.get("source") or "")
    periodos = parametros.get("periodosHabilitados") or {}
    habilitados = sorted(codigo_mes for codigo_mes, activo in periodos.items() if activo)
    payload.guardar(
        ctx,
        payload.registro(
            titulo=f"Parámetros de operación, compañía {codigo}",
            campos=[
                ["Nombre de empresa", parametros.get("nombreEmpresa")],
                ["NIT", parametros.get("nit")],
                ["Año de operación", parametros.get("anioOperacion")],
                ["Verifica documentos de lotes", parametros.get("verificaDocumentosLotes")],
                ["Terceros en documentos propios", parametros.get("tercerosDocumentosPropios")],
                ["Controla usuario de lotes", parametros.get("controlaUsuarioLotes")],
                ["Períodos habilitados", ", ".join(habilitados)],
            ],
            origen=origen,
            filtros=respuesta["filtros"],
        ),
    )
    return {"ok": True, "parametros": parametros, "origen": origen}


# ---------------------------------------------------------------------------
# T-03 · C03 - Listar compañías
# ---------------------------------------------------------------------------
async def listar_companias(args: dict, ctx: dict) -> dict:
    """Compañías del motor activo (CONEMP, tabla ``companias`` o respaldo DEMO)."""
    respuesta = await backend_client.peticion("GET", "/api/companias")
    if not respuesta["ok"]:
        return respuesta

    datos = respuesta["data"]
    items = list(datos.get("items") or [])
    total = int(datos.get("count") if datos.get("count") is not None else len(items))
    origen = str(datos.get("source") or "")
    mostradas = items[:TOPE_COMPANIAS]

    nota = ""
    if origen == "DEMO":
        nota = (
            "El backend respondió con compañías de respaldo (ADS_DEV_FALLBACK), "
            "no con las del sistema real: dilo al usuario."
        )
    elif len(mostradas) < total:
        nota = f"Se muestran {len(mostradas)} de {total} compañías."

    payload.guardar(
        ctx,
        payload.tabla(
            titulo="Compañías del motor activo",
            columnas=[
                payload.columna("Código"),
                payload.columna("Nombre"),
                payload.columna("NIT"),
                payload.columna("Habilitada"),
            ],
            filas=[
                [
                    item.get("codigo"),
                    item.get("nombre"),
                    item.get("nit"),
                    item.get("habilitada"),
                ]
                for item in mostradas
            ],
            origen=origen,
            count=total,
            truncado=len(mostradas) < total,
            nota=nota,
        ),
    )

    resultado = {"ok": True, "items": mostradas, "count": total, "origen": origen}
    if len(mostradas) < total:
        resultado["nota"] = nota
    if origen == "DEMO":
        resultado["aviso"] = nota
    return resultado


# ---------------------------------------------------------------------------
# T-04 · C04 - Buscar tercero
# ---------------------------------------------------------------------------
async def buscar_tercero(args: dict, ctx: dict) -> dict:
    """Busca terceros por código, nombre o ciudad en el maestro global FADCLI."""
    buscar = str(args.get("buscar") or "").strip()
    if not buscar:
        return _error(
            "Falta el argumento 'buscar': escribe el código, el nombre o la ciudad "
            "del tercero (1 a 60 caracteres)."
        )
    if len(buscar) > 60:
        return _error("La búsqueda admite máximo 60 caracteres.")

    estado = str(args.get("estado") or "todos").strip().lower() or "todos"
    if estado not in ESTADOS_TERCERO:
        return _error(
            f"El estado '{estado}' no es válido; usa uno de: {', '.join(ESTADOS_TERCERO)}."
        )

    respuesta = await backend_client.peticion(
        "GET",
        "/api/terceros",
        params={"page": 1, "pageSize": TOPE_TERCEROS, "q": buscar, "estado": estado},
    )
    if not respuesta["ok"]:
        return respuesta

    datos = respuesta["data"]
    items = list(datos.get("items") or [])
    total = int(datos.get("total") or 0)
    pagina = int(datos.get("page") or 1)
    tamano = int(datos.get("pageSize") or TOPE_TERCEROS)
    origen = str(datos.get("source") or "FADCLI")
    compartido = bool(datos.get("sharedAcrossCompanies", True))
    hay_mas = pagina * tamano < total

    nota = ""
    if not items:
        nota = (
            f"No hay terceros que coincidan con '{buscar}' (estado {estado}). "
            "No supongas que el tercero existe con otro NIT."
        )
    elif hay_mas:
        nota = f"Se muestran {len(items)} de {total} coincidencias; acota la búsqueda."

    payload.guardar(
        ctx,
        payload.tabla(
            titulo=f"Terceros: búsqueda '{buscar}'",
            columnas=[
                payload.columna("NIT"),
                payload.columna("Nombre"),
                payload.columna("Tipo"),
                payload.columna("Ciudad"),
                payload.columna("Teléfono"),
                payload.columna("Estado"),
                payload.columna("Cupo", money=True),
            ],
            filas=[
                [
                    item.get("nit"),
                    item.get("nombre"),
                    item.get("tipo"),
                    item.get("ciudad"),
                    item.get("telefono"),
                    item.get("estado"),
                    item.get("cupo"),
                ]
                for item in items
            ],
            origen=origen,
            count=total,
            has_more=hay_mas,
            nota=nota,
        ),
    )

    resultado = {
        "ok": True,
        "items": items,
        "count": total,
        "hayMas": hay_mas,
        "origen": origen,
        "compartidoEntreCompanias": compartido,
    }
    if nota:
        resultado["nota"] = nota
    return resultado


# ---------------------------------------------------------------------------
# T-05 · C06 - Consultar comprobantes
# ---------------------------------------------------------------------------
async def consultar_comprobantes(args: dict, ctx: dict) -> dict:
    """Comprobantes contables definidos para la compañía activa (CONTICOM)."""
    codigo, error = _compania_activa(ctx)
    if error:
        return error

    respuesta = await backend_client.peticion(
        "GET", "/api/comprobantes", params={"cia": codigo}
    )
    if not respuesta["ok"]:
        return respuesta

    datos = respuesta["data"]
    items = list(datos.get("items") or [])
    total = int(datos.get("count") if datos.get("count") is not None else len(items))
    origen = str(datos.get("source") or "")

    payload.guardar(
        ctx,
        payload.tabla(
            titulo=f"Comprobantes de la compañía {codigo}",
            columnas=[
                payload.columna("Código"),
                payload.columna("Nombre"),
                payload.columna("Histórico"),
                payload.columna("Descripción auxiliar"),
            ],
            filas=[
                [
                    item.get("codigo"),
                    item.get("nombre"),
                    item.get("historico"),
                    item.get("descripcionAuxiliar"),
                ]
                for item in items
            ],
            origen=origen,
            count=total,
        ),
    )
    return {"ok": True, "items": items, "count": total, "origen": origen}


# ---------------------------------------------------------------------------
# T-06 · C07 - Consultar tipos de documento
# ---------------------------------------------------------------------------
async def consultar_tipos_documento(args: dict, ctx: dict) -> dict:
    """Tipos de documento del catálogo global (VISDOCUM)."""
    respuesta = await backend_client.peticion("GET", "/api/tipos-documento")
    if not respuesta["ok"]:
        return respuesta

    datos = respuesta["data"]
    items = list(datos.get("items") or [])
    total = int(datos.get("count") if datos.get("count") is not None else len(items))
    origen = str(datos.get("source") or "")

    payload.guardar(
        ctx,
        payload.tabla(
            titulo="Tipos de documento (catálogo global)",
            columnas=[
                payload.columna("Código"),
                payload.columna("Nombre"),
                payload.columna("Módulo"),
                payload.columna("Prefijo"),
                payload.columna("Comprobante"),
                payload.columna("Consecutivo"),
            ],
            filas=[
                [
                    item.get("codigo"),
                    item.get("nombre"),
                    item.get("nombreModulo"),
                    item.get("prefijo"),
                    item.get("comprobante"),
                    item.get("consecutivo"),
                ]
                for item in items
            ],
            origen=origen,
            count=total,
        ),
    )
    return {"ok": True, "items": items, "count": total, "origen": origen}


# ---------------------------------------------------------------------------
# T-07 · C08 - Consultar centros de costo
# ---------------------------------------------------------------------------
async def consultar_centros(args: dict, ctx: dict) -> dict:
    """Centros de costo de la compañía activa (CONCECOS)."""
    codigo, error = _compania_activa(ctx)
    if error:
        return error

    respuesta = await backend_client.peticion("GET", "/api/centros", params={"cia": codigo})
    if not respuesta["ok"]:
        return respuesta

    datos = respuesta["data"]
    items = list(datos.get("items") or [])
    total = int(datos.get("count") if datos.get("count") is not None else len(items))
    origen = str(datos.get("source") or "")

    payload.guardar(
        ctx,
        payload.tabla(
            titulo=f"Centros de costo de la compañía {codigo}",
            columnas=[
                payload.columna("Código"),
                payload.columna("Nombre"),
                payload.columna("Nivel"),
                payload.columna("Padre"),
                payload.columna("Habilitado"),
            ],
            filas=[
                [
                    item.get("codigo"),
                    item.get("nombre"),
                    item.get("nivel"),
                    item.get("padre"),
                    item.get("habilita"),
                ]
                for item in items
            ],
            origen=origen,
            count=total,
        ),
    )
    return {"ok": True, "items": items, "count": total, "origen": origen}


# ---------------------------------------------------------------------------
# T-08 · C27 - Verificar un lote
# ---------------------------------------------------------------------------
async def verificar_lote(args: dict, ctx: dict) -> dict:
    """Verifica la consistencia de un lote. Es lectura: no contabiliza nada."""
    codigo, error = _compania_activa(ctx)
    if error:
        return error

    lote = str(args.get("lote") or "").strip()
    if not lote:
        return _error(
            "Falta el argumento 'lote': escribe el código exacto del lote, tal como "
            "aparece en la pantalla de Lotes."
        )
    if not LOTE_PATTERN.fullmatch(lote):
        return _error(
            "El código del lote no es válido: admite de 1 a 10 caracteres (letras, "
            "dígitos, espacio, punto, guion bajo, barra o guion) y ningún comodín."
        )

    respuesta = await backend_client.peticion(
        "POST", f"/api/lotes/{quote(lote, safe='')}/verificar", params={"cia": codigo}
    )
    if not respuesta["ok"]:
        return respuesta

    verificacion = respuesta["data"].get("item") or {}
    if not verificacion:
        return _error(f"El backend no devolvió la verificación del lote {lote}.")

    errores = list(verificacion.get("errores") or [])
    truncado = len(errores) > TOPE_ERRORES_TABLA

    if truncado:
        payload.guardar(
            ctx,
            payload.tabla(
                titulo=f"Verificación del lote {verificacion.get('lote') or lote}"
                f", compañía {codigo}",
                columnas=[
                    payload.columna("Categoría"),
                    payload.columna("Línea"),
                    payload.columna("Documento"),
                    payload.columna("Mensaje"),
                ],
                filas=[
                    [
                        error.get("categoria"),
                        error.get("lineaId"),
                        error.get("documento"),
                        error.get("mensaje"),
                    ]
                    for error in errores
                ],
                totales=[
                    f"{len(errores)} inconsistencia(s)",
                    "",
                    f"Débito {verificacion.get('debito')}",
                    f"Crédito {verificacion.get('credito')} / diferencia "
                    f"{verificacion.get('diferencia')}",
                ],
                origen="CONLOTES",
                count=len(errores),
                filtros=respuesta["filtros"],
                truncado=True,
                nota="El lote tiene más inconsistencias de las que caben en el resumen.",
            ),
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
        "errores": errores[:TOPE_ERRORES_TABLA] if truncado else errores,
        "erroresTotales": len(errores),
        "erroresTruncados": truncado,
        "origen": "CONLOTES",
    }
    if truncado:
        resultado["nota"] = (
            f"La verificación devolvió {len(errores)} inconsistencias; el resumen "
            "incluye las primeras y la lista completa está en la tabla."
        )
    return resultado


# Definiciones de herramientas para DeepSeek (esquema JSON). Las descripciones y
# los parámetros copian el apartado 3.1 de HERRAMIENTAS_PRIORIZADAS.md; cuando la
# descripción del documento nombraba una herramienta que todavía no existe, se
# sustituyó por la pantalla real donde se consulta.
TOOLS: list[dict] = [
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
            "name": "buscar_tercero",
            "description": (
                "Busca terceros por código, nombre o ciudad y devuelve hasta 10 "
                "coincidencias con su estado. Úsala cuando el usuario nombre un "
                "tercero sin dar el NIT o pregunte si existe. No la uses para saldos "
                "ni para crear terceros. Si no hay coincidencias, dilo; no supongas "
                "que el tercero existe con otro NIT."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "buscar": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 60,
                        "description": "Código, nombre o ciudad. Obligatorio.",
                    },
                    "estado": {
                        "type": "string",
                        "enum": ["todos", "activo", "bloqueado"],
                        "default": "todos",
                    },
                },
                "required": ["buscar"],
            },
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

# Nombre de la función -> handler ``async (args, ctx) -> dict``.
FUNCTION_MAP: dict = {
    "consultar_periodo_operacion": consultar_periodo_operacion,
    "consultar_parametros_operacion": consultar_parametros_operacion,
    "listar_companias": listar_companias,
    "buscar_tercero": buscar_tercero,
    "consultar_comprobantes": consultar_comprobantes,
    "consultar_tipos_documento": consultar_tipos_documento,
    "consultar_centros": consultar_centros,
    "verificar_lote": verificar_lote,
}


# Opciones rápidas que muestra el widget mientras no hay conversación.
QUICK_OPTIONS: list[dict] = [
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
        "id": "periodo",
        "label": "¿En qué período estoy?",
        "message": "¿Cuál es el período contable habilitado de la compañía activa?",
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

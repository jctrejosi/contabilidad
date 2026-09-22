"""Cliente HTTP compartido hacia el backend de CONTABDSI (fase 0 del asistente).

Las herramientas **no** hablan con la base de datos: piden los datos al backend
por HTTP, de modo que la lógica de filtros y validaciones no se duplica, el
asistente funciona igual con Advantage o con PostgreSQL y no necesita
credenciales de base (``docs/catalogo/PLAN_ASISTENTE.md``, fase 0).

Contrato del módulo. ``peticion()`` devuelve siempre uno de estos dos dicts:

- ``{"ok": True, "data": <json del backend>, "filtros": <parámetros enviados>}``
- ``{"ok": False, "mensaje": <texto del backend o del transporte>}``

Los errores del backend **no se reescriben** (punto 1.1 del apartado 3 de
``HERRAMIENTAS_PRIORIZADAS.md``): 422 y 404 se comunican con su texto; 503 se
comunica como indisponibilidad del motor de datos. Nunca se convierte un fallo en
un éxito narrado.
"""
from __future__ import annotations

import httpx

from . import config

# Mensaje único de indisponibilidad del motor: el backend responde 503 con su
# propio texto cuando Advantage o PostgreSQL no están configurados o no responden.
MENSAJE_MOTOR = "El motor de datos no está disponible."

# Transporte alterno para la verificación sin backend levantado (prueba con la
# capa HTTP simulada). En producción queda en None.
TRANSPORTE_SIMULADO: httpx.AsyncBaseTransport | None = None


def _cliente(timeout: float | None = None) -> httpx.AsyncClient:
    """Cliente con tiempo de espera acotado.

    Se crea por petición para no retener conexiones entre turnos de conversación.
    """
    return httpx.AsyncClient(
        base_url=config.BACKEND_URL,
        timeout=config.BACKEND_TIMEOUT if timeout is None else timeout,
        transport=TRANSPORTE_SIMULADO,
    )


def _detalle(respuesta: httpx.Response) -> str:
    """Texto que el backend puso en ``detail`` (FastAPI), sin reescribirlo."""
    try:
        cuerpo = respuesta.json()
    except ValueError:
        cuerpo = None
    if isinstance(cuerpo, dict):
        detalle = str(cuerpo.get("detail") or cuerpo.get("mensaje") or "").strip()
        if detalle:
            return detalle
    elif cuerpo is not None:
        texto = str(cuerpo).strip()
        if texto:
            return texto
    return respuesta.text.strip()[:200] or "sin detalle en la respuesta"


async def peticion(
    metodo: str,
    ruta: str,
    *,
    params: dict | None = None,
    timeout: float | None = None,
) -> dict:
    """Una petición al backend con los errores ya mapeados.

    ``params`` son los parámetros de consulta; los valores ``None`` y las cadenas
    vacías se omiten y se devuelven en ``filtros`` solo los que se enviaron.
    """
    filtros = {
        clave: valor
        for clave, valor in (params or {}).items()
        if valor is not None and valor != ""
    }

    try:
        async with _cliente(timeout) as cliente:
            respuesta = await cliente.request(metodo, ruta, params=filtros)
    except httpx.TimeoutException:
        return {
            "ok": False,
            "mensaje": (
                f"El backend de CONTABDSI no respondió a tiempo ({ruta}). "
                "No puedo verificar el dato."
            ),
        }
    except httpx.HTTPError as exc:
        return {
            "ok": False,
            "mensaje": (
                f"No fue posible comunicarse con el backend de CONTABDSI en "
                f"{config.BACKEND_URL} ({ruta}): {type(exc).__name__}. "
                "No puedo verificar el dato."
            ),
        }

    if respuesta.status_code >= 400:
        detalle = _detalle(respuesta)
        if respuesta.status_code == 503:
            return {"ok": False, "mensaje": f"{MENSAJE_MOTOR} El backend informa: {detalle}"}
        return {"ok": False, "mensaje": detalle}

    try:
        datos = respuesta.json()
    except ValueError:
        return {
            "ok": False,
            "mensaje": (
                f"El backend respondió algo que no es JSON ({ruta}, "
                f"HTTP {respuesta.status_code})."
            ),
        }

    if not isinstance(datos, dict):
        return {
            "ok": False,
            "mensaje": f"El backend respondió un JSON inesperado ({ruta}).",
        }

    return {"ok": True, "data": datos, "filtros": filtros}


async def estado_backend() -> dict:
    """Sondeo corto de ``GET /api/health``; no lanza excepciones."""
    resultado = await peticion("GET", "/api/health", timeout=config.BACKEND_HEALTH_TIMEOUT)
    if not resultado["ok"]:
        return {"disponible": False, "mensaje": resultado["mensaje"]}
    datos = resultado["data"]
    return {
        "disponible": datos.get("status") == "ok",
        "store": datos.get("store", ""),
        "database": datos.get("database", ""),
        "tabla": datos.get("table", ""),
    }

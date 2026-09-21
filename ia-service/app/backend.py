"""Cliente HTTP del asistente hacia la API del backend de CONTABDSI.

Los handlers de las herramientas (``app/tools.py``) **no** consultan la base de
datos: llaman a la API del backend (``/api/...``). El backend resuelve el motor
de datos (Advantage o PostgreSQL, según ``CONTABDSI_STORE``) y concentra las
reglas de aislamiento por compañía, así que el asistente no se acopla al esquema
ni a la migración en curso.

Contrato:

- ``get`` y ``post`` devuelven el JSON ya interpretado.
- Ante error de red o respuesta 4xx/5xx lanzan ``BackendError`` con un mensaje en
  español, listo para que el modelo lo explique al usuario.
- ``ctx`` es el diccionario de la conversación que reciben los handlers; la
  compañía activa vive en ``ctx["context"]["compania"]``.

Uso típico dentro de un handler::

    try:
        cia = backend.require_company(ctx)
        datos = await backend.get("/api/cuentas", {"cia": cia})
    except backend.BackendError as exc:
        return backend.fail(exc)
"""
from __future__ import annotations

from typing import Any

import httpx

from . import config


class BackendError(RuntimeError):
    """Falla de comunicación o de validación devuelta por el backend."""


def _endpoint(path: str) -> str:
    return f"{config.BACKEND_API_URL.rstrip('/')}/{path.lstrip('/')}"


def _clean(params: dict[str, Any] | None) -> dict[str, Any] | None:
    """Descarta filtros vacíos para no enviar parámetros nulos a la API."""
    if not params:
        return None
    limpio = {k: v for k, v in params.items() if v is not None and v != ""}
    return limpio or None


def _detail(response: httpx.Response) -> str | None:
    """Extrae el mensaje de error del contrato FastAPI (``{"detail": ...}``)."""
    try:
        body = response.json()
    except ValueError:
        return None
    if not isinstance(body, dict):
        return None
    detail = body.get("detail")
    if isinstance(detail, str) and detail.strip():
        return detail.strip()
    if isinstance(detail, list):
        for item in detail:
            if isinstance(item, dict) and item.get("msg"):
                return str(item["msg"])
    return None


async def _request(method: str, path: str, *, params=None, json=None) -> Any:
    try:
        async with httpx.AsyncClient(timeout=config.BACKEND_TIMEOUT) as client:
            response = await client.request(method, _endpoint(path), params=params, json=json)
    except httpx.HTTPError as exc:
        raise BackendError(
            "No se pudo contactar la API de CONTABDSI. ¿Está corriendo el backend?"
        ) from exc

    if response.status_code >= 400:
        raise BackendError(
            _detail(response) or f"La API respondió con un error ({response.status_code})."
        )

    try:
        return response.json()
    except ValueError as exc:
        raise BackendError("La API devolvió una respuesta que no se pudo interpretar.") from exc


async def get(path: str, params: dict[str, Any] | None = None) -> Any:
    """``GET`` a la API del backend."""
    return await _request("GET", path, params=_clean(params))


async def post(path: str, payload: dict[str, Any] | None = None) -> Any:
    """``POST`` a la API del backend."""
    return await _request("POST", path, json=payload or {})


def company_from(ctx: dict) -> str:
    """Código de la compañía activa del contexto de la conversación."""
    context = ctx.get("context") or {}
    return str(context.get("compania") or "").strip()


def require_company(ctx: dict) -> str:
    """Devuelve la compañía activa o falla indicando que hay que pedirla."""
    cia = company_from(ctx)
    if not cia:
        raise BackendError(
            "No tengo la compañía activa. Pídele al usuario que seleccione una compañía."
        )
    return cia


def fail(exc: Exception) -> dict:
    """Resultado estándar para el modelo cuando una herramienta no puede completarse."""
    if isinstance(exc, BackendError):
        return {"ok": False, "mensaje": str(exc)}
    return {"ok": False, "mensaje": f"Ocurrió un error inesperado: {exc}"}

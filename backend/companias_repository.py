"""Mantenimiento de compañías del modelo compartido (bloque B3).

La creación Advantage inserta CONEMP y comparte las demás tablas por CIA; no
crea carpetas. Modificación y eliminación Advantage aún están pendientes y
devuelven una rama no implementada explícita.

Este módulo concentra las reglas de contrato que comparten las dos ramas
(``normalize_*``, ``company_item``) y la rama declarada de Advantage; la rama de
PostgreSQL vive en :mod:`backend.postgres_writes`, como en B1 y B2.

**Baja.** ``companias`` no tiene ``eliminado_en`` (``db/postgresql/schema/02_nucleo.sql``
L11-30): la baja lógica se hace con ``estado = 'Inactiva'``, que es lo que la
retira del selector de ingreso sin perder la identidad fiscal de sus documentos.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR,
    _execute, _number, ads_odbc_connection,
)
from .lotes_repository import _one


# ``CONEMP.EMPCOD`` son 3 posiciones; el modelo guarda el código sin ceros y
# ``postgres_repository.list_companies`` lo vuelve a presentar como ``027``.
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")
COMPANY_NAME_SIZE = 40
COMPANY_NIT_SIZE = 15
COMPANY_REASON_MIN = 5
COMPANY_REASON_SIZE = 180
COMPANY_STATES = ("Activa", "Inactiva")
COMPANY_YEAR_MIN = 1900
COMPANY_YEAR_MAX = 2999


class CompanyAlreadyExists(RuntimeError):
    """Ya existe una compañía con el mismo código, o el mismo NIT y dígito."""


class CompanyConflict(RuntimeError):
    """La compañía tiene historia contable que impide el cambio pedido."""


class CompanyValidationError(ValueError):
    """Los datos de la compañía no cumplen el contrato de ``companias``."""


class CompanyWriteNotImplemented(RuntimeError):
    """Modificación o baja pendiente en Advantage."""


# Mensaje declarado de la rama no implementada: la ruta debe responder 503 con
# esta causa y no con el error genérico de motor no disponible.
LEGACY_BRANCH_MESSAGE = (
    "La modificación y la baja de compañías aún no están implementadas con Advantage."
)


def normalize_company_code(value: Any) -> str:
    """Valida el código visible (``027`` → ``27``) sin ceros, como lo guarda el modelo."""
    text: str = str(value if value is not None else "").strip()
    if not COMPANY_CODE.fullmatch(text) or int(text) <= 0:
        raise CompanyValidationError(
            "El código de compañía debe contener entre 1 y 3 dígitos."
        )
    return str(int(text))


def company_display_code(code: str) -> str:
    """Código de tres posiciones que consume el selector de ingreso."""
    return f"{int(code):03d}"


def _text_field(
    payload: dict[str, Any], key: str, label: str, size: int, *, required: bool = False
) -> str:
    value = str(payload.get(key, "") or "").strip()
    if required and not value:
        raise CompanyValidationError(f"{label} es obligatorio.")
    if len(value) > size:
        raise CompanyValidationError(f"{label} admite máximo {size} caracteres.")
    return value


def _verification_digit(payload: dict[str, Any]) -> str:
    """Dígito de verificación: un solo carácter, opcional."""
    value = str(payload.get("digito", "") or "").strip()
    if value and (len(value) > 1 or not value.isdigit()):
        raise CompanyValidationError("El dígito de verificación admite un solo dígito.")
    return value


def _year(payload: dict[str, Any]) -> int:
    try:
        anio = int(payload.get("anio"))
    except (TypeError, ValueError) as exc:
        raise CompanyValidationError(
            f"El año de operación es obligatorio entre {COMPANY_YEAR_MIN} y {COMPANY_YEAR_MAX}."
        ) from exc
    if not COMPANY_YEAR_MIN <= anio <= COMPANY_YEAR_MAX:
        raise CompanyValidationError(
            f"El año de operación debe estar entre {COMPANY_YEAR_MIN} y {COMPANY_YEAR_MAX}."
        )
    return anio


def normalize_company_create(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida el alta de una compañía y de su primer año (B3, ``POST``)."""
    return {
        "codigo": normalize_company_code(payload.get("codigo")),
        "nombre": _text_field(payload, "nombre", "El nombre de la compañía", COMPANY_NAME_SIZE, required=True),
        "nit": _text_field(payload, "nit", "El NIT", COMPANY_NIT_SIZE, required=True),
        "digito": _verification_digit(payload),
        "soloConsolidacion": bool(payload.get("soloConsolidacion", False)),
        "anio": _year(payload),
    }


def normalize_company_write(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida la modificación de la ficha de la compañía (B3, ``PUT``).

    El código no forma parte del cuerpo: es la clave inmutable de la ruta.
    """
    estado = str(payload.get("estado") or "Activa").strip()
    if estado not in COMPANY_STATES:
        raise CompanyValidationError("El estado debe ser Activa o Inactiva.")
    return {
        "nombre": _text_field(payload, "nombre", "El nombre de la compañía", COMPANY_NAME_SIZE, required=True),
        "nit": _text_field(payload, "nit", "El NIT", COMPANY_NIT_SIZE, required=True),
        "digito": _verification_digit(payload),
        "estado": estado,
        "soloConsolidacion": bool(payload.get("soloConsolidacion", False)),
    }


def company_item(
    data: dict[str, Any], *, anios: list[int] | None = None, estado: str | None = None
) -> dict[str, Any]:
    """Elemento de las rutas de escritura de compañía.

    Añade al contrato de escritura el año o los años vigentes, para que la
    pantalla pueda refrescar el selector sin una segunda llamada.
    """
    efectivo = estado or data.get("estado") or "Activa"
    return {
        "codigo": company_display_code(data["codigo"]),
        "nombre": data["nombre"],
        "nit": f"{data['nit']}-{data['digito']}" if data["digito"] else data["nit"],
        "digito": data["digito"],
        "estado": efectivo,
        "soloConsolidacion": bool(data.get("soloConsolidacion", False)),
        "anios": sorted(int(anio) for anio in (anios or [])),
    }


def validate_company_reason(reason: str) -> str:
    """Motivo de la baja: entre 5 y 180 caracteres (R7)."""
    text = str(reason or "").strip()
    if not COMPANY_REASON_MIN <= len(text) <= COMPANY_REASON_SIZE:
        raise CompanyValidationError(
            f"Indique un motivo de baja entre {COMPANY_REASON_MIN} y {COMPANY_REASON_SIZE} caracteres."
        )
    return text


def create_company(payload: dict[str, Any], *, user: str = "WEB") -> dict[str, Any]:
    """Da de alta CONEMP sin crear carpetas ni duplicar el CONCTR global.

    Todas las tablas contables que pertenecen a una compañía se consultan con
    ``CIA``. Su configuración de período sigue siendo compartida: los procesos
    actuales hacen ``SELECT TOP 1 FROM CONCTR`` y por eso añadir otra fila aquí
    haría ambiguo el año para *todas* las compañías.
    """
    data = normalize_company_create(payload)
    clave = str(payload.get("clave", "") or "").strip()
    if not 1 <= len(clave) <= 5:
        raise CompanyValidationError("La clave debe contener entre 1 y 5 caracteres.")
    if len(data["nit"]) > 12:
        raise CompanyValidationError("El NIT admite máximo 12 caracteres en CONEMP.")
    if data["soloConsolidacion"]:
        raise CompanyValidationError("CONEMP no tiene un campo para marcar solo consolidación.")
    code = company_display_code(data["codigo"])
    habilitada = bool(payload.get("habilitada", False))
    with accounting_write_lock, ads_odbc_connection() as connection:
        if _one(connection, "SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = ?", [(ADO_TYPE_VARCHAR, 3, code)]) is not None:
            raise CompanyAlreadyExists(f"Ya existe la compañía {code}.")
        control = _one(connection, "SELECT COUNT(*) AS TOTAL, MAX(CTANO) AS ANIO FROM CONCTR", [])
        if control is None or int(_number(control.get("TOTAL"))) != 1:
            raise CompanyConflict("Los parámetros de operación deben contener un único registro antes de crear compañías.")
        if data["anio"] != int(_number(control.get("ANIO"))):
            raise CompanyValidationError(
                f"El año debe ser {int(_number(control.get('ANIO')))}, que es el año operativo compartido."
            )
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONEMP (EMPCOD, EMPNOM, EMPNIT, EMPCLAV, REASIGNA, HABILITA) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 3, code),
                    (ADO_TYPE_VARCHAR, 40, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 12, data["nit"]),
                    (ADO_TYPE_VARCHAR, 5, clave),
                    (ADO_TYPE_VARCHAR, 1, ""),
                    (ADO_TYPE_BOOLEAN, 0, habilitada),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    return {"codigo": code, "nombre": data["nombre"], "nit": data["nit"],
            "habilitada": habilitada, "soloConsolidacion": False, "anios": [data["anio"]]}


def _legacy_branch(*_args: Any, **_kwargs: Any) -> Any:
    """Rama declarada de Advantage para modificación y baja pendientes."""
    raise CompanyWriteNotImplemented(LEGACY_BRANCH_MESSAGE)


# La creación usa CONEMP; estas dos acciones permanecen pendientes.
update_company = _legacy_branch
delete_company = _legacy_branch

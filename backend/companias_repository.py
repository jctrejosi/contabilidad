"""Mantenimiento de compañías del modelo nuevo (bloque B3, pantalla Companias).

**Solo PostgreSQL.** En el legado una compañía es una *carpeta de tablas por
empresa* que crea el instalador de VISION, no una fila: ``CONEMP`` se escribe
durante la instalación y el alta desde la web no tiene destino. Por eso las tres
operaciones de escritura devuelven, con el motor Advantage, la rama no
implementada **declarada** (:class:`CompanyWriteNotImplemented`, 503) y no un
error genérico.

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
    """La escritura de compañías solo está implementada en el modelo nuevo."""


# Mensaje declarado de la rama no implementada: la ruta debe responder 503 con
# esta causa y no con el error genérico de motor no disponible.
LEGACY_BRANCH_MESSAGE = (
    "El alta, la modificación y la baja de compañías solo están implementadas con "
    "PostgreSQL. En Advantage una compañía es una carpeta de tablas por empresa que "
    "crea el instalador del legado, no una fila de CONEMP."
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


def _legacy_branch(*_args: Any, **_kwargs: Any) -> Any:
    """Rama declarada de Advantage: la operación no tiene destino en el legado."""
    raise CompanyWriteNotImplemented(LEGACY_BRANCH_MESSAGE)


# Alias explícitos para el despacho de ``store``: dejan escrito que la rama
# Advantage no se limita a faltar, sino que se declara como no implementada.
create_company = _legacy_branch
update_company = _legacy_branch
delete_company = _legacy_branch

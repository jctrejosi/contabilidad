"""Lectura y actualización de los parámetros operativos almacenados en CONCTR.

La correspondencia se tomó de ``PARAMS`` y ``DSIGRABA6`` en DSITAB.PRG. El
diccionario contable conserva un solo registro CONCTR; la compañía recibida no
filtra esa tabla (no tiene CIA), pero se valida contra CONEMP para asegurar que
la sesión continúe siendo válida antes de leer o modificar parámetros.
"""

from __future__ import annotations

from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
    _boolean,
    _execute,
    _number,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .lotes_repository import _one


ADO_TYPE_SMALLINT = 2
MONTH_CODES = tuple(f"{month:02d}" for month in range(13))


class OperationParametersValidationError(ValueError):
    """Los valores no caben o no corresponden a los campos de CONCTR."""


def _validate_session_company(connection: Any, company: int) -> None:
    if _one(
        connection,
        "SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = ?",
        [(ADO_TYPE_INTEGER, 0, company)],
    ) is None:
        raise CompanyNotFound(f"No existe la compañía {company:03d} en CONEMP.")


def _map_row(row: dict[str, Any]) -> dict[str, Any]:
    """Traduce nombres físicos de PARAMS/DSIGRABA6 al contrato web."""
    return {
        "codigoInterno": int(_number(row.get("CTCODCIA"))),
        "nombreEmpresa": _text(row.get("CTCIA")).strip(),
        "nit": _text(row.get("CTNIT")).strip(),
        "direccion": _text(row.get("CTDIRECC")).strip(),
        "ciudad": _text(row.get("CTCIUDAD")).strip(),
        "directorioContabilidad": _text(row.get("CTDIREC")).strip(),
        "anioOperacion": str(int(_number(row.get("CTANO")))),
        "contabilidadConciliacion": _text(row.get("CTCLAVE1")).strip(),
        "verificaDocumentosLotes": _boolean(row.get("CTVERDOC")),
        "tercerosDocumentosPropios": _boolean(row.get("CTTERDOC")),
        "controlaUsuarioLotes": _text(row.get("CTPUC")).strip() == "1",
        "comentarioCertificado": _text(row.get("CTLEY1")).strip(),
        "periodosHabilitados": {
            code: _boolean(row.get(f"CT{code}")) for code in MONTH_CODES
        },
    }


def _required_text(payload: dict[str, Any], key: str, label: str, size: int) -> str:
    value = str(payload.get(key, "")).strip()
    if not value:
        raise OperationParametersValidationError(f"{label} es obligatorio.")
    if len(value) > size:
        raise OperationParametersValidationError(
            f"{label} admite máximo {size} caracteres en CONCTR."
        )
    return value


def _optional_text(payload: dict[str, Any], key: str, label: str, size: int) -> str:
    value = str(payload.get(key, "")).strip()
    if len(value) > size:
        raise OperationParametersValidationError(
            f"{label} admite máximo {size} caracteres en CONCTR."
        )
    return value


def _normalize(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        year = int(str(payload.get("anioOperacion", "")).strip())
    except ValueError as exc:
        raise OperationParametersValidationError("El año de operación no es válido.") from exc
    if not 1900 <= year <= 2100:
        raise OperationParametersValidationError("El año de operación debe estar entre 1900 y 2100.")

    raw_months = payload.get("periodosHabilitados")
    if not isinstance(raw_months, dict) or set(raw_months) != set(MONTH_CODES):
        raise OperationParametersValidationError("Deben informarse exactamente los períodos CT00 a CT12.")

    return {
        "nombreEmpresa": _required_text(payload, "nombreEmpresa", "El nombre de empresa", 40),
        "nit": _required_text(payload, "nit", "El NIT", 15),
        "direccion": _optional_text(payload, "direccion", "La dirección", 30),
        "ciudad": _optional_text(payload, "ciudad", "La ciudad", 20),
        "directorioContabilidad": _required_text(
            payload, "directorioContabilidad", "El directorio de contabilidad", 40
        ),
        "anioOperacion": year,
        "contabilidadConciliacion": _optional_text(
            payload, "contabilidadConciliacion", "La contabilidad de conciliación", 3
        ),
        "verificaDocumentosLotes": bool(payload.get("verificaDocumentosLotes")),
        "tercerosDocumentosPropios": bool(payload.get("tercerosDocumentosPropios")),
        "controlaUsuarioLotes": bool(payload.get("controlaUsuarioLotes")),
        "comentarioCertificado": _optional_text(
            payload, "comentarioCertificado", "El comentario del certificado", 120
        ),
        "periodosHabilitados": {code: bool(raw_months[code]) for code in MONTH_CODES},
    }


def get_operation_parameters(cia: str) -> dict[str, Any]:
    """Lee el único registro CONCTR usado por todos los procesos contables."""
    company = normalize_company_code(cia)
    columns = ", ".join(
        [
            "CTCODCIA", "CTCIA", "CTNIT", "CTDIRECC", "CTCIUDAD", "CTDIREC",
            "CTANO", "CTCLAVE1", "CTVERDOC", "CTTERDOC", "CTPUC", "CTLEY1",
            *(f"CT{code}" for code in MONTH_CODES),
        ]
    )
    with ads_connection() as connection:
        _validate_session_company(connection, company)
        row = _one(connection, f"SELECT TOP 1 {columns} FROM CONCTR", [])
    if row is None:
        raise OperationParametersValidationError("CONCTR no contiene el registro de parámetros.")
    return _map_row(row)


def update_operation_parameters(cia: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Actualiza únicamente los campos que DSIGRABA6 permite mantener."""
    company = normalize_company_code(cia)
    data = _normalize(payload)
    month_assignments = ", ".join(f"CT{code} = ?" for code in MONTH_CODES)
    sql = (
        "UPDATE CONCTR SET CTCIA = ?, CTNIT = ?, CTDIRECC = ?, CTCIUDAD = ?, "
        "CTDIREC = ?, CTANO = ?, CTCLAVE1 = ?, CTVERDOC = ?, CTTERDOC = ?, "
        f"CTPUC = ?, CTLEY1 = ?, {month_assignments}"
    )
    parameters = [
        (ADO_TYPE_VARCHAR, 40, data["nombreEmpresa"]),
        (ADO_TYPE_VARCHAR, 15, data["nit"]),
        (ADO_TYPE_VARCHAR, 30, data["direccion"]),
        (ADO_TYPE_VARCHAR, 20, data["ciudad"]),
        (ADO_TYPE_VARCHAR, 40, data["directorioContabilidad"]),
        (ADO_TYPE_SMALLINT, 0, data["anioOperacion"]),
        (ADO_TYPE_VARCHAR, 3, data["contabilidadConciliacion"]),
        (ADO_TYPE_BOOLEAN, 0, data["verificaDocumentosLotes"]),
        (ADO_TYPE_BOOLEAN, 0, data["tercerosDocumentosPropios"]),
        (ADO_TYPE_VARCHAR, 1, "1" if data["controlaUsuarioLotes"] else " "),
        (ADO_TYPE_VARCHAR, 120, data["comentarioCertificado"]),
        *(
            (ADO_TYPE_BOOLEAN, 0, data["periodosHabilitados"][code])
            for code in MONTH_CODES
        ),
    ]

    with accounting_write_lock, ads_odbc_connection() as connection:
        _validate_session_company(connection, company)
        count = _one(connection, "SELECT COUNT(*) AS TOTAL FROM CONCTR", [])
        if count is None or int(_number(count.get("TOTAL"))) != 1:
            raise OperationParametersValidationError(
                "CONCTR debe contener exactamente un registro para modificar sus parámetros."
            )
        connection.BeginTrans()
        try:
            _execute(connection, sql, parameters)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise

    return get_operation_parameters(cia)

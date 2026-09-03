"""Consulta de comprobantes contables almacenados en CONTICOM.

CONTICOM depende de la contabilidad seleccionada. Su clave funcional es
``(CIA, CODIGO)``; nunca se consulta el catálogo sin aplicar CIA.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import (
    CompanyNotFound,
    _company_exists,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    normalize_company_code,
)


def _voucher_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Mapea los cuatro campos propios de CONTICOM sin agregar reglas ficticias."""
    history_flag = _text(row.get("HIST"))
    return {
        "codigo": _text(row.get("CODIGO")),
        "nombre": _text(row.get("NOMBRE")),
        "hist": history_flag,
        "historico": history_flag.upper() in {"S", "Y", "1", "T"},
        "descripcionAuxiliar": _text(row.get("CTABDES")),
    }


def list_vouchers(company_code: str) -> list[dict[str, Any]]:
    """Devuelve únicamente los comprobantes de la compañía solicitada."""
    company_id = normalize_company_code(company_code)
    sql = (
        "SELECT CODIGO, NOMBRE, HIST, CTABDES FROM CONTICOM "
        f"WHERE CIA = {company_id} ORDER BY CODIGO"
    )
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        recordset = _open_recordset(connection, sql)
        try:
            return [_voucher_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()

"""Consulta de centros de costo almacenados en CONCECOS.

CONCECOS pertenece a cada contabilidad: un código solo es único dentro de su
compañía. Por eso la clave funcional es ``(CIA, CODIGO)`` y toda lectura debe
recibir la compañía activa de la sesión.

La tabla heredada no tiene un campo padre. Para presentar una lista ordenada
se reconoce como hijo únicamente un código de tres caracteres cuyo prefijo de
dos caracteres exista en la misma compañía. Los demás códigos se conservan
como raíces; así la API no inventa relaciones que no estén respaldadas por
los datos.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import (
    CompanyNotFound,
    _boolean,
    _company_exists,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    normalize_company_code,
)


def _nullable_boolean(value: Any) -> bool | None:
    """Mantiene NULL separado de False para no alterar el estado heredado."""
    return None if value is None else _boolean(value)


def _cost_centers_from_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convierte filas CONCECOS y deriva la jerarquía solo por prefijos válidos."""
    codes = {_text(row.get("CODIGO")) for row in rows}
    items: list[dict[str, Any]] = []
    for row in rows:
        code = _text(row.get("CODIGO"))
        parent = code[:2] if len(code) == 3 and code[:2] in codes else ""
        items.append(
            {
                "codigo": code,
                "nombre": _text(row.get("NOMBRE")),
                "nivel": 2 if parent else 1,
                "padre": parent,
                "carpeta": _text(row.get("CARPETA")),
                "tipo": int(_number(row.get("TIPO"))),
                "habilita": _nullable_boolean(row.get("HABILITA")),
                "hist": _text(row.get("HIST")),
                "valor": _number(row.get("VALOR")),
                "porcentaje": _number(row.get("PORCEN")),
                "valorPorcentaje": _number(row.get("VLRPOR")),
                "codigoItem": _text(row.get("CODITEM")),
                "cuenta": _text(row.get("CUENTA")),
                "concepto": _text(row.get("CONCEPTO")),
            }
        )
    return items


def list_cost_centers(company_code: str) -> list[dict[str, Any]]:
    """Lista los centros exclusivos de una CIA, ordenados por su código."""
    company_id = normalize_company_code(company_code)
    sql = (
        "SELECT CODIGO, NOMBRE, HIST, VALOR, PORCEN, VLRPOR, CODITEM, "
        "CUENTA, CONCEPTO, CARPETA, TIPO, HABILITA FROM CONCECOS "
        f"WHERE CIA = {company_id} ORDER BY CODIGO"
    )
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        recordset = _open_recordset(connection, sql)
        try:
            return _cost_centers_from_rows(list(_rows(recordset)))
        finally:
            recordset.Close()

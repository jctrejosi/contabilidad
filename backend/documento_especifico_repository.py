"""Consulta de documento propio o afectado según CONSUL_8/CONSUL_81."""

from __future__ import annotations

import re
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _company_exists, _number, _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code
from .movimiento_mensual_repository import _movement_from_row

CODE = re.compile(r"^[A-Za-z0-9.\-/ ]+$")


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try: return list(_rows(recordset))
    finally: recordset.Close()


def specific_document(cia: str, year: int, month: int, document_type: str, document: str, *, search_by: str = "propio") -> dict[str, Any]:
    company = normalize_company_code(cia)
    document_type = document_type.strip(); document = document.strip()
    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("El período consultado no es válido.")
    if search_by not in {"propio", "afectado"}:
        raise ValueError("El criterio de búsqueda no es válido.")
    if not document_type or len(document_type) > 2 or not CODE.fullmatch(document_type):
        raise ValueError("Seleccione un tipo de documento válido.")
    if not document or len(document) > 12 or not CODE.fullmatch(document):
        raise ValueError("Ingrese un número de documento válido.")
    column = "TDOCUM" if search_by == "propio" else "TDOCUM2"
    columns = "CONANO, CONMES, CODIGO, NIT, NITN, TFECHA, TCOMPR, TFASE, TIPODOC, TDOCUM, TDOCUM2, TDETALLE, TVALOR, TBASE, TIVA_RET, TSALDO, TSEC, TUSUA"
    sql = (
        f"SELECT {columns} FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} AND CONMES = {month} "
        f"AND TIPODOC = '{document_type}' AND {column} = '{document}' ORDER BY TFECHA, TCOMPR, TDOCUM, TSEC"
    )
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company): raise CompanyNotFound(f"La compañía {cia} no existe.")
        rows = _read(connection, sql)
        codes = sorted({_text(row.get("CODIGO")).strip() for row in rows})
        names: dict[str, str] = {}
        if codes:
            literals = ", ".join(f"'{code}'" for code in codes)
            master = _read(connection, f"SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} AND CODIGO IN ({literals})")
            names = {_text(row.get("CODIGO")).strip(): _text(row.get("MNOMBRE")).strip() for row in master}
    if not rows:
        return {"items": [], "count": 0, "debito": 0, "credito": 0, "diferencia": 0, "anio": year, "mes": month, "buscarPor": search_by}
    items = []
    for row in rows:
        item = _movement_from_row(row); item["nombreCuenta"] = names.get(item["cuenta"].strip(), ""); items.append(item)
    debit = round(sum(item["debito"] for item in items), 2); credit = round(sum(item["credito"] for item in items), 2)
    first = items[0]
    return {"items": items, "count": len(items), "debito": debit, "credito": credit, "diferencia": round(debit - credit, 2), "anio": year, "mes": month, "buscarPor": search_by, "cabecera": {"comprobante": first["comprobante"], "fecha": first["fecha"], "tipoDocumento": first["tipoDoc"], "documento": first["documento"], "documentoAfectado": first["docAfectado"], "concepto": first["concepto"]}}

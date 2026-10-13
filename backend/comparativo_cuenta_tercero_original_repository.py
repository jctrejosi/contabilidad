"""P. INFORP1: documentos con terceros diferentes en cuentas relevantes."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection, normalize_company_code
from .informes_terceros_repository import _read


def build_account_third_comparison(cia: str, year: int, month: int, *,
                                   account_from: str = "", account_to: str = "") -> dict[str, Any]:
    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("Seleccione un mes válido (01–18).")
    first, last = account_from.strip(), account_to.strip()
    if any(code and (len(code) > 12 or not re.fullmatch(r"[0-9]+", code)) for code in (first, last)):
        raise ValueError("El rango de cuentas no es válido.")
    if first and last and first > last:
        raise ValueError("Cuenta inicial mayor que cuenta final.")
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        movement = _read(connection,
            "SELECT TDOCUM, CODIGO, NIT, TIPODOC, TVALOR FROM MOV01 "
            f"WHERE CONCIA = {company} AND CONANO = {year} AND CONMES = {month} "
            "ORDER BY TDOCUM, TSEC")
        accounts = {_text(row.get("CODIGO")).strip(): row for row in _read(connection,
            "SELECT CODIGO, MCTAPAGOS, MIVA_RET FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")}
        thirds = sorted({_text(row.get("NIT")).strip() for row in movement if _text(row.get("NIT")).strip()})
        third_names: dict[str, str] = {}
        for offset in range(0, len(thirds), 100):
            batch = ", ".join(f"'{code.replace(chr(39), chr(39) * 2)}'" for code in thirds[offset:offset + 100])
            for row in _read(connection, f"SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO IN ({batch})"):
                third_names[_text(row.get("CCODIGO")).strip()] = _text(row.get("CNOMBRE")).strip()
    by_document: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in movement:
        by_document[_text(item.get("TDOCUM")).strip()].append(item)
    columns = [{"label": label, "money": index >= 4} for index, label in enumerate(
        ["Documento", "Cuenta", "Tercero", "Nombre", "Débito", "Crédito", "Tipo"])]
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    for document, items in by_document.items():
        eligible: list[str] = []
        representative = ""
        reportable = False
        for item in items:
            nit = _text(item.get("NIT")).strip()
            if not nit:
                continue
            if not representative:
                representative = nit
            code = _text(item.get("CODIGO")).strip()
            # INFORP14 usa OR (>= inicial OR <= final), no AND. Se conserva:
            # cualquier código hace que el documento sea reportable.
            if not first or not last or code >= first or code <= last:
                reportable = True
            definition = accounts.get(code)
            if definition and (_number(definition.get("MCTAPAGOS")) or
                               _text(definition.get("MIVA_RET")).strip() in {"I", "R"}):
                eligible.append(nit)
        if not reportable or not any(nit != representative for nit in eligible):
            continue
        subtotal = [0.0, 0.0]
        for item in items:
            amount = float(_number(item.get("TVALOR")))
            nit = _text(item.get("NIT")).strip()
            debit, credit = (amount, 0.0) if amount > 0 else (0.0, amount)
            rows.append([document, _text(item.get("CODIGO")).strip(), nit,
                         third_names.get(nit, ""), round(debit, 2), round(credit, 2),
                         _text(item.get("TIPODOC")).strip()])
            kinds.append("detalle")
            subtotal[0] += debit
            subtotal[1] += credit
        rows.append([f"TOTAL DOCUMENTO {document}", "", "", "", round(subtotal[0], 2),
                     round(subtotal[1], 2), ""])
        kinds.append("subtotal")
    header = companies[0]
    return {"id": "comp-cta-tercero", "compania": {"codigo": f"{company:03d}",
                "nombre": _text(header.get("EMPNOM")).strip(), "nit": _text(header.get("EMPNIT")).strip()},
            "anio": year, "mesDesde": month, "mesHasta": month,
            "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
            "source": "MOV01 / CONMAE / FADCLI",
            "nota": "Documentos con diferentes terceros en cuentas de pago, IVA o retención."}

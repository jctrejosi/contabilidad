"""Q. INFORQ1: movimiento de dos prefijos por tipo de contribuyente."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection, normalize_company_code
from .informes_terceros_repository import _read


def build_taxpayer_movement(cia: str, year: int, first: int, last: int, *,
                            taxpayer_type: str, account_one: str, account_two: str) -> dict[str, Any]:
    taxpayer_type = taxpayer_type.strip().upper()
    account_one, account_two = account_one.strip(), account_two.strip()
    if not 1900 <= year <= 2100 or not 1 <= first <= last <= 12:
        raise ValueError("Seleccione meses entre 01 y 12, en orden.")
    if not taxpayer_type or len(taxpayer_type) > 2 or not re.fullmatch(r"[A-Z0-9]+", taxpayer_type):
        raise ValueError("Indique un tipo de contribuyente válido.")
    if any(not value or len(value) > 12 or not value.isdigit() for value in (account_one, account_two)):
        raise ValueError("Indique las dos cuentas o prefijos a reportar.")
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        # El origen recorre dos veces MOVxx; si los prefijos se superponen, el
        # importe de la intersección figura dos veces. No se deduplican.
        movements: list[dict[str, Any]] = []
        for prefix in (account_one, account_two):
            movements.extend(_read(connection,
                "SELECT CODIGO, NIT, TVALOR FROM MOV01 "
                f"WHERE CONCIA = {company} AND CONANO = {year} AND CONMES >= {first} "
                f"AND CONMES <= {last} AND CODIGO >= '{prefix}' AND CODIGO <= '{prefix + 'Z'}' "
                "AND NIT IS NOT NULL AND NIT <> ''"))
        third_codes = sorted({_text(item.get("NIT")).strip() for item in movements})
        third_data: dict[str, tuple[str, str]] = {}
        for offset in range(0, len(third_codes), 100):
            batch = ", ".join(f"'{code.replace(chr(39), chr(39) * 2)}'" for code in third_codes[offset:offset + 100])
            for item in _read(connection, f"SELECT CCODIGO, CNOMBRE, CTIPPAG FROM FADCLI WHERE CCODIGO IN ({batch})"):
                third_data[_text(item.get("CCODIGO")).strip()] = (
                    _text(item.get("CNOMBRE")).strip(), _text(item.get("CTIPPAG")).strip())
        account_names = {_text(item.get("CODIGO")).strip(): _text(item.get("MNOMBRE")).strip()
                         for item in _read(connection, "SELECT CODIGO, MNOMBRE FROM CONMAE "
                            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")}
    amounts: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    for item in movements:
        nit = _text(item.get("NIT")).strip()
        if nit not in third_data or third_data[nit][1] != taxpayer_type:
            continue
        account = _text(item.get("CODIGO")).strip()
        amount = float(_number(item.get("TVALOR")))
        amounts[(nit, account)][0 if amount > 0 else 1] += amount if amount > 0 else -amount
    columns = [{"label": label, "money": index >= 3} for index, label in enumerate(
        ["Tercero / cuenta", "Nombre", "Código", "Débitos", "Créditos"])]
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    total = [0.0, 0.0]
    current = ""
    third_total = [0.0, 0.0]
    for (nit, account), pair in sorted(amounts.items()):
        if nit != current:
            if current:
                rows.append([f"TOTAL CLIENTE {current}", "", "", *[round(v, 2) for v in third_total]])
                kinds.append("subtotal")
            current = nit
            third_total = [0.0, 0.0]
            rows.append([f"CLIENTE {nit}", third_data[nit][0], "", "", ""])
            kinds.append("seccion")
        rows.append([account, account_names.get(account, "**"), "", round(pair[0], 2), round(pair[1], 2)])
        kinds.append("detalle")
        for index in range(2):
            third_total[index] += pair[index]
            total[index] += pair[index]
    if current:
        rows.append([f"TOTAL CLIENTE {current}", "", "", *[round(v, 2) for v in third_total]])
        kinds.append("subtotal")
    rows.append(["TOTAL GENERAL", "", "", *[round(v, 2) for v in total]])
    kinds.append("total-general")
    header = companies[0]
    return {"id": "resumen-tipo-contribuyente", "compania": {"codigo": f"{company:03d}",
                "nombre": _text(header.get("EMPNOM")).strip(), "nit": _text(header.get("EMPNIT")).strip()},
            "anio": year, "mesDesde": first, "mesHasta": last,
            "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
            "source": "MOV01 / FADCLI / CONMAE",
            "nota": f"Tipo de contribuyente {taxpayer_type}; cuentas {account_one} y {account_two}."}

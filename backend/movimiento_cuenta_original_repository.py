"""O. Movimiento por cuenta: INFORO1N/INFORO12/INFORO14.

El Harbour usa las fechas introducidas para elegir los MOVxx inclusivos; no
recorta las partidas por día dentro del primer o último mes. Se conserva esa
semántica y se evita la tabla temporal POSINFOR.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection, normalize_company_code
from .informes_terceros_repository import _read


def build_account_movement(
    cia: str, year: int, *, date_from: str, date_to: str,
    account_from: str = "", account_to: str = "",
) -> dict[str, Any]:
    try:
        first_date = date.fromisoformat(date_from)
        last_date = date.fromisoformat(date_to)
    except ValueError as exc:
        raise ValueError("Indique fechas inicial y final válidas.") from exc
    if first_date.year != year or last_date.year != year or first_date > last_date:
        raise ValueError("El rango de fechas debe pertenecer al ejercicio y estar ordenado.")
    first, last = first_date.month, last_date.month
    if first > last:
        raise ValueError("Mes inicial mayor que mes final.")
    account_from, account_to = account_from.strip(), account_to.strip()
    for code in (account_from, account_to):
        if code and (len(code) > 12 or not re.fullmatch(r"[0-9]+", code)):
            raise ValueError("El código de cuenta no es válido.")
    if account_from and account_to and account_from > account_to:
        raise ValueError("Cuenta inicial mayor que cuenta final.")
    company = normalize_company_code(cia)
    where = f"CONCIA = {company} AND CONANO = {year} AND CONMES >= {first} AND CONMES <= {last}"
    if account_from:
        where += f" AND CODIGO >= '{account_from}'"
    if account_to:
        where += f" AND CODIGO <= '{account_to}'"
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        source = _read(connection, "SELECT CODIGO, NIT, TFECHA, TDOCUM, TVALOR, TBASE, TVALORUS "
                       f"FROM MOV01 WHERE {where} ORDER BY CODIGO, NIT, TFECHA, TDOCUM, TSEC")
        names = {_text(row.get("CODIGO")).strip(): _text(row.get("MNOMBRE")).strip()
                 for row in _read(connection, "SELECT CODIGO, MNOMBRE FROM CONMAE "
                    f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")}
        thirds = sorted({_text(row.get("NIT")).strip() for row in source if _text(row.get("NIT")).strip()})
        third_names: dict[str, str] = {}
        for offset in range(0, len(thirds), 100):
            batch = ", ".join(f"'{code.replace(chr(39), chr(39) * 2)}'" for code in thirds[offset:offset + 100])
            for row in _read(connection, f"SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO IN ({batch})"):
                third_names[_text(row.get("CCODIGO")).strip()] = _text(row.get("CNOMBRE")).strip()
    columns = [{"label": label, "money": index >= 4} for index, label in enumerate(
        ["Cuenta / corte", "Tercero", "Fecha", "Documento", "Valor", "Base", "Cantidad"])]
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    overall = [0.0, 0.0, 0.0]

    def subtotal(label: str, amounts: list[float], kind: str) -> None:
        rows.append([label, "", "", "", *[round(value, 2) for value in amounts]])
        kinds.append(kind)

    by_account: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in source:
        by_account[_text(item.get("CODIGO")).strip()].append(item)
    for code, items in by_account.items():
        rows.append([f"CUENTA {code} — {names.get(code, '**')}", "", "", "", "", "", ""])
        kinds.append("seccion")
        account_total = [0.0, 0.0, 0.0]
        by_nit: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in items:
            by_nit[_text(item.get("NIT")).strip()].append(item)
        for nit, nit_items in by_nit.items():
            rows.append([f"TERCERO {nit} — {third_names.get(nit, '**')}", nit, "", "", "", "", ""])
            kinds.append("seccion")
            third_total = [0.0, 0.0, 0.0]
            for item in nit_items:
                amounts = [float(_number(item.get(field))) for field in ("TVALOR", "TBASE", "TVALORUS")]
                rows.append([code, nit, str(int(_number(item.get("TFECHA")))).zfill(8),
                             _text(item.get("TDOCUM")).strip(), *[round(value, 2) for value in amounts]])
                kinds.append("detalle")
                for idx, amount in enumerate(amounts):
                    third_total[idx] += amount
                    account_total[idx] += amount
                    overall[idx] += amount
            subtotal(f"TOTAL TERCERO {nit}", third_total, "subtotal")
        subtotal(f"TOTAL CUENTA {code}", account_total, "total-cuenta")
    subtotal("TOTAL GENERAL", overall, "total-general")
    header = companies[0]
    return {"id": "mov-cuenta", "compania": {"codigo": f"{company:03d}",
                "nombre": _text(header.get("EMPNOM")).strip(), "nit": _text(header.get("EMPNIT")).strip()},
            "anio": year, "mesDesde": first, "mesHasta": last,
            "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
            "source": "MOV01 / CONMAE / FADCLI",
            "nota": f"Movimiento por cuenta · meses {first:02d}–{last:02d} (fechas {date_from} a {date_to})."}

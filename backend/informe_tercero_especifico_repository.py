"""Movimiento específico por tercero: INFORT1/INFORT1A/INFTER1/INFTER4.

El listado original guarda temporalmente la elección de cuentas en CONRTER y
copia MOVxx a una tabla de trabajo. En el modelo nuevo la selección llega en
el filtro y se consulta MOV01 directamente, siempre limitada a la compañía.
"""

from __future__ import annotations

import re
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection, normalize_company_code
from .informes_terceros_repository import _read


ACCOUNT = re.compile(r"^[0-9]{1,12}$")
THIRD = re.compile(r"^[A-Za-z0-9.\-/]{1,15}$")


def _accounts(raw: str) -> tuple[str, ...]:
    values = tuple(dict.fromkeys(part.strip() for part in raw.split(",")))
    if not raw.strip() or not all(ACCOUNT.fullmatch(code) for code in values):
        raise ValueError("Seleccione al menos una cuenta válida.")
    return values


def _columns(*items: tuple[str, bool]) -> list[dict[str, Any]]:
    return [{"label": label, "money": money} for label, money in items]


def build_specific_third_report(cia: str, year: int, first: int, last: int, *,
                                nit: str, selected_accounts: str,
                                detailed: bool = False) -> dict[str, Any]:
    if not 1900 <= year <= 2100 or not 1 <= first <= last <= 18:
        raise ValueError("Seleccione un rango de meses entre 01 y 18.")
    nit = nit.strip()
    if not THIRD.fullmatch(nit):
        raise ValueError("Seleccione un tercero válido.")
    accounts = _accounts(selected_accounts)
    company = normalize_company_code(cia)

    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        available = int(_number(control[0].get("CTANO"))) if control else 0
        if year != available:
            raise ValueError(f"El movimiento corresponde al ejercicio {available}.")
        thirds = _read(connection, f"SELECT TOP 1 CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO = '{nit}'")
        if not thirds:
            raise ValueError("El tercero no existe.")
        literals = ", ".join(f"'{code}'" for code in accounts)
        catalog = _read(connection,
            "SELECT CODIGO, MNOMBRE, MTC, MCTAPAGOS FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} AND CODIGO IN ({literals})")
        names = {_text(row["CODIGO"]).strip(): _text(row["MNOMBRE"]).strip() for row in catalog
                 if _number(row.get("MTC")) and _number(row.get("MCTAPAGOS"))}
        if invalid := set(accounts) - names.keys():
            raise ValueError("Estas cuentas no existen o no manejan terceros: " + ", ".join(sorted(invalid)))
        source = _read(connection,
            "SELECT CODIGO, TDETALLE, TFECHA, TCOMPR, TIPODOC, TFASE, TDOCUM, TVALOR, TBASE "
            "FROM MOV01 "
            f"WHERE CONCIA = {company} AND CONANO = {year} AND CONMES >= {first} AND CONMES <= {last} "
            f"AND NIT = '{nit}' AND CODIGO IN ({literals}) "
            "ORDER BY CODIGO, TFECHA, TDOCUM")

    if detailed:
        columns = _columns(("Cuenta", False), ("Concepto", False), ("Fecha", False),
                           ("Comprobante", False), ("Tipo documento", False), ("Centro", False),
                           ("Documento", False), ("Débitos", True), ("Créditos", True),
                           ("Base", True), ("%", False))
        rows: list[list[str | float]] = []
        kinds: list[str] = []
        current: str | None = None
        subtotal = 0.0
        overall = 0.0

        def close_account() -> None:
            if current is not None:
                rows.append([f"SUBTOTAL CUENTA {current}", "", "", "", "", "", "",
                             round(max(subtotal, 0.0), 2), round(max(-subtotal, 0.0), 2), "", ""])
                kinds.append("subtotal")

        for item in source:
            code = _text(item["CODIGO"]).strip()
            if code != current:
                close_account()
                current, subtotal = code, 0.0
            amount = float(_number(item.get("TVALOR")))
            base = float(_number(item.get("TBASE")))
            percentage = round(abs(amount) * 100 / base, 2) if base else ""
            value_date = str(int(_number(item.get("TFECHA")))).zfill(8)
            rows.append([code, _text(item.get("TDETALLE")).strip()[:35],
                         f"{value_date[:4]}/{value_date[4:6]}/{value_date[6:8]}",
                         _text(item.get("TCOMPR")).strip(), _text(item.get("TIPODOC")).strip(),
                         _text(item.get("TFASE")).strip(), _text(item.get("TDOCUM")).strip(),
                         round(max(amount, 0.0), 2), round(max(-amount, 0.0), 2),
                         round(base, 2), percentage])
            kinds.append("detalle")
            subtotal += amount
            overall += amount
        close_account()
        rows.append(["TOTAL GENERAL", "", "", "", "", "", "",
                     round(max(overall, 0.0), 2), round(max(-overall, 0.0), 2), "", ""])
        kinds.append("total-general")
    else:
        columns = _columns(("Cuenta", False), ("Nombre cuenta", False),
                           ("Débitos", True), ("Créditos", True), ("Neto", True))
        values: dict[str, list[float]] = {code: [0.0, 0.0] for code in accounts}
        for item in source:
            code, amount = _text(item["CODIGO"]).strip(), float(_number(item.get("TVALOR")))
            values[code][0 if amount > 0 else 1] += amount
        rows = [[code, names[code], round(values[code][0], 2), round(max(-values[code][1], 0.0), 2),
                 round(sum(values[code]), 2)] for code in sorted(accounts)]
        debit = sum(pair[0] for pair in values.values())
        credit = sum(pair[1] for pair in values.values())
        rows.append(["TOTALES", "", round(debit, 2), round(max(-credit, 0.0), 2), round(debit + credit, 2)])
        kinds = ["detalle"] * len(accounts) + ["total-general"]

    header = companies[0]
    return {"id": "tercero-especifico", "compania": {
                "codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                "nit": _text(header.get("EMPNIT")).strip()},
            "anio": year, "mesDesde": first, "mesHasta": last,
            "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
            "source": "MOV01 / CONMAE / FADCLI",
            "nota": f"Movimiento específico de {_text(thirds[0].get('CNOMBRE')).strip()} ({nit}) · "
                    f"meses {first:02d}–{last:02d} · {'detallado' if detailed else 'resumido'}."}

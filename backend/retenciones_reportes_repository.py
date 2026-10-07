"""Informes de retenciones 6-3, 6-4 y 6-5 del menú Harbour.

INFOR152/153: CONRET por cuenta o tercero, resumido o discriminado por mes.
RETECTA: totales netos por cuenta de CONRET.
ANEXIMP: soportes de MOV01 agrupados por cuenta y tercero.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from .ads_repository import _number, _text, ads_odbc_connection
from .iva_analisis_repository import CODE, NIT, _lookup_names, _quote, _safe
from .retenciones_acumulacion_repository import _stream, _validate

REPORT_IDS = {"ret-relacion", "ret-totales-cuenta", "ret-soportes"}


def _ranges(account_from: str, account_to: str, nit_from: str, nit_to: str) -> tuple[str, str, str, str]:
    values = (_safe(account_from, CODE, "La cuenta inicial"), _safe(account_to, CODE, "La cuenta final"),
              _safe(nit_from, NIT, "El tercero inicial"), _safe(nit_to, NIT, "El tercero final"))
    if values[0] and values[1] and values[0] > values[1]:
        raise ValueError("La cuenta inicial no puede superar a la final.")
    if values[2] and values[3] and values[2] > values[3]:
        raise ValueError("El tercero inicial no puede superar al final.")
    return values


def _conditions(account_from: str, account_to: str, nit_from: str, nit_to: str,
                account_field: str = "CODIGO", nit_field: str = "NIT") -> str:
    return "".join(f" AND {field} {op} {_quote(value)}" for value, field, op in
                   ((account_from, account_field, ">="), (account_to, account_field, "<="),
                    (nit_from, nit_field, ">="), (nit_to, nit_field, "<=")) if value)


def _months(first: int, last: int) -> list[int]:
    if not 1 <= first <= last <= 12:
        raise ValueError("Seleccione un rango de meses entre 01 y 12.")
    return list(range(first, last + 1))


def _monthly_fields(months: list[int]) -> str:
    return ", ".join(f"{prefix}{month:02d}{suffix}" for month in months
                     for prefix, suffix in (("BASE", ""), ("BASE", "C"), ("VALOR", ""), ("VALOR", "C")))


def _signed_month(row: dict[str, Any], month: int) -> tuple[float, float]:
    return (round(_number(row.get(f"BASE{month:02d}")) + _number(row.get(f"BASE{month:02d}C")), 2),
            round(_number(row.get(f"VALOR{month:02d}")) + _number(row.get(f"VALOR{month:02d}C")), 2))


def _base_report(report_id: str, company: int, company_row: dict[str, Any], year: int,
                 first: int, last: int, columns: list[tuple[str, bool]],
                 rows: list[list[Any]], kinds: list[str], note: str) -> dict[str, Any]:
    return {"id": report_id, "compania": {"codigo": f"{company:03d}",
            "nombre": _text(company_row.get("EMPNOM")), "nit": _text(company_row.get("EMPNIT"))},
            "anio": year, "mesDesde": first, "mesHasta": last,
            "columnas": [{"label": label, "money": is_money} for label, is_money in columns],
            "filas": rows, "tipos": kinds, "count": len(rows), "source": "CONRET" if report_id != "ret-soportes" else "MOV01",
            "nota": note}


def build_retention_report(report_id: str, cia: str, year: int, first: int, last: int, *,
                           account_from: str = "", account_to: str = "", nit_from: str = "",
                           nit_to: str = "", order: str = "cuenta", detailed: bool = False,
                           date_from: str = "", date_to: str = "") -> dict[str, Any]:
    if report_id not in REPORT_IDS:
        raise ValueError("El informe de retenciones no existe.")
    months = _months(first, last)
    account_from, account_to, nit_from, nit_to = _ranges(account_from, account_to, nit_from, nit_to)
    if order not in {"cuenta", "tercero"}:
        raise ValueError("Seleccione el orden por cuenta o tercero.")
    start_date = end_date = None
    if report_id == "ret-soportes":
        try:
            start_date, end_date = date.fromisoformat(date_from), date.fromisoformat(date_to)
        except ValueError as exc:
            raise ValueError("Seleccione fechas inicial y final válidas.") from exc
        if start_date > end_date or start_date.year != year or end_date.year != year:
            raise ValueError("El rango de fechas debe estar ordenado y pertenecer al ejercicio seleccionado.")
        first, last = start_date.month, end_date.month

    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, first, last)
        if report_id == "ret-soportes":
            sql = ("SELECT m.CODIGO, m.NIT, m.TFECHA, m.TDOCUM, m.TDETALLE, m.TVALOR, m.TBASE "
                   "FROM MOV01 m INNER JOIN CONMAE a ON m.CONCIA = a.CIA AND m.CODIGO = a.CODIGO "
                   f"WHERE m.CONCIA = {company} AND m.CONANO = {year} "
                   f"AND m.CONMES >= {first} AND m.CONMES <= {last} "
                   f"AND m.TFECHA >= {start_date:%Y%m%d} AND m.TFECHA <= {end_date:%Y%m%d} "
                   "AND a.MIVA_RET = 'R'" + _conditions(account_from, account_to, nit_from, nit_to,
                                                          "m.CODIGO", "m.NIT") +
                   " ORDER BY m.CODIGO, m.NIT, m.TFECHA, m.TDOCUM")
            source = list(_stream(connection, sql))
        else:
            sql = (f"SELECT CODIGO, NIT, {_monthly_fields(months)} FROM CONRET "
                   f"WHERE CIA = {company} AND ANO = {year}" +
                   _conditions(account_from, account_to, nit_from, nit_to) +
                   " ORDER BY CODIGO, NIT")
            source = list(_stream(connection, sql))
        accounts, thirds = _lookup_names(connection, company, source)

    if report_id == "ret-totales-cuenta":
        grouped: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
        for row in source:
            code = _text(row["CODIGO"])
            for month in months:
                base, amount = _signed_month(row, month)
                grouped[code][0] += base
                grouped[code][1] += amount
        rows = [[code, accounts.get(code, ""), round(values[0], 2), round(values[1], 2)]
                for code, values in sorted(grouped.items()) if any(values)]
        total = [round(sum(row[index] for row in rows), 2) for index in (2, 3)]
        rows.append(["TOTAL GENERAL", "", *total])
        return _base_report(report_id, company, company_row, year, first, last,
                            [("Cuenta", False), ("Nombre", False), ("Base", True), ("Valor", True)],
                            rows, ["detalle"] * (len(rows) - 1) + ["total-general"],
                            f"Relación de totales por cuenta · meses {first:02d}–{last:02d}.")

    if report_id == "ret-relacion":
        ordered = sorted(source, key=lambda row: (_text(row["NIT"]), _text(row["CODIGO"]))
                         if order == "tercero" else (_text(row["CODIGO"]), _text(row["NIT"])))
        rows: list[list[Any]] = []
        kinds: list[str] = []
        group_key = None
        subtotal = [0.0, 0.0]
        overall = [0.0, 0.0]

        def close_group() -> None:
            if group_key is not None:
                rows.append([f"TOTAL {order.upper()} {group_key}", "", "", "", *[round(v, 2) for v in subtotal]])
                kinds.append("subtotal")

        for row in ordered:
            code, nit = _text(row["CODIGO"]), _text(row["NIT"])
            current = nit if order == "tercero" else code
            if current != group_key:
                close_group()
                group_key = current
                subtotal = [0.0, 0.0]
            monthly = [(month, *_signed_month(row, month)) for month in months]
            base, amount = (round(sum(item[1] for item in monthly), 2),
                            round(sum(item[2] for item in monthly), 2))
            if not base and not amount:
                continue
            name = accounts.get(code, "") if order == "tercero" else thirds.get(nit, "")
            if detailed:
                for month, month_base, month_amount in monthly:
                    if month_base or month_amount:
                        rows.append([code, nit, name, f"{month:02d}", abs(month_base), abs(month_amount)])
                        kinds.append("detalle")
            rows.append([code, nit, name, "TOTAL", base, amount])
            kinds.append("total-cuenta")
            subtotal[0] += base; subtotal[1] += amount
            overall[0] += base; overall[1] += amount
        close_group()
        rows.append(["TOTAL GENERAL", "", "", "", round(overall[0], 2), round(overall[1], 2)])
        kinds.append("total-general")
        return _base_report(report_id, company, company_row, year, first, last,
                            [("Cuenta", False), ("Tercero", False), ("Nombre", False), ("Mes", False),
                             ("Base", True), ("Valor", True)], rows, kinds,
                            f"Relación acumulada por {order} · {'detallada' if detailed else 'resumida'} · "
                            f"meses {first:02d}–{last:02d}.")

    # ANEXIMP: las bases y valores de crédito conservan el signo de MOV01.
    rows = []
    kinds = []
    current_account = current_nit = None
    third_totals = [0.0] * 4
    account_totals = [0.0] * 4
    grand_totals = [0.0] * 4

    def add_total(label: str, values: list[float], kind: str) -> None:
        rows.append([label, "", "", "", "", *[round(value, 2) for value in values]])
        kinds.append(kind)

    for row in source:
        code, nit = _text(row["CODIGO"]), _text(row["NIT"])
        if code != current_account:
            if current_nit is not None:
                add_total(f"SUBTOTAL TERCERO {current_nit}", third_totals, "subtotal")
            if current_account is not None:
                add_total(f"TOTAL CUENTA {current_account}", account_totals, "total-cuenta")
                add_total(f"CONSOLIDADO CUENTA {current_account}",
                          [account_totals[0] + account_totals[2], account_totals[1] + account_totals[3], 0, 0],
                          "subtotal")
            current_account, current_nit = code, None
            account_totals = [0.0] * 4
        if nit != current_nit:
            if current_nit is not None:
                add_total(f"SUBTOTAL TERCERO {current_nit}", third_totals, "subtotal")
            current_nit = nit
            third_totals = [0.0] * 4
        value, base = _number(row["TVALOR"]), _number(row["TBASE"])
        values = [value, base, 0.0, 0.0] if value > 0 else [0.0, 0.0, value, base]
        rows.append([code, f"{nit} · {thirds.get(nit, '')}", str(int(_number(row["TFECHA"]))),
                     _text(row["TDOCUM"]), _text(row["TDETALLE"]), *values])
        kinds.append("detalle")
        for totals in (third_totals, account_totals, grand_totals):
            for index, number in enumerate(values):
                totals[index] += number
    if current_nit is not None:
        add_total(f"SUBTOTAL TERCERO {current_nit}", third_totals, "subtotal")
    if current_account is not None:
        add_total(f"TOTAL CUENTA {current_account}", account_totals, "total-cuenta")
        add_total(f"CONSOLIDADO CUENTA {current_account}",
                  [account_totals[0] + account_totals[2], account_totals[1] + account_totals[3], 0, 0], "subtotal")
    add_total("TOTAL GENERAL", grand_totals, "total-general")
    return _base_report(report_id, company, company_row, year, first, last,
                        [("Cuenta", False), ("Tercero", False), ("Fecha", False),
                         ("Documento", False), ("Concepto", False), ("Valor débito", True),
                         ("Base débito", True), ("Valor crédito", True), ("Base crédito", True)],
                        rows, kinds, f"Anexo de retenciones · {date_from} a {date_to}.")

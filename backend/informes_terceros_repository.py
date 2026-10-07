"""Informes 8.2 y 8.3 del menú original (INFOR07T/TERIMP e INFOR07D).

CONTERCE contiene el saldo inicial y los importes mensuales por cuenta/NIT;
MOV01 contiene todas las partidas, identificadas por CONMES. Los informes son
de solo lectura: no ejecutan la antigua acumulación ni modifican saldos.
"""

from __future__ import annotations

import re
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code


_CODE = re.compile(r"^[A-Za-z0-9.\-/]*$")


def _filter(value: str, label: str, size: int) -> str:
    value = value.strip()
    if len(value) > size or not _CODE.fullmatch(value):
        raise ValueError(f"El filtro {label} no es válido.")
    return value


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _amount(row: dict[str, Any], field: str) -> float:
    return float(_number(row.get(field)))


def _columns(*columns: tuple[str, bool]) -> list[dict[str, Any]]:
    return [{"label": label, "money": money} for label, money in columns]


def _bounds(account_from: str, account_to: str, nit_from: str, nit_to: str) -> tuple[str, str, str, str]:
    account_from = _filter(account_from, "cuenta inicial", 12)
    account_to = _filter(account_to, "cuenta final", 12)
    nit_from = _filter(nit_from, "tercero inicial", 15)
    nit_to = _filter(nit_to, "tercero final", 15)
    if account_from and account_to and account_from > account_to:
        raise ValueError("El rango de cuentas está invertido.")
    if nit_from and nit_to and nit_from > nit_to:
        raise ValueError("El rango de terceros está invertido.")
    return account_from, account_to, nit_from, nit_to


def _where(account_from: str, account_to: str, nit_from: str, nit_to: str, *, alias: str = "") -> str:
    code = f"{alias}CODIGO"
    nit = f"{alias}NIT"
    parts = [f"{nit} IS NOT NULL", f"{nit} <> ''", f"{nit} <> '           '"]
    if account_from:
        parts.append(f"{code} >= '{account_from}'")
    if account_to:
        parts.append(f"{code} <= '{account_to}'")
    if nit_from:
        parts.append(f"{nit} >= '{nit_from}'")
    if nit_to:
        parts.append(f"{nit} <= '{nit_to}'")
    return " AND ".join(parts)


def _balances(row: dict[str, Any], first: int, last: int) -> tuple[float, float, float, float]:
    """TERSALDO: saldo previo + débitos + créditos negativos = saldo final."""
    opening = _amount(row, "MSALDO")
    prior = opening if first > 0 else 0.0
    for month in range(1, first):
        prior += _amount(row, f"MACMDEB{month:02d}") + _amount(row, f"MACMCRE{month:02d}")
    debit = sum(_amount(row, f"MACMDEB{month:02d}") for month in range(first, last + 1))
    credit = sum(_amount(row, f"MACMCRE{month:02d}") for month in range(first, last + 1))
    if first == 0:
        debit += max(opening, 0.0)
        credit += min(opening, 0.0)
    return tuple(round(value, 2) for value in (prior, debit, credit, prior + debit + credit))


def build_third_party_report(
    report_id: str, cia: str, year: int, month_from: int, month_to: int, *,
    account_from: str = "", account_to: str = "", nit_from: str = "", nit_to: str = "",
    order: str = "cuenta", movement_order: str = "documento", detailed: bool = True,
) -> dict[str, Any]:
    """Genera consulta/impresión (8.2) o movimiento cuenta-tercero (8.3)."""
    if report_id not in {"tercero-general", "tercero-cuenta-tercero"}:
        raise ValueError("Informe de terceros no reconocido.")
    if not 1900 <= year <= 2100 or not 0 <= month_from <= month_to <= 12:
        raise ValueError("Seleccione un período entre los meses 00 y 12.")
    if order not in {"cuenta", "tercero"}:
        raise ValueError("Seleccione el orden por cuenta o por tercero.")
    if movement_order not in {"documento", "fecha"}:
        raise ValueError("Seleccione el orden del movimiento por documento o fecha.")
    account_from, account_to, nit_from, nit_to = _bounds(account_from, account_to, nit_from, nit_to)
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        available_year = int(_number(control[0].get("CTANO"))) if control else 0
        if year != available_year:
            raise ValueError(f"Los acumulados de terceros corresponden al ejercicio {available_year}.")
        header = companies[0]
        account_name = "m.MNOMBRE"
        third_name = "f.CNOMBRE"
        if report_id == "tercero-general":
            fields = ", ".join(["t.MSALDO"] + [f"t.MACMDEB{m:02d}, t.MACMCRE{m:02d}" for m in range(1, 13)])
            rows = _read(connection,
                f"SELECT t.CODIGO, t.NIT, {fields}, {account_name} AS CUENTA_NOMBRE, {third_name} AS TERCERO_NOMBRE "
                "FROM CONTERCE t "
                f"LEFT JOIN CONMAE m ON m.CIA = t.CIA AND m.CODIGO = t.CODIGO AND {CATALOG_ACCOUNT_FILTER.replace('NIT', 'm.NIT')} "
                "LEFT JOIN FADCLI f ON f.CCODIGO = t.NIT "
                f"WHERE t.CIA = {company} AND {_where(account_from, account_to, nit_from, nit_to, alias='t.')} "
                f"ORDER BY {'t.CODIGO, t.NIT' if order == 'cuenta' else 't.NIT, t.CODIGO'}")
            columns = _columns(("Cuenta", False), ("Nombre cuenta", False), ("Tercero", False),
                               ("Nombre tercero", False), ("Saldo anterior", True),
                               ("Débitos", True), ("Créditos", True), ("Saldo", True))
            output: list[list[str | float]] = []
            overall = [0.0] * 4
            group_key = None
            group_totals = [0.0] * 4
            for row in rows:
                code = _text(row.get("CODIGO")).strip()
                nit = _text(row.get("NIT")).strip()
                key = code if order == "cuenta" else nit
                if group_key is not None and key != group_key:
                    output.append([f"TOTAL {'CUENTA' if order == 'cuenta' else 'TERCERO'} {group_key}", "", "", "", *[round(x, 2) for x in group_totals]])
                    group_totals = [0.0] * 4
                group_key = key
                values = _balances(row, month_from, month_to)
                output.append([code, _text(row.get("CUENTA_NOMBRE")).strip(), nit,
                               _text(row.get("TERCERO_NOMBRE")).strip(), *values])
                for index, value in enumerate(values):
                    group_totals[index] += value
                    overall[index] += value
            if group_key is not None:
                output.append([f"TOTAL {'CUENTA' if order == 'cuenta' else 'TERCERO'} {group_key}", "", "", "", *[round(x, 2) for x in group_totals]])
            title = "Listado general cuentas por tercero" if order == "cuenta" else "Listado general tercero por cuenta"
        else:
            # TER174 copia los MOVxx del rango, excluye NIT en blanco y ordena
            # por cuenta/NIT o NIT/cuenta, con documento o fecha como tercer eje.
            ordering = "m.CODIGO, m.NIT" if order == "cuenta" else "m.NIT, m.CODIGO"
            ordering += ", m.TDOCUM, m.TFECHA" if movement_order == "documento" else ", m.TFECHA, m.TDOCUM"
            rows = _read(connection,
                "SELECT m.CODIGO, m.NIT, m.TDOCUM, m.TCOMPR, m.TIPODOC, m.TFECHA, m.TDETALLE, m.TVALOR, "
                "f.CNOMBRE AS TERCERO_NOMBRE, c.MNOMBRE AS CUENTA_NOMBRE "
                "FROM MOV01 m LEFT JOIN FADCLI f ON f.CCODIGO = m.NIT "
                f"LEFT JOIN CONMAE c ON c.CIA = m.CONCIA AND c.CODIGO = m.CODIGO AND {CATALOG_ACCOUNT_FILTER.replace('NIT', 'c.NIT')} "
                f"WHERE m.CONCIA = {company} AND m.CONANO = {year} AND m.CONMES >= {month_from} AND m.CONMES <= {month_to} "
                f"AND {_where(account_from, account_to, nit_from, nit_to, alias='m.')} "
                f"ORDER BY {ordering}")
            keys = {( _text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip()) for row in rows}
            balances: dict[tuple[str, str], float] = {}
            if keys:
                opening_fields = ["CODIGO", "NIT", "MSALDO"]
                for month in range(1, month_from):
                    opening_fields.extend((f"MACMDEB{month:02d}", f"MACMCRE{month:02d}"))
                opening_rows = _read(connection,
                    f"SELECT {', '.join(opening_fields)} FROM CONTERCE "
                    f"WHERE CIA = {company} AND {_where(account_from, account_to, nit_from, nit_to)}")
                for item in opening_rows:
                    key = (_text(item.get("CODIGO")).strip(), _text(item.get("NIT")).strip())
                    if key in keys:
                        balances[key] = _balances(item, month_from, month_from - 1)[0]
            columns = _columns(("Cuenta", False), ("Nombre cuenta", False), ("Tercero", False),
                               ("Nombre tercero", False), ("Saldo anterior", True),
                               ("Documento", False), ("TC", False), ("TD", False),
                               ("Fecha", False), ("Concepto", False), ("Débitos", True),
                               ("Créditos", True), ("Saldo", True)) if detailed else _columns(
                               ("Cuenta", False), ("Nombre cuenta", False), ("Tercero", False),
                               ("Nombre tercero", False), ("Saldo anterior", True),
                               ("Débitos", True), ("Créditos", True), ("Saldo", True))
            aggregates: dict[tuple[str, str], dict[str, Any]] = {}
            order_keys: list[tuple[str, str]] = []
            detail_rows: dict[tuple[str, str], list[list[str | float]]] = {}
            output = []
            overall = [0.0] * 4
            for row in rows:
                code = _text(row.get("CODIGO")).strip()
                nit = _text(row.get("NIT")).strip()
                key = (code, nit)
                if key not in aggregates:
                    opening = balances.get(key, 0.0)
                    aggregates[key] = {"account": _text(row.get("CUENTA_NOMBRE")).strip(),
                                       "third": _text(row.get("TERCERO_NOMBRE")).strip(),
                                       "opening": opening, "debit": 0.0, "credit": 0.0, "balance": opening}
                    order_keys.append(key)
                    detail_rows[key] = []
                item = aggregates[key]
                value = _amount(row, "TVALOR")
                item["balance"] += value
                if value > 0:
                    item["debit"] += value
                else:
                    item["credit"] += value
                if detailed:
                    detail_rows[key].append([code, item["account"], nit, item["third"],
                                             round(item["opening"], 2) if len(detail_rows[key]) == 0 else "",
                                             _text(row.get("TDOCUM")).strip(), _text(row.get("TCOMPR")).strip(),
                                             _text(row.get("TIPODOC")).strip(), str(int(_number(row.get("TFECHA")))),
                                             _text(row.get("TDETALLE")).strip(), max(value, 0.0), min(value, 0.0),
                                             round(item["balance"], 2)])
            group_key = None
            group_values = [0.0] * 4
            for code, nit in order_keys:
                key = code if order == "cuenta" else nit
                if group_key is not None and key != group_key:
                    if detailed:
                        output.append([f"TOTAL {'CUENTA' if order == 'cuenta' else 'TERCERO'} {group_key}", "", "", "", "", "", "", "", "", "",
                                       round(group_values[1], 2), round(group_values[2], 2), round(group_values[3], 2)])
                    else:
                        output.append([f"TOTAL {'CUENTA' if order == 'cuenta' else 'TERCERO'} {group_key}", "", "", "",
                                       *[round(value, 2) for value in group_values]])
                    group_values = [0.0] * 4
                group_key = key
                item = aggregates[(code, nit)]
                values = (item["opening"], item["debit"], item["credit"], item["balance"])
                if detailed:
                    output.extend(detail_rows[(code, nit)])
                    output.append([f"TOTAL TERCERO {nit}", "", "", "", "", "", "", "", "", "",
                                   round(item["debit"], 2), round(item["credit"], 2), round(item["balance"], 2)])
                else:
                    output.append([code, item["account"], nit, item["third"], *[round(value, 2) for value in values]])
                for index, value in enumerate(values):
                    group_values[index] += value
            if group_key is not None:
                if detailed:
                    output.append([f"TOTAL {'CUENTA' if order == 'cuenta' else 'TERCERO'} {group_key}", "", "", "", "", "", "", "", "", "",
                                   round(group_values[1], 2), round(group_values[2], 2), round(group_values[3], 2)])
                else:
                    output.append([f"TOTAL {'CUENTA' if order == 'cuenta' else 'TERCERO'} {group_key}", "", "", "",
                                   *[round(value, 2) for value in group_values]])
            for item in aggregates.values():
                for index, value in enumerate((item["opening"], item["debit"], item["credit"], item["balance"])):
                    overall[index] += value
            title = "Informe detallado de movimiento de terceros" if detailed else "Informe resumido de movimiento de terceros"
        company_info = {"codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                        "nit": _text(header.get("EMPNIT")).strip()}
        return {"id": report_id, "compania": company_info, "anio": year,
                "mesDesde": month_from, "mesHasta": month_to, "columnas": columns,
                "filas": output, "count": len(output), "source": "CONTERCE" if report_id == "tercero-general" else "MOV01 / CONTERCE",
                "nota": f"{title}. Período {month_from:02d} al {month_to:02d}.",
                "totales": (["TOTAL GENERAL", "", "", "", *[round(value, 2) for value in overall]]
                            if report_id == "tercero-general" or not detailed else
                            ["TOTAL GENERAL", "", "", "", "", "", "", "", "", "",
                             round(overall[1], 2), round(overall[2], 2), round(overall[3], 2)])}


def read_third_party_annual(cia: str, year: int, account: str, nit: str) -> dict[str, Any]:
    """TERANO(1): apertura y comportamiento enero–diciembre de una cuenta/NIT."""
    company = normalize_company_code(cia)
    account = _filter(account, "cuenta", 12)
    nit = _filter(nit, "tercero", 15)
    if not account or not nit:
        raise ValueError("Seleccione una cuenta y un tercero.")
    if not 1900 <= year <= 2100:
        raise ValueError("El año no es válido.")
    with ads_odbc_connection() as connection:
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        available_year = int(_number(control[0].get("CTANO"))) if control else 0
        if year != available_year:
            raise ValueError(f"Los acumulados de terceros corresponden al ejercicio {available_year}.")
        fields = ", ".join(["t.MSALDO"] + [f"t.MACMDEB{m:02d}, t.MACMCRE{m:02d}" for m in range(1, 13)])
        rows = _read(connection,
            f"SELECT TOP 1 {fields}, f.CNOMBRE AS TERCERO_NOMBRE, c.MNOMBRE AS CUENTA_NOMBRE "
            "FROM CONTERCE t LEFT JOIN FADCLI f ON f.CCODIGO = t.NIT "
            f"LEFT JOIN CONMAE c ON c.CIA = t.CIA AND c.CODIGO = t.CODIGO AND {CATALOG_ACCOUNT_FILTER.replace('NIT', 'c.NIT')} "
            f"WHERE t.CIA = {company} AND t.CODIGO = '{account}' AND t.NIT = '{nit}'")
    if not rows:
        raise ValueError("No existe acumulado para esta cuenta y tercero.")
    row = rows[0]
    opening = _amount(row, "MSALDO")
    running = opening
    months = []
    for month in range(1, 13):
        debit = _amount(row, f"MACMDEB{month:02d}")
        credit = _amount(row, f"MACMCRE{month:02d}")
        running += debit + credit
        months.append({"mes": month, "debito": round(debit, 2), "credito": round(credit, 2),
                       "saldo": round(running, 2)})
    return {"cuenta": account, "nombreCuenta": _text(row.get("CUENTA_NOMBRE")).strip(),
            "tercero": nit, "nombreTercero": _text(row.get("TERCERO_NOMBRE")).strip(),
            "saldoInicial": round(opening, 2), "meses": months, "saldoFinal": round(running, 2)}

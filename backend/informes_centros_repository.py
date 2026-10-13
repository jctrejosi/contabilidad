"""Consultas e informes del submenú 9 de centros de costos de Harbour.

Fuentes: COCENTRO (saldos por cuenta/centro/NIT), MOV01 (partidas),
CONMAE, CONCECOS y FADCLI (nombres y controles). Ninguna función escribe
acumulados. Los importes de crédito conservan el signo negativo contable;
la variante por columnas 51–52 los presenta positivos, como INFOR091X9.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code


REPORTS = {
    "centro-consulta", "centro-cuenta-centro", "centro-por-cuenta",
    "centro-tercero-centro", "centro-detallado", "centro-columnas-5152",
    "centro-por-nivel",
}
_CODE = re.compile(r"^[A-Za-z0-9.\-/]*$")
_ACCOUNT = re.compile(r"^[0-9]*$")


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _safe(value: str, label: str, length: int, pattern: re.Pattern[str] = _CODE) -> str:
    value = value.strip()
    if len(value) > length or not pattern.fullmatch(value):
        raise ValueError(f"El filtro {label} no es válido.")
    return value


def _range(first: str, last: str, field: str) -> str:
    if first and last and first > last:
        raise ValueError(f"El rango de {field} está invertido.")
    return (f" AND {field} >= '{first}'" if first else "") + (f" AND {field} <= '{last}'" if last else "")


def _selection(raw: str, label: str, length: int, pattern: re.Pattern[str] = _CODE) -> tuple[str, ...]:
    if not raw.strip():
        return ()
    values = tuple(dict.fromkeys(_safe(part, label, length, pattern) for part in raw.split(",")))
    if not all(values) or len(values) > 250:
        raise ValueError(f"La selección de {label} no es válida.")
    return values


def _val(row: dict[str, Any], field: str) -> float:
    return float(_number(row.get(field)))


def _text_field(row: dict[str, Any], field: str) -> str:
    return _text(row.get(field)).strip()


def _center_balances(row: dict[str, Any], first: int, last: int, include_opening: bool = True) -> tuple[float, float, float, float]:
    """CCSALDO: períodos 00..mes anterior + débito/crédito del mes."""
    prior = sum(_val(row, f"DEB{m:02d}") + _val(row, f"CRE{m:02d}") for m in range(0, first)) if include_opening else 0.0
    debit = sum(_val(row, f"DEB{m:02d}") for m in range(first, last + 1))
    credit = sum(_val(row, f"CRE{m:02d}") for m in range(first, last + 1))
    return tuple(round(x, 2) for x in (prior, debit, credit, prior + debit + credit))


def _company_and_year(connection: Any, company: int, year: int) -> dict[str, Any]:
    company_rows = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
    if not company_rows:
        raise ValueError(f"No existe la compañía {company:03d}.")
    control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
    available = int(_number(control[0].get("CTANO"))) if control else 0
    if year != available:
        raise ValueError(f"Los acumulados de centros de costo corresponden al ejercicio {available}.")
    return {"codigo": f"{company:03d}", "nombre": _text_field(company_rows[0], "EMPNOM"),
            "nit": _text_field(company_rows[0], "EMPNIT")}


def _columns(*items: tuple[str, bool]) -> list[dict[str, Any]]:
    return [{"label": label, "money": money} for label, money in items]


def _amount_columns() -> list[dict[str, Any]]:
    return _columns(("Saldo anterior", True), ("Débitos", True), ("Créditos", True), ("Saldo", True))


def _result(report_id: str, company: dict[str, Any], year: int, first: int, last: int,
            columns: list[dict[str, Any]], rows: list[list[str | float]], source: str,
            note: str, totals: list[str | float] | None = None) -> dict[str, Any]:
    result = {"id": report_id, "compania": company, "anio": year, "mesDesde": first, "mesHasta": last,
              "columnas": columns, "filas": rows, "count": len(rows), "source": source, "nota": note}
    if totals is not None:
        result["totales"] = totals
    return result


def _data_rows(connection: Any, company: int, *, account_from: str, account_to: str,
               center_from: str, center_to: str, nit_from: str, nit_to: str,
               accounts: tuple[str, ...] = (), centers: tuple[str, ...] = ()) -> list[dict[str, Any]]:
    conditions = [f"c.CIA = {company}"]
    conditions.append(_range(account_from, account_to, "c.CODIGO"))
    conditions.append(_range(center_from, center_to, "c.CENTRO"))
    conditions.append(_range(nit_from, nit_to, "c.NIT"))
    if accounts:
        conditions.append(" AND c.CODIGO IN (" + ", ".join(f"'{value}'" for value in accounts) + ")")
    if centers:
        conditions.append(" AND c.CENTRO IN (" + ", ".join(f"'{value}'" for value in centers) + ")")
    where = "".join(conditions)
    return _read(connection,
        "SELECT c.*, m.MNOMBRE AS CUENTA_NOMBRE, m.MCOSTOS AS MANEJA_CENTRO, m.MTC AS AFECTABLE, "
        "e.NOMBRE AS CENTRO_NOMBRE, f.CNOMBRE AS TERCERO_NOMBRE "
        "FROM COCENTRO c "
        f"LEFT JOIN CONMAE m ON m.CIA = c.CIA AND m.CODIGO = c.CODIGO AND {CATALOG_ACCOUNT_FILTER.replace('NIT', 'm.NIT')} "
        "LEFT JOIN CONCECOS e ON e.CIA = c.CIA AND e.CODIGO = c.CENTRO "
        "LEFT JOIN FADCLI f ON f.CCODIGO = c.NIT "
        f"WHERE {where}")


def _standard_report(report_id: str, rows: list[dict[str, Any]], first: int, last: int,
                     *, order: str, include_third: bool, include_opening: bool) -> tuple[list[dict[str, Any]], list[list[str | float]], list[str | float]]:
    # INFOR171/INFOR091: la agrupación depende de la opción, no se mezclan
    # distintas cuentas, centros o terceros aunque compartan nombre.
    if report_id == "centro-tercero-centro":
        key = lambda r: (_text_field(r, "NIT"), _text_field(r, "CENTRO"), _text_field(r, "CODIGO"))
    elif order == "centro":
        key = lambda r: (_text_field(r, "CENTRO"), _text_field(r, "CODIGO"), _text_field(r, "NIT"))
    else:
        key = lambda r: (_text_field(r, "CODIGO"), _text_field(r, "CENTRO"), _text_field(r, "NIT"))
    rows.sort(key=key)
    columns = _columns(("Cuenta", False), ("Nombre cuenta", False), ("Centro", False),
                       ("Nombre centro", False), ("Tercero", False), ("Nombre tercero", False)) + _amount_columns()
    output: list[list[str | float]] = []
    overall = [0.0] * 4
    group_name = "TERCERO" if report_id == "centro-tercero-centro" else "CENTRO" if order == "centro" else "CUENTA"
    group_key = None
    group_totals = [0.0] * 4
    inner_key = None
    inner_totals = [0.0] * 4
    detail_group: dict[tuple[str, str], list[float]] = {}
    pair_names: dict[tuple[str, str], tuple[str, str]] = {}
    for row in rows:
        code = _text_field(row, "CODIGO")
        center = _text_field(row, "CENTRO")
        nit = _text_field(row, "NIT")
        outer = nit if report_id == "centro-tercero-centro" else center if order == "centro" else code
        inner = (outer, center if order != "centro" else code)
        if include_third and report_id != "centro-consulta" and inner_key is not None and inner != inner_key:
            output.append([f"TOTAL {'CUENTA' if order == 'centro' else 'CENTRO'} {inner_key[1]}", "", "", "", "", "",
                           *[round(value, 2) for value in inner_totals]])
            inner_totals = [0.0] * 4
        if group_key is not None and outer != group_key:
            output.append([f"TOTAL {group_name} {group_key}", "", "", "", "", "", *[round(value, 2) for value in group_totals]])
            group_totals = [0.0] * 4
        group_key = outer
        inner_key = inner
        values = _center_balances(row, first, last, include_opening)
        for index, value in enumerate(values):
            overall[index] += value
            group_totals[index] += value
            inner_totals[index] += value
        if include_third or report_id == "centro-consulta" or report_id == "centro-tercero-centro":
            output.append([code, _text_field(row, "CUENTA_NOMBRE"), center,
                           _text_field(row, "CENTRO_NOMBRE"), nit,
                           _text_field(row, "TERCERO_NOMBRE"), *values])
        else:
            pair = (code, center)
            if pair not in detail_group:
                detail_group[pair] = [0.0] * 4
                pair_names[pair] = (_text_field(row, "CUENTA_NOMBRE"), _text_field(row, "CENTRO_NOMBRE"))
            for index, value in enumerate(values):
                detail_group[pair][index] += value
    if not include_third and report_id not in {"centro-consulta", "centro-tercero-centro"}:
        # Reemplaza el detalle por los totales cuenta/centro y conserva el
        # orden elegido; el saldo inicial no se suma por duplicado.
        output = []
        group_key = None
        group_totals = [0.0] * 4
        for code, center in sorted(detail_group, key=lambda pair: (pair[1], pair[0]) if order == "centro" else pair):
            outer = center if order == "centro" else code
            if group_key is not None and outer != group_key:
                output.append([f"TOTAL {group_name} {group_key}", "", "", "", "", "", *[round(value, 2) for value in group_totals]])
                group_totals = [0.0] * 4
            group_key = outer
            values = detail_group[(code, center)]
            account_name, center_name = pair_names[(code, center)]
            output.append([code, account_name, center, center_name, "", "", *[round(value, 2) for value in values]])
            for index, value in enumerate(values):
                group_totals[index] += value
    if group_key is not None:
        if include_third and report_id != "centro-consulta" and inner_key is not None:
            output.append([f"TOTAL {'CUENTA' if order == 'centro' else 'CENTRO'} {inner_key[1]}", "", "", "", "", "",
                           *[round(value, 2) for value in inner_totals]])
        output.append([f"TOTAL {group_name} {group_key}", "", "", "", "", "", *[round(value, 2) for value in group_totals]])
    return columns, output, ["TOTAL GENERAL", "", "", "", "", "", *[round(value, 2) for value in overall]]


def _detail_report(connection: Any, company: int, year: int, first: int, last: int,
                   account_from: str, account_to: str, center_from: str, center_to: str,
                   date_from: str, date_to: str) -> tuple[list[dict[str, Any]], list[list[str | float]], list[str | float]]:
    if not date_from or not date_to:
        raise ValueError("Indique las fechas inicial y final.")
    try:
        start = date.fromisoformat(date_from)
        end = date.fromisoformat(date_to)
    except ValueError as exc:
        raise ValueError("La fecha debe tener el formato AAAA-MM-DD.") from exc
    if start > end or start.year != year or end.year != year:
        raise ValueError("El rango de fechas debe pertenecer al ejercicio y estar en orden.")
    first = start.month
    last = end.month
    where = f"m.CONCIA = {company} AND m.CONANO = {year} AND m.CONMES >= {first} AND m.CONMES <= {last}"
    where += f" AND m.TFECHA >= {int(start.strftime('%Y%m%d'))} AND m.TFECHA <= {int(end.strftime('%Y%m%d'))}"
    where += _range(account_from, account_to, "m.CODIGO")
    where += _range(center_from, center_to, "m.TFASE")
    rows = _read(connection,
        "SELECT m.CODIGO, m.NIT, m.TFASE, m.TFECHA, m.TCOMPR, m.TIPODOC, m.TDOCUM, m.TDETALLE, m.TVALOR, "
        "c.MNOMBRE AS CUENTA_NOMBRE, e.NOMBRE AS CENTRO_NOMBRE "
        "FROM MOV01 m "
        f"INNER JOIN CONMAE c ON c.CIA = m.CONCIA AND c.CODIGO = m.CODIGO AND {CATALOG_ACCOUNT_FILTER.replace('NIT', 'c.NIT')} AND c.MCOSTOS = TRUE "
        "LEFT JOIN CONCECOS e ON e.CIA = m.CONCIA AND e.CODIGO = m.TFASE "
        f"WHERE {where} AND m.TFASE IS NOT NULL AND m.TFASE <> '' "
        "ORDER BY m.CODIGO, m.TFASE, m.TFECHA, m.TDOCUM")
    columns = _columns(("Cuenta", False), ("Nombre cuenta", False), ("Centro", False),
                       ("Nombre centro", False), ("Tercero", False), ("Fecha", False),
                       ("Comprobante", False), ("Documento", False), ("Tipo", False),
                       ("Concepto", False), ("Débitos", True), ("Créditos", True), ("Saldo", True))
    output: list[list[str | float]] = []
    overall = [0.0, 0.0, 0.0]
    account_key = None
    center_key = None
    account_totals = [0.0, 0.0, 0.0]
    center_totals = [0.0, 0.0, 0.0]
    for row in rows:
        code = _text_field(row, "CODIGO")
        center = _text_field(row, "TFASE")
        if center_key is not None and (code, center) != center_key:
            output.append([f"TOTAL CENTRO {center_key[1]}", "", "", "", "", "", "", "", "", "", *[round(x, 2) for x in center_totals]])
            center_totals = [0.0, 0.0, 0.0]
        if account_key is not None and code != account_key:
            output.append([f"TOTAL CUENTA {account_key}", "", "", "", "", "", "", "", "", "", *[round(x, 2) for x in account_totals]])
            account_totals = [0.0, 0.0, 0.0]
        account_key = code
        center_key = (code, center)
        value = _val(row, "TVALOR")
        debit, credit = max(value, 0.0), min(value, 0.0)
        center_totals[0] += debit
        center_totals[1] += credit
        center_totals[2] += value
        account_totals[0] += debit
        account_totals[1] += credit
        account_totals[2] += value
        overall[0] += debit
        overall[1] += credit
        overall[2] += value
        output.append([code, _text_field(row, "CUENTA_NOMBRE"), center, _text_field(row, "CENTRO_NOMBRE"),
                       _text_field(row, "NIT"), str(int(_val(row, "TFECHA"))),
                       _text_field(row, "TCOMPR"), _text_field(row, "TDOCUM"), _text_field(row, "TIPODOC"),
                       _text_field(row, "TDETALLE")[:36], round(debit, 2), round(credit, 2), round(center_totals[2], 2)])
    if center_key is not None:
        output.append([f"TOTAL CENTRO {center_key[1]}", "", "", "", "", "", "", "", "", "", *[round(x, 2) for x in center_totals]])
        output.append([f"TOTAL CUENTA {account_key}", "", "", "", "", "", "", "", "", "", *[round(x, 2) for x in account_totals]])
    return columns, output, ["TOTAL GENERAL", "", "", "", "", "", "", "", "", "", *[round(x, 2) for x in overall]]


def build_center_report(
    report_id: str, cia: str, year: int, month_from: int, month_to: int, *,
    account_from: str = "", account_to: str = "", center_from: str = "", center_to: str = "",
    nit_from: str = "", nit_to: str = "", order: str = "cuenta", include_third: bool = True,
    include_opening: bool = True, date_from: str = "", date_to: str = "",
    selected_accounts: str = "", selected_centers: str = "", account_prefix: str = "",
) -> dict[str, Any]:
    if report_id not in REPORTS:
        raise ValueError("Informe de centros de costos no reconocido.")
    if not 1900 <= year <= 2100 or not 0 <= month_from <= month_to <= 18:
        raise ValueError("Seleccione un período válido.")
    if order not in {"cuenta", "centro"}:
        raise ValueError("Seleccione el orden por cuenta o centro.")
    account_from = _safe(account_from, "cuenta inicial", 12, _ACCOUNT)
    account_to = _safe(account_to, "cuenta final", 12, _ACCOUNT)
    center_from = _safe(center_from, "centro inicial", 7)
    center_to = _safe(center_to, "centro final", 7)
    nit_from = _safe(nit_from, "tercero inicial", 15)
    nit_to = _safe(nit_to, "tercero final", 15)
    account_prefix = _safe(account_prefix, "nivel de cuenta", 12, _ACCOUNT)
    accounts = _selection(selected_accounts, "cuentas", 12, _ACCOUNT)
    centers = _selection(selected_centers, "centros", 7)
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        company_info = _company_and_year(connection, company, year)
        if accounts:
            valid_accounts = {_text_field(row, "CODIGO") for row in _read(connection,
                "SELECT CODIGO FROM CONMAE "
                f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} AND MCOSTOS = TRUE "
                "AND CODIGO IN (" + ", ".join(f"'{code}'" for code in accounts) + ")")}
            if invalid := set(accounts) - valid_accounts:
                raise ValueError("Estas cuentas no existen o no manejan centro de costo: " + ", ".join(sorted(invalid)))
        if centers:
            valid_centers = {_text_field(row, "CODIGO") for row in _read(connection,
                f"SELECT CODIGO FROM CONCECOS WHERE CIA = {company} AND CODIGO IN (" +
                ", ".join(f"'{center}'" for center in centers) + ")")}
            if invalid := set(centers) - valid_centers:
                raise ValueError("Estos centros no existen en la compañía: " + ", ".join(sorted(invalid)))
        if report_id == "centro-detallado":
            columns, output, totals = _detail_report(connection, company, year, month_from, month_to,
                account_from, account_to, center_from, center_to, date_from, date_to)
            return _result(report_id, company_info, year, month_from, month_to, columns, output,
                           "MOV01", "Detalle por cuenta y centro, con totales por ambos niveles.", totals)
        if report_id in {"centro-consulta", "centro-cuenta-centro", "centro-por-cuenta", "centro-tercero-centro"} and month_to > 12:
            raise ValueError("Este informe admite meses del 00 al 12.")
        if report_id in {"centro-cuenta-centro", "centro-por-cuenta", "centro-tercero-centro", "centro-columnas-5152"} and month_from != month_to:
            raise ValueError("Este informe solicita un único mes.")
        if report_id == "centro-por-nivel" and not account_prefix:
            raise ValueError("Indique la cuenta o nivel que desea consultar.")
        if report_id == "centro-por-cuenta" and not accounts:
            raise ValueError("Seleccione al menos una cuenta para este informe.")
        rows = _data_rows(connection, company, account_from=account_from, account_to=account_to,
                          center_from=center_from, center_to=center_to, nit_from=nit_from, nit_to=nit_to,
                          accounts=accounts, centers=centers)
        if report_id == "centro-por-nivel":
            level = len(account_prefix)
            grouped: dict[tuple[str, str], float] = {}
            names: dict[str, str] = {}
            for row in rows:
                code = _text_field(row, "CODIGO")
                if not code.startswith(account_prefix):
                    continue
                center = _text_field(row, "CENTRO")
                key = (code[:level], center)
                grouped[key] = grouped.get(key, 0.0) + sum(
                    _val(row, f"DEB{month:02d}") + _val(row, f"CRE{month:02d}")
                    for month in range(0, month_to + 1))
                names[center] = _text_field(row, "CENTRO_NOMBRE")
            output = [[code, center, names.get(center, ""), round(balance, 2)]
                      for (code, center), balance in sorted(grouped.items())]
            columns = _columns(("Cuenta / nivel", False), ("Centro", False), ("Nombre centro", False), ("Saldo al mes", True))
            return _result(report_id, company_info, year, month_from, month_to, columns, output,
                           "COCENTRO", "Saldo acumulado por nivel de cuenta y centro.")
        if report_id == "centro-columnas-5152":
            # INFOR091X9 limita clases 51/52, cuentas que manejan centro y
            # filas afectables; agrupa todos los NIT de cada cuenta/centro.
            grouped: dict[tuple[str, str], list[float]] = {}
            names: dict[tuple[str, str], tuple[str, str]] = {}
            main_centers = {_text_field(item, "CODIGO"): _text_field(item, "NOMBRE")
                            for item in _read(connection, f"SELECT CODIGO, NOMBRE FROM CONCECOS WHERE CIA = {company}")}
            for row in rows:
                code, center = _text_field(row, "CODIGO"), _text_field(row, "CENTRO")
                if not code.startswith(("51", "52")) or not _val(row, "MANEJA_CENTRO") or not _val(row, "AFECTABLE"):
                    continue
                debit, credit = _val(row, f"DEB{month_to:02d}"), _val(row, f"CRE{month_to:02d}")
                key = (center, code)
                if key not in grouped:
                    grouped[key] = [0.0, 0.0]
                grouped[key][0] += debit
                grouped[key][1] += credit
                names[key] = (_text_field(row, "CENTRO_NOMBRE"), _text_field(row, "CUENTA_NOMBRE"))
            output = []
            for (center, code), (debit, credit) in sorted(grouped.items()):
                if debit or credit:
                    center_name, account_name = names[(center, code)]
                    output.append([str(year), f"{month_to:02d}", main_centers.get(center[:2], ""), center,
                                   center_name, code, account_name, round(debit, 2), max(0.0, round(-credit, 2))])
            columns = _columns(("Año", False), ("Mes", False), ("Centro principal", False),
                               ("Centro", False), ("Descripción", False), ("Cuenta", False),
                               ("Nombre cuenta", False), ("Débitos", True), ("Créditos", True))
            return _result(report_id, company_info, year, month_from, month_to, columns, output,
                           "COCENTRO", "Columnas 51–52; créditos presentados en positivo.")
        if report_id == "centro-consulta":
            order = "centro" if order == "centro" else "cuenta"
        elif report_id == "centro-por-cuenta":
            order = "centro"
        elif report_id == "centro-tercero-centro":
            order = "tercero"
        columns, output, totals = _standard_report(report_id, rows, month_from, month_to,
            order=order, include_third=include_third or report_id == "centro-tercero-centro",
            include_opening=include_opening)
        return _result(report_id, company_info, year, month_from, month_to, columns, output,
                       "COCENTRO", "Saldo anterior + débitos + créditos = saldo del período.", totals)


def read_center_annual(cia: str, year: int, account: str, center: str, nit: str) -> dict[str, Any]:
    """TERANO(2): apertura y movimiento mensual de una fila cuenta/centro/NIT."""
    company = normalize_company_code(cia)
    account = _safe(account, "cuenta", 12, _ACCOUNT)
    center = _safe(center, "centro", 7)
    nit = _safe(nit, "tercero", 15)
    if not account or not center or not nit:
        raise ValueError("Seleccione una cuenta, centro y tercero.")
    with ads_odbc_connection() as connection:
        _company_and_year(connection, company, year)
        fields = ", ".join(f"c.DEB{month:02d}, c.CRE{month:02d}" for month in range(13))
        rows = _read(connection,
            f"SELECT TOP 1 {fields}, m.MNOMBRE AS CUENTA_NOMBRE, e.NOMBRE AS CENTRO_NOMBRE, "
            "f.CNOMBRE AS TERCERO_NOMBRE FROM COCENTRO c "
            f"LEFT JOIN CONMAE m ON m.CIA = c.CIA AND m.CODIGO = c.CODIGO AND {CATALOG_ACCOUNT_FILTER.replace('NIT', 'm.NIT')} "
            "LEFT JOIN CONCECOS e ON e.CIA = c.CIA AND e.CODIGO = c.CENTRO "
            "LEFT JOIN FADCLI f ON f.CCODIGO = c.NIT "
            f"WHERE c.CIA = {company} AND c.CODIGO = '{account}' AND c.CENTRO = '{center}' AND c.NIT = '{nit}'")
    if not rows:
        raise ValueError("No existe acumulado para esta cuenta, centro y tercero.")
    row = rows[0]
    opening = _val(row, "DEB00") + _val(row, "CRE00")
    running = opening
    months = []
    for month in range(1, 13):
        debit, credit = _val(row, f"DEB{month:02d}"), _val(row, f"CRE{month:02d}")
        running += debit + credit
        months.append({"mes": month, "debito": round(debit, 2), "credito": round(credit, 2),
                       "saldo": round(running, 2)})
    return {"cuenta": account, "nombreCuenta": _text_field(row, "CUENTA_NOMBRE"),
            "centro": center, "nombreCentro": _text_field(row, "CENTRO_NOMBRE"),
            "tercero": nit, "nombreTercero": _text_field(row, "TERCERO_NOMBRE"),
            "saldoInicial": round(opening, 2), "meses": months, "saldoFinal": round(running, 2)}

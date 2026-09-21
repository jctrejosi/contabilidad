"""Comparativos de compañías, centros y meses (CONSULCO/CONSULCO2/CONSULME)."""

from __future__ import annotations

from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _company_exists, _number, _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try: return list(_rows(recordset))
    finally: recordset.Close()


def _range(column: str, start: str, end: str) -> str:
    result = ""
    if start: result += f" AND {column} >= '{start}'"
    if end: result += f" AND {column} <= '{end}'"
    return result


def _movement_values(connection: Any, company: int, year: int, month: int, keys: list[str], *, cumulative: bool, group: str, account_from: str, account_to: str, nit_from: str, nit_to: str) -> dict[str, float]:
    if not keys: return {}
    month_sql = f"CONMES >= 1 AND CONMES <= {month}" if cumulative else f"CONMES = {month}"
    key_sql = ", ".join(f"'{key}'" for key in keys)
    conditions = _range("CODIGO", account_from, account_to) + _range("NIT", nit_from, nit_to)
    rows = _read(connection, f"SELECT {group} AS CLAVE, COALESCE(SUM(TVALOR),0) AS VALOR FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} AND {month_sql} AND {group} IN ({key_sql}){conditions} GROUP BY {group}")
    return {_text(row.get("CLAVE")).strip(): round(_number(row.get("VALOR")), 2) for row in rows}


def _account_initials(connection: Any, company: int, keys: list[str], nit_from: str, nit_to: str) -> dict[str, float]:
    if not keys: return {}
    key_sql = ", ".join(f"'{key}'" for key in keys)
    if nit_from or nit_to:
        rows = _read(connection, f"SELECT CODIGO, COALESCE(SUM(MSALDO),0) AS VALOR FROM CONTERCE WHERE CIA = {company} AND CODIGO IN ({key_sql}){_range('NIT', nit_from, nit_to)} GROUP BY CODIGO")
    else:
        rows = _read(connection, f"SELECT CODIGO, MSALDO AS VALOR FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} AND CODIGO IN ({key_sql})")
    return {_text(row.get("CODIGO")).strip(): round(_number(row.get("VALOR")), 2) for row in rows}


def _center_initials(connection: Any, company: int, keys: list[str], account_from: str, account_to: str, nit_from: str, nit_to: str) -> dict[str, float]:
    if not keys: return {}
    key_sql = ", ".join(f"'{key}'" for key in keys)
    conditions = _range("CODIGO", account_from, account_to) + _range("NIT", nit_from, nit_to)
    rows = _read(connection, f"SELECT CENTRO, COALESCE(SUM(DEB00),0) + COALESCE(SUM(CRE00),0) AS VALOR FROM COCENTRO WHERE CIA = {company} AND CENTRO IN ({key_sql}){conditions} GROUP BY CENTRO")
    return {_text(row.get("CENTRO")).strip(): round(_number(row.get("VALOR")), 2) for row in rows}


def compare_values(
    kind: str, cia: str, year: int, month_a: int, *, cia_b: str = "", month_b: int = 0,
    mode: str = "saldo", account_from: str = "", account_to: str = "", nit_from: str = "", nit_to: str = "",
    center_from: str = "", center_to: str = "", search: str = "", page: int = 1, page_size: int = 100,
) -> dict[str, Any]:
    if kind not in {"companias", "centros", "meses"} or mode not in {"saldo", "movimiento"}: raise ValueError("El tipo de comparativo no es válido.")
    company_a = normalize_company_code(cia); company_b = normalize_company_code(cia_b) if kind in {"companias", "centros"} else company_a
    if not 1900 <= year <= 2100 or not 1 <= month_a <= 12 or (kind == "meses" and not 1 <= month_b <= 12): raise ValueError("El período comparado no es válido.")
    if kind in {"companias", "centros"} and company_a == company_b: raise ValueError("Seleccione dos compañías diferentes.")
    if kind == "meses" and month_a == month_b: raise ValueError("Seleccione dos meses diferentes.")
    if page < 1 or not 1 <= page_size <= 200: raise ValueError("La paginación solicitada no es válida.")
    for value in (account_from, account_to, nit_from, nit_to, center_from, center_to):
        if len(value) > 15 or any(char in value for char in "'\r\n\x00"): raise ValueError("Uno de los rangos contiene caracteres no válidos.")
    if account_from and account_to and account_from > account_to: raise ValueError("El rango de cuentas no es válido.")
    if nit_from and nit_to and nit_from > nit_to: raise ValueError("El rango de terceros no es válido.")
    if center_from and center_to and center_from > center_to: raise ValueError("El rango de centros no es válido.")
    if len(search) > 60 or any(char in search for char in "'\r\n\x00"): raise ValueError("La búsqueda no es válida.")
    start_at = (page - 1) * page_size + 1; escaped = search.strip().upper()
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company_a) or not _company_exists(connection, company_b): raise CompanyNotFound("Una de las compañías seleccionadas no existe.")
        if kind == "centros":
            search_sql = f" AND (CODIGO LIKE '{escaped}%' OR UPPER(NOMBRE) LIKE '%{escaped}%')" if escaped else ""
            rows = _read(connection, f"SELECT TOP {page_size + 1} START AT {start_at} CODIGO, NOMBRE FROM CONCECOS WHERE CIA = {company_a}{_range('CODIGO', center_from, center_to)}{search_sql} ORDER BY CODIGO")
            page_rows = rows[:page_size]; keys = [_text(row.get("CODIGO")).strip() for row in page_rows]
            a = _movement_values(connection, company_a, year, month_a, keys, cumulative=mode == "saldo", group="TFASE", account_from=account_from, account_to=account_to, nit_from=nit_from, nit_to=nit_to)
            b = _movement_values(connection, company_b, year, month_a, keys, cumulative=mode == "saldo", group="TFASE", account_from=account_from, account_to=account_to, nit_from=nit_from, nit_to=nit_to)
            if mode == "saldo":
                ia = _center_initials(connection, company_a, keys, account_from, account_to, nit_from, nit_to); ib = _center_initials(connection, company_b, keys, account_from, account_to, nit_from, nit_to)
                a = {key: a.get(key, 0) + ia.get(key, 0) for key in keys}; b = {key: b.get(key, 0) + ib.get(key, 0) for key in keys}
        else:
            search_sql = f" AND (CODIGO LIKE '{escaped}%' OR UPPER(MNOMBRE) LIKE '%{escaped}%')" if escaped else ""
            rows = _read(connection, f"SELECT TOP {page_size + 1} START AT {start_at} CODIGO, MNOMBRE AS NOMBRE FROM CONMAE WHERE CIA = {company_a} AND {CATALOG_ACCOUNT_FILTER}{_range('CODIGO', account_from, account_to)}{search_sql} ORDER BY CODIGO")
            page_rows = rows[:page_size]; keys = [_text(row.get("CODIGO")).strip() for row in page_rows]
            second_month = month_b if kind == "meses" else month_a
            a = _movement_values(connection, company_a, year, month_a, keys, cumulative=mode == "saldo", group="CODIGO", account_from=account_from, account_to=account_to, nit_from=nit_from, nit_to=nit_to)
            b = _movement_values(connection, company_b, year, second_month, keys, cumulative=mode == "saldo", group="CODIGO", account_from=account_from, account_to=account_to, nit_from=nit_from, nit_to=nit_to)
            if mode == "saldo":
                ia = _account_initials(connection, company_a, keys, nit_from, nit_to); ib = _account_initials(connection, company_b, keys, nit_from, nit_to)
                a = {key: a.get(key, 0) + ia.get(key, 0) for key in keys}; b = {key: b.get(key, 0) + ib.get(key, 0) for key in keys}
    items = []
    for row, key in zip(page_rows, keys):
        va = round(a.get(key, 0), 2); vb = round(b.get(key, 0), 2); difference = round(va - vb, 2)
        percentage = round(((va / vb) - 1) * 100, 3) if vb else (100.0 if va else 0.0)
        items.append({"clave": key, "nombre": _text(row.get("NOMBRE")).strip(), "valorA": va, "valorB": vb, "diferencia": difference, "porcentaje": percentage})
    return {"items": items, "page": page, "pageSize": page_size, "hasMore": len(rows) > page_size, "tipo": kind, "modo": mode, "anio": year, "mesA": month_a, "mesB": month_b if kind == "meses" else month_a, "ciaA": f"{company_a:03d}", "ciaB": f"{company_b:03d}"}

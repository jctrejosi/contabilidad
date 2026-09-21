"""Saldos de cuentas y centros según CONSUL_7."""

from __future__ import annotations

from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _company_exists, _number, _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _validate(cia: str, year: int, month: int) -> int:
    company = normalize_company_code(cia)
    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("El período consultado no es válido.")
    return company


def _context(connection: Any, company: int, year: int) -> None:
    if not _company_exists(connection, company):
        raise CompanyNotFound(f"La compañía {company} no existe.")
    rows = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
    available = int(_number(rows[0].get("CTANO"))) if rows else 0
    if available != year:
        raise ValueError(f"Los saldos disponibles corresponden al ejercicio {available}.")


def list_account_balances(cia: str, year: int, month: int, *, search: str = "", page: int = 1, page_size: int = 100) -> dict[str, Any]:
    company = _validate(cia, year, month)
    if page < 1 or not 1 <= page_size <= 200:
        raise ValueError("La paginación solicitada no es válida.")
    search = search.strip()
    if len(search) > 60 or any(char in search for char in "'\r\n\x00"):
        raise ValueError("La búsqueda de cuenta no es válida.")
    escaped = search.upper()
    search_sql = f" AND (CODIGO LIKE '{escaped}%' OR UPPER(MNOMBRE) LIKE '%{escaped}%')" if escaped else ""
    fields = ["MSALDO"] + [field for number in range(1, month + 1) for field in (f"MACMDEB{number:02d}", f"MACMCRE{number:02d}")]
    start_at = (page - 1) * page_size + 1
    sql = (
        f"SELECT TOP {page_size + 1} START AT {start_at} CODIGO, MNOMBRE, MCOSTOS, {', '.join(fields)} "
        f"FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}{search_sql} ORDER BY CODIGO"
    )
    with ads_odbc_connection() as connection:
        _context(connection, company, year)
        rows = _read(connection, sql)
    items = []
    for row in rows[:page_size]:
        previous = _number(row.get("MSALDO"))
        for number in range(1, month):
            previous += _number(row.get(f"MACMDEB{number:02d}")) + _number(row.get(f"MACMCRE{number:02d}"))
        debit = _number(row.get(f"MACMDEB{month:02d}"))
        signed_credit = _number(row.get(f"MACMCRE{month:02d}"))
        items.append({
            "cuenta": _text(row.get("CODIGO")).strip(), "nombre": _text(row.get("MNOMBRE")).strip(),
            "manejaCentro": str(row.get("MCOSTOS") or "").strip().upper() not in {"", "0", "F", "FALSE", "N"},
            "saldoAnterior": round(previous, 2), "debito": round(debit, 2), "credito": round(abs(signed_credit), 2),
            "saldo": round(previous + debit + signed_credit, 2),
        })
    return {"items": items, "page": page, "pageSize": page_size, "hasMore": len(rows) > page_size, "anio": year, "mes": month}


def list_centers_for_account(cia: str, year: int, month: int, account: str) -> dict[str, Any]:
    company = _validate(cia, year, month)
    account = account.strip()
    if not account.isdigit() or len(account) > 12:
        raise ValueError("La cuenta seleccionada no es válida.")
    prior = ["COALESCE(SUM(c.DEB00),0)", "COALESCE(SUM(c.CRE00),0)"]
    for number in range(1, month):
        prior.extend((f"COALESCE(SUM(c.DEB{number:02d}),0)", f"COALESCE(SUM(c.CRE{number:02d}),0)"))
    sql = (
        "SELECT c.CENTRO, e.NOMBRE, " + " + ".join(prior) + " AS ANTERIOR, "
        f"COALESCE(SUM(c.DEB{month:02d}),0) AS DEBITO, COALESCE(SUM(c.CRE{month:02d}),0) AS CREDITO "
        "FROM COCENTRO c LEFT JOIN CONCECOS e ON e.CIA = c.CIA AND e.CODIGO = c.CENTRO "
        f"WHERE c.CIA = {company} AND c.CODIGO = '{account}' GROUP BY c.CENTRO, e.NOMBRE ORDER BY c.CENTRO"
    )
    with ads_odbc_connection() as connection:
        _context(connection, company, year)
        rows = _read(connection, sql)
    items = []
    for row in rows:
        previous = _number(row.get("ANTERIOR")); debit = _number(row.get("DEBITO")); signed_credit = _number(row.get("CREDITO"))
        items.append({"centro": _text(row.get("CENTRO")).strip(), "nombre": _text(row.get("NOMBRE")).strip(), "saldoAnterior": round(previous, 2), "debito": round(debit, 2), "credito": round(abs(signed_credit), 2), "saldo": round(previous + debit + signed_credit, 2)})
    return {"items": items, "cuenta": account, "anio": year, "mes": month}

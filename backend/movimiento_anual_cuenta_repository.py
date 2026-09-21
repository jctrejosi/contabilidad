"""Movimiento anual de una cuenta según CONSUL_3/CONSUL_31.

La consulta anual usa los acumulados reales de CONMAE. Cuando el usuario
limita el NIT, suma los auxiliares de CONTERCE. El detalle expandible se lee
de MOV01, tabla que en la versión web concentra los doce meses del ejercicio.
"""

from __future__ import annotations

import re
from typing import Any

from .ads_repository import (
    CATALOG_ACCOUNT_FILTER,
    AccountNotFound,
    CompanyNotFound,
    _company_exists,
    _boolean,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_odbc_connection,
    normalize_company_code,
)
from .movimiento_mensual_repository import _movement_from_row


ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
NIT_CODE = re.compile(r"^[A-Za-z0-9.\-]*$")
MONTH_FIELDS = ", ".join(
    field for month in range(1, 13)
    for field in (f"MACMDEB{month:02d}", f"MACMCRE{month:02d}")
)


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _validate(cia: str, year: int, account: str, nit_from: str, nit_to: str) -> tuple[int, str, str, str]:
    company = normalize_company_code(cia)
    account = account.strip()
    nit_from = nit_from.strip()
    nit_to = nit_to.strip()
    if not 1900 <= year <= 2100:
        raise ValueError("El año consultado no es válido.")
    if not ACCOUNT_CODE.fullmatch(account):
        raise ValueError("La cuenta debe contener entre 1 y 12 dígitos.")
    for value, label in ((nit_from, "NIT inicial"), (nit_to, "NIT final")):
        if len(value) > 15 or not NIT_CODE.fullmatch(value):
            raise ValueError(f"El {label} contiene caracteres no válidos.")
    if nit_from and nit_to and nit_from > nit_to:
        raise ValueError("El NIT inicial no puede ser mayor que el NIT final.")
    return company, account, nit_from, nit_to


def _nit_condition(nit_from: str, nit_to: str, *, movement: bool) -> str:
    """Construye el rango alfanumérico sin imponer filtro cuando queda vacío."""
    if not nit_from and not nit_to:
        return ""
    lower = nit_from or ""
    upper = nit_to or "ZZZZZZZZZZZZZZZ"
    if movement:
        return (
            f" AND ((NIT >= '{lower}' AND NIT <= '{upper}') "
            f"OR (NITN >= '{lower}' AND NITN <= '{upper}'))"
        )
    return f" AND NIT >= '{lower}' AND NIT <= '{upper}'"


def _account_and_period(connection: Any, company: int, year: int, account: str) -> dict[str, Any]:
    controls = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
    available = int(_number(controls[0].get("CTANO"))) if controls else 0
    if available != year:
        raise ValueError(f"Los saldos disponibles corresponden al ejercicio {available}.")
    rows = _read(
        connection,
        f"SELECT TOP 1 CODIGO, MNOMBRE, MCTAPAGOS, MIVA_RET, MSALDO, {MONTH_FIELDS} "
        f"FROM CONMAE WHERE CIA = {company} AND CODIGO = '{account}' "
        f"AND {CATALOG_ACCOUNT_FILTER}",
    )
    if not rows:
        raise AccountNotFound(f"La cuenta {account} no existe para la compañía seleccionada.")
    return rows[0]


def _summary_source(connection: Any, company: int, account: str, master: dict[str, Any], nit_from: str, nit_to: str) -> dict[str, Any]:
    if not nit_from and not nit_to:
        return master
    sums = ", ".join(f"COALESCE(SUM({field}), 0) AS {field}" for field in ["MSALDO"] + MONTH_FIELDS.split(", "))
    rows = _read(
        connection,
        f"SELECT {sums} FROM CONTERCE WHERE CIA = {company} AND CODIGO = '{account}'"
        + _nit_condition(nit_from, nit_to, movement=False),
    )
    return rows[0] if rows else {}


def _monthly_movements(
    connection: Any, company: int, year: int, account: str, nit_from: str, nit_to: str,
) -> dict[int, tuple[float, float]]:
    """Resume MOV01 por mes usando el índice CONCIA/CONANO/CONMES/CODIGO."""
    result: dict[int, tuple[float, float]] = {}
    nit_condition = _nit_condition(nit_from, nit_to, movement=True)
    for month in range(1, 13):
        rows = _read(
            connection,
            "SELECT COALESCE(SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END), 0) AS DEBITO, "
            "COALESCE(SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END), 0) AS CREDITO "
            f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} AND CONMES = {month} "
            f"AND CODIGO = '{account}'{nit_condition}",
        )
        row = rows[0] if rows else {}
        result[month] = (round(_number(row.get("DEBITO")), 2), round(_number(row.get("CREDITO")), 2))
    return result


def annual_account_summary(cia: str, year: int, account: str, *, nit_from: str = "", nit_to: str = "") -> dict[str, Any]:
    company, account, nit_from, nit_to = _validate(cia, year, account, nit_from, nit_to)
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe.")
        master = _account_and_period(connection, company, year, account)
        source = _summary_source(connection, company, account, master, nit_from, nit_to)
        movements = _monthly_movements(connection, company, year, account, nit_from, nit_to)

    opening = round(_number(source.get("MSALDO")), 2)
    balance = opening
    months: list[dict[str, Any]] = []
    for month in range(1, 13):
        debit, signed_credit = movements[month]
        balance = round(balance + debit + signed_credit, 2)
        months.append({
            "mes": month,
            "debito": debit,
            "credito": abs(signed_credit),
            "saldoMes": round(debit + signed_credit, 2),
            "saldoAcumulado": balance,
        })
    return {
        "cuenta": account,
        "nombre": _text(master.get("MNOMBRE")).strip(),
        "requiereTercero": _boolean(master.get("MCTAPAGOS")),
        "tipoFiscal": _text(master.get("MIVA_RET")).strip() or "O",
        "anio": year,
        "nitDesde": nit_from,
        "nitHasta": nit_to,
        "saldoInicial": opening,
        "meses": months,
        "totalDebito": round(sum(item["debito"] for item in months), 2),
        "totalCredito": round(sum(item["credito"] for item in months), 2),
        "saldoFinal": balance,
    }


def annual_account_detail(
    cia: str, year: int, month: int, account: str, *, nit_from: str = "", nit_to: str = "",
    page: int = 1, page_size: int = 100,
) -> dict[str, Any]:
    company, account, nit_from, nit_to = _validate(cia, year, account, nit_from, nit_to)
    if not 1 <= month <= 12:
        raise ValueError("El mes debe estar entre 1 y 12.")
    if page < 1 or not 1 <= page_size <= 200:
        raise ValueError("La paginación solicitada no es válida.")
    start_at = (page - 1) * page_size + 1
    columns = (
        "CONANO, CONMES, CODIGO, NIT, NITN, TFECHA, TCOMPR, TFASE, TIPODOC, "
        "TDOCUM, TDOCUM2, TDETALLE, TVALOR, TBASE, TIVA_RET, TSALDO, TSEC, TUSUA"
    )
    where = (
        f" WHERE CONCIA = {company} AND CONANO = {year} AND CONMES = {month} "
        f"AND CODIGO = '{account}'" + _nit_condition(nit_from, nit_to, movement=True)
    )
    sql = (
        f"SELECT TOP {page_size + 1} START AT {start_at} {columns} FROM MOV01{where} "
        "ORDER BY NIT, TFECHA, TCOMPR, TDOCUM, TSEC"
    )
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe.")
        _account_and_period(connection, company, year, account)
        rows = _read(connection, sql)
    has_more = len(rows) > page_size
    items = [_movement_from_row(row) for row in rows[:page_size]]
    return {"items": items, "page": page, "pageSize": page_size, "hasMore": has_more}

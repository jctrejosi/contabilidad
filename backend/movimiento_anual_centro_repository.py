"""Movimiento anual por centro de costo según CONSUL_5/CONSUL_51."""

from __future__ import annotations

import re
from typing import Any

from .ads_repository import (
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _company_exists,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_odbc_connection,
    normalize_company_code,
)
from .movimiento_mensual_repository import _movement_from_row


ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
CENTER_CODE = re.compile(r"^[A-Za-z0-9.\-]{1,7}$")


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _validate(cia: str, year: int, center: str, account_from: str, account_to: str) -> tuple[int, str, str, str]:
    company = normalize_company_code(cia)
    center = center.strip()
    account_from = account_from.strip()
    account_to = account_to.strip()
    if not 1900 <= year <= 2100:
        raise ValueError("El año consultado no es válido.")
    if not CENTER_CODE.fullmatch(center):
        raise ValueError("El centro de costo contiene caracteres no válidos.")
    for value, label in ((account_from, "cuenta inicial"), (account_to, "cuenta final")):
        if value and not ACCOUNT_CODE.fullmatch(value):
            raise ValueError(f"La {label} debe contener entre 1 y 12 dígitos.")
    if account_from and account_to and account_from > account_to:
        raise ValueError("La cuenta inicial no puede ser mayor que la cuenta final.")
    return company, center, account_from, account_to


def _account_condition(account_from: str, account_to: str) -> str:
    condition = ""
    if account_from:
        condition += f" AND CODIGO >= '{account_from}'"
    if account_to:
        condition += f" AND CODIGO <= '{account_to}'"
    return condition


def _validate_context(connection: Any, company: int, year: int, center: str) -> dict[str, Any]:
    if not _company_exists(connection, company):
        raise CompanyNotFound(f"La compañía {company} no existe.")
    controls = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
    available = int(_number(controls[0].get("CTANO"))) if controls else 0
    if available != year:
        raise ValueError(f"Los movimientos disponibles corresponden al ejercicio {available}.")
    centers = _read(
        connection,
        f"SELECT TOP 1 CODIGO, NOMBRE FROM CONCECOS WHERE CIA = {company} AND CODIGO = '{center}'",
    )
    if not centers:
        raise ValueError(f"El centro de costo {center} no existe para la compañía seleccionada.")
    return centers[0]


def annual_cost_center_summary(
    cia: str, year: int, center: str, *, account_from: str = "", account_to: str = "",
) -> dict[str, Any]:
    company, center, account_from, account_to = _validate(cia, year, center, account_from, account_to)
    account_condition = _account_condition(account_from, account_to)
    # El proveedor OLE DB 11.10 puede mostrar C0000005 al cerrar las doce
    # consultas mensuales. ADO sobre el driver ODBC evita ese callback nativo
    # defectuoso y conserva exactamente el mismo SQL y resultado contable.
    with ads_odbc_connection() as connection:
        center_row = _validate_context(connection, company, year, center)
        opening_rows = _read(
            connection,
            "SELECT COALESCE(SUM(DEB00), 0) + COALESCE(SUM(CRE00), 0) AS SALDO "
            f"FROM COCENTRO WHERE CIA = {company} AND CENTRO = '{center}'{account_condition}",
        )
        opening = round(_number(opening_rows[0].get("SALDO")) if opening_rows else 0, 2)
        monthly: dict[int, tuple[float, float]] = {month: (0.0, 0.0) for month in range(1, 13)}
        movement_rows = _read(
            connection,
            "SELECT CONMES, COALESCE(SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END), 0) AS DEBITO, "
            "COALESCE(SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END), 0) AS CREDITO "
            f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} AND CONMES >= 1 AND CONMES <= 12 "
            f"AND TFASE = '{center}'{account_condition} GROUP BY CONMES ORDER BY CONMES",
        )
        for row in movement_rows:
            month = int(_number(row.get("CONMES")))
            if 1 <= month <= 12:
                monthly[month] = (round(_number(row.get("DEBITO")), 2), round(_number(row.get("CREDITO")), 2))

    balance = opening
    months: list[dict[str, Any]] = []
    for month in range(1, 13):
        debit, signed_credit = monthly[month]
        balance = round(balance + debit + signed_credit, 2)
        months.append({
            "mes": month,
            "debito": debit,
            "credito": abs(signed_credit),
            "saldoMes": round(debit + signed_credit, 2),
            "saldoAcumulado": balance,
        })
    return {
        "centro": _text(center_row.get("CODIGO")).strip(),
        "nombre": _text(center_row.get("NOMBRE")).strip(),
        "anio": year,
        "cuentaDesde": account_from,
        "cuentaHasta": account_to,
        "saldoInicial": opening,
        "meses": months,
        "totalDebito": round(sum(item["debito"] for item in months), 2),
        "totalCredito": round(sum(item["credito"] for item in months), 2),
        "saldoFinal": balance,
    }


def annual_cost_center_detail(
    cia: str, year: int, month: int, center: str, *, account_from: str = "", account_to: str = "",
    page: int = 1, page_size: int = 100,
) -> dict[str, Any]:
    company, center, account_from, account_to = _validate(cia, year, center, account_from, account_to)
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
        f"AND TFASE = '{center}'" + _account_condition(account_from, account_to)
    )
    sql = (
        f"SELECT TOP {page_size + 1} START AT {start_at} {columns} FROM MOV01{where} "
        "ORDER BY CODIGO, TFECHA, TCOMPR, TDOCUM, TSEC"
    )
    with ads_odbc_connection() as connection:
        _validate_context(connection, company, year, center)
        rows = _read(connection, sql)
        page_rows = rows[:page_size]
        codes = sorted({_text(row.get("CODIGO")).strip() for row in page_rows})
        names: dict[str, str] = {}
        if codes:
            literals = ", ".join(f"'{code}'" for code in codes)
            account_rows = _read(
                connection,
                f"SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = {company} "
                f"AND {CATALOG_ACCOUNT_FILTER} AND CODIGO IN ({literals})",
            )
            names = {_text(row.get("CODIGO")).strip(): _text(row.get("MNOMBRE")).strip() for row in account_rows}

    items = []
    for row in page_rows:
        item = _movement_from_row(row)
        item["nombreCuenta"] = names.get(item["cuenta"].strip(), "")
        items.append(item)
    return {"items": items, "page": page, "pageSize": page_size, "hasMore": len(rows) > page_size}

"""Consulta Saldos y comportamiento anual, basada en CONSUL_2/CONSUL_21."""

from __future__ import annotations

from typing import Any

from .ads_repository import (
    CATALOG_ACCOUNT_FILTER, CompanyNotFound, _company_exists, _number,
    _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code,
)

FILTERS = {"generales", "todos", "retenciones", "iva"}
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


def _value(row: dict[str, Any], field: str) -> float:
    return round(_number(row.get(field)), 2)


def _annual_item(row: dict[str, Any], selected_month: int) -> dict[str, Any]:
    initial = _value(row, "MSALDO")
    balance = initial
    months: list[dict[str, Any]] = []
    for month in range(1, 13):
        debit = _value(row, f"MACMDEB{month:02d}")
        signed_credit = _value(row, f"MACMCRE{month:02d}")
        balance = round(balance + debit + signed_credit, 2)
        months.append({"mes": month, "debito": debit, "credito": signed_credit, "saldo": balance})

    opening = initial
    for month in range(1, selected_month):
        opening += _value(row, f"MACMDEB{month:02d}") + _value(row, f"MACMCRE{month:02d}")
    debit = _value(row, f"MACMDEB{selected_month:02d}")
    signed_credit = _value(row, f"MACMCRE{selected_month:02d}")
    return {
        "cuenta": _text(row.get("CODIGO")).strip(),
        "nombre": _text(row.get("MNOMBRE")).strip(),
        "nit": _text(row.get("NIT")).strip(),
        "tipo": _text(row.get("TIPO")).strip() or "cuenta",
        "tipoFiscal": _text(row.get("MIVA_RET")).strip().upper() or "O",
        "saldoAnterior": round(opening, 2),
        "debito": debit,
        "credito": signed_credit,
        "saldo": round(opening + debit + signed_credit, 2),
        "saldoInicial": initial,
        "meses": months,
        "saldoFinal": balance,
    }


def _overlay_special_movements(
    rows: list[dict[str, Any]], movements: list[dict[str, Any]], selected_month: int,
) -> None:
    master = {_text(row.get("CODIGO")).strip(): row for row in rows if _text(row.get("TIPO")) == "cuenta"}
    thirds = {
        (_text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip()): row
        for row in rows if _text(row.get("TIPO")) == "tercero"
    }
    for movement in movements:
        month = int(_number(movement.get("CONMES")))
        if month > selected_month:
            continue
        code = _text(movement.get("CODIGO")).strip()
        nit = _text(movement.get("NITN")).strip() or _text(movement.get("NIT")).strip()
        amount = _number(movement.get("TVALOR"))
        field = f"MACMDEB{month:02d}" if amount >= 0 else f"MACMCRE{month:02d}"
        for length in (1, 2, 4, 6, 9, 12):
            prefix = code[:length]
            if len(code) >= length and prefix in master:
                master[prefix][field] = _number(master[prefix].get(field)) + amount
        third = thirds.get((code, nit))
        if third is not None:
            third[field] = _number(third.get(field)) + amount


def list_annual_balances(
    cia: str, year: int, month: int, *, filter_type: str = "generales",
    account_search: str = "", page: int = 1, page_size: int = 100,
) -> dict[str, Any]:
    """Entrega la página seleccionada y los doce meses de comportamiento."""
    company = normalize_company_code(cia)
    if not 1900 <= year <= 2100:
        raise ValueError("El año consultado no es válido.")
    if not 1 <= month <= 18:
        raise ValueError("El período debe estar entre 01 y 18.")
    if filter_type not in FILTERS:
        raise ValueError("El filtro seleccionado no es válido.")
    if page < 1 or not 1 <= page_size <= 200:
        raise ValueError("La paginación solicitada no es válida.")
    account_search = account_search.strip()
    if len(account_search) > 30 or any(character in account_search for character in "\r\n\x00"):
        raise ValueError("La búsqueda de cuenta no es válida.")
    escaped_search = account_search.replace("'", "''").upper()
    master_search = (
        f" AND (CODIGO LIKE '{escaped_search}%' OR UPPER(MNOMBRE) LIKE '%{escaped_search}%')"
        if escaped_search else ""
    )

    fiscal = {"retenciones": "R", "iva": "I"}.get(filter_type)
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe.")
        controls = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        if not controls or int(_number(controls[0].get("CTANO"))) != year:
            available = int(_number(controls[0].get("CTANO"))) if controls else 0
            raise ValueError(f"Los saldos disponibles corresponden al ejercicio {available}.")

        fiscal_clause = f" AND MIVA_RET = '{fiscal}'" if fiscal else ""
        master_rows = _read(
            connection,
            "SELECT CODIGO, MNOMBRE, MIVA_RET, MSALDO, " + MONTH_FIELDS + " "
            f"FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}{fiscal_clause}{master_search} ORDER BY CODIGO",
        )
        for row in master_rows:
            row["NIT"] = ""
            row["TIPO"] = "cuenta"

        start = (page - 1) * page_size
        selected = master_rows[start:start + page_size + 1]
        third_has_more = False
        include_thirds = filter_type != "generales"
        if include_thirds and len(selected) <= page_size:
            third_start = max(0, start - len(master_rows))
            capacity = page_size + 1 - len(selected)
            if filter_type == "todos":
                third_search = (
                    f" AND (CODIGO LIKE '{escaped_search}%' OR UPPER(MNOMBRE) LIKE '%{escaped_search}%')"
                    if escaped_search else ""
                )
                third_sql = (
                    f"SELECT TOP {capacity} START AT {third_start + 1} CODIGO, NIT, MNOMBRE, "
                    f"'O' AS MIVA_RET, MSALDO, {MONTH_FIELDS} FROM CONTERCE "
                    f"WHERE CIA = {company}{third_search} ORDER BY CIA, CODIGO, NIT"
                )
            else:
                third_fields = ", ".join(
                    f"t.{field}" for field in ["MSALDO"] + [
                        field for number in range(1, 13)
                        for field in (f"MACMDEB{number:02d}", f"MACMCRE{number:02d}")
                    ]
                )
                third_search = (
                    f" AND (t.CODIGO LIKE '{escaped_search}%' OR UPPER(t.MNOMBRE) LIKE '%{escaped_search}%')"
                    if escaped_search else ""
                )
                third_sql = (
                    f"SELECT TOP {capacity} START AT {third_start + 1} t.CODIGO, t.NIT, t.MNOMBRE, "
                    f"m.MIVA_RET, {third_fields} FROM CONTERCE t INNER JOIN CONMAE m "
                    f"ON m.CIA = t.CIA AND m.CODIGO = t.CODIGO WHERE t.CIA = {company} "
                    f"AND {CATALOG_ACCOUNT_FILTER.replace('NITN', 'm.NITN')} AND m.MIVA_RET = '{fiscal}'{third_search} "
                    "ORDER BY t.CODIGO, t.NIT"
                )
            third_rows = _read(connection, third_sql)
            for row in third_rows:
                row["TIPO"] = "tercero"
            selected.extend(third_rows)
            third_has_more = len(third_rows) == capacity

        page_rows = selected[:page_size]
        if month > 12 and page_rows:
            movements = _read(
                connection,
                "SELECT CODIGO, NIT, NITN, CONMES, TVALOR FROM MOV01 "
                f"WHERE CONCIA = {company} AND CONANO = {year} AND CONMES >= 13 AND CONMES <= {month}",
            )
            _overlay_special_movements(page_rows, movements, month)

    items = [_annual_item(row, month) for row in page_rows]
    has_more = len(selected) > page_size or third_has_more or start + page_size < len(master_rows)
    return {
        "items": items, "page": page, "pageSize": page_size, "hasMore": has_more,
        "anio": year, "mes": month, "filtro": filter_type, "busquedaCuenta": account_search,
        "totalesPagina": {
            "saldoAnterior": round(sum(item["saldoAnterior"] for item in items), 2),
            "debito": round(sum(item["debito"] for item in items), 2),
            "credito": round(sum(item["credito"] for item in items), 2),
            "saldo": round(sum(item["saldo"] for item in items), 2),
        },
    }

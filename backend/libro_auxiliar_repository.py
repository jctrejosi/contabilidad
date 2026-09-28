"""Los dos libros auxiliares de ``INFOR03``/``INFOR03_2`` de CONINFOR.PRG.

El original recorre MOV01..MOV12. Esta instalación conserva todos los meses
en MOV01, distinguidos por CONANO/CONMES. Los saldos de apertura de las cuentas
vienen de CONMAE y los auxiliares por NIT de CONTERCE. No se modifica el libro.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date
from typing import Any, Iterator

from .ads_repository import (
    CATALOG_ACCOUNT_FILTER, _boolean, _number, _open_recordset, _rows, _text,
    ads_odbc_connection, normalize_company_code,
)

ACCOUNT_CODE = re.compile(r"[0-9]{0,12}\Z")
DOCUMENT_CODE = re.compile(r"[A-Za-z0-9.\-/]{1,12}\Z")
COLUMNS = [
    ("NIT / Cuenta", False), ("Fecha", False), ("Co", False),
    ("Documento", False), ("Td", False), ("Concepto", False),
    ("Débitos", True), ("Créditos", True), ("Saldo", True),
]


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _date(value: str, year: int, label: str) -> date:
    try:
        result = date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{label} debe tener formato AAAA-MM-DD y ser una fecha válida.") from exc
    if result.year != year:
        raise ValueError(f"{label} debe pertenecer al ejercicio {year}.")
    return result


def _date_number(value: Any) -> int:
    return int(_number(value))


def _month_columns(first: int, last: int) -> str:
    return ", ".join(
        f"MACMDEB{month:02d}, MACMCRE{month:02d}"
        for month in range(first, last + 1)
    )


def _opening(source: dict[str, Any], month: int) -> float:
    """CONSALDO: MSALDO más débitos y créditos (estos ya son negativos)."""
    return round(_number(source.get("MSALDO")) + sum(
        _number(source.get(f"MACMDEB{index:02d}"))
        + _number(source.get(f"MACMCRE{index:02d}"))
        for index in range(1, month)
    ), 2)


def _movement(row: dict[str, Any], balance: float) -> tuple[list[Any], float]:
    value = round(_number(row.get("TVALOR")), 2)
    balance = round(balance + value, 2)
    number = _date_number(row.get("TFECHA"))
    stamp = f"{number:08d}"
    formatted = f"{stamp[:4]}/{stamp[4:6]}/{stamp[6:]}" if number else ""
    return [
        _text(row.get("NIT")).strip(), formatted,
        _text(row.get("TCOMPR")).strip(), _text(row.get("TDOCUM")).strip(),
        _text(row.get("TIPODOC")).strip(), _text(row.get("TDETALLE")).strip(),
        value if value > 0 else 0, -value if value < 0 else 0, balance,
    ], balance


def _result(
    report_id: str, company: dict[str, Any], year: int, start_month: int,
    end_month: int, rows: list[list[Any]], kinds: list[str], note: str,
    *, dates: tuple[str, str] | None = None,
) -> dict[str, Any]:
    return {
        "id": report_id,
        "compania": {
            "codigo": f"{int(_number(company.get('EMPCOD'))):03d}",
            "nombre": _text(company.get("EMPNOM")).strip(),
            "nit": _text(company.get("EMPNIT")).strip(),
        },
        "anio": year, "mesDesde": start_month, "mesHasta": end_month,
        "fechaDesde": dates[0] if dates else "", "fechaHasta": dates[1] if dates else "",
        "columnas": [{"label": name, "money": money} for name, money in COLUMNS],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "MOV01/CONMAE/CONTERCE",
        "nota": note,
    }


def _read_movements(connection: Any, where: str, order: str) -> Iterator[dict[str, Any]]:
    """Recorre todo el rango en lotes ADO; no descarga todo en un GetRows."""
    recordset = _open_recordset(connection,
        "SELECT CODIGO, NIT, TFECHA, TCOMPR, TDOCUM, "
        f"TIPODOC, TDOCUM2, TDETALLE, TVALOR, CONMES, TSEC FROM MOV01 "
        f"WHERE {where} ORDER BY {order}")
    try:
        fields = [recordset.Fields.Item(index).Name for index in range(recordset.Fields.Count)]
        while not recordset.EOF:
            columns = recordset.GetRows(1000)
            if not columns or not columns[0]:
                break
            for values in zip(*columns):
                yield dict(zip(fields, values))
    finally:
        recordset.Close()


def _add(rows: list[list[Any]], kinds: list[str], kind: str, values: list[Any]) -> None:
    rows.append(values)
    kinds.append(kind)


def _general(
    connection: Any, company: dict[str, Any], cia: int, year: int,
    start: date, end: date, account_from: str, account_to: str,
    detail_mode: str,
) -> dict[str, Any]:
    if not ACCOUNT_CODE.fullmatch(account_from) or not ACCOUNT_CODE.fullmatch(account_to):
        raise ValueError("El rango de cuentas solo admite códigos numéricos de hasta 12 dígitos.")
    if account_from and account_to and account_from > account_to:
        raise ValueError("La cuenta inicial no puede ser mayor que la final.")
    if detail_mode not in {"detallado", "resumido"}:
        raise ValueError("Seleccione Detallado o Resumido.")
    bounds = ""
    if account_from:
        bounds += f" AND CODIGO >= '{account_from}'"
    if account_to:
        bounds += f" AND CODIGO <= '{account_to}'"
    fields = _month_columns(1, max(1, start.month - 1))
    accounts = _read(connection,
        f"SELECT CODIGO, MNOMBRE, MTC, MCTAPAGOS, MSALDO, {fields} "
        f"FROM CONMAE WHERE CIA = {cia} AND {CATALOG_ACCOUNT_FILTER}{bounds} ORDER BY CODIGO")
    # INFOR31A/INFOR31B en modo información General incluye toda cuenta
    # afectable; TIPONIIF no debe excluir partidas ni saldos del libro.
    accounts = [row for row in accounts if _boolean(row.get("MTC"))]
    codes = {_text(row.get("CODIGO")).strip() for row in accounts}
    where = (f"CONCIA = {cia} AND CONANO = {year} AND CONMES >= {start.month} "
             f"AND CONMES <= {end.month}") + bounds
    by_account: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in _read_movements(connection, where, "CODIGO, TFECHA, TSEC"):
        code = _text(row.get("CODIGO")).strip()
        if code in codes:
            by_account[code].append(row)
    third_openings: dict[tuple[str, str], float] = {}
    if detail_mode == "resumido":
        third_rows = _read(connection,
            f"SELECT CODIGO, NIT, MSALDO, {fields} FROM CONTERCE "
            f"WHERE CIA = {cia}{bounds} ORDER BY CODIGO, NIT")
        third_openings = {
            (_text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip()):
            _opening(row, start.month) for row in third_rows
        }
    begin = int(start.strftime("%Y%m%d"))
    finish = int(end.strftime("%Y%m%d"))
    result_rows: list[list[Any]] = []
    kinds: list[str] = []
    grand_debit = grand_credit = grand_balance = 0.0
    for account in accounts:
        code = _text(account.get("CODIGO")).strip()
        name = _text(account.get("MNOMBRE")).strip()
        source = by_account.pop(code, [])
        opening = _opening(account, start.month)
        opening += sum(_number(row.get("TVALOR")) for row in source
                       if _date_number(row.get("TFECHA")) < begin and
                       int(_number(row.get("CONMES"))) == start.month)
        current = [row for row in source if begin <= _date_number(row.get("TFECHA")) <= finish]
        if detail_mode == "resumido" and _boolean(account.get("MCTAPAGOS")):
            third_keys = {key[1] for key in third_openings if key[0] == code}
            third_keys.update(_text(row.get("NIT")).strip() for row in current)
            groups = []
            for nit in sorted(third_keys):
                third_open = third_openings.get((code, nit), 0.0)
                third_open += sum(_number(row.get("TVALOR")) for row in source
                                  if _text(row.get("NIT")).strip() == nit
                                  and _date_number(row.get("TFECHA")) < begin
                                  and int(_number(row.get("CONMES"))) == start.month)
                groups.append((nit, round(third_open, 2), [row for row in current
                              if _text(row.get("NIT")).strip() == nit]))
        else:
            groups = [("", round(opening, 2), current)]
        account_debit = account_credit = account_balance = 0.0
        account_present = False
        for nit, group_opening, entries in groups:
            if not group_opening and not entries:
                continue
            account_present = True
            label = (name if not nit else f"{name} / {nit}") + " · SALDO INICIAL"
            _add(result_rows, kinds, "seccion", [code, "", "", "", "", label, 0, 0, group_opening])
            balance = group_opening
            debit = credit = 0.0
            for movement in sorted(entries, key=lambda item: (_date_number(item.get("TFECHA")),
                                                    _text(item.get("TDOCUM")), _number(item.get("TSEC")))):
                line, balance = _movement(movement, balance)
                _add(result_rows, kinds, "movimiento", line)
                debit += line[6]
                credit += line[7]
            debit = round(debit, 2)
            credit = round(credit, 2)
            _add(result_rows, kinds, "subtotal", [f"Subtotal {code}" + (f" / {nit}" if nit else ""),
                "", "", "", "", "", debit, credit, balance])
            account_debit += debit
            account_credit += credit
            account_balance += balance
        if account_present and len(groups) > 1:
            _add(result_rows, kinds, "total-cuenta", [f"TOTAL CUENTA {code}", "", "", "", "", "",
                round(account_debit, 2), round(account_credit, 2), round(account_balance, 2)])
        if account_present:
            grand_debit += account_debit
            grand_credit += account_credit
            grand_balance += account_balance
    _add(result_rows, kinds, "total-general", ["TOTALES GENERALES", "", "", "", "", "",
        round(grand_debit, 2), round(grand_credit, 2), round(grand_balance, 2)])
    return _result("aux-gral", company, year, start.month, end.month, result_rows, kinds,
                   f"{start.isoformat()} a {end.isoformat()} · {detail_mode}",
                   dates=(start.isoformat(), end.isoformat()))


def _affected_document(
    connection: Any, company: dict[str, Any], cia: int, year: int,
    first: int, last: int, document: str,
) -> dict[str, Any]:
    if not 0 <= first <= last <= 12:
        raise ValueError("Seleccione un rango de meses entre 00 y 12.")
    if not DOCUMENT_CODE.fullmatch(document):
        raise ValueError("Indique un número válido de documento afectado (máximo 12 caracteres).")
    where = f"CONCIA = {cia} AND CONANO = {year} AND CONMES <= {last} AND TDOCUM2 = '{document}'"
    rows: list[list[Any]] = []
    kinds: list[str] = []
    opening = balance = 0.0
    debit = credit = 0.0
    last_nit = ""
    opened = False
    for row in _read_movements(connection, where, "CONMES, TFECHA, TSEC"):
        nit = _text(row.get("NIT")).strip()
        if nit:
            last_nit = nit
        if int(_number(row.get("CONMES"))) < first:
            opening = round(opening + _number(row.get("TVALOR")), 2)
            continue
        if not opened:
            _add(rows, kinds, "apertura", ["SALDO INICIAL", "", "", "", "", "", 0, 0, opening])
            balance = opening
            opened = True
        line, balance = _movement(row, balance)
        line[0] = _text(row.get("CODIGO")).strip()
        line[5] = line[5][:50]  # SUBS(TDETALLE,1,50) en MOVI_DOC.
        _add(rows, kinds, "movimiento", line)
        debit += line[6]
        credit += line[7]
    if not opened:
        _add(rows, kinds, "apertura", ["SALDO INICIAL", "", "", "", "", "", 0, 0, opening])
        balance = opening
    third_label = ""
    if last_nit:
        third = _read(connection,
            "SELECT TOP 1 CNOMBRE FROM FADCLI WHERE CCODIGO = '"
            + last_nit.replace("'", "''") + "'")
        third_label = f" · Tercero {last_nit}" + (
            f" {_text(third[0].get('CNOMBRE')).strip()}" if third else "")
    _add(rows, kinds, "total-general", ["TOTALES GENERALES", "", "", "", "", "",
        round(debit, 2), round(credit, 2), balance])
    return _result("aux-doc-afectado", company, year, first, last, rows, kinds,
                   f"Documento afectado {document} · meses {first:02d} a {last:02d}{third_label}")


def build_auxiliary_book(
    report_id: str, cia: str, year: int, month_from: int, month_to: int, *,
    account_from: str = "", account_to: str = "", date_from: str = "",
    date_to: str = "", detail_mode: str = "detallado",
    affected_document: str = "",
) -> dict[str, Any]:
    """Produce las filas para vista previa y exportación con la misma fuente."""
    company_code = normalize_company_code(cia)
    if not 1900 <= year <= 2100:
        raise ValueError("El ejercicio contable no es válido.")
    if report_id == "aux-gral":
        start = _date(date_from, year, "La fecha inicial")
        end = _date(date_to, year, "La fecha final")
        if start > end:
            raise ValueError("La fecha inicial no puede ser mayor que la final.")
    elif report_id != "aux-doc-afectado":
        raise ValueError("El libro auxiliar solicitado no existe.")
    with ads_odbc_connection() as connection:
        company = _read(connection,
            f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company_code}")
        if not company:
            raise ValueError(f"No existe la compañía {company_code:03d}.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        active_year = int(_number(control[0].get("CTANO"))) if control else 0
        if year != active_year:
            raise ValueError(f"Los saldos auxiliares disponibles corresponden al ejercicio {active_year}.")
        if report_id == "aux-gral":
            return _general(connection, company[0], company_code, year, start, end,
                            account_from.strip(), account_to.strip(), detail_mode)
        return _affected_document(connection, company[0], company_code, year,
                                  month_from, month_to, affected_document.strip())

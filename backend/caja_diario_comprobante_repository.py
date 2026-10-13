"""Opción E: libro caja diario por comprobante (INFOR12(1)/INFOR121).

El MOV01 actual reúne todos los meses. Los comprobantes vacíos se derivan de
VISDOCUM (sucursal 1) y, de faltar allí, del último CONTICOM de la compañía.
Harbour escribía esa corrección en MOV; aquí solo se aplica al informe.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _number, _text, ads_connection, normalize_company_code
from .balance_comprobacion_repository import _read


LEVELS = {1: 2, 2: 4, 3: 6, 4: 9}


def _voucher_bound(value: str, label: str) -> str:
    value = value.strip().upper()
    if len(value) > 2 or any(not (char.isalnum() or char in "-_/") for char in value):
        raise ValueError(f"{label} debe tener máximo dos caracteres alfanuméricos.")
    return value


def _money(value: float) -> float:
    return 0.0 if round(value, 2) == 0 else round(value, 2)


def build_cash_journal_by_voucher(
    cia: str, year: int, month: int, *, voucher_from: str = "",
    voucher_to: str = "", level: int = 1,
) -> dict[str, Any]:
    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("Seleccione un año y un mes válidos (01–18).")
    if level not in LEVELS:
        raise ValueError("Seleccione un nivel entre 1 y 4.")
    first = _voucher_bound(voucher_from, "El comprobante inicial")
    last = _voucher_bound(voucher_to, "El comprobante final")
    if first and last and first > last:
        raise ValueError("El comprobante inicial no puede ser mayor que el final.")
    company = normalize_company_code(cia)
    with ads_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        vouchers = _read(connection,
            f"SELECT CODIGO, NOMBRE FROM CONTICOM WHERE CIA = {company} ORDER BY CODIGO")
        voucher_names = {_text(row.get("CODIGO")).strip(): _text(row.get("NOMBRE")).strip()
                         for row in vouchers}
        fallback = max(voucher_names, default="")
        documents = _read(connection, "SELECT CODIGO, COMPRO FROM VISDOCUM WHERE SUC = 1")
        document_vouchers = {_text(row.get("CODIGO")).strip(): _text(row.get("COMPRO")).strip()
                             for row in documents}
        account_names = {_text(row.get("CODIGO")).strip(): _text(row.get("MNOMBRE")).strip()
                         for row in _read(connection,
                             f"SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")}
        # Agrupar en Advantage reduce el traslado de partidas sin cambiar los
        # totales que Harbour acumula al recorrer el movimiento del mes.
        movements = _read(connection,
            "SELECT TCOMPR, TIPODOC, CODIGO, "
            "SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
            "SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END) AS CREDITO "
            f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} AND CONMES = {month} "
            "GROUP BY TCOMPR, TIPODOC, CODIGO")

    depth = LEVELS[level]
    by_voucher: dict[str, dict[str, list[float]]] = defaultdict(dict)
    for movement in movements:
        voucher = _text(movement.get("TCOMPR")).strip()[:2]
        if not voucher:
            document = _text(movement.get("TIPODOC")).strip()
            voucher = document_vouchers.get(document) or fallback
        if (first and voucher < first) or (last and voucher > last):
            continue
        code = _text(movement.get("CODIGO")).strip()[:depth]
        if not code:
            continue
        amounts = by_voucher[voucher].setdefault(code, [0.0, 0.0])
        amounts[0] += _number(movement.get("DEBITO"))
        amounts[1] += _number(movement.get("CREDITO"))

    rows: list[list[Any]] = []
    kinds: list[str] = []
    summary: dict[str, list[float]] = {}
    period_debit = period_credit = 0.0
    for voucher in sorted(by_voucher):
        rows.append([voucher, voucher_names.get(voucher, "**"), "", ""])
        kinds.append("seccion")
        voucher_debit = voucher_credit = 0.0
        for code, (debit, signed_credit) in sorted(by_voucher[voucher].items()):
            rows.append([code, account_names.get(code, "**")[:30], _money(debit), _money(-signed_credit)])
            kinds.append("detalle")
            voucher_debit += debit
            voucher_credit += signed_credit
            # INFOR12G acumula 1, 2, 4, 6 y el nivel impreso según WNIVEL.
            for length in dict.fromkeys([*(n for n in (1, 2, 4, 6) if n < depth), depth]):
                if len(code) < length:
                    continue
                bucket = summary.setdefault(code[:length], [0.0, 0.0])
                bucket[0] += debit
                bucket[1] += signed_credit
        rows.append([f"TOTAL COMPROBANTE {voucher}", "", _money(voucher_debit), _money(-voucher_credit)])
        kinds.append("subtotal")
        period_debit += voucher_debit
        period_credit += voucher_credit

    rows.append(["TOTAL PERÍODO", "", _money(period_debit), _money(-period_credit)])
    kinds.append("total-general")
    rows.append(["RESUMEN LIBRO CAJA DIARIO", "", "", ""])
    kinds.append("seccion")
    for code, (debit, signed_credit) in sorted(summary.items()):
        # El resumen original conserva el crédito firmado en VAL2.
        rows.append([code, account_names.get(code, "**")[:30], _money(debit), _money(signed_credit)])
        kinds.append("resumen")

    header = companies[0]
    return {
        "id": "caja-diario-comp",
        "compania": {"codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                     "nit": _text(header.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": month, "mesHasta": month,
        "nivel": level, "comprobanteDesde": first, "comprobanteHasta": last,
        "columnas": [{"label": label, "money": index >= 2} for index, label in enumerate(
            ["Cuenta / comprobante", "Nombre", "Débitos", "Créditos"])],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "MOV01",
        "nota": f"Libro caja diario por comprobante · mes {month:02d} de {year}",
    }


def build_cash_journal_by_account(
    cia: str, year: int, month: int, *, account_from: str = "",
    account_to: str = "", level: int = 1,
) -> dict[str, Any]:
    """Opción F: INFOR12(2)/INFOR122, cuenta → comprobantes → totales."""
    from .diario_cuenta_repository import _account_bound

    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("Seleccione un año y un mes válidos (01–18).")
    if level not in LEVELS:
        raise ValueError("Seleccione un nivel entre 1 y 4.")
    first = _account_bound(account_from, "La cuenta inicial")
    last = _account_bound(account_to, "La cuenta final")
    if first and last and first > last:
        raise ValueError("La cuenta inicial no puede ser mayor que la final.")
    company = normalize_company_code(cia)
    where = f"CONCIA = {company} AND CONANO = {year} AND CONMES = {month}"
    if first:
        where += f" AND CODIGO >= '{first}'"
    if last:
        where += f" AND CODIGO <= '{last}'"
    with ads_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        vouchers = _read(connection,
            f"SELECT CODIGO, NOMBRE FROM CONTICOM WHERE CIA = {company} ORDER BY CODIGO")
        voucher_names = {_text(row.get("CODIGO")).strip(): _text(row.get("NOMBRE")).strip()
                         for row in vouchers}
        fallback = max(voucher_names, default="")
        documents = _read(connection, "SELECT CODIGO, COMPRO FROM VISDOCUM WHERE SUC = 1")
        document_vouchers = {_text(row.get("CODIGO")).strip(): _text(row.get("COMPRO")).strip()
                             for row in documents}
        account_names = {_text(row.get("CODIGO")).strip(): _text(row.get("MNOMBRE")).strip()
                         for row in _read(connection,
                             f"SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")}
        movements = _read(connection,
            "SELECT TCOMPR, TIPODOC, CODIGO, "
            "SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
            "SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END) AS CREDITO "
            f"FROM MOV01 WHERE {where} GROUP BY TCOMPR, TIPODOC, CODIGO")

    depth = LEVELS[level]
    by_account: dict[str, dict[str, list[float]]] = defaultdict(dict)
    for movement in movements:
        code = _text(movement.get("CODIGO")).strip()[:depth]
        if not code:
            continue
        voucher = _text(movement.get("TCOMPR")).strip()[:2]
        if not voucher:
            document = _text(movement.get("TIPODOC")).strip()
            voucher = document_vouchers.get(document) or fallback
        amounts = by_account[code].setdefault(voucher, [0.0, 0.0])
        amounts[0] += _number(movement.get("DEBITO"))
        amounts[1] += _number(movement.get("CREDITO"))

    rows: list[list[Any]] = []
    kinds: list[str] = []
    period_debit = period_credit = 0.0
    for code in sorted(by_account):
        rows.append([code, account_names.get(code, "**")[:30], "", ""])
        kinds.append("seccion")
        account_debit = account_credit = 0.0
        for voucher, (debit, signed_credit) in sorted(by_account[code].items()):
            rows.append([voucher, voucher_names.get(voucher, "**"),
                         _money(debit), _money(-signed_credit)])
            kinds.append("detalle")
            account_debit += debit
            account_credit += signed_credit
        rows.append([f"TOTAL CUENTA {code}", "", _money(account_debit), _money(-account_credit)])
        kinds.append("subtotal")
        period_debit += account_debit
        period_credit += account_credit
    rows.append(["TOTAL PERÍODO", "", _money(period_debit), _money(-period_credit)])
    kinds.append("total-general")
    header = companies[0]
    return {
        "id": "caja-diario-cta",
        "compania": {"codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                     "nit": _text(header.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": month, "mesHasta": month,
        "nivel": level, "cuentaDesde": first, "cuentaHasta": last,
        "columnas": [{"label": label, "money": index >= 2} for index, label in enumerate(
            ["Cuenta / comprobante", "Nombre", "Débitos", "Créditos"])],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "MOV01",
        "nota": f"Libro caja diario por cuenta · mes {month:02d} de {year}",
    }

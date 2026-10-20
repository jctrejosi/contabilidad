"""Opción G: saldos por cuenta, adaptada de INFOR13/INFOR131.

La salida recorre todos los niveles hasta el solicitado. Los terceros, si se
incluyen, salen de CONTERCE en lugar de los registros con NIT de CONMAE.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _number, _text, ads_connection, normalize_company_code
from .balance_comprobacion_repository import _account_values, _add_detail_extra_months, _add_extra_months, _read
from .diario_cuenta_repository import _account_bound


LEVELS = {4: "Cuenta", 6: "Subcuenta", 9: "Auxiliar 1", 12: "Auxiliar 2"}


def build_account_balances(
    cia: str, year: int, month: int, *, level: int = 4,
    account_from: str = "", account_to: str = "",
    include_zero: bool = False, include_thirds: bool = False,
) -> dict[str, Any]:
    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("Seleccione un año y un mes válidos (01–18).")
    if level not in LEVELS:
        raise ValueError("Seleccione Cuenta, Subcuenta, Auxiliar 1 o Auxiliar 2.")
    first = _account_bound(account_from, "La cuenta inicial")
    last = _account_bound(account_to, "La cuenta final")
    if first and last and first > last:
        raise ValueError("La cuenta inicial no puede superar la final.")
    company = normalize_company_code(cia)
    months = ", ".join(field for number in range(1, 13)
                       for field in (f"MACMDEB{number:02d}", f"MACMCRE{number:02d}"))
    bounds = (f" AND CODIGO >= '{first}'" if first else "") + (f" AND CODIGO <= '{last}'" if last else "")
    with ads_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        controls = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        if not controls or year != int(_number(controls[0].get("CTANO"))):
            raise ValueError("Los saldos corresponden al ejercicio operativo actual.")
        masters = _read(connection,
            f"SELECT CODIGO, MNOMBRE, MSALDO, {months} FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}{bounds} ORDER BY CODIGO")
        if month > 12:
            _add_extra_months(connection, company, year, month, masters)
        third_rows: list[dict[str, Any]] = []
        if include_thirds:
            third_rows = _read(connection,
                f"SELECT CODIGO, NIT, MNOMBRE, MSALDO, {months} FROM CONTERCE "
                f"WHERE CIA = {company}{bounds} AND LENGTH(TRIM(CODIGO)) <= {level} "
                "ORDER BY CODIGO, NIT")
            if month > 12:
                codes = [_text(row.get("CODIGO")).strip() for row in masters
                         if len(_text(row.get("CODIGO")).strip()) <= level]
                _add_detail_extra_months(connection, company, year, month,
                                         third_rows, "NIT", codes, max_rows=None)

    combined = [(row, "") for row in masters if len(_text(row.get("CODIGO")).strip()) <= level]
    combined.extend((row, _text(row.get("NIT")).strip()) for row in third_rows
                    if len(_text(row.get("CODIGO")).strip()) <= level)
    combined.sort(key=lambda pair: (_text(pair[0].get("CODIGO")).strip(), pair[1]))
    rows: list[list[Any]] = []
    kinds: list[str] = []
    for account, nit in combined:
        code = _text(account.get("CODIGO")).strip()
        opening, debit, credit, closing = _account_values(account, month, month)
        if not include_zero and not (opening or debit or credit):
            continue
        if code == "3" and not nit:
            # INFOR131 inicializa WSAL3/WDEB3/WCRE3 en cero y los imprime
            # para la raíz de patrimonio sin recalcularlos en esta rutina.
            opening = debit = credit = closing = 0.0
        sign = -1 if code[:1] in "234" else 1
        rows.append([code, nit, _text(account.get("MNOMBRE")).strip()[:30],
                     round(opening * sign, 2), round(debit, 2), round(credit, 2),
                     round(closing * sign, 2)])
        kinds.append("tercero" if nit else "cuenta")
    header = companies[0]
    return {
        "id": "saldos-cuenta",
        "compania": {"codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                     "nit": _text(header.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": month, "mesHasta": month,
        "nivel": level, "nombreNivel": LEVELS[level],
        "columnas": [{"label": label, "money": index >= 3} for index, label in enumerate(
            ["Código", "NIT", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"])],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "CONMAE / CONTERCE",
        "nota": f"Saldos por cuenta · mes {month:02d} de {year}",
    }

"""Informe C, Mayor y balance: lectura equivalente a INFOR10/INFOR101.

CONMAE contiene saldos y movimientos firmados por compañía; MOV01 completa
los períodos especiales 13–18 del modelo actual. El informe solo lee datos.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _number, _text, ads_connection, normalize_company_code
from .balance_comprobacion_repository import _account_values, _add_extra_months, _read


LEVELS = {1: "Clase", 2: "Grupo", 4: "Cuenta", 6: "Subcuenta", 9: "Auxiliar 1", 12: "Auxiliar 2"}


def _split_balance(value: float) -> tuple[float, float]:
    """Muestra un saldo deudor o acreedor en columnas excluyentes."""
    return round(max(value, 0.0), 2), round(max(-value, 0.0), 2)


def build_mayor_balance(
    cia: str, year: int, month_from: int, month_to: int, *,
    level: int = 1, include_zero: bool = False,
) -> dict[str, Any]:
    """Obtiene únicamente cuentas del nivel elegido y totaliza lo impreso."""
    if not 1900 <= year <= 2100:
        raise ValueError("El año del informe no es válido.")
    if not 1 <= month_from <= month_to <= 18:
        raise ValueError("Seleccione un rango de meses entre 01 y 18.")
    if level not in LEVELS:
        raise ValueError("Seleccione un nivel contable válido.")
    company = normalize_company_code(cia)
    month_fields = ", ".join(
        field for month in range(1, 13)
        for field in (f"MACMDEB{month:02d}", f"MACMCRE{month:02d}")
    )
    with ads_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        controls = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        if not controls:
            raise ValueError("No existe configuración contable.")
        if year != int(_number(controls[0].get("CTANO"))):
            raise ValueError("El año solicitado no corresponde al ejercicio operativo.")
        accounts = _read(
            connection,
            f"SELECT CODIGO, MNOMBRE, MSALDO, {month_fields} FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} ORDER BY CODIGO",
        )
        if month_to > 12:
            _add_extra_months(connection, company, year, month_to, accounts)

    rows: list[list[Any]] = []
    total = [0.0] * 6
    for account in accounts:
        code = _text(account.get("CODIGO")).strip()
        if len(code) != level:
            continue
        opening, debit, credit, closing = _account_values(account, month_from, month_to)
        debit = 0.0 if debit == 0 else debit
        credit = 0.0 if credit == 0 else credit
        if not include_zero and not (opening or debit or credit):
            continue
        before_debit, before_credit = _split_balance(opening)
        after_debit, after_credit = _split_balance(closing)
        values = [before_debit, before_credit, debit, credit, after_debit, after_credit]
        rows.append([code, _text(account.get("MNOMBRE")).strip(), *values])
        total = [round(a + b, 2) for a, b in zip(total, values)]

    labels = ["Cuenta", "Nombre", "Saldo anterior débito", "Saldo anterior crédito",
              "Movimiento débito", "Movimiento crédito", "Saldo actual débito", "Saldo actual crédito"]
    company_row = companies[0]
    return {
        "id": "mayor-bal",
        "compania": {"codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM")).strip(),
                     "nit": _text(company_row.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": month_from, "mesHasta": month_to,
        "nivel": level, "nombreNivel": LEVELS[level],
        "columnas": [{"label": label, "money": index >= 2} for index, label in enumerate(labels)],
        "filas": rows, "count": len(rows), "source": "CONMAE",
        "nota": f"Mayor y balance · meses {month_from:02d} al {month_to:02d} de {year}",
        "totales": ["", "TOTALES", *total],
    }

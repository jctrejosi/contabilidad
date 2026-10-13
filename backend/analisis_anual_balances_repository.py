"""Opción I: INFO015, matriz fija de enero a diciembre por cuenta.

La variante 1 muestra el saldo de cierre de cada mes; la 2, el movimiento
neto mensual. El formulario Harbour enseña otros controles pero esta rutina
no los utiliza: no hay filtro de terceros, ceros ni período variable.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _number, _text, ads_connection, normalize_company_code
from .balance_comprobacion_repository import MONTH_NAMES, _account_values, _read


LEVELS = {4: "Cuenta", 6: "Subcuenta", 9: "Auxiliar 1", 12: "Auxiliar 2"}


def build_annual_balance_analysis(cia: str, year: int, *,
                                  accumulated: bool, level: int = 4) -> dict[str, Any]:
    if level not in LEVELS:
        raise ValueError("Seleccione un nivel contable válido.")
    company = normalize_company_code(cia)
    fields = ", ".join(field for month in range(1, 13)
                       for field in (f"MACMDEB{month:02d}", f"MACMCRE{month:02d}"))
    with ads_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        if not control or year != int(_number(control[0].get("CTANO"))):
            raise ValueError("Los acumulados disponibles corresponden al ejercicio operativo.")
        accounts = _read(connection,
            f"SELECT CODIGO, MNOMBRE, MSALDO, {fields} FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} ORDER BY CODIGO")

    source = {_text(row.get("CODIGO")).strip(): row for row in accounts}

    def values(account: dict[str, Any]) -> list[float]:
        code = _text(account.get("CODIGO")).strip()
        sign = -1 if code[:1] in "234" else 1
        result = []
        for month in range(1, 13):
            _opening, debit, credit, closing = _account_values(account, month, month)
            amount = closing if accumulated else debit - credit
            result.append(round(amount * sign, 2))
        return result

    result_values = [0.0] * 12
    for digit in "456789":
        root = source.get(digit)
        if root is None:
            continue
        root_values = values(root)
        multiplier = 1 if digit == "4" else -1
        result_values = [round(total + multiplier * amount, 2)
                         for total, amount in zip(result_values, root_values)]

    rows: list[list[Any]] = []
    kinds: list[str] = []
    class_values: dict[str, list[float]] = {}
    for digit in "123456789":
        root = source.get(digit)
        if root is None:
            continue
        printable = [row for row in accounts
                     if (code := _text(row.get("CODIGO")).strip()).startswith(digit)
                     and len(code) <= level
                     and (_number(row.get("MSALDO")) != 0 or any(
                         _number(row.get(f"MACMDEB{month:02d}")) != 0 or
                         _number(row.get(f"MACMCRE{month:02d}")) != 0
                         for month in range(1, 13)))]
        if not printable:
            continue
        for account in printable:
            code = _text(account.get("CODIGO")).strip()
            monthly = values(account)
            if code == "3":
                monthly = [round(a + b, 2) for a, b in zip(monthly, result_values)]
            rows.append([code, _text(account.get("MNOMBRE")).strip()[:20], *monthly])
            kinds.append("cuenta")
        class_total = values(root)
        if digit == "3":
            class_total = [round(a + b, 2) for a, b in zip(class_total, result_values)]
            rows.append(["", "RESULTADO EJERCICIO", *result_values])
            kinds.append("resultado")
        class_values[digit] = class_total
        rows.append([digit, f"TOTAL {digit}", *class_total])
        kinds.append("total-clase")
        if digit == "3":
            balance = [round(a + b, 2) for a, b in zip(
                class_values.get("2", [0.0] * 12), class_total)]
            rows.append(["", "PASIVO Y PATRIMONIO", *balance])
            kinds.append("total-balance")
    rows.append(["", "INGRESOS - EGRESOS", *result_values])
    kinds.append("total-estado")
    header = companies[0]
    report_id = "analisis-anual-acum" if accumulated else "analisis-anual-mens"
    return {
        "id": report_id,
        "compania": {"codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                     "nit": _text(header.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": 1, "mesHasta": 12,
        "nivel": level,
        "columnas": [{"label": label, "money": index >= 2} for index, label in enumerate(
            ["Cuenta", "Descripción", *MONTH_NAMES])],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "CONMAE",
        "nota": "Saldos acumulados" if accumulated else "Movimiento mensual",
    }

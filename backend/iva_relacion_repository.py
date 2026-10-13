"""Relación de acumulados IVA: INFOR152(2) -> INFOR153(2).

CONIVA ya contiene el acumulado por compañía, cuenta y tercero. Este informe
solo lee los meses solicitados: base/valor netos = débito + crédito. El modo
detallado muestra cada mes y el resumido únicamente el total del período.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import _text, ads_odbc_connection
from .iva_acumulacion_repository import _stream, _validate
from .iva_analisis_repository import _lookup_names
from .retenciones_reportes_repository import _conditions, _monthly_fields, _months, _ranges, _signed_month


def build_iva_relation(cia: str, year: int, first: int, last: int, *,
                       account_from: str = "", account_to: str = "",
                       nit_from: str = "", nit_to: str = "",
                       order: str = "cuenta", detailed: bool = False) -> dict[str, Any]:
    months = _months(first, last)
    account_from, account_to, nit_from, nit_to = _ranges(
        account_from, account_to, nit_from, nit_to)
    if order not in {"cuenta", "tercero"}:
        raise ValueError("Seleccione el orden por cuenta o tercero.")

    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, first, last)
        sql = (f"SELECT CODIGO, NIT, {_monthly_fields(months)} FROM CONIVA "
               f"WHERE CIA = {company}" +
               _conditions(account_from, account_to, nit_from, nit_to) +
               (" ORDER BY NIT, CODIGO" if order == "tercero" else " ORDER BY CODIGO, NIT"))
        source = list(_stream(connection, sql))
        accounts, thirds = _lookup_names(connection, company, source)

    columns = [{"label": name, "money": money} for name, money in
               (("Cuenta", False), ("Nombre cuenta", False), ("Tercero", False),
                ("Nombre tercero", False), ("Mes", False), ("Base", True), ("Valor IVA", True))]
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    group_key: str | None = None
    subtotal = [0.0, 0.0]
    overall = [0.0, 0.0]

    def close_group() -> None:
        if group_key is not None:
            label = "TERCERO" if order == "tercero" else "CUENTA"
            rows.append([f"TOTAL {label} {group_key}", "", "", "", "",
                         round(subtotal[0], 2), round(subtotal[1], 2)])
            kinds.append("subtotal")

    for item in source:
        code, nit = _text(item["CODIGO"]).strip(), _text(item["NIT"]).strip()
        monthly = [(month, *_signed_month(item, month)) for month in months]
        base = round(sum(value[1] for value in monthly), 2)
        amount = round(sum(value[2] for value in monthly), 2)
        # El original omite filas cuya base y valor netos son cero.
        if not base and not amount:
            continue
        current = nit if order == "tercero" else code
        if current != group_key:
            close_group()
            group_key = current
            subtotal = [0.0, 0.0]
        if detailed:
            for month, month_base, month_amount in monthly:
                # En INFOR153 el desglose mensual aparece incluso si el mes
                # carece de movimiento; conserva esa secuencia completa.
                rows.append([code, accounts.get(code, ""), nit, thirds.get(nit, ""),
                             f"{month:02d}", abs(month_base), abs(month_amount)])
                kinds.append("detalle-mes")
        rows.append([code, accounts.get(code, ""), nit, thirds.get(nit, ""),
                     "TOTAL", base, amount])
        kinds.append("detalle")
        subtotal[0] += base
        subtotal[1] += amount
        overall[0] += base
        overall[1] += amount
    close_group()
    rows.append(["TOTAL GENERAL", "", "", "", "", round(overall[0], 2), round(overall[1], 2)])
    kinds.append("total-general")
    return {
        "id": "iva-relacion",
        "compania": {"codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM")).strip(),
                     "nit": _text(company_row.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": first, "mesHasta": last,
        "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
        "source": "CONIVA",
        "nota": f"Relación acumulada de IVA por {order} · {'detallada' if detailed else 'resumida'} · meses {first:02d}–{last:02d}.",
    }


def build_iva_totals_by_account(cia: str, year: int, first: int, last: int, *,
                                account_from: str = "", account_to: str = "",
                                nit_from: str = "", nit_to: str = "") -> dict[str, Any]:
    """RETECTA(2)/RETCTA2: una línea por cuenta con base y valor netos."""
    months = _months(first, last)
    account_from, account_to, nit_from, nit_to = _ranges(
        account_from, account_to, nit_from, nit_to)
    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, first, last)
        sql = (f"SELECT CODIGO, NIT, {_monthly_fields(months)} FROM CONIVA "
               f"WHERE CIA = {company}" +
               _conditions(account_from, account_to, nit_from, nit_to) +
               " ORDER BY CODIGO, NIT")
        source = list(_stream(connection, sql))
        accounts, _ = _lookup_names(connection, company, source)

    totals_by_code: dict[str, list[float]] = {}
    for item in source:
        code = _text(item["CODIGO"]).strip()
        amounts = totals_by_code.setdefault(code, [0.0, 0.0])
        for month in months:
            base, value = _signed_month(item, month)
            amounts[0] += base
            amounts[1] += value
    rows: list[list[str | float]] = [
        [code, accounts.get(code, ""), round(base, 2), round(value, 2)]
        for code, (base, value) in sorted(totals_by_code.items())
        if round(base, 2) or round(value, 2)
    ]
    total_base = round(sum(float(row[2]) for row in rows), 2)
    total_value = round(sum(float(row[3]) for row in rows), 2)
    rows.append(["TOTAL GENERAL", "", total_base, total_value])
    return {
        "id": "iva-totales-cuenta",
        "compania": {"codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM")).strip(),
                     "nit": _text(company_row.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": first, "mesHasta": last,
        "columnas": [{"label": label, "money": money} for label, money in
                     (("Cuenta", False), ("Nombre", False), ("Valor base", True), ("Valor IVA", True))],
        "filas": rows, "tipos": ["detalle"] * (len(rows) - 1) + ["total-general"],
        "count": len(rows), "source": "CONIVA",
        "nota": f"Totales de IVA por cuenta · meses {first:02d}–{last:02d}.",
    }

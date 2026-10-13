"""Informe D (INFOR11): diario mensual agrupado por cuenta y tercero.

El sistema Harbour leía MOV<mes> por el índice CODIGO+NIT+TFECHA y
mostraba subtotal para cada pareja cuenta/tercero y total del período.
En el esquema actual todos los meses están en MOV01, filtrados por CONMES.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, CompanyNotFound, _number, _text, ads_connection, normalize_company_code
from .balance_comprobacion_repository import _read


def _account_bound(value: str, label: str) -> str:
    value = value.strip()
    if value and (not value.isdigit() or len(value) > 12):
        raise ValueError(f"{label} debe tener entre 1 y 12 dígitos.")
    return value


def _third_names(connection: Any, company: int, movements: list[dict[str, Any]]) -> dict[tuple[str, str], str]:
    """Busca solo las parejas impresas, usando la cuenta y tercero del original."""
    by_account: dict[str, set[str]] = defaultdict(set)
    for movement in movements:
        nit = _text(movement.get("NIT")).strip()
        if nit:
            by_account[_text(movement.get("CODIGO")).strip()].add(nit)
    names: dict[tuple[str, str], str] = {}
    for code, nits in by_account.items():
        ordered_nits = sorted(nits)
        for start in range(0, len(ordered_nits), 200):
            batch = ordered_nits[start:start + 200]
            quoted = ", ".join("'" + nit.replace("'", "''") + "'" for nit in batch)
            records = _read(connection,
                "SELECT CODIGO, NIT, MNOMBRE FROM CONTERCE "
                f"WHERE CIA = {company} AND CODIGO = '{code}' AND NIT IN ({quoted})")
            for record in records:
                key = (_text(record.get("CODIGO")).strip(), _text(record.get("NIT")).strip())
                names.setdefault(key, _text(record.get("MNOMBRE")).strip())
    return names


def _date(value: Any) -> str:
    digits = str(int(_number(value))) if value else ""
    return f"{digits[:4]}/{digits[4:6]}/{digits[6:8]}" if len(digits) == 8 else digits


def build_account_journal(
    cia: str, year: int, month: int, *, account_from: str = "", account_to: str = "",
) -> dict[str, Any]:
    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("Seleccione un año y un mes válidos (01–18).")
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
        movements = _read(connection,
            "SELECT CODIGO, NIT, TFECHA, TCOMPR, TIPODOC, TDOCUM, TDETALLE, TVALOR "
            f"FROM MOV01 WHERE {where} ORDER BY CODIGO, NIT, TFECHA, TCOMPR, TIPODOC, TDOCUM, TSEC")
        account_names = {
            _text(row.get("CODIGO")).strip(): _text(row.get("MNOMBRE")).strip()
            for row in _read(connection,
                f"SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")
        }
        third_names = _third_names(connection, company, movements)

    rows: list[list[Any]] = []
    types: list[str] = []
    period_debit = period_credit = 0.0
    group: tuple[str, str] | None = None
    group_debit = group_credit = 0.0

    def close_group() -> None:
        nonlocal period_debit, period_credit, group_debit, group_credit
        if group is None:
            return
        rows.append([group[0], group[1], "TOTAL CUENTA", "", "", "", "", "",
                     round(group_debit, 2), round(group_credit, 2)])
        types.append("subtotal")
        period_debit += group_debit
        period_credit += group_credit
        group_debit = group_credit = 0.0

    for movement in movements:
        code = _text(movement.get("CODIGO")).strip()
        nit = _text(movement.get("NIT")).strip()
        key = (code, nit)
        if key != group:
            close_group()
            group = key
        value = round(_number(movement.get("TVALOR")), 2)
        debit = value if value > 0 else 0.0
        credit = value if value < 0 else 0.0  # Harbour imprime el crédito firmado.
        group_debit += debit
        group_credit += credit
        name = (third_names.get(key, "**") if nit else account_names.get(code, "**"))
        rows.append([
            code, nit, name[:20], _date(movement.get("TFECHA")),
            _text(movement.get("TCOMPR")).strip()[:2],
            _text(movement.get("TIPODOC")).strip(),
            _text(movement.get("TDOCUM")).strip(),
            _text(movement.get("TDETALLE")).strip()[:24], debit, credit,
        ])
        types.append("detalle")
    close_group()
    rows.append(["", "", "TOTAL PERÍODO", "", "", "", "", "",
                 round(period_debit, 2), round(period_credit, 2)])
    types.append("total-general")
    labels = ["Cuenta", "Tercero", "Nombre", "Fecha", "Tc", "Td", "Documento",
              "Concepto", "Débitos", "Créditos"]
    header = companies[0]
    return {
        "id": "diario-cta", "compania": {
            "codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
            "nit": _text(header.get("EMPNIT")).strip(),
        },
        "anio": year, "mesDesde": month, "mesHasta": month,
        "columnas": [{"label": label, "money": index >= 8} for index, label in enumerate(labels)],
        "filas": rows, "tipos": types, "count": len(rows), "source": "MOV01",
        "nota": f"Diario por cuenta · mes {month:02d} de {year}",
    }

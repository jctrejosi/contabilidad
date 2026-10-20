"""Anexo de IVA de Harbour: ANEXIMP(2), ANEXIMP2, ANEXIMP3/4.

Consulta directamente MOV01 para el ejercicio activo. El original copiaba
partidas a POSINFOR temporal; aquí se agrupan en memoria sin escribir datos.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection
from .iva_acumulacion_repository import _stream, _validate
from .iva_analisis_repository import _lookup_names
from .retenciones_reportes_repository import _conditions, _ranges


def _date_filter(value: str, label: str, year: int) -> date:
    try:
        result = date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Indique una {label} válida.") from exc
    if result.year != year:
        raise ValueError(f"La {label} debe pertenecer al ejercicio activo.")
    return result


def _movement_values(item: dict[str, Any]) -> list[float]:
    amount = float(_number(item.get("TVALOR")))
    base = float(_number(item.get("TBASE")))
    return [round(amount, 2), round(base, 2), 0.0, 0.0] if amount > 0 else [
        0.0, 0.0, round(amount, 2), round(base, 2)]


def _date_label(value: Any) -> str:
    text = str(int(_number(value))).zfill(8)
    return f"{text[:4]}/{text[4:6]}/{text[6:8]}"


def build_iva_supports(cia: str, year: int, *, date_from: str, date_to: str,
                       account_from: str = "", account_to: str = "",
                       nit_from: str = "", nit_to: str = "") -> dict[str, Any]:
    start = _date_filter(date_from, "fecha inicial", year)
    end = _date_filter(date_to, "fecha final", year)
    if start > end:
        raise ValueError("La fecha inicial no puede superar la final.")
    account_from, account_to, nit_from, nit_to = _ranges(
        account_from, account_to, nit_from, nit_to)

    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, start.month, end.month)
        catalog_filter = CATALOG_ACCOUNT_FILTER.replace("NITN", "a.NITN")
        sql = ("SELECT m.CODIGO, m.NIT, m.TFECHA, m.TDOCUM, m.TDETALLE, m.TVALOR, m.TBASE "
               "FROM MOV01 m INNER JOIN CONMAE a ON a.CIA = m.CONCIA AND a.CODIGO = m.CODIGO "
               f"AND {catalog_filter} "
               f"WHERE m.CONCIA = {company} AND m.CONANO = {year} "
               f"AND m.CONMES >= {start.month} AND m.CONMES <= {end.month} "
               f"AND m.TFECHA >= {start:%Y%m%d} AND m.TFECHA <= {end:%Y%m%d} "
               "AND a.MIVA_RET = 'I'" +
               _conditions(account_from, account_to, nit_from, nit_to, "m.CODIGO", "m.NIT") +
               " ORDER BY m.CODIGO, m.NIT, m.TFECHA, m.TDOCUM")
        source = list(_stream(connection, sql))
        accounts, thirds = _lookup_names(connection, company, source)

    columns = [{"label": label, "money": money} for label, money in
               (("Cuenta / sección", False), ("Tercero", False), ("Fecha", False),
                ("Documento", False), ("Concepto", False), ("Valor débito", True),
                ("Base débito", True), ("Valor crédito", True), ("Base crédito", True))]
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    account_key: str | None = None
    nit_key: str | None = None
    account_totals = [0.0] * 4
    nit_totals = [0.0] * 4
    overall = [0.0] * 4

    def total_row(label: str, values: list[float], kind: str) -> None:
        rows.append([label, "", "", "", "", *[round(value, 2) for value in values]])
        kinds.append(kind)

    def close_third() -> None:
        if nit_key is not None:
            total_row(f"SUBTOTAL TERCERO {nit_key}", nit_totals, "subtotal")

    def close_account() -> None:
        if account_key is not None:
            total_row(f"TOTAL CUENTA {account_key}", account_totals, "total-cuenta")
            total_row(f"CONSOLIDADO CUENTA {account_key}",
                      [account_totals[0] + account_totals[2],
                       account_totals[1] + account_totals[3], 0.0, 0.0], "subtotal")

    for item in source:
        code, nit = _text(item["CODIGO"]).strip(), _text(item["NIT"]).strip()
        if code != account_key:
            close_third()
            close_account()
            account_key, nit_key = code, None
            account_totals = [0.0] * 4
            rows.append([f"CUENTA: {code} — {accounts.get(code, '')}", "", "", "", "", "", "", "", ""])
            kinds.append("subtotal")
        if nit != nit_key:
            close_third()
            nit_key = nit
            nit_totals = [0.0] * 4
            rows.append([f"TERCERO: {nit} — {thirds.get(nit, '')}", "", "", "", "", "", "", "", ""])
            kinds.append("subtotal")
        values = _movement_values(item)
        rows.append([code, nit, _date_label(item["TFECHA"]),
                     _text(item["TDOCUM"]).strip()[:12], _text(item["TDETALLE"]).strip()[:35],
                     *values])
        kinds.append("detalle")
        for totals in (nit_totals, account_totals, overall):
            for index, value in enumerate(values):
                totals[index] += value
    close_third()
    close_account()
    total_row("TOTALES GENERALES", overall, "total-general")
    total_row("CONSOLIDADO GENERAL", [overall[0] + overall[2], overall[1] + overall[3], 0.0, 0.0],
              "total-general")
    return {
        "id": "iva-soportes",
        "compania": {"codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM")).strip(),
                     "nit": _text(company_row.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": start.month, "mesHasta": end.month,
        "fechaDesde": start.isoformat(), "fechaHasta": end.isoformat(),
        "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
        "source": "MOV01", "nota": f"Soportes de IVA del {start:%Y/%m/%d} al {end:%Y/%m/%d}.",
    }

"""Libro diario por comprobante: INFOR08(1), INFOR81(1), INFOR81X(1).

El original copia un MOVxx a una tabla temporal y lo ordena por comprobante
y fecha o documento. MOV01 concentra todos los meses en esta instalación;
la lectura equivalente filtra CONMES y no escribe archivos temporales.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection, normalize_company_code
from .informes_terceros_repository import _filter, _read


def _columns(*items: tuple[str, bool]) -> list[dict[str, Any]]:
    return [{"label": label, "money": money} for label, money in items]


def build_voucher_journal(cia: str, year: int, first: int, last: int, *,
                          voucher_from: str = "", voucher_to: str = "",
                          order: str = "fecha", subtotals: bool = False,
                          by_document_type: bool = False) -> dict[str, Any]:
    if not 1900 <= year <= 2100 or first != last or not 0 <= first <= 12:
        raise ValueError("Seleccione un único mes entre 00 y 12.")
    group_label = "tipo documental" if by_document_type else "comprobante"
    group_column = "TIPODOC" if by_document_type else "TCOMPR"
    voucher_from = _filter(voucher_from, f"{group_label} inicial", 2)
    voucher_to = _filter(voucher_to, f"{group_label} final", 2)
    if voucher_from and voucher_to and voucher_from > voucher_to:
        raise ValueError(f"El rango de {group_label}s está invertido.")
    if order not in {"fecha", "documento"}:
        raise ValueError("Seleccione el orden por fecha o documento.")
    company = normalize_company_code(cia)
    where = f"m.CONCIA = {company} AND m.CONANO = {year} AND m.CONMES = {first}"
    if voucher_from:
        where += f" AND m.{group_column} >= '{voucher_from}'"
    if voucher_to:
        where += f" AND m.{group_column} <= '{voucher_to}'"
    ordering = "m.TFECHA, m.TDOCUM" if order == "fecha" else "m.TDOCUM, m.TFECHA"
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        available = int(_number(control[0].get("CTANO"))) if control else 0
        if year != available:
            raise ValueError(f"El movimiento corresponde al ejercicio {available}.")
        catalog_filter = CATALOG_ACCOUNT_FILTER.replace("NITN", "a.NITN")
        source = _read(connection,
            "SELECT m.TCOMPR, m.CODIGO, m.NIT, m.TFECHA, m.TIPODOC, m.TDOCUM, "
            "m.TDETALLE, m.TVALOR, a.MNOMBRE AS CUENTA_NOMBRE, c.NOMBRE AS COMPROBANTE_NOMBRE, "
            "d.NOMBRE AS DOCUMENTO_NOMBRE "
            "FROM MOV01 m "
            f"LEFT JOIN CONMAE a ON a.CIA = m.CONCIA AND a.CODIGO = m.CODIGO AND {catalog_filter} "
            "LEFT JOIN CONTICOM c ON c.CIA = m.CONCIA AND c.CODIGO = m.TCOMPR "
            "LEFT JOIN VISDOCUM d ON d.SUC = 1 AND d.CODIGO = m.TIPODOC "
            f"WHERE {where} ORDER BY m.{group_column}, {ordering}, m.CODIGO")

    columns = _columns(("Cuenta / sección", False), ("Tercero", False),
                       ("Nombre cuenta", False), ("Fecha", False), ("Tipo documento", False),
                       ("Documento", False), ("Concepto", False), ("Débitos", True),
                       ("Créditos", True), ("Diferencia", True))
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    voucher: str | None = None
    subkey: str | None = None
    subvalues = [0.0, 0.0]
    voucher_values = [0.0, 0.0]
    overall = [0.0, 0.0]

    def append_total(label: str, values: list[float], kind: str, *, difference: bool) -> None:
        rows.append([label, "", "", "", "", "", "", round(values[0], 2),
                     round(values[1], 2), round(sum(values), 2) if difference else ""])
        kinds.append(kind)

    def close_subgroup() -> None:
        if subtotals and subkey is not None:
            label = "FECHA" if order == "fecha" else "DOCUMENTO"
            append_total(f"TOTAL {label} {subkey}", subvalues, "subtotal", difference=False)

    def close_voucher() -> None:
        if voucher is not None:
            close_subgroup()
            append_total(f"TOTAL {'TIPO DOC.' if by_document_type else 'COMPROBANTE'} {voucher}", voucher_values, "total-cuenta", difference=True)

    for item in source:
        current = _text(item.get(group_column)).strip()
        if current != voucher:
            close_voucher()
            voucher = current
            subkey = None
            voucher_values = [0.0, 0.0]
            group_name = _text(item.get("DOCUMENTO_NOMBRE" if by_document_type else "COMPROBANTE_NOMBRE")).strip()
            rows.append([f"{'TIPO DOCUMENTO' if by_document_type else 'COMPROBANTE'} {current} — {group_name}",
                         "", "", "", "", "", "", "", "", ""])
            kinds.append("subtotal")
        raw_date = str(int(_number(item.get("TFECHA")))).zfill(8)
        current_subkey = raw_date if order == "fecha" else _text(item.get("TDOCUM")).strip()
        if current_subkey != subkey:
            close_subgroup()
            subkey = current_subkey
            subvalues = [0.0, 0.0]
        amount = float(_number(item.get("TVALOR")))
        debit, credit = (amount, 0.0) if amount >= 0 else (0.0, amount)
        rows.append([_text(item.get("CODIGO")).strip(), _text(item.get("NIT")).strip()[:12],
                     _text(item.get("CUENTA_NOMBRE")).strip()[:18], raw_date,
                     _text(item.get("TIPODOC")).strip()[:2], _text(item.get("TDOCUM")).strip(),
                     _text(item.get("TDETALLE")).strip()[:30], round(debit, 2), round(credit, 2), ""])
        kinds.append("detalle")
        for values in (subvalues, voucher_values, overall):
            values[0] += debit
            values[1] += credit
    close_voucher()
    append_total("TOTAL GENERAL", overall, "total-general", difference=True)
    header = companies[0]
    return {"id": "mov-tipo-doc" if by_document_type else "mov-comprobante", "compania": {
                "codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                "nit": _text(header.get("EMPNIT")).strip()},
            "anio": year, "mesDesde": first, "mesHasta": last,
            "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
            "source": "MOV01 / VISDOCUM / CONMAE" if by_document_type else "MOV01 / CONTICOM / CONMAE",
            "nota": f"Libro diario por {'tipo de documento' if by_document_type else 'comprobante'} · mes {first:02d} · ordenado por {order}"
                    + (" · subtotales por grupo." if subtotals else ".")}

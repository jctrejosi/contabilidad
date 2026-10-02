"""Balance de comprobación acumulado: INFOR02(1) → INFOR21 → INFOR21A/B.

Reglas del informe Harbour conservadas en este módulo:

* INFOR02 recoge meses 1–18, nivel, resultados, ceros y terceros.
* CONSALDO y MOVMENSU calculan apertura y movimientos del intervalo.
* INFOR21A/B separan resultados (clases 4–9) y balance (1–3), agregan
  el resultado del ejercicio al patrimonio y emiten subtotales por clase.
* INCLU_CC añade el detalle por centro cuando se solicita.
* ``MSALDO`` es el saldo inicial del ejercicio.
* Los campos ``MACMDEBxx`` guardan débitos positivos.
* Los campos ``MACMCRExx`` guardan créditos negativos.

En la base nueva, CONMAE conserva solo cuentas maestras y meses 01–12;
CONTERCE contiene los terceros, COCENTRO los centros y MOV01 permite
reconstruir los períodos especiales 13–18 sin sumar auxiliares dos veces.
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle

from .ads_repository import (
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    normalize_company_code,
)


LEVELS = {4: "Cuenta", 6: "Subcuenta", 9: "Auxiliar 1", 12: "Auxiliar 2"}
MONTH_NAMES = (
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
)
PERIOD_NAMES = MONTH_NAMES + tuple(f"Mes {month}" for month in range(13, 19))
ACCOUNT_LENGTHS = (1, 2, 4, 6, 9, 12)
MAX_DETAIL_ROWS = 10000


def _validate_parameters(year: int, month_from: int, month_to: int, level: int) -> None:
    if not 1900 <= year <= 2100:
        raise ValueError("El año del informe no es válido.")
    if not 1 <= month_from <= 18 or not 1 <= month_to <= 18:
        raise ValueError("Los meses deben estar entre 1 y 18.")
    if month_from > month_to:
        raise ValueError("El mes inicial no puede ser posterior al mes final.")
    if level not in LEVELS:
        raise ValueError("El nivel debe ser Cuenta, Subcuenta, Auxiliar 1 o Auxiliar 2.")


def _amount(row: dict[str, Any], field: str) -> float:
    return round(_number(row.get(field)), 2)


def _account_values(
    row: dict[str, Any], month_from: int, month_to: int,
) -> tuple[float, float, float, float]:
    """Calcula saldo anterior, débito, crédito presentado y saldo final."""
    opening = _amount(row, "MSALDO")
    for month in range(1, month_from):
        opening += _amount(row, f"MACMDEB{month:02d}")
        opening += _amount(row, f"MACMCRE{month:02d}")

    debit = sum(_amount(row, f"MACMDEB{month:02d}") for month in range(month_from, month_to + 1))
    signed_credit = sum(_amount(row, f"MACMCRE{month:02d}") for month in range(month_from, month_to + 1))
    closing = opening + debit + signed_credit
    return round(opening, 2), round(debit, 2), round(-signed_credit, 2), round(closing, 2)


def build_trial_balance(
    company_code: str,
    year: int,
    month_from: int,
    month_to: int,
    *,
    level: int = 4,
    include_zero: bool = False,
    include_results: bool = True,
    include_thirds: bool = False,
    include_centers: bool = False,
    detail_from: str = "",
    detail_to: str = "",
    detail_limit: int | None = MAX_DETAIL_ROWS,
) -> dict[str, Any]:
    """Consulta CONMAE y entrega el balance acumulado de una compañía."""
    company = normalize_company_code(company_code)
    _validate_parameters(year, month_from, month_to, level)
    detail_from, detail_to = _validate_detail_range(detail_from, detail_to)
    month_fields = ", ".join(
        field
        for month in range(1, 13)
        for field in (f"MACMDEB{month:02d}", f"MACMCRE{month:02d}")
    )

    with ads_connection() as connection:
        company_rs = _open_recordset(
            connection,
            f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}",
        )
        try:
            companies = list(_rows(company_rs))
        finally:
            company_rs.Close()
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")

        control_rs = _open_recordset(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        try:
            controls = list(_rows(control_rs))
        finally:
            control_rs.Close()
        if not controls:
            raise ValueError("No existe configuración contable en CONCTR.")
        control_year = int(_number(controls[0].get("CTANO")))
        if year != control_year:
            raise ValueError(
                f"CONMAE contiene los acumulados del ejercicio {control_year}; "
                f"no es posible generar el año {year}."
            )

        account_rs = _open_recordset(
            connection,
            "SELECT CODIGO, MNOMBRE, MSALDO, " + month_fields + " "
            f"FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} ORDER BY CODIGO",
        )
        try:
            source_rows = list(_rows(account_rs))
        finally:
            account_rs.Close()

        if month_to > 12:
            _add_extra_months(connection, company, year, month_to, source_rows)
        detail_codes = [
            code for row in source_rows
            if (code := _text(row.get("CODIGO")).strip())
            and len(code) <= level
            and (not detail_from or (code >= detail_from if detail_to else code.startswith(detail_from)))
            and (not detail_to or code <= detail_to)
        ]
        third_rows = _load_thirds(connection, company, level, detail_from, detail_to, detail_codes,
                                  month_to=month_to, max_rows=detail_limit) if include_thirds else []
        center_rows = _load_centers(connection, company, level, detail_from, detail_to, detail_codes) if include_centers else []
        if month_to > 12:
            if include_thirds:
                _add_detail_extra_months(connection, company, year, month_to, third_rows, "NIT", detail_codes,
                                         max_rows=detail_limit)
            if include_centers:
                _add_detail_extra_months(connection, company, year, month_to, center_rows, "CENTRO", detail_codes)

    return _assemble_report(
        company, companies[0], year, month_from, month_to, level, include_zero, source_rows,
        include_results=include_results, third_rows=third_rows, center_rows=center_rows,
        detail_from=detail_from, detail_to=detail_to,
    )


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _validate_detail_range(first: str, last: str) -> tuple[str, str]:
    first, last = first.strip(), last.strip()
    if any(value and (not value.isdigit() or len(value) > 12) for value in (first, last)):
        raise ValueError("El rango de cuentas para detalles debe contener solo dígitos (máximo 12).")
    if first and last and first > last:
        raise ValueError("La cuenta inicial de los detalles no puede superar la final.")
    return first, last


def _detail_where(first: str, last: str) -> str:
    if first and last:
        return f" AND CODIGO >= '{first}' AND CODIGO <= '{last}'"
    if first:
        return f" AND CODIGO LIKE '{first}%'"
    if last:
        return f" AND CODIGO <= '{last}'"
    return ""


def _add_extra_months(connection: Any, company: int, year: int, last_month: int,
                      rows: list[dict[str, Any]]) -> None:
    """CONMAE llega hasta mes 12; los períodos especiales salen del libro único MOV01."""
    indexed = {_text(row.get("CODIGO")).strip(): row for row in rows}
    movements = _read(connection,
        "SELECT CODIGO, CONMES, SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
        "SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END) AS CREDITO "
        f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} "
        f"AND CONMES BETWEEN 13 AND {last_month} "
        "GROUP BY CODIGO, CONMES")
    for movement in movements:
        code = _text(movement.get("CODIGO")).strip()
        month = int(_number(movement.get("CONMES")))
        for length in ACCOUNT_LENGTHS:
            if len(code) < length:
                break
            parent = indexed.get(code[:length])
            if parent is None:
                continue
            for field, value in ((f"MACMDEB{month:02d}", movement.get("DEBITO")),
                                 (f"MACMCRE{month:02d}", movement.get("CREDITO"))):
                parent[field] = _number(parent.get(field)) + _number(value)


def _code_condition(level: int, first: str, last: str, codes: list[str]) -> str:
    # La búsqueda exacta aprovecha el índice de CODIGO y evita calcular LENGTH
    # sobre millones de filas del detalle.
    if not codes:
        return " AND 1 = 0"
    if len(codes) <= 500:
        return " AND CODIGO IN (" + ",".join(f"'{code}'" for code in codes) + ")"
    return f" AND LENGTH(TRIM(CODIGO)) <= {level}{_detail_where(first, last)}"


def _load_thirds(connection: Any, company: int, level: int, first: str, last: str,
                 codes: list[str], *, month_to: int = 12,
                 max_rows: int | None = MAX_DETAIL_ROWS) -> list[dict[str, Any]]:
    # CONSALDO solo necesita los meses hasta el solicitado. En un informe con
    # muchos terceros esto evita transferir columnas posteriores innecesarias.
    fields = ", ".join(f"MACMDEB{m:02d}, MACMCRE{m:02d}"
                       for m in range(1, min(12, month_to) + 1))
    limit = f"TOP {max_rows + 1} " if max_rows is not None else ""
    # En el informe sin tope, una lista IN extensa fuerza a Advantage a
    # comparar cada registro con cientos de códigos. El filtro por nivel
    # recorre la compañía una sola vez; el armado final usa solo códigos reales.
    code_filter = (f" AND LENGTH(TRIM(CODIGO)) <= {level}{_detail_where(first, last)}"
                   if max_rows is None else _code_condition(level, first, last, codes))
    sql = (
        f"SELECT {limit}CODIGO, NIT, MNOMBRE, MSALDO, {fields} "
        f"FROM CONTERCE WHERE CIA = {company}{code_filter} "
        "ORDER BY CODIGO, NIT"
    )
    if max_rows is None:
        # El informe original no tiene límite; GetRows por bloques evita una
        # sola matriz ADO gigantesca antes de construir las filas del informe.
        recordset = _open_recordset(connection, sql)
        try:
            names = [recordset.Fields.Item(index).Name for index in range(recordset.Fields.Count)]
            rows = []
            while not recordset.EOF:
                columns = recordset.GetRows(1000)
                if not columns or not columns[0]:
                    break
                rows.extend(dict(zip(names, values)) for values in zip(*columns))
        finally:
            recordset.Close()
    else:
        rows = _read(connection, sql)
    if max_rows is not None and len(rows) > max_rows:
        raise ValueError("Hay demasiados detalles de terceros. Indique un rango de cuentas más pequeño.")
    return rows


def _load_centers(connection: Any, company: int, level: int, first: str, last: str,
                  codes: list[str]) -> list[dict[str, Any]]:
    fields = ", ".join(
        f"SUM(DEB{m:02d}) AS MACMDEB{m:02d}, SUM(CRE{m:02d}) AS MACMCRE{m:02d}"
        for m in range(1, 13))
    rows = _read(connection,
        f"SELECT TOP {MAX_DETAIL_ROWS + 1} CODIGO, CENTRO, "
        f"SUM(DEB00 + CRE00) AS MSALDO, {fields} FROM COCENTRO "
        f"WHERE CIA = {company}{_code_condition(level, first, last, codes)} "
        "GROUP BY CODIGO, CENTRO ORDER BY CODIGO, CENTRO")
    if len(rows) > MAX_DETAIL_ROWS:
        raise ValueError("Hay demasiados detalles de centros. Indique un rango de cuentas más pequeño.")
    return rows


def _add_detail_extra_months(connection: Any, company: int, year: int, last_month: int,
                             rows: list[dict[str, Any]], kind: str,
                             allowed_codes: list[str], *, max_rows: int | None = MAX_DETAIL_ROWS) -> None:
    source_field = "NIT" if kind == "NIT" else "TFASE"
    indexed = {(_text(row.get("CODIGO")).strip(), _text(row.get(kind)).strip()): row for row in rows}
    allowed = set(allowed_codes)
    movements = _read(connection,
        f"SELECT CODIGO, {source_field} AS DETALLE, CONMES, "
        "SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
        "SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END) AS CREDITO "
        f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} "
        f"AND CONMES BETWEEN 13 AND {last_month} "
        f"GROUP BY CODIGO, {source_field}, CONMES")
    for movement in movements:
        code = _text(movement.get("CODIGO")).strip()
        detail = _text(movement.get("DETALLE")).strip()
        month = int(_number(movement.get("CONMES")))
        for length in ACCOUNT_LENGTHS:
            if len(code) < length:
                break
            parent_code = code[:length]
            if parent_code not in allowed or not detail:
                continue
            row = indexed.get((parent_code, detail))
            if row is None:
                if max_rows is not None and len(indexed) >= max_rows:
                    raise ValueError("Hay demasiados detalles en los períodos especiales. Acote el rango de cuentas.")
                row = {"CODIGO": parent_code, kind: detail, "MNOMBRE": detail, "MSALDO": 0}
                rows.append(row)
                indexed[(parent_code, detail)] = row
            row[f"MACMDEB{month:02d}"] = _number(row.get(f"MACMDEB{month:02d}")) + _number(movement.get("DEBITO"))
            row[f"MACMCRE{month:02d}"] = _number(row.get(f"MACMCRE{month:02d}")) + _number(movement.get("CREDITO"))


def _assemble_report(
    company: int,
    company_row: dict[str, Any],
    year: int,
    month_from: int,
    month_to: int,
    level: int,
    include_zero: bool,
    source_rows: list[dict[str, Any]],
    *,
    include_results: bool = True,
    third_rows: list[dict[str, Any]] | None = None,
    center_rows: list[dict[str, Any]] | None = None,
    detail_from: str = "",
    detail_to: str = "",
) -> dict[str, Any]:
    """Emula los dos recorridos de INFOR21A/INFOR21B sin sumar niveles hijos.

    Los totales de clase provienen exclusivamente de la cuenta raíz. Si no se
    muestra el estado de resultados, INFOR21A calcula 4–6 en segundo plano;
    con él visible acumula 4–9. El resultado se agrega solo a la clase 3.
    """
    source = {_text(row.get("CODIGO")).strip(): row for row in source_rows}
    result_classes = "456789" if include_results else "456"
    result_raw = [0.0, 0.0, 0.0, 0.0]
    for digit in result_classes:
        if digit in source:
            values = _account_values(source[digit], month_from, month_to)
            result_raw = [round(a + b, 2) for a, b in zip(result_raw, values)]

    def present(code: str, name: str, values: tuple[float, float, float, float],
                kind: str, section: str, nit: str = "") -> dict[str, Any]:
        sign = -1 if code and code[0] in "234" else 1
        opening, debit, credit, closing = values
        return {
            "tipo": kind, "seccion": section, "cuenta": code, "nit": nit,
            "nombre": name, "nivel": len(code),
            "saldoAnterior": round(opening * sign, 2), "debito": round(debit, 2),
            "credito": round(credit, 2), "saldoActual": round(closing * sign, 2),
        }

    details_by_code: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for kind, rows in (("tercero", third_rows or []), ("centro", center_rows or [])):
        key = "NIT" if kind == "tercero" else "CENTRO"
        for row in rows:
            code = _text(row.get("CODIGO")).strip()
            details_by_code.setdefault(code, []).append((kind, row))

    items: list[dict[str, Any]] = []
    raw_classes: dict[str, tuple[float, float, float, float]] = {}
    sections = [
        ("resultados", "ESTADO DE RESULTADOS ACUMULADO", "456789"),
        ("balance", "BALANCE DE COMPROBACIÓN ACUMULADO", "123"),
    ] if include_results else [("balance", "BALANCE DE COMPROBACIÓN ACUMULADO", "123")]
    for section, heading, digits in sections:
        items.append(present("", heading, (0, 0, 0, 0), "seccion", section))
        for digit in digits:
            root = source.get(digit)
            if root is None:
                continue
            root_values = _account_values(root, month_from, month_to)
            if digit == "3":
                root_values = tuple(round(a + b, 2) for a, b in zip(root_values, result_raw))
            raw_classes[digit] = root_values
            for row in source_rows:
                code = _text(row.get("CODIGO")).strip()
                if not code.startswith(digit) or len(code) > level:
                    continue
                values = root_values if code == "3" else _account_values(row, month_from, month_to)
                # El original comprueba apertura y movimientos, no el cierre.
                if not include_zero and all(value == 0 for value in values[:3]):
                    continue
                items.append(present(code, _text(row.get("MNOMBRE")).strip(), values, "cuenta", section))
                for kind, detail in details_by_code.get(code, []):
                    detail_values = _account_values(detail, month_from, month_to)
                    if not include_zero and all(value == 0 for value in detail_values[:3]):
                        continue
                    label = _text(detail.get("MNOMBRE")).strip() if kind == "tercero" else "Centro de costo"
                    identifier = _text(detail.get("NIT" if kind == "tercero" else "CENTRO")).strip()
                    items.append(present(code, label, detail_values, kind, section, identifier))
            if digit == "3":
                items.append(present("3", "RESULTADO DEL EJERCICIO", tuple(result_raw), "resultado", section))
            items.append(present(digit, _text(root.get("MNOMBRE")).strip(), root_values,
                                 "total-clase", section))
        if section == "resultados":
            items.append(present("4", "INGRESOS - EGRESOS", tuple(result_raw), "total-estado", section))

    liability_equity = tuple(round(a + b, 2) for a, b in zip(raw_classes.get("2", (0, 0, 0, 0)), raw_classes.get("3", (0, 0, 0, 0))))
    items.append(present("2", "PASIVO Y PATRIMONIO", liability_equity, "total-balance", "balance"))
    asset = raw_classes.get("1", (0, 0, 0, 0))
    difference = round(asset[3] + liability_equity[3], 2)
    return {
        "compania": {
            "codigo": f"{company:03d}",
            "nombre": _text(company_row.get("EMPNOM")).strip(),
            "nit": _text(company_row.get("EMPNIT")).strip(),
        },
        "anio": year,
        "mesDesde": month_from,
        "mesHasta": month_to,
        "periodo": f"{PERIOD_NAMES[month_from - 1]} a {PERIOD_NAMES[month_to - 1]} de {year}",
        "nivel": level,
        "nombreNivel": LEVELS[level],
        "incluirCeros": include_zero,
        "incluirResultados": include_results,
        "incluirTerceros": third_rows is not None,
        "incluirCentros": center_rows is not None,
        "detalleCuentaDesde": detail_from,
        "detalleCuentaHasta": detail_to,
        "items": items,
        "count": len(items),
        "totales": {
            "saldoAnterior": round(asset[0], 2),
            "debito": round(asset[1], 2),
            "credito": round(asset[2], 2),
            "diferencia": difference,
            "saldoActual": round(asset[3], 2),
            "pasivoPatrimonio": round(-liability_equity[3], 2),
            "resultadoEjercicio": round(-result_raw[3], 2),
        },
        "source": "CONMAE",
    }


def _format_money(value: float) -> str:
    result = f"{abs(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"({result})" if value < 0 else result


def export_trial_balance_xlsx(report: dict[str, Any]) -> bytes:
    """Construye un libro Excel legible, filtrable y con valores numéricos."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Balance acumulado"
    navy = "174E5A"
    light = "E8F1F2"
    thin_gray = Side(style="thin", color="D1D5DB")

    sheet.merge_cells("A1:G1")
    sheet["A1"] = "BALANCE DE COMPROBACIÓN ACUMULADO"
    sheet["A1"].font = Font(name="Arial", size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor=navy)
    sheet["A1"].alignment = Alignment(horizontal="center")
    sheet["A2"] = report["compania"]["nombre"]
    sheet["A3"] = f"NIT {report['compania']['nit']}"
    sheet["A4"] = f"Período: {report['periodo']}"
    sheet["A5"] = f"Nivel máximo: {report['nombreNivel']}"
    sheet.merge_cells("A2:G2")
    sheet.merge_cells("A3:G3")
    sheet.merge_cells("A4:G4")
    sheet.merge_cells("A5:G5")
    for row in range(2, 6):
        sheet.cell(row, 1).alignment = Alignment(horizontal="center")
        sheet.cell(row, 1).font = Font(name="Arial", size=10, bold=row == 2)

    headers = ["Código", "NIT / Centro", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"]
    for column, label in enumerate(headers, 1):
        cell = sheet.cell(7, column, label)
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=navy)
        cell.alignment = Alignment(horizontal="right" if column >= 4 else "left")

    first_data_row = 8
    for row_number, item in enumerate(report["items"], first_data_row):
        kind = item.get("tipo", "cuenta")
        values = [item["cuenta"], item.get("nit", ""), item["nombre"],
                  item["saldoAnterior"], item["debito"], item["credito"], item["saldoActual"]]
        if kind == "seccion":
            sheet.merge_cells(start_row=row_number, start_column=1, end_row=row_number, end_column=7)
            sheet.cell(row_number, 1, item["nombre"])
            for column in range(1, 8):
                cell = sheet.cell(row_number, column)
                cell.fill = PatternFill("solid", fgColor=navy)
                cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
            continue
        for column, value in enumerate(values, 1):
            cell = sheet.cell(row_number, column, value)
            bold = kind in {"resultado", "total-clase", "total-estado", "total-balance"} or item["nivel"] <= 2
            cell.font = Font(name="Arial", size=9, bold=bold)
            cell.fill = PatternFill("solid", fgColor=light) if kind != "cuenta" or item["nivel"] == 1 else PatternFill()
            cell.border = Border(bottom=thin_gray)
            if column >= 4:
                cell.number_format = '#,##0.00;[Red](#,##0.00);-'

    last_row = first_data_row + len(report["items"]) - 1
    widths = [16, 18, 42, 19, 19, 19, 19]
    for column, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.freeze_panes = "A8"
    sheet.auto_filter.ref = f"A7:G{max(7, last_row)}"
    sheet.sheet_view.showGridLines = False
    sheet.print_title_rows = "1:7"
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.fitToWidth = 1
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.oddFooter.center.text = "Página &P de &N"
    sheet.oddFooter.right.text = datetime.now().strftime("Generado %d/%m/%Y %H:%M")

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def export_trial_balance_pdf(report: dict[str, Any]) -> bytes:
    """Genera un PDF paginado en orientación horizontal."""
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=landscape(letter),
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="Balance de comprobación acumulado",
        author="CONTABDSI 27",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=13, leading=16, alignment=TA_CENTER, textColor=colors.HexColor("#174E5A"),
    )
    meta_style = ParagraphStyle(
        "ReportMeta", parent=styles["Normal"], fontName="Helvetica",
        fontSize=8, leading=10, alignment=TA_CENTER, textColor=colors.HexColor("#4B5563"),
    )
    number_style = ParagraphStyle(
        "Number", parent=styles["Normal"], fontName="Helvetica",
        fontSize=7, leading=8, alignment=TA_RIGHT,
    )
    text_style = ParagraphStyle(
        "Text", parent=styles["Normal"], fontName="Helvetica", fontSize=7, leading=8,
    )
    story = [
        Paragraph("BALANCE DE COMPROBACIÓN ACUMULADO", title_style),
        Paragraph(report["compania"]["nombre"], meta_style),
        Paragraph(
            f"NIT {report['compania']['nit']} - {report['periodo']} - "
            f"Nivel máximo: {report['nombreNivel']}",
            meta_style,
        ),
        Spacer(1, 4 * mm),
    ]
    table_data: list[list[Any]] = [[
        "Código", "NIT / Centro", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"
    ]]
    special_rows: list[tuple[int, str]] = []
    for item in report["items"]:
        kind = item.get("tipo", "cuenta")
        if kind == "seccion":
            special_rows.append((len(table_data), kind))
            table_data.append([item["nombre"], "", "", "", "", "", ""])
            continue
        if kind in {"resultado", "total-clase", "total-estado", "total-balance"}:
            special_rows.append((len(table_data), kind))
        table_data.append([
            Paragraph(item["cuenta"], text_style),
            Paragraph(item.get("nit", ""), text_style),
            Paragraph(item["nombre"], text_style),
            Paragraph(_format_money(item["saldoAnterior"]), number_style),
            Paragraph(_format_money(item["debito"]), number_style),
            Paragraph(_format_money(item["credito"]), number_style),
            Paragraph(_format_money(item["saldoActual"]), number_style),
        ])
    table = LongTable(
        table_data,
        repeatRows=1,
        colWidths=[23 * mm, 27 * mm, 65 * mm, 31 * mm, 31 * mm, 31 * mm, 31 * mm],
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#174E5A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ] + [style for row, kind in special_rows for style in (
        [("BACKGROUND", (0, row), (-1, row), colors.HexColor("#174E5A")),
         ("TEXTCOLOR", (0, row), (-1, row), colors.white),
         ("SPAN", (0, row), (-1, row))] if kind == "seccion" else
        [("BACKGROUND", (0, row), (-1, row), colors.HexColor("#E8F1F2")),
         ("FONTNAME", (0, row), (-1, row), "Helvetica-Bold")]
    )]))
    story.append(table)

    def footer(canvas: Any, doc: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#6B7280"))
        canvas.drawString(12 * mm, 7 * mm, report["compania"]["nombre"])
        canvas.drawRightString(landscape(letter)[0] - 12 * mm, 7 * mm, f"Página {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()

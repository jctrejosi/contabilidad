"""Balance de comprobación acumulado basado en CONMAE.

La implementación reproduce las reglas centrales de ``INFOR02(1)``,
``MOVMENSU`` y ``CONSALDO`` del proyecto Harbour:

* ``MSALDO`` es el saldo inicial del ejercicio.
* Los campos ``MACMDEBxx`` guardan débitos positivos.
* Los campos ``MACMCRExx`` guardan créditos negativos.
* El saldo anterior incluye los meses previos al rango solicitado.
* El saldo actual suma saldo anterior, débitos y créditos del rango.

El informe lee solamente las filas maestras de CONMAE. Esto evita duplicar
los acumulados auxiliares por NIT que también existen en esa tabla.
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


def _validate_parameters(year: int, month_from: int, month_to: int, level: int) -> None:
    if not 1900 <= year <= 2100:
        raise ValueError("El año del informe no es válido.")
    if not 1 <= month_from <= 12 or not 1 <= month_to <= 12:
        raise ValueError("Los meses deben estar entre enero y diciembre.")
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
    level: int = 6,
    include_zero: bool = False,
) -> dict[str, Any]:
    """Consulta CONMAE y entrega el balance acumulado de una compañía."""
    company = normalize_company_code(company_code)
    _validate_parameters(year, month_from, month_to, level)
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

    return _assemble_report(
        company, companies[0], year, month_from, month_to, level, include_zero, source_rows,
    )


def _assemble_report(
    company: int,
    company_row: dict[str, Any],
    year: int,
    month_from: int,
    month_to: int,
    level: int,
    include_zero: bool,
    source_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """Arma el JSON del balance a partir de las filas de acumulados.

    **Es el punto compartido por los dos motores.** Tanto Advantage (que lee
    ``CONMAE``) como PostgreSQL (que lee ``saldos_cuenta``, el mismo origen
    volcado al modelo nuevo) entregan filas con los nombres físicos del legado
    ``MSALDO``/``MACMDEBxx``/``MACMCREyy``; aquí se aplican las reglas del
    informe Harbour una sola vez, de modo que el contrato no pueda divergir.
    """
    items: list[dict[str, Any]] = []
    class_totals: list[tuple[float, float, float, float]] = []
    for row in source_rows:
        code = _text(row.get("CODIGO")).strip()
        if not code or len(code) > level:
            continue
        opening, debit, credit, closing = _account_values(row, month_from, month_to)
        if len(code) == 1:
            class_totals.append((opening, debit, credit, closing))
        if not include_zero and opening == debit == credit == closing == 0:
            continue

        # Harbour muestra con naturaleza positiva pasivos, patrimonio e
        # ingresos (clases 2, 3 y 4). Los demás conservan su signo contable.
        presentation_sign = -1 if code[0] in {"2", "3", "4"} else 1
        items.append(
            {
                "cuenta": code,
                "nombre": _text(row.get("MNOMBRE")).strip(),
                "nivel": len(code),
                "saldoAnterior": round(opening * presentation_sign, 2),
                "debito": debit,
                "credito": credit,
                "saldoActual": round(closing * presentation_sign, 2),
            }
        )

    total_opening = round(sum(values[0] for values in class_totals), 2)
    total_debit = round(sum(values[1] for values in class_totals), 2)
    total_credit = round(sum(values[2] for values in class_totals), 2)
    total_balance = round(sum(values[3] for values in class_totals), 2)
    return {
        "compania": {
            "codigo": f"{company:03d}",
            "nombre": _text(company_row.get("EMPNOM")).strip(),
            "nit": _text(company_row.get("EMPNIT")).strip(),
        },
        "anio": year,
        "mesDesde": month_from,
        "mesHasta": month_to,
        "periodo": f"{MONTH_NAMES[month_from - 1]} a {MONTH_NAMES[month_to - 1]} de {year}",
        "nivel": level,
        "nombreNivel": LEVELS[level],
        "incluirCeros": include_zero,
        "items": items,
        "count": len(items),
        "totales": {
            "saldoAnterior": total_opening,
            "debito": total_debit,
            "credito": total_credit,
            "diferencia": round(total_debit - total_credit, 2),
            "saldoActual": total_balance,
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

    sheet.merge_cells("A1:F1")
    sheet["A1"] = "BALANCE DE COMPROBACIÓN ACUMULADO"
    sheet["A1"].font = Font(name="Arial", size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor=navy)
    sheet["A1"].alignment = Alignment(horizontal="center")
    sheet["A2"] = report["compania"]["nombre"]
    sheet["A3"] = f"NIT {report['compania']['nit']}"
    sheet["A4"] = f"Período: {report['periodo']}"
    sheet["A5"] = f"Nivel máximo: {report['nombreNivel']}"
    sheet.merge_cells("A2:F2")
    sheet.merge_cells("A3:F3")
    sheet.merge_cells("A4:F4")
    sheet.merge_cells("A5:F5")
    for row in range(2, 6):
        sheet.cell(row, 1).alignment = Alignment(horizontal="center")
        sheet.cell(row, 1).font = Font(name="Arial", size=10, bold=row == 2)

    headers = ["Código", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"]
    for column, label in enumerate(headers, 1):
        cell = sheet.cell(7, column, label)
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=navy)
        cell.alignment = Alignment(horizontal="right" if column >= 3 else "left")

    first_data_row = 8
    for row_number, item in enumerate(report["items"], first_data_row):
        values = [
            item["cuenta"], item["nombre"], item["saldoAnterior"],
            item["debito"], item["credito"], item["saldoActual"],
        ]
        for column, value in enumerate(values, 1):
            cell = sheet.cell(row_number, column, value)
            cell.font = Font(name="Arial", size=9, bold=item["nivel"] <= 2)
            cell.fill = PatternFill("solid", fgColor=light) if item["nivel"] == 1 else PatternFill()
            cell.border = Border(bottom=thin_gray)
            if column >= 3:
                cell.number_format = '#,##0.00;[Red](#,##0.00);-'

    total_row = first_data_row + len(report["items"])
    sheet.cell(total_row, 2, "TOTALES DE CONTROL")
    sheet.cell(total_row, 3, report["totales"]["saldoAnterior"])
    sheet.cell(total_row, 4, report["totales"]["debito"])
    sheet.cell(total_row, 5, report["totales"]["credito"])
    sheet.cell(total_row, 6, report["totales"]["saldoActual"])
    for column in range(1, 7):
        cell = sheet.cell(total_row, column)
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=navy)
        if column >= 3:
            cell.number_format = '#,##0.00;[Red](#,##0.00);-'

    widths = [16, 42, 19, 19, 19, 19]
    for column, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.freeze_panes = "A8"
    sheet.auto_filter.ref = f"A7:F{max(7, total_row - 1)}"
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
        "Código", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"
    ]]
    for item in report["items"]:
        table_data.append([
            Paragraph(item["cuenta"], text_style),
            Paragraph(item["nombre"], text_style),
            Paragraph(_format_money(item["saldoAnterior"]), number_style),
            Paragraph(_format_money(item["debito"]), number_style),
            Paragraph(_format_money(item["credito"]), number_style),
            Paragraph(_format_money(item["saldoActual"]), number_style),
        ])
    table_data.append([
        "", "TOTALES DE CONTROL",
        _format_money(report["totales"]["saldoAnterior"]),
        _format_money(report["totales"]["debito"]),
        _format_money(report["totales"]["credito"]),
        _format_money(report["totales"]["saldoActual"]),
    ])
    table = LongTable(
        table_data,
        repeatRows=1,
        colWidths=[25 * mm, 72 * mm, 34 * mm, 34 * mm, 34 * mm, 34 * mm],
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#174E5A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -2), 0.25, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F8FAFC")]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#174E5A")),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 7.5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)

    def footer(canvas: Any, doc: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#6B7280"))
        canvas.drawString(12 * mm, 7 * mm, "Fuente: CONMAE - Advantage Data Server")
        canvas.drawRightString(landscape(letter)[0] - 12 * mm, 7 * mm, f"Página {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()

"""INFOR02(2): balance de comprobación mensual del programa Harbour.

La fuente maestra es CONMAE; CONTERCE y COCENTRO aportan los detalles
opcionales. Para meses 13-18, build_trial_balance reconstruye movimientos
desde MOV01. A diferencia del acumulado, las cuentas normales imprimen
el movimiento neto del rango y no su saldo de cierre histórico.
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, TableStyle

from .balance_comprobacion_repository import build_trial_balance

MONTHS = (
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
) + ("ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO")


def build_monthly_balance(
    company: str, year: int, month_from: int, month_to: int, *,
    level: int = 4, include_zero: bool = False, include_results: bool = True,
    include_thirds: bool = False, include_centers: bool = False,
    detail_from: str = "", detail_to: str = "",
) -> dict[str, Any]:
    """Reproduce los recorridos y el filtro de ceros de INFOR21A/B con cT=2.

    Se carga también la apertura para obtener el resultado del ejercicio que
    Harbour lleva al patrimonio. En filas ordinarias se ignora la apertura:
    para el mensual, SALDO ACTUAL significa neto del rango. El registro raíz
    3 y los renglones de resultado son excepciones del código original.
    """
    report = build_trial_balance(
        company, year, month_from, month_to, level=level, include_zero=True,
        include_results=include_results, include_thirds=include_thirds,
        include_centers=include_centers, detail_from=detail_from, detail_to=detail_to,
    )
    items = []
    for original in report["items"]:
        row = dict(original)
        kind = row["tipo"]
        if kind in {"cuenta", "tercero", "centro"}:
            # INFOR21A pone WSALDO=0 antes de evaluar WCEROS en cT=2.
            if not include_zero and row["debito"] == 0 and row["credito"] == 0:
                continue
            if not (kind == "cuenta" and row["cuenta"] == "3"):
                sign = -1 if row["cuenta"][:1] in "234" else 1
                row["saldoActual"] = round((row["debito"] - row["credito"]) * sign, 2)
        elif kind in {"total-clase", "total-balance"}:
            sign = -1 if row["cuenta"][:1] in "234" else 1
            row["saldoActual"] = round((row["debito"] - row["credito"]) * sign, 2)
        if kind == "seccion":
            row["nombre"] = (
                "ESTADO DE RESULTADOS MENSUAL" if row["seccion"] == "resultados"
                else "BALANCE DE COMPROBACIÓN MENSUAL"
            )
        row["saldoAnterior"] = 0.0  # La impresión mensual no tiene esta columna.
        items.append(row)
    report["items"] = items
    report["count"] = len(items)
    report["tipoInforme"] = "mensual"
    report["periodo"] = f"{MONTHS[month_from - 1]}-{MONTHS[month_to - 1]} {year}"
    asset = next((item for item in items if item["tipo"] == "total-clase" and item["cuenta"] == "1"), None)
    liability = next((item for item in items if item["tipo"] == "total-balance"), None)
    asset_value = asset["saldoActual"] if asset else 0.0
    liability_value = liability["saldoActual"] if liability else 0.0
    report["totales"] = {
        **report["totales"], "saldoAnterior": 0.0, "saldoActual": asset_value,
        "pasivoPatrimonio": liability_value,
        "diferencia": round(asset_value - liability_value, 2),
    }
    return report


def _money(value: float) -> str:
    # La máscara de PPP/TRANSFORM del Harbour original usa coma para miles y
    # punto para decimales, independientemente de la configuración del navegador.
    text = f"{abs(value):,.2f}"
    return f"({text})" if value < 0 else text


def export_monthly_balance_pdf(report: dict[str, Any]) -> bytes:
    """Presenta INFOR21A(cT=2) con el diseño del balance acumulado.

    Solo cambia la presentación: conserva las seis columnas mensuales, el
    orden de las filas y los cortes de página entre resultados, activo y
    pasivo/patrimonio que hace el informe original.
    """
    output = BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=landscape(letter), rightMargin=12 * mm,
        leftMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm,
        title="Balance de comprobación mensual", author="CONTABDSI 27",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "MonthlyTitle", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=13, leading=16, alignment=TA_CENTER,
        textColor=colors.HexColor("#174E5A"),
    )
    meta_style = ParagraphStyle(
        "MonthlyMeta", parent=styles["Normal"], fontName="Helvetica",
        fontSize=8, leading=10, alignment=TA_CENTER,
        textColor=colors.HexColor("#4B5563"),
    )
    text_style = ParagraphStyle(
        "MonthlyText", parent=styles["Normal"], fontName="Helvetica",
        fontSize=7, leading=8,
    )
    number_style = ParagraphStyle(
        "MonthlyNumber", parent=text_style, alignment=TA_RIGHT,
    )

    # Tres bloques lógicos del original. LongTable repite los títulos de
    # columna cuando un bloque necesita más páginas.
    results: list[dict[str, Any]] = []
    assets: list[dict[str, Any]] = []
    remainder: list[dict[str, Any]] = []
    active_done = False
    for item in report["items"]:
        if item["tipo"] == "seccion":
            continue
        if item["seccion"] == "resultados":
            results.append(item)
        elif not active_done:
            assets.append(item)
            if item["tipo"] == "total-clase" and item["cuenta"] == "1":
                active_done = True
        else:
            remainder.append(item)

    story: list[Any] = []
    blocks = [("resultados", results), ("balance", assets), ("balance", remainder)]
    for section, items in blocks:
        if not items:
            continue
        if story:
            story.append(PageBreak())
        heading = ("ESTADO DE RESULTADOS MENSUAL" if section == "resultados"
                   else "BALANCE DE COMPROBACION MENSUAL")
        story.extend([
            Paragraph(escape(f"{heading} A {report['periodo']}"), title_style),
            Paragraph(escape(report["compania"]["nombre"]), meta_style),
            Paragraph(escape(f"NIT {report['compania']['nit']} · Nivel máximo: {report['nombreNivel']}"), meta_style),
            Spacer(1, 4 * mm),
        ])
        rows: list[list[Any]] = [["Código", "NIT / Centro", "Cuenta", "Débitos", "Créditos", "Saldo Actual"]]
        highlighted: list[int] = []
        for item in items:
            row_index = len(rows)
            if item["tipo"] in {"resultado", "total-clase", "total-estado", "total-balance"}:
                highlighted.append(row_index)
            rows.append([
                Paragraph(escape(item["cuenta"]), text_style),
                Paragraph(escape(item.get("nit", "")), text_style),
                Paragraph(escape(item["nombre"]), text_style),
                Paragraph(_money(item["debito"]), number_style),
                Paragraph(_money(item["credito"]), number_style),
                Paragraph(_money(item["saldoActual"]), number_style),
            ])
        table = LongTable(
            rows, repeatRows=1,
            colWidths=[24 * mm, 29 * mm, 83 * mm, 33 * mm, 33 * mm, 33 * mm],
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
        ] + [style for row in highlighted for style in (
            ("BACKGROUND", (0, row), (-1, row), colors.HexColor("#E8F1F2")),
            ("FONTNAME", (0, row), (-1, row), "Helvetica-Bold"),
        )]))
        story.append(table)

    def footer(page: Any, doc: Any) -> None:
        page.saveState()
        page.setFont("Helvetica", 7)
        page.setFillColor(colors.HexColor("#6B7280"))
        page.drawString(12 * mm, 7 * mm, report["compania"]["nombre"])
        page.drawRightString(landscape(letter)[0] - 12 * mm, 7 * mm, f"Página {doc.page}")
        page.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def export_monthly_balance_xlsx(report: dict[str, Any]) -> bytes:
    """Aplica el diseño del acumulado sin alterar las columnas del mensual."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Balance mensual"
    navy = "174E5A"
    light = "E8F1F2"
    thin_gray = Side(style="thin", color="D1D5DB")
    company = report["compania"]
    sheet.merge_cells("A1:G1")
    sheet["A1"] = "BALANCE DE COMPROBACIÓN MENSUAL"
    sheet["A1"].font = Font(name="Arial", size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor=navy)
    sheet["A1"].alignment = Alignment(horizontal="center")
    for row, value in ((2, company["nombre"]), (3, f"NIT {company['nit']}"),
                       (4, f"Período: {report['periodo']} · Nivel máximo: {report['nombreNivel']}")):
        sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=7)
        cell = sheet.cell(row, 1, value)
        cell.font = Font(name="Arial", size=10, bold=row == 2)
        cell.alignment = Alignment(horizontal="center")
    headers = ["Código", "NIT", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"]
    for column, label in enumerate(headers, 1):
        cell = sheet.cell(5, column, label)
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=navy)
        cell.alignment = Alignment(horizontal="right" if column >= 4 else "left")
    for item in report["items"]:
        if item["tipo"] == "seccion":
            row_no = sheet.max_row + 1
            sheet.merge_cells(start_row=row_no, start_column=1, end_row=row_no, end_column=7)
            sheet.cell(row_no, 1, f"{item['nombre']} A {report['periodo']}")
            for cell in sheet[row_no]:
                cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
                cell.fill = PatternFill("solid", fgColor=navy)
            continue
        sheet.append([item["cuenta"], item.get("nit", ""), item["nombre"], None,
                      item["debito"], item["credito"], item["saldoActual"]])
        row_no = sheet.max_row
        highlighted = item["tipo"] in {"resultado", "total-clase", "total-estado", "total-balance"}
        for cell in sheet[row_no]:
            cell.font = Font(name="Arial", size=9, bold=highlighted or item["nivel"] <= 2)
            cell.fill = PatternFill("solid", fgColor=light) if highlighted or item["nivel"] == 1 else PatternFill()
            cell.border = Border(bottom=thin_gray)
        for col in (5, 6, 7):
            sheet.cell(row_no, col).number_format = '#,##0.00;[Red](#,##0.00);-'
    for column, width in enumerate((16, 18, 42, 19, 19, 19, 19), 1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.freeze_panes = "A6"
    sheet.print_title_rows = "1:5"
    sheet.auto_filter.ref = f"A5:G{max(5, sheet.max_row)}"
    sheet.sheet_view.showGridLines = False
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.fitToWidth = 1
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.oddFooter.center.text = "Página &P de &N"
    sheet.oddFooter.right.text = datetime.now().strftime("Generado %d/%m/%Y %H:%M")
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()

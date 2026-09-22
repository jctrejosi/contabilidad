"""Balance acumulado de ``INFOR02(1)`` / ``INFOR21A`` / ``INFOR21B``.

``CONSALDO`` calcula apertura al primer mes y ``MOVMENSU`` suma movimientos
del rango. El legado imprime dos secciones: resultados (clases 4–9) y balance
(clases 1–3). Tras calcular resultados incorpora el ejercicio al patrimonio.
Los auxiliares por tercero viven hoy en CONTERCE, no en CONMAE como antes.
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
import re
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
EXTRA_MONTH_NAMES = ("Enero (13)", "Febrero (14)", "Marzo (15)", "Abril (16)", "Mayo (17)", "Junio (18)")


def _month_label(month: int) -> str:
    return MONTH_NAMES[month - 1] if month <= 12 else EXTRA_MONTH_NAMES[month - 13]


def _validate_parameters(year: int, month_from: int, month_to: int, level: int) -> None:
    if not 1900 <= year <= 2100:
        raise ValueError("El año del informe no es válido.")
    if not 1 <= month_from <= 18 or not 1 <= month_to <= 18:
        raise ValueError("Los meses deben estar entre 01 y 18.")
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


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _add_extra_months(
    connection: Any, company: int, year: int, source_rows: list[dict[str, Any]],
    month_to: int,
) -> None:
    """Reconstruye meses 13–18 desde MOV01, ausentes en el CONMAE nuevo.

    El movimiento está a nivel de cuenta afectable. Se propaga a los padres
    existentes tal como el reproceso alimentaba los acumulados del legado.
    """
    if month_to <= 12:
        return
    indexed = {_text(row.get("CODIGO")).strip(): row for row in source_rows}
    movement = _read(connection,
        "SELECT CODIGO, CONMES, "
        "SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
        "SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END) AS CREDITO "
        f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} "
        f"AND CONMES >= 13 AND CONMES <= {month_to} GROUP BY CODIGO, CONMES")
    for entry in movement:
        code = _text(entry.get("CODIGO")).strip()
        month = int(_number(entry.get("CONMES")))
        for length in VALID_ACCOUNT_LENGTHS:
            if length > len(code):
                break
            parent = indexed.get(code[:length])
            if parent is None:
                continue
            for field, amount in ((f"MACMDEB{month:02d}", _number(entry.get("DEBITO"))),
                                  (f"MACMCRE{month:02d}", _number(entry.get("CREDITO")))):
                parent[field] = _number(parent.get(field)) + amount


VALID_ACCOUNT_LENGTHS = (1, 2, 4, 6, 9, 12)
MAX_DETAIL_ROWS = 10000


def _detail_condition(first: str, last: str) -> str:
    if any(not re.fullmatch(r"[0-9]{0,12}", value) for value in (first, last)):
        raise ValueError("El rango de cuentas del detalle no es válido.")
    if first and last and first > last:
        raise ValueError("El rango de cuentas del detalle está invertido.")
    if first and not last:
        return f" AND CODIGO LIKE '{first}%'"
    return (f" AND CODIGO >= '{first}'" if first else "") + (f" AND CODIGO <= '{last}'" if last else "")


def _load_detail_rows(
    connection: Any, company: int, level: int, *, third: bool, center: bool,
    first: str, last: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not third and not center:
        return [], []
    account_scope = _detail_condition(first, last)
    where = f"CIA = {company} AND LENGTH(TRIM(CODIGO)) <= {level}{account_scope}"
    months = range(1, 13)
    third_rows: list[dict[str, Any]] = []
    center_rows: list[dict[str, Any]] = []
    if third:
        fields = ", ".join(field for month in months for field in
                           (f"MACMDEB{month:02d}", f"MACMCRE{month:02d}"))
        third_rows = _read(connection,
            f"SELECT TOP {MAX_DETAIL_ROWS + 1} CODIGO, NIT, MNOMBRE, MSALDO, {fields} "
            f"FROM CONTERCE WHERE {where} ORDER BY CODIGO, NIT")
        if len(third_rows) > MAX_DETAIL_ROWS:
            raise ValueError("Hay más de 10.000 auxiliares de terceros. Acote el rango de cuentas del detalle.")
    if center:
        fields = ", ".join(
            f"SUM(COALESCE(DEB{month:02d},0)) AS MACMDEB{month:02d}, "
            f"SUM(COALESCE(CRE{month:02d},0)) AS MACMCRE{month:02d}"
            for month in months
        )
        center_rows = _read(connection,
            f"SELECT TOP {MAX_DETAIL_ROWS + 1} CODIGO, CENTRO, "
            f"SUM(COALESCE(DEB00,0)+COALESCE(CRE00,0)) AS MSALDO, {fields} "
            f"FROM COCENTRO WHERE {where} GROUP BY CODIGO, CENTRO ORDER BY CODIGO, CENTRO")
        if len(center_rows) > MAX_DETAIL_ROWS:
            raise ValueError("Hay más de 10.000 auxiliares por centro. Acote el rango de cuentas del detalle.")
    return third_rows, center_rows


def _add_extra_detail_months(
    connection: Any, company: int, year: int, month_to: int,
    third_rows: list[dict[str, Any]], center_rows: list[dict[str, Any]],
    *, third: bool, center: bool, first: str, last: str, level: int,
) -> None:
    """Completa auxiliares 13–18 a partir del movimiento único MOV01."""
    if month_to <= 12 or not (third or center):
        return
    account_scope = _detail_condition(first, last)
    movement = _read(connection,
        "SELECT CODIGO, NIT, TFASE, CONMES, "
        "SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
        "SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END) AS CREDITO "
        f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} "
        f"AND CONMES >= 13 AND CONMES <= {month_to}{account_scope} "
        "GROUP BY CODIGO, NIT, TFASE, CONMES")
    thirds = {(_text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip()): row
              for row in third_rows}
    centers = {(_text(row.get("CODIGO")).strip(), _text(row.get("CENTRO")).strip()): row
               for row in center_rows}
    for entry in movement:
        code = _text(entry.get("CODIGO")).strip()
        month = int(_number(entry.get("CONMES")))
        nit = _text(entry.get("NIT")).strip()
        center_code = _text(entry.get("TFASE")).strip()
        for length in VALID_ACCOUNT_LENGTHS:
            if length > min(len(code), level):
                break
            parent = code[:length]
            if first and not last and not parent.startswith(first):
                continue
            if first and last and not first <= parent <= last:
                continue
            if not first and last and parent > last:
                continue
            if third and nit:
                key = (parent, nit)
                if key not in thirds:
                    if len(third_rows) >= MAX_DETAIL_ROWS:
                        raise ValueError("Hay más de 10.000 auxiliares de terceros. Acote el rango de cuentas del detalle.")
                    row = {"CODIGO": parent, "NIT": nit, "MNOMBRE": nit, "MSALDO": 0}
                    third_rows.append(row)
                    thirds[key] = row
                row = thirds[key]
                row[f"MACMDEB{month:02d}"] = _number(row.get(f"MACMDEB{month:02d}")) + _number(entry.get("DEBITO"))
                row[f"MACMCRE{month:02d}"] = _number(row.get(f"MACMCRE{month:02d}")) + _number(entry.get("CREDITO"))
            if center and center_code:
                key = (parent, center_code)
                if key not in centers:
                    if len(center_rows) >= MAX_DETAIL_ROWS:
                        raise ValueError("Hay más de 10.000 auxiliares por centro. Acote el rango de cuentas del detalle.")
                    row = {"CODIGO": parent, "CENTRO": center_code, "MSALDO": 0}
                    center_rows.append(row)
                    centers[key] = row
                row = centers[key]
                row[f"MACMDEB{month:02d}"] = _number(row.get(f"MACMDEB{month:02d}")) + _number(entry.get("DEBITO"))
                row[f"MACMCRE{month:02d}"] = _number(row.get(f"MACMCRE{month:02d}")) + _number(entry.get("CREDITO"))


def build_trial_balance(
    company_code: str,
    year: int,
    month_from: int,
    month_to: int,
    *,
    level: int = 4,
    include_zero: bool = False,
    include_results: bool = True,
    include_third: bool = False,
    include_centers: bool = False,
    detail_from: str = "",
    detail_to: str = "",
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
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")

        controls = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        if not controls:
            raise ValueError("No existe configuración contable en CONCTR.")
        control_year = int(_number(controls[0].get("CTANO")))
        if year != control_year:
            raise ValueError(
                f"CONMAE contiene los acumulados del ejercicio {control_year}; "
                f"no es posible generar el año {year}."
            )

        source_rows = _read(connection,
            "SELECT CODIGO, MNOMBRE, MSALDO, " + month_fields + " "
            f"FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} ORDER BY CODIGO")
        _add_extra_months(connection, company, year, source_rows, month_to)
        third_rows, center_rows = _load_detail_rows(
            connection, company, level, third=include_third, center=include_centers,
            first=detail_from, last=detail_to,
        )
        _add_extra_detail_months(
            connection, company, year, month_to, third_rows, center_rows,
            third=include_third, center=include_centers, first=detail_from,
            last=detail_to, level=level,
        )

    report = _assemble_report(
        company, companies[0], year, month_from, month_to, level, include_zero,
        source_rows, include_results=include_results, third_rows=third_rows,
        center_rows=center_rows,
    )
    report["incluirTerceros"] = include_third
    report["incluirCentros"] = include_centers
    return report


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
) -> dict[str, Any]:
    """Replica el orden y los renglones de INFOR21A/B sin modificar acumulados.

    Las clases 4–9 alimentan el resultado cuando se imprime el estado. Con la
    casilla desactivada Harbour calcula 4–6 sin imprimir esa primera sección.
    El resultado se suma sólo al renglón raíz de patrimonio (3), nunca a sus
    subcuentas ni a los auxiliares por tercero.
    """
    masters = {
        _text(row.get("CODIGO")).strip(): row
        for row in source_rows
        if _text(row.get("CODIGO")).strip()
    }
    result_classes = "456789" if include_results else "456"
    result_values = [_account_values(masters[code], month_from, month_to)
                     for code in result_classes if code in masters]
    result_open = round(sum(values[0] for values in result_values), 2)
    result_debit = round(sum(values[1] for values in result_values), 2)
    result_credit = round(sum(values[2] for values in result_values), 2)
    result_close = round(result_open + result_debit - result_credit, 2)
    thirds_by_code: dict[str, list[dict[str, Any]]] = {}
    centers_by_code: dict[str, list[dict[str, Any]]] = {}
    for row in third_rows or []:
        thirds_by_code.setdefault(_text(row.get("CODIGO")).strip(), []).append(row)
    for row in center_rows or []:
        centers_by_code.setdefault(_text(row.get("CODIGO")).strip(), []).append(row)

    def line(
        code: str, name: str, values: tuple[float, float, float, float], *,
        kind: str = "cuenta", nit: str = "", section: str = "",
    ) -> dict[str, Any]:
        opening, debit, credit, closing = values
        sign = -1 if code[:1] in "234" else 1
        return {
            "tipo": kind, "seccion": section, "cuenta": code, "nit": nit,
            "nombre": name, "nivel": len(code),
            "saldoAnterior": round(opening * sign, 2),
            "debito": round(debit, 2), "credito": round(credit, 2),
            "saldoActual": round(closing * sign, 2),
        }

    def section_header(name: str, section: str) -> dict[str, Any]:
        return {
            "tipo": "seccion", "seccion": section, "cuenta": "", "nit": "",
            "nombre": name, "nivel": 0, "saldoAnterior": 0.0,
            "debito": 0.0, "credito": 0.0, "saldoActual": 0.0,
        }

    items: list[dict[str, Any]] = []
    class_values: dict[str, tuple[float, float, float, float]] = {}
    class_names: dict[str, str] = {}

    def add_section(codes: str, section: str, title: str) -> None:
        items.append(section_header(title, section))
        for class_code in codes:
            root = masters.get(class_code)
            if root is None:
                continue
            class_name = _text(root.get("MNOMBRE")).strip()
            class_names[class_code] = class_name
            root_values = _account_values(root, month_from, month_to)
            if class_code == "3":
                root_values = (
                    round(root_values[0] + result_open, 2),
                    round(root_values[1] + result_debit, 2),
                    round(root_values[2] + result_credit, 2),
                    round(root_values[3] + result_close, 2),
                )
            class_values[class_code] = root_values
            for code in sorted(masters):
                if not code.startswith(class_code) or len(code) > level:
                    continue
                row = masters[code]
                values = root_values if code == "3" else _account_values(row, month_from, month_to)
                # INFOR21A/B compara saldo anterior y ambos movimientos, no
                # sólo el saldo final, para excluir renglones en cero.
                account_visible = include_zero or any(values[:3])
                if account_visible:
                    items.append(line(code, _text(row.get("MNOMBRE")).strip(), values, section=section))
                for third_row in thirds_by_code.get(code, []):
                    detail_values = _account_values(third_row, month_from, month_to)
                    if include_zero or any(detail_values[:3]):
                        items.append(line(code, _text(third_row.get("MNOMBRE")).strip(),
                                          detail_values, kind="tercero",
                                          nit=_text(third_row.get("NIT")).strip(), section=section))
                for center_row in centers_by_code.get(code, []) if account_visible else []:
                    detail_values = _account_values(center_row, month_from, month_to)
                    if include_zero or any(detail_values[:3]):
                        center_code = _text(center_row.get("CENTRO")).strip()
                        items.append(line(code, f"Centro de costo {center_code}",
                                          detail_values, kind="centro", nit=center_code,
                                          section=section))
            if class_code == "3":
                items.append(line("3", "RESULTADO DEL EJERCICIO",
                                  (result_open, result_debit, result_credit, result_close),
                                  kind="resultado", section=section))
            items.append(line(class_code, class_name, root_values,
                              kind="total-clase", section=section))

    period = (f"{_month_label(month_from)} de {year}" if month_from == month_to else
              f"{_month_label(month_from)} a {_month_label(month_to)} de {year}")
    if include_results:
        add_section("456789", "resultados", f"ESTADO DE RESULTADOS ACUMULADO A {period}")
        items.append(line("4", "INGRESOS - EGRESOS",
                          (result_open, result_debit, result_credit, result_close),
                          kind="total-estado", section="resultados"))
    add_section("123", "balance", f"BALANCE DE COMPROBACIÓN ACUMULADO A {period}")
    liability = class_values.get("2", (0.0, 0.0, 0.0, 0.0))
    equity = class_values.get("3", (0.0, 0.0, 0.0, 0.0))
    liability_equity = tuple(round(liability[i] + equity[i], 2) for i in range(4))
    items.append(line("2", "PASIVO Y PATRIMONIO", liability_equity,
                      kind="total-balance", section="balance"))

    asset = class_values.get("1", (0.0, 0.0, 0.0, 0.0))
    difference = round(asset[3] + liability_equity[3], 2)
    return {
        "version": 2,
        "compania": {
            "codigo": f"{company:03d}",
            "nombre": _text(company_row.get("EMPNOM")).strip(),
            "nit": _text(company_row.get("EMPNIT")).strip(),
        },
        "anio": year, "mesDesde": month_from, "mesHasta": month_to,
        "periodo": period, "nivel": level, "nombreNivel": LEVELS[level],
        "incluirCeros": include_zero, "incluirResultados": include_results,
        "incluirTerceros": bool(third_rows is not None and third_rows),
        "incluirCentros": bool(center_rows is not None and center_rows),
        "items": items, "count": len(items),
        "totales": {
            "saldoAnterior": round(asset[0], 2), "debito": round(asset[1], 2),
            "credito": round(asset[2], 2), "saldoActual": round(asset[3], 2),
            "activo": round(asset[3], 2),
            "pasivoPatrimonio": round(-liability_equity[3], 2),
            "diferencia": difference,
            "resultadoEjercicio": round(-result_close, 2),
        },
        "source": "CONMAE",
    }
def _format_money(value: float) -> str:
    result = f"{abs(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"({result})" if value < 0 else result


def _export_v2_xlsx(report: dict[str, Any]) -> bytes:
    """Conserva las dos secciones y subtotales del impreso original."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Balance acumulado"
    headers = ("Código", "NIT / Centro", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual")
    sheet.merge_cells("A1:G1")
    sheet["A1"] = report["compania"]["nombre"]
    sheet["A1"].font = Font(name="Arial", size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor="174E5A")
    sheet["A2"] = f"NIT {report['compania']['nit']} · {report['periodo']} · Nivel: {report['nombreNivel']}"
    sheet.merge_cells("A2:G2")
    for column, label in enumerate(headers, 1):
        cell = sheet.cell(4, column, label)
        cell.font = Font(name="Arial", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="174E5A")
    for row_index, item in enumerate(report["items"], 5):
        kind = item.get("tipo")
        if kind == "seccion":
            sheet.merge_cells(start_row=row_index, start_column=1, end_row=row_index, end_column=7)
            cell = sheet.cell(row_index, 1, item["nombre"])
            cell.font = Font(name="Arial", bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="276C79")
            continue
        values = (item["cuenta"], item.get("nit", ""), item["nombre"],
                  item["saldoAnterior"], item["debito"], item["credito"], item["saldoActual"])
        emphasized = kind in ("resultado", "total-clase", "total-estado", "total-balance") or item["nivel"] == 1
        for column, value in enumerate(values, 1):
            cell = sheet.cell(row_index, column, value)
            cell.font = Font(name="Arial", size=9, bold=emphasized)
            if emphasized:
                cell.fill = PatternFill("solid", fgColor="E8F1F2")
            if column >= 4:
                cell.number_format = '#,##0.00;[Red](#,##0.00);-'
    for column, width in enumerate((15, 17, 43, 21, 21, 21, 21), 1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.freeze_panes = "D5"
    sheet.sheet_view.showGridLines = False
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.fitToWidth = 1
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.print_title_rows = "1:4"
    sheet.oddFooter.center.text = "Página &P de &N"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _export_v2_pdf(report: dict[str, Any]) -> bytes:
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(letter),
                                 leftMargin=10 * mm, rightMargin=10 * mm,
                                 topMargin=10 * mm, bottomMargin=10 * mm,
                                 title="Balance de comprobación acumulado")
    styles = getSampleStyleSheet()
    regular = ParagraphStyle("BalanceText", parent=styles["Normal"], fontSize=6.5, leading=8)
    right = ParagraphStyle("BalanceNumber", parent=regular, alignment=TA_RIGHT)
    meta = ParagraphStyle("BalanceMeta", parent=styles["Normal"], alignment=TA_CENTER,
                          fontSize=9, leading=12)
    story = [Paragraph(report["compania"]["nombre"], meta),
             Paragraph(f"NIT {report['compania']['nit']} · {report['periodo']} · Nivel: {report['nombreNivel']}", meta),
             Spacer(1, 3 * mm)]
    table_data: list[list[Any]] = [["Código", "NIT / Centro", "Cuenta", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"]]
    style_commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#174E5A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 6.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for item in report["items"]:
        row_index = len(table_data)
        kind = item.get("tipo")
        if kind == "seccion":
            table_data.append([item["nombre"], "", "", "", "", "", ""])
            style_commands.extend([
                ("SPAN", (0, row_index), (-1, row_index)),
                ("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#276C79")),
                ("TEXTCOLOR", (0, row_index), (-1, row_index), colors.white),
                ("FONTNAME", (0, row_index), (-1, row_index), "Helvetica-Bold"),
            ])
            continue
        table_data.append([
            Paragraph(str(item["cuenta"]), regular), Paragraph(str(item.get("nit", "")), regular),
            Paragraph(str(item["nombre"]), regular),
            *(Paragraph(_format_money(item[key]), right) for key in
              ("saldoAnterior", "debito", "credito", "saldoActual")),
        ])
        if kind in ("resultado", "total-clase", "total-estado", "total-balance") or item["nivel"] == 1:
            style_commands.extend([
                ("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#E8F1F2")),
                ("FONTNAME", (0, row_index), (-1, row_index), "Helvetica-Bold"),
            ])
    table = LongTable(table_data, repeatRows=1,
                      colWidths=[19 * mm, 25 * mm, 73 * mm, 29 * mm, 29 * mm, 29 * mm, 29 * mm])
    table.setStyle(TableStyle(style_commands))
    story.append(table)

    def footer(canvas: Any, doc: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(landscape(letter)[0] - 10 * mm, 6 * mm, f"Página {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def export_trial_balance_xlsx(report: dict[str, Any]) -> bytes:
    """Construye un libro Excel legible, filtrable y con valores numéricos."""
    if report.get("version") == 2:
        return _export_v2_xlsx(report)
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
    if report.get("version") == 2:
        return _export_v2_pdf(report)
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

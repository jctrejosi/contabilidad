"""Análisis de CONRET y certificados: INFOR15(1), FILRET, VERITRE e INFOR16C.

CONRET es derivada de la acumulación general. Se limita toda lectura/escritura
por CIA y ANO; el certificado lee valores netos de los doce meses, incluyendo
las columnas de crédito y BASCO de la retención sobre IVA.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, TableStyle

from .accounting_lock import accounting_write_lock
from .ads_repository import ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, _execute, _number, _text, ads_odbc_connection
from .iva_analisis_repository import CODE, NIT, MONTHS, PAGE_SIZE, IvaAnalysisConflict, _lookup_names, _quote, _safe, _selected_periods
from .retenciones_acumulacion_repository import _one, _stream, _validate

MONEY_KEYS = ("baseDebito", "retencionDebito", "baseCredito", "retencionCredito", "baseCompraDebito", "baseCompraCredito")


def _fields() -> list[str]:
    return [f"{prefix}{month:02d}{suffix}" for month in range(1, 13)
            for prefix, suffix in (("BASE", ""), ("VALOR", ""), ("BASE", "C"), ("VALOR", "C"),
                                   ("BASCO", ""), ("BASCO", "C"))]


def _months(row: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for month in range(1, 13):
        values = [round(_number(row.get(name)), 2) for name in
                  (f"BASE{month:02d}", f"VALOR{month:02d}", f"BASE{month:02d}C",
                   f"VALOR{month:02d}C", f"BASCO{month:02d}", f"BASCO{month:02d}C")]
        result.append({"mes": month, "nombre": MONTHS[month - 1], **dict(zip(MONEY_KEYS, values)),
                       "baseNeta": round(values[0] + values[2], 2),
                       "retencionNeta": round(values[1] + values[3], 2),
                       "baseCompraNeta": round(values[4] + values[5], 2)})
    return result


def _total(months: list[dict[str, Any]]) -> dict[str, float]:
    values = {key: round(sum(month[key] for month in months), 2) for key in MONEY_KEYS}
    values.update(baseNeta=round(values["baseDebito"] + values["baseCredito"], 2),
                  retencionNeta=round(values["retencionDebito"] + values["retencionCredito"], 2),
                  baseCompraNeta=round(values["baseCompraDebito"] + values["baseCompraCredito"], 2))
    return values


def _version(row: dict[str, Any]) -> str:
    identity = [_text(row.get("CODIGO")), _text(row.get("NIT")),
                [round(_number(row.get(field)), 2) for field in _fields()]]
    return hashlib.sha256(json.dumps(identity, separators=(",", ":")).encode()).hexdigest()


def _item(row: dict[str, Any], accounts: dict[str, str], thirds: dict[str, str]) -> dict[str, Any]:
    code, nit = _text(row.get("CODIGO")), _text(row.get("NIT"))
    months = _months(row)
    return {"cuenta": code, "nombreCuenta": accounts.get(code, ""), "tercero": nit,
            "nombreTercero": thirds.get(nit, ""), "meses": months,
            "anual": _total(months), "version": _version(row)}


def _ranges(account_from: str, account_to: str, nit_from: str, nit_to: str) -> tuple[str, str, str, str]:
    values = (_safe(account_from, CODE, "La cuenta inicial"), _safe(account_to, CODE, "La cuenta final"),
              _safe(nit_from, NIT, "El tercero inicial"), _safe(nit_to, NIT, "El tercero final"))
    if values[0] and values[1] and values[0] > values[1]:
        raise ValueError("La cuenta inicial no puede ser posterior a la final.")
    if values[2] and values[3] and values[2] > values[3]:
        raise ValueError("El tercero inicial no puede ser posterior al final.")
    return values


def _where(company: int, year: int, account_from: str, account_to: str,
           nit_from: str, nit_to: str, search: str = "",
           cursor_account: str = "", cursor_nit: str = "") -> str:
    conditions = [f"CIA = {company}", f"ANO = {year}"]
    for value, field, op in ((account_from, "CODIGO", ">="), (account_to, "CODIGO", "<="),
                             (nit_from, "NIT", ">="), (nit_to, "NIT", "<=")):
        if value:
            conditions.append(f"{field} {op} {_quote(value)}")
    if search:
        conditions.append(f"CODIGO LIKE {_quote(search + '%')}")
    if cursor_account:
        conditions.append(f"(CODIGO > {_quote(cursor_account)} OR "
                          f"(CODIGO = {_quote(cursor_account)} AND NIT > {_quote(cursor_nit)}))")
    return " WHERE " + " AND ".join(conditions)


def list_retention_analysis(cia: str, year: int, *, account_from: str = "", account_to: str = "",
                            nit_from: str = "", nit_to: str = "", search: str = "",
                            cursor_account: str = "", cursor_nit: str = "") -> dict[str, Any]:
    account_from, account_to, nit_from, nit_to = _ranges(account_from, account_to, nit_from, nit_to)
    search = _safe(search, CODE, "La búsqueda de cuenta")
    cursor_account = _safe(cursor_account, CODE, "El cursor de cuenta")
    cursor_nit = _safe(cursor_nit, NIT, "El cursor de tercero")
    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, 1, 12)
        sql = (f"SELECT TOP {PAGE_SIZE + 1} CODIGO, NIT, {', '.join(_fields())} FROM CONRET" +
               _where(company, year, account_from, account_to, nit_from, nit_to,
                      search, cursor_account, cursor_nit) + " ORDER BY CODIGO, NIT")
        rows = list(_stream(connection, sql))
        more = len(rows) > PAGE_SIZE
        rows = rows[:PAGE_SIZE]
        accounts, thirds = _lookup_names(connection, company, rows)
    last = rows[-1] if more else None
    return {"compania": {"codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM"))},
            "anio": year, "filas": [_item(row, accounts, thirds) for row in rows],
            "siguiente": {"cuenta": _text(last["CODIGO"]), "tercero": _text(last["NIT"])} if last else None}


def get_retention_analysis_item(cia: str, year: int, code: str, nit: str) -> dict[str, Any]:
    code, nit = _safe(code, CODE, "La cuenta"), _safe(nit, NIT, "El tercero")
    if not code:
        raise ValueError("Seleccione una cuenta.")
    with ads_odbc_connection() as connection:
        company, _ = _validate(connection, cia, year, 1, 12)
        rows = list(_stream(connection, f"SELECT TOP 2 CODIGO, NIT, {', '.join(_fields())} "
                            f"FROM CONRET WHERE CIA = {company} AND ANO = {year} "
                            f"AND CODIGO = {_quote(code)} AND NIT = {_quote(nit)}"))
        if len(rows) != 1:
            raise IvaAnalysisConflict("El acumulado no existe o está duplicado.")
        accounts, thirds = _lookup_names(connection, company, rows)
        return _item(rows[0], accounts, thirds)


def update_retention_analysis_item(cia: str, year: int, code: str, nit: str,
                                   version: str, months: list[dict[str, Any]]) -> dict[str, Any]:
    """FILRET8: corrige 72 columnas mensuales sin tocar otros ejercicios."""
    code, nit = _safe(code, CODE, "La cuenta"), _safe(nit, NIT, "El tercero")
    if not code or len(version) != 64:
        raise ValueError("La fila seleccionada no es válida.")
    if len(months) != 12 or [month.get("mes") for month in months] != list(range(1, 13)):
        raise ValueError("Se requieren los doce meses en orden.")
    values = []
    for month in months:
        for key in MONEY_KEYS:
            value = month.get(key)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"El importe {key} del mes {month['mes']:02d} no es válido.")
            rounded = round(float(value), 2)
            if (key.endswith("Debito") and rounded < 0) or (key.endswith("Credito") and rounded > 0):
                raise ValueError("Los débitos deben ser positivos y los créditos negativos.")
            values.append(rounded)
    with accounting_write_lock, ads_odbc_connection() as connection:
        company, _ = _validate(connection, cia, year, 1, 12)
        connection.BeginTrans()
        try:
            rows = list(_stream(connection, f"SELECT TOP 2 CODIGO, NIT, {', '.join(_fields())} "
                                f"FROM CONRET WHERE CIA = {company} AND ANO = {year} "
                                f"AND CODIGO = {_quote(code)} AND NIT = {_quote(nit)}"))
            if len(rows) != 1 or _version(rows[0]) != version:
                raise IvaAnalysisConflict("El acumulado cambió; actualice la consulta antes de guardar.")
            assignment = ", ".join(f"{field} = ?" for field in _fields())
            _execute(connection, f"UPDATE CONRET SET {assignment} WHERE CIA = ? AND ANO = ? AND CODIGO = ? AND NIT = ?",
                     [(ADO_TYPE_DOUBLE, 0, value) for value in values] +
                     [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, year),
                      (ADO_TYPE_VARCHAR, 12, code), (ADO_TYPE_VARCHAR, 15, nit)])
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    return get_retention_analysis_item(cia, year, code, nit)


def build_retention_certificates(cia: str, year: int, *, account_from: str, account_to: str,
                                 nit_from: str, nit_to: str, frequency: str, period: str,
                                 presentation: str = "detallado", include_iva: bool = False) -> dict[str, Any]:
    """INFOR16C/VALRET2: una constancia por tercero con períodos y presentación originales."""
    account_from, account_to, nit_from, nit_to = _ranges(account_from, account_to, nit_from, nit_to)
    if presentation not in {"detallado", "sencillo", "porcentaje"}:
        raise ValueError("La presentación del certificado no es válida.")
    periods = _selected_periods(frequency, period)
    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, 1, 12)
        controls = _one(connection, "SELECT TOP 1 CTDIRECC, CTCODCIU, CTLEY1, CTLEY2, CTLEY3, CTLEY4 FROM CONCTR") or {}
        rows = list(_stream(connection, f"SELECT CODIGO, NIT, {', '.join(_fields())} FROM CONRET" +
                            _where(company, year, account_from, account_to, nit_from, nit_to) + " ORDER BY NIT, CODIGO"))
        accounts, thirds = _lookup_names(connection, company, rows)
        rates = {}
        for code in sorted({_text(row["CODIGO"]) for row in rows}):
            result = _one(connection, f"SELECT TOP 1 PORIVARET FROM CONMAE WHERE CIA = {company} AND CODIGO = {_quote(code)}")
            rates[code] = _number(result.get("PORIVARET")) if result else 0
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        item = _item(row, accounts, thirds)
        for label, numbers in periods:
            totals = _total([item["meses"][number - 1] for number in numbers])
            if totals["retencionDebito"] == 0 and totals["retencionCredito"] == 0:
                continue
            base = abs(totals["baseNeta"])
            amount = abs(totals["retencionNeta"])
            purchase = abs(totals["baseCompraNeta"])
            rate = rates.get(item["cuenta"], 0)
            vat_rate = round(base / purchase * 100, 2) if rate and purchase else None
            grouped[item["tercero"]].append({
                "periodo": label, "cuenta": item["cuenta"], "concepto": item["nombreCuenta"],
                "base": base, "baseCompra": purchase, "iva": base if rate else 0,
                "porcentajeIva": vat_rate if include_iva and rate else None,
                "porcentajeRetencion": (round(amount / base * 100, 2) if base else None)
                if presentation == "porcentaje" else rate,
                "retencion": amount,
            })
    certificates = [{"tercero": nit, "nombreTercero": thirds.get(nit, ""), "filas": lines,
                     "totalBase": round(sum(line["base"] for line in lines), 2),
                     "totalBaseCompra": round(sum(line["baseCompra"] for line in lines), 2),
                     "totalRetencion": round(sum(line["retencion"] for line in lines), 2)}
                    for nit, lines in sorted(grouped.items())]
    return {"compania": {"codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM")),
                           "nit": _text(company_row.get("EMPNIT")), "direccion": _text(controls.get("CTDIRECC")),
                           "ciudad": _text(controls.get("CTCODCIU"))},
            "leyendas": [_text(controls.get(f"CTLEY{i}")) for i in range(1, 5)],
            "anio": year, "periodicidad": frequency, "periodo": period,
            "presentacion": presentation, "incluirIva": include_iva,
            "certificados": certificates, "cantidad": len(certificates)}


def _certificate_columns(report: dict[str, Any]) -> list[str]:
    presentation = report["presentacion"]
    if presentation == "sencillo":
        return ["Período", "Cuenta", "Concepto", "Base", "Retención"]
    if presentation == "porcentaje":
        return ["Período", "Cuenta", "Concepto", "Base", "% Ret.", "Retención"]
    columns = ["Período", "Cuenta", "Concepto", "Base compra"]
    if report["incluirIva"]:
        columns += ["% IVA", "IVA"]
    return columns + ["% Ret.", "Retención"]


def _certificate_values(report: dict[str, Any], line: dict[str, Any]) -> list[Any]:
    values = [line["periodo"], line["cuenta"], line["concepto"]]
    if report["presentacion"] == "sencillo":
        return values + [line["base"], line["retencion"]]
    if report["presentacion"] == "porcentaje":
        return values + [line["base"], line["porcentajeRetencion"], line["retencion"]]
    values.append(line["baseCompra"])
    if report["incluirIva"]:
        values += [line["porcentajeIva"], line["iva"]]
    return values + [line["porcentajeRetencion"], line["retencion"]]


def _certificate_total_base(report: dict[str, Any], certificate: dict[str, Any]) -> float:
    if report["presentacion"] == "detallado":
        return certificate["totalBaseCompra"]
    return certificate["totalBase"]


def export_retention_certificates(report: dict[str, Any], format_name: str) -> bytes:
    """Certificados locales; no utiliza el antiguo portal externo ni XADPDF."""
    headings = _certificate_columns(report)
    if format_name == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Certificados retención"
        for index, certificate in enumerate(report["certificados"]):
            start = 1 if index == 0 else sheet.max_row + 1
            sheet.append([report["compania"]["nombre"], f"NIT {report['compania']['nit']}", report["anio"]])
            sheet.append(["CERTIFICADO DE RETENCIONES", certificate["nombreTercero"], certificate["tercero"]])
            sheet.append(headings)
            for line in certificate["filas"]:
                sheet.append(_certificate_values(report, line))
            sheet.append(["", "", "TOTAL", _certificate_total_base(report, certificate),
                          *([None] * (len(headings) - 5)), certificate["totalRetencion"]])
            for cell in sheet[start]:
                cell.font = Font(name="Arial", size=14, bold=True, color="FFFFFF")
                cell.fill = PatternFill("solid", fgColor="003366")
            for cell in sheet[start + 1]:
                cell.font = Font(name="Arial", size=11, bold=True, color="003366")
                cell.fill = PatternFill("solid", fgColor="C8F0FD")
            for cell in sheet[start + 2]:
                cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
                cell.fill = PatternFill("solid", fgColor="0073C0")
            for row in sheet.iter_rows(min_row=start + 3, max_row=sheet.max_row - 1):
                for cell in row:
                    cell.font = Font(name="Arial", size=10, color="001F4C")
            for cell in sheet[sheet.max_row]:
                cell.font = Font(name="Arial", size=10, bold=True, color="003366")
                cell.fill = PatternFill("solid", fgColor="EFFAFF")
            for legend in report["leyendas"]:
                if legend:
                    sheet.append([legend])
                    sheet.cell(sheet.max_row, 1).font = Font(name="Arial", size=10, color="004183")
            sheet.append([])
        sheet.sheet_view.showGridLines = False
        for column in "ABCDEFGH":
            sheet.column_dimensions[column].width = 22 if column != "C" else 42
        output = BytesIO()
        workbook.save(output)
        return output.getvalue()
    if format_name == "pdf":
        output = BytesIO()
        page_size = landscape(letter) if len(headings) > 6 else letter
        document = SimpleDocTemplate(output, pagesize=page_size, leftMargin=30, rightMargin=30,
                                     topMargin=32, bottomMargin=32)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("DsiCertificateCompany", parent=styles["Normal"],
                                     fontName="Helvetica-Bold", fontSize=15, leading=19,
                                     textColor=colors.HexColor("#003366"), spaceAfter=5)
        subtitle_style = ParagraphStyle("DsiCertificateTitle", parent=styles["Normal"],
                                        fontName="Helvetica-Bold", fontSize=12, leading=15,
                                        textColor=colors.HexColor("#0073C0"), spaceAfter=5)
        body_style = ParagraphStyle("DsiCertificateBody", parent=styles["Normal"],
                                    fontName="Helvetica", fontSize=9, leading=12,
                                    textColor=colors.HexColor("#001F4C"))
        cell_style = ParagraphStyle("DsiCertificateCell", parent=body_style,
                                    fontSize=8.5, leading=10.5)
        legend_style = ParagraphStyle("DsiCertificateLegend", parent=body_style,
                                      fontSize=8.5, leading=11,
                                      textColor=colors.HexColor("#004183"))
        story = []
        for index, certificate in enumerate(report["certificados"]):
            if index:
                story.append(PageBreak())
            company = report["compania"]
            story.extend([Paragraph(escape(company["nombre"]), title_style),
                          Paragraph(f"NIT {escape(company['nit'])} · {escape(company['direccion'])}", body_style),
                          Spacer(1, 10), Paragraph("CERTIFICADO DE RETENCIONES", subtitle_style),
                          Paragraph(f"Ejercicio {report['anio']} · {escape(certificate['nombreTercero'])} "
                                    f"(NIT {escape(certificate['tercero'])})", body_style), Spacer(1, 10)])
            table_rows = [headings]
            for line in certificate["filas"]:
                values = _certificate_values(report, line)
                table_rows.append([Paragraph(escape(str(value)), cell_style) if position == 2
                                   else (f"{value:,.2f}" if isinstance(value, (float, int)) else (value or ""))
                                   for position, value in enumerate(values)])
            table_rows.append(["", "", "TOTAL", f"{_certificate_total_base(report, certificate):,.2f}",
                               *([""] * (len(headings) - 5)), f"{certificate['totalRetencion']:,.2f}"])
            available_width = page_size[0] - 60
            other_width = (available_width - 150) / (len(headings) - 1)
            widths = [other_width] * len(headings)
            widths[2] = 150
            table = LongTable(table_rows, colWidths=widths, repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), .25, colors.HexColor("#D7E8F4")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F5FBFF")]),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("LEADING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EFFAFF")),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#003366")),
            ]))
            story.extend([table, Spacer(1, 14)])
            story.extend(Paragraph(escape(legend), legend_style) for legend in report["leyendas"] if legend)
        document.build(story or [Paragraph("No hay retenciones para emitir certificados.", body_style)])
        return output.getvalue()
    raise ValueError("El formato debe ser PDF o XLSX.")

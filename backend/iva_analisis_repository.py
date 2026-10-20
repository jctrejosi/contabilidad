"""Análisis de CONIVA y certificados: INFOR15(2), VERITRE, FILRET y INFOR16.

La pantalla original muestra una fila por cuenta/tercero, cuatro importes por
mes y sus totales anuales. F/B buscan y filtran, F8 modifica exclusivamente
CONIVA y F6 produce certificados agrupados por tercero. CONIVA es una tabla
derivada: un reproceso de IVA puede sustituir las correcciones manuales.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import defaultdict
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, TableStyle

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, CATALOG_ACCOUNT_FILTER,
    _execute, _number, _text, ads_odbc_connection,
)
from .iva_acumulacion_repository import _one, _stream, _validate


MONTHS = ("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
          "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")
MONEY_KEYS = ("baseDebito", "ivaDebito", "baseCredito", "ivaCredito")
CODE = re.compile(r"^[0-9]{0,12}$")
NIT = re.compile(r"^[A-Za-z0-9.\-]{0,15}$")
PAGE_SIZE = 100


class IvaAnalysisConflict(RuntimeError):
    """La fila cambió desde que se abrió o perdió su identidad única."""


def _safe(value: str, pattern: re.Pattern[str], label: str) -> str:
    value = value.strip()
    if not pattern.fullmatch(value):
        raise ValueError(f"{label} no es válido.")
    return value


def _quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _fields() -> str:
    return ", ".join(f"{prefix}{month:02d}{suffix}" for month in range(1, 13)
                     for prefix, suffix in (("BASE", ""), ("VALOR", ""), ("BASE", "C"), ("VALOR", "C")))


def _periods(row: dict[str, Any]) -> list[dict[str, float | int | str]]:
    months = []
    for month in range(1, 13):
        values = [round(_number(row.get(field)), 2) for field in
                  (f"BASE{month:02d}", f"VALOR{month:02d}",
                   f"BASE{month:02d}C", f"VALOR{month:02d}C")]
        months.append({"mes": month, "nombre": MONTHS[month - 1],
                       **dict(zip(MONEY_KEYS, values)),
                       "baseNeta": round(values[0] + values[2], 2),
                       "ivaNeto": round(values[1] + values[3], 2)})
    return months


def _totals(months: list[dict[str, Any]]) -> dict[str, float]:
    result = {key: round(sum(float(month[key]) for month in months), 2) for key in MONEY_KEYS}
    result["baseNeta"] = round(result["baseDebito"] + result["baseCredito"], 2)
    result["ivaNeto"] = round(result["ivaDebito"] + result["ivaCredito"], 2)
    return result


def _version(row: dict[str, Any]) -> str:
    values = [round(_number(row.get(field)), 2) for field in _fields().split(", ")]
    identity = [_text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip(), values]
    return hashlib.sha256(json.dumps(identity, separators=(",", ":")).encode()).hexdigest()


def _lookup_names(connection: Any, company: int, rows: list[dict[str, Any]]) -> tuple[dict[str, str], dict[str, str]]:
    codes = sorted({_text(row.get("CODIGO")).strip() for row in rows if _text(row.get("CODIGO")).strip()})
    nits = sorted({_text(row.get("NIT")).strip() for row in rows if _text(row.get("NIT")).strip()})
    accounts: dict[str, str] = {}
    thirds: dict[str, str] = {}
    for offset in range(0, len(codes), 100):
        chunk = ", ".join(_quote(code) for code in codes[offset:offset + 100])
        sql = (f"SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = {company} "
               f"AND CODIGO IN ({chunk}) AND {CATALOG_ACCOUNT_FILTER}")
        for row in _stream(connection, sql):
            accounts[_text(row["CODIGO"]).strip()] = _text(row["MNOMBRE"]).strip()
    for offset in range(0, len(nits), 100):
        chunk = ", ".join(_quote(nit) for nit in nits[offset:offset + 100])
        for row in _stream(connection, f"SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO IN ({chunk})"):
            thirds[_text(row["CCODIGO"]).strip()] = _text(row["CNOMBRE"]).strip()
    return accounts, thirds


def _item(row: dict[str, Any], accounts: dict[str, str], thirds: dict[str, str]) -> dict[str, Any]:
    code = _text(row.get("CODIGO")).strip()
    nit = _text(row.get("NIT")).strip()
    months = _periods(row)
    return {"cuenta": code, "nombreCuenta": accounts.get(code, ""), "tercero": nit,
            "nombreTercero": thirds.get(nit, ""), "meses": months,
            "anual": _totals(months), "version": _version(row)}


def _where(company: int, account_from: str, account_to: str,
           nit_from: str, nit_to: str, search: str = "",
           cursor_account: str = "", cursor_nit: str = "") -> str:
    conditions = [f"CIA = {company}"]
    for value, field, comparison in ((account_from, "CODIGO", ">="),
                                      (account_to, "CODIGO", "<="),
                                      (nit_from, "NIT", ">="), (nit_to, "NIT", "<=")):
        if value:
            conditions.append(f"{field} {comparison} {_quote(value)}")
    if search:
        conditions.append(f"CODIGO LIKE {_quote(search + '%')}")
    if cursor_account:
        conditions.append(f"(CODIGO > {_quote(cursor_account)} OR "
                          f"(CODIGO = {_quote(cursor_account)} AND NIT > {_quote(cursor_nit)}))")
    return " WHERE " + " AND ".join(conditions)


def list_iva_analysis(cia: str, year: int, *, account_from: str = "", account_to: str = "",
                      nit_from: str = "", nit_to: str = "", search: str = "",
                      cursor_account: str = "", cursor_nit: str = "") -> dict[str, Any]:
    """FILRET/BUSCTAR: rangos de cuenta y tercero, búsqueda y página estable."""
    account_from = _safe(account_from, CODE, "La cuenta inicial")
    account_to = _safe(account_to, CODE, "La cuenta final")
    nit_from = _safe(nit_from, NIT, "El tercero inicial")
    nit_to = _safe(nit_to, NIT, "El tercero final")
    search = _safe(search, CODE, "La búsqueda de cuenta")
    cursor_account = _safe(cursor_account, CODE, "El cursor de cuenta")
    cursor_nit = _safe(cursor_nit, NIT, "El cursor de tercero")
    if account_from and account_to and account_from > account_to:
        raise ValueError("La cuenta inicial no puede ser posterior a la final.")
    if nit_from and nit_to and nit_from > nit_to:
        raise ValueError("El tercero inicial no puede ser posterior al final.")
    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, 1, 12)
        sql = (f"SELECT TOP {PAGE_SIZE + 1} CODIGO, NIT, {_fields()} FROM CONIVA"
               + _where(company, account_from, account_to, nit_from, nit_to,
                        search, cursor_account, cursor_nit) + " ORDER BY CODIGO, NIT")
        rows = list(_stream(connection, sql))
        has_more = len(rows) > PAGE_SIZE
        rows = rows[:PAGE_SIZE]
        accounts, thirds = _lookup_names(connection, company, rows)
    last = rows[-1] if has_more else None
    return {"compania": {"codigo": f"{company:03d}",
                          "nombre": _text(company_row.get("EMPNOM")).strip()},
            "anio": year, "filas": [_item(row, accounts, thirds) for row in rows],
            "siguiente": {"cuenta": _text(last["CODIGO"]).strip(),
                          "tercero": _text(last["NIT"]).strip()} if last else None}


def get_iva_analysis_item(cia: str, year: int, code: str, nit: str) -> dict[str, Any]:
    code = _safe(code, CODE, "La cuenta")
    nit = _safe(nit, NIT, "El tercero")
    if not code:
        raise ValueError("Seleccione una cuenta.")
    with ads_odbc_connection() as connection:
        company, _ = _validate(connection, cia, year, 1, 12)
        sql = (f"SELECT TOP 2 CODIGO, NIT, {_fields()} FROM CONIVA WHERE CIA = {company} "
               f"AND CODIGO = {_quote(code)} AND NIT = {_quote(nit)}")
        rows = list(_stream(connection, sql))
        if len(rows) != 1:
            raise IvaAnalysisConflict("El acumulado no existe o está duplicado.")
        accounts, thirds = _lookup_names(connection, company, rows)
        return _item(rows[0], accounts, thirds)


def update_iva_analysis_item(cia: str, year: int, code: str, nit: str,
                             version: str, months: list[dict[str, Any]]) -> dict[str, Any]:
    """FILRET8: graba los 48 valores editables de una fila con control de cambio."""
    code = _safe(code, CODE, "La cuenta")
    nit = _safe(nit, NIT, "El tercero")
    if not code or not re.fullmatch(r"[0-9a-f]{64}", version):
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
            sql = (f"SELECT TOP 2 CODIGO, NIT, {_fields()} FROM CONIVA WHERE CIA = {company} "
                   f"AND CODIGO = {_quote(code)} AND NIT = {_quote(nit)}")
            current = list(_stream(connection, sql))
            if len(current) != 1 or _version(current[0]) != version:
                raise IvaAnalysisConflict("El acumulado cambió; actualice la consulta antes de guardar.")
            assignment = ", ".join(f"{field} = ?" for field in _fields().split(", "))
            _execute(connection, f"UPDATE CONIVA SET {assignment} WHERE CIA = ? AND CODIGO = ? AND NIT = ?",
                     [(ADO_TYPE_DOUBLE, 0, value) for value in values] +
                     [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, code),
                      (ADO_TYPE_VARCHAR, 15, nit)])
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    return get_iva_analysis_item(cia, year, code, nit)


def _selected_periods(frequency: str, period: str) -> list[tuple[str, list[int]]]:
    if frequency == "mensual":
        periods = [(MONTHS[index], [index + 1]) for index in range(12)]
    elif frequency == "bimestral":
        periods = [(f"{MONTHS[index]}–{MONTHS[index + 1]}", [index + 1, index + 2])
                   for index in range(0, 12, 2)]
    elif frequency == "anual":
        periods = [("Anual", list(range(1, 13)))]
    else:
        raise ValueError("La periodicidad del certificado no es válida.")
    if period == "todos":
        return periods
    if not period.isdigit() or not 1 <= int(period) <= len(periods):
        raise ValueError("El período del certificado no es válido.")
    return [periods[int(period) - 1]]


def build_iva_certificates(cia: str, year: int, *, account_from: str,
                           account_to: str, nit_from: str, nit_to: str,
                           frequency: str, period: str, include_rate: bool = False) -> dict[str, Any]:
    """INFOR16C: certificado por tercero, mes/bimestre/año y rangos."""
    account_from = _safe(account_from, CODE, "La cuenta inicial")
    account_to = _safe(account_to, CODE, "La cuenta final")
    nit_from = _safe(nit_from, NIT, "El tercero inicial")
    nit_to = _safe(nit_to, NIT, "El tercero final")
    if account_from and account_to and account_from > account_to:
        raise ValueError("La cuenta inicial no puede ser posterior a la final.")
    if nit_from and nit_to and nit_from > nit_to:
        raise ValueError("El tercero inicial no puede ser posterior al final.")
    periods = _selected_periods(frequency, period)
    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, 1, 12)
        controls = _one(connection, "SELECT TOP 1 CTDIRECC, CTCODCIU FROM CONCTR") or {}
        sql = (f"SELECT CODIGO, NIT, {_fields()} FROM CONIVA"
               + _where(company, account_from, account_to, nit_from, nit_to)
               + " ORDER BY NIT, CODIGO")
        source = list(_stream(connection, sql))
        accounts, thirds = _lookup_names(connection, company, source)
    by_nit: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in source:
        item = _item(row, accounts, thirds)
        for label, numbers in periods:
            chosen = [item["meses"][number - 1] for number in numbers]
            sums = _totals(chosen)
            # INFOR16 omite conceptos sin valor fiscal en el período.
            if sums["ivaDebito"] == 0 and sums["ivaCredito"] == 0:
                continue
            base = sums["baseNeta"]
            amount = sums["ivaNeto"]
            by_nit[item["tercero"]].append({
                "periodo": label, "cuenta": item["cuenta"],
                "concepto": item["nombreCuenta"], "base": base, "iva": amount,
                "porcentaje": round(amount / base * 100, 2) if include_rate and base else None,
            })
    certificates = []
    for nit, lines in sorted(by_nit.items()):
        certificates.append({
            "tercero": nit, "nombreTercero": thirds.get(nit, ""), "filas": lines,
            "totalBase": round(sum(line["base"] for line in lines), 2),
            "totalIva": round(sum(line["iva"] for line in lines), 2),
        })
    return {
        "compania": {"codigo": f"{company:03d}",
                     "nombre": _text(company_row.get("EMPNOM")).strip(),
                     "nit": _text(company_row.get("EMPNIT")).strip(),
                     "direccion": _text(controls.get("CTDIRECC")).strip(),
                     "ciudad": _text(controls.get("CTCODCIU")).strip()},
        "anio": year, "periodicidad": frequency, "periodo": period,
        "incluirPorcentaje": include_rate, "certificados": certificates,
        "cantidad": len(certificates),
    }


def export_iva_certificates(report: dict[str, Any], format_name: str) -> bytes:
    """Una página PDF por tercero; un libro Excel para todos los certificados."""
    if format_name == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Certificados IVA"
        for certificate in report["certificados"]:
            sheet.append([report["compania"]["nombre"], report["anio"]])
            sheet.append([f"Certificado IVA — {certificate['nombreTercero']}", certificate["tercero"]])
            sheet.append(["Período", "Cuenta", "Concepto", "Base", "% IVA", "IVA"])
            for line in certificate["filas"]:
                sheet.append([line["periodo"], line["cuenta"], line["concepto"],
                              line["base"], line["porcentaje"], line["iva"]])
            sheet.append(["", "", "TOTAL", certificate["totalBase"], "", certificate["totalIva"]])
            for cell in sheet[sheet.max_row]:
                cell.font = Font(bold=True, color="003366")
                cell.fill = PatternFill("solid", fgColor="EFFAFF")
            sheet.append([])
        sheet.column_dimensions["A"].width = 24
        sheet.column_dimensions["B"].width = 20
        sheet.column_dimensions["C"].width = 44
        for column_letter in ("D", "E", "F"):
            sheet.column_dimensions[column_letter].width = 18
        output = BytesIO()
        workbook.save(output)
        return output.getvalue()
    if format_name == "pdf":
        output = BytesIO()
        document = SimpleDocTemplate(output, pagesize=letter,
                                     leftMargin=32, rightMargin=32, topMargin=35, bottomMargin=35)
        styles = getSampleStyleSheet()
        styles["Heading1"].textColor = colors.HexColor("#003366")
        styles["Heading2"].textColor = colors.HexColor("#0073C0")
        styles["Normal"].textColor = colors.HexColor("#001F4C")
        styles["BodyText"].textColor = colors.HexColor("#001F4C")
        story = []
        for index, certificate in enumerate(report["certificados"]):
            if index:
                story.append(PageBreak())
            company = report["compania"]
            story.extend([
                Paragraph(escape(company["nombre"]), styles["Heading1"]),
                Paragraph(f"NIT {escape(company['nit'])} · {escape(company['direccion'])}", styles["Normal"]),
                Spacer(1, 10), Paragraph("CERTIFICADO DE IVA", styles["Heading2"]),
                Paragraph(f"Ejercicio {report['anio']} · {escape(certificate['nombreTercero'])} "
                          f"(NIT {escape(certificate['tercero'])})", styles["Normal"]),
                Spacer(1, 12),
            ])
            table_rows = [["Período", "Cuenta", "Concepto", "Base", "% IVA", "IVA"]]
            table_rows.extend([line["periodo"], line["cuenta"],
                               Paragraph(escape(line["concepto"]), styles["BodyText"]),
                               f"{line['base']:,.2f}",
                               "" if line["porcentaje"] is None else f"{line['porcentaje']:,.2f}",
                               f"{line['iva']:,.2f}"] for line in certificate["filas"])
            table_rows.append(["", "", "TOTAL", f"{certificate['totalBase']:,.2f}", "",
                               f"{certificate['totalIva']:,.2f}"])
            table = LongTable(table_rows, colWidths=[75, 73, 162, 92, 55, 91], repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), .2, colors.lightgrey),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EFFAFF")),
            ]))
            story.extend([table, Spacer(1, 18)])
        document.build(story or [Paragraph("No hay importes de IVA para emitir certificados.", styles["Normal"])])
        return output.getvalue()
    raise ValueError("El formato debe ser PDF o XLSX.")

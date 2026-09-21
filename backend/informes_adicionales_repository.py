"""Informes de solo lectura recuperados del menú ``MENU_INFOR`` de Harbour.

Todas las fuentes son tablas reales de Advantage. MOV01 concentra los meses que
el legado leía como MOV01..MOV12; CONTERCE conserva ahora los auxiliares por
tercero que antes compartían CONMAE. Las consultas de detalle exigen filtros
útiles para no intentar descargar millones de partidas en una sola respuesta.
"""

from __future__ import annotations

import re
from decimal import Decimal
from io import BytesIO, StringIO
from itertools import groupby
from typing import Any
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, letter, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, TableStyle

from .ads_repository import (
    CATALOG_ACCOUNT_FILTER, CompanyNotFound, _company_exists, _number,
    _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code,
)
from .balance_comprobacion_repository import build_trial_balance

MAX_ROWS = 5000
CODE = re.compile(r"^[A-Za-z0-9.\-/]*$")
ACCOUNT = re.compile(r"^[0-9]{0,12}$")


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    rs = _open_recordset(connection, sql)
    try:
        return list(_rows(rs))
    finally:
        rs.Close()


def _safe(value: str, label: str, length: int, *, account: bool = False) -> str:
    value = value.strip()
    if len(value) > length or not (ACCOUNT if account else CODE).fullmatch(value):
        raise ValueError(f"El filtro {label} contiene caracteres no válidos.")
    return value


def _range(column: str, first: str, last: str) -> str:
    if first and last and first > last:
        raise ValueError(f"El rango de {column} está invertido.")
    return (f" AND {column} >= '{first}'" if first else "") + (f" AND {column} <= '{last}'" if last else "")


def _limited(connection: Any, sql: str) -> list[dict[str, Any]]:
    rows = _read(connection, sql.replace("SELECT ", f"SELECT TOP {MAX_ROWS + 1} ", 1))
    if len(rows) > MAX_ROWS:
        raise ValueError("El informe supera 5.000 filas. Acote los filtros de cuenta, tercero, centro, documento o búsqueda.")
    return rows


def _cell(value: Any) -> str | float:
    if isinstance(value, (Decimal, int, float)) and not isinstance(value, bool):
        return round(float(value), 2)
    return _text(value).strip() if value is not None else ""


def _result(
    report_id: str, company: dict[str, Any], year: int, month_from: int, month_to: int,
    columns: list[tuple[str, str, bool]], rows: list[dict[str, Any]], source: str,
    *, note: str = "",
) -> dict[str, Any]:
    return {
        "id": report_id,
        "compania": {
            "codigo": f"{int(_number(company.get('EMPCOD'))):03d}",
            "nombre": _text(company.get("EMPNOM")).strip(),
            "nit": _text(company.get("EMPNIT")).strip(),
        },
        "anio": year, "mesDesde": month_from, "mesHasta": month_to,
        "columnas": [{"label": label, "money": money} for _, label, money in columns],
        "filas": [[str(int(_number(row.get(key)))) if key in {"TFECHA", "CCUMPLE"} and row.get(key)
                   else _cell(row.get(key)) for key, _, _ in columns] for row in rows],
        "count": len(rows), "source": source, "nota": note,
    }


def _movement_where(
    cia: int, year: int, first: int, last: int, *, account_from: str,
    account_to: str, nit: str, center: str, voucher: str, voucher_to: str,
    document_type: str, document_type_to: str,
    document_from: str, document_to: str,
) -> str:
    where = f"CONCIA = {cia} AND CONANO = {year} AND CONMES >= {first} AND CONMES <= {last}"
    where += _range("CODIGO", account_from, account_to)
    where += _range("TDOCUM", document_from, document_to)
    if nit:
        where += f" AND (NIT = '{nit}' OR NITN = '{nit}')"
    if center:
        where += f" AND TFASE = '{center}'"
    if voucher:
        where += _range("TCOMPR", voucher, voucher_to) if voucher_to else f" AND TCOMPR = '{voucher}'"
    elif voucher_to:
        where += _range("TCOMPR", "", voucher_to)
    if document_type:
        where += _range("TIPODOC", document_type, document_type_to) if document_type_to else f" AND TIPODOC = '{document_type}'"
    elif document_type_to:
        where += _range("TIPODOC", "", document_type_to)
    return where


def _balance_report(
    report_id: str, cia: str, year: int, first: int, last: int,
    level: int, include_zero: bool,
) -> dict[str, Any]:
    """Variantes de INFOR02/INFOR09/INFOR10/INFOR13 sobre CONMAE."""
    balance = build_trial_balance(cia, year, first, last, level=level, include_zero=include_zero)
    items = balance["items"]
    if report_id == "bal-gral-resultados":
        items = [row for row in items if row["cuenta"][0] in "1234567"]
    if report_id == "balance-prueba-anual":
        title = "Balance de prueba anual"
    else:
        title = "Informe de saldos"
    columns = [
        ("cuenta", "Cuenta", False), ("nombre", "Nombre", False),
        ("saldoAnterior", "Saldo anterior", True), ("debito", "Débitos", True),
        ("credito", "Créditos", True), ("saldoActual", "Saldo final", True),
    ]
    control_totals = ["", "TOTALES", balance["totales"]["saldoAnterior"],
                      balance["totales"]["debito"], balance["totales"]["credito"],
                      balance["totales"]["saldoActual"]]
    if report_id == "bal-gral-resultados":
        class_rows = [item for item in items if len(item["cuenta"]) == 1]
        control_totals = ["", "TOTALES"] + [
            round(sum(float(item[key]) for item in class_rows), 2)
            for key in ("saldoAnterior", "debito", "credito", "saldoActual")
        ]
    return {
        "id": report_id, "compania": balance["compania"], "anio": year,
        "mesDesde": first, "mesHasta": last,
        "columnas": [{"label": label, "money": money} for _, label, money in columns],
        "filas": [[row[key] for key, _, _ in columns] for row in items],
        "count": len(items), "source": "CONMAE", "nota": title,
        "totales": control_totals,
    }


def _monthly_sum(prefix: str, first: int, last: int) -> str:
    """ADS guarda créditos negativos; sumarlos conserva el signo contable."""
    return " + ".join(f"COALESCE({prefix}{month:02d}, 0)" for month in range(first, last + 1))


def _accumulated_columns(first: int, last: int) -> tuple[str, str]:
    return _monthly_sum("MACMDEB", first, last), _monthly_sum("MACMCRE", first, last)


def _cost_columns(first: int, last: int) -> tuple[str, str]:
    return _monthly_sum("DEB", first, last), _monthly_sum("CRE", first, last)


def build_additional_report(
    report_id: str, cia: str, year: int, month_from: int, month_to: int, *,
    account_from: str = "", account_to: str = "", nit: str = "", center: str = "",
    voucher: str = "", voucher_to: str = "", document_type: str = "",
    document_type_to: str = "", document_from: str = "",
    document_to: str = "", search: str = "", level: int = 6,
    include_zero: bool = False,
) -> dict[str, Any]:
    """Genera una opción visible de impresión sin cambiar ningún acumulado."""
    company = normalize_company_code(cia)
    if not 1900 <= year <= 2100 or not 1 <= month_from <= month_to <= 12:
        raise ValueError("Seleccione un año y un rango de meses válido.")
    account_from = _safe(account_from, "cuenta inicial", 12, account=True)
    account_to = _safe(account_to, "cuenta final", 12, account=True)
    nit = _safe(nit, "tercero", 15)
    center = _safe(center, "centro", 7)
    voucher = _safe(voucher, "comprobante", 2)
    voucher_to = _safe(voucher_to, "comprobante final", 2)
    document_type = _safe(document_type, "tipo de documento", 2)
    document_type_to = _safe(document_type_to, "tipo de documento final", 2)
    document_from = _safe(document_from, "documento inicial", 12)
    document_to = _safe(document_to, "documento final", 12)
    search = search.strip()
    if len(search) > 60 or any(char in search for char in "'\r\n\x00"):
        raise ValueError("La búsqueda contiene caracteres no válidos.")
    if level not in {4, 6, 9, 12}:
        raise ValueError("El nivel contable no es válido.")

    balance_ids = {
        "balance-mensual", "balance-prueba-anual", "inventario-bal", "mayor-bal",
        "saldos-cuenta", "bal-gral-resultados", "analisis-anual-acum",
        "bal-comparativo-mensual",
    }
    if report_id in balance_ids:
        if report_id == "bal-comparativo-mensual":
            older = build_trial_balance(cia, year, month_from, month_from, level=level, include_zero=True)
            newer = build_trial_balance(cia, year, month_to, month_to, level=level, include_zero=True)
            prior = {row["cuenta"]: row for row in older["items"]}
            rows = []
            for item in newer["items"]:
                code = item["cuenta"]
                if (account_from and code < account_from) or (account_to and code > account_to):
                    continue
                if search and search.casefold() not in (code + " " + item["nombre"]).casefold():
                    continue
                before = prior.get(code, {}).get("saldoActual", 0)
                after = item["saldoActual"]
                if include_zero or before or after:
                    rows.append([code, item["nombre"], before, after, round(after - before, 2)])
            return {
                "id": report_id, "compania": newer["compania"], "anio": year,
                "mesDesde": month_from, "mesHasta": month_to,
                "columnas": [{"label": label, "money": index >= 2} for index, label in enumerate(
                    ["Cuenta", "Nombre", "Saldo primer mes", "Saldo segundo mes", "Variación"])],
                "filas": rows, "count": len(rows), "source": "CONMAE", "nota": "Comparación de saldos al cierre de los dos meses elegidos.",
            }
        first = month_from if report_id == "balance-mensual" else 1
        last = month_to if report_id != "balance-prueba-anual" else 12
        report = _balance_report(report_id, cia, year, first, last, level, include_zero)
        if account_from or account_to or search:
            needle = search.casefold()
            report["filas"] = [row for row in report["filas"] if
                (not account_from or row[0] >= account_from) and
                (not account_to or row[0] <= account_to) and
                (not needle or needle in str(row[0]).casefold() or needle in str(row[1]).casefold())]
            report["count"] = len(report["filas"])
            report.pop("totales", None)
        return report

    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        header = companies[0]
        if report_id in {
            "tercero-acumulacion", "tercero-cuenta-tercero", "comp-cta-tercero",
            "resumen-tipo-contribuyente", "balance-acumulado", "balance-mensual-centro",
            "clasificacion-centros", "clasificacion-centro-tercero", "discriminados-mes",
            "analisis-anual-mens",
        }:
            control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
            available_year = int(_number(control[0].get("CTANO"))) if control else 0
            if year != available_year:
                raise ValueError(f"Los acumulados disponibles corresponden al ejercicio {available_year}.")
        where = _movement_where(
            company, year, month_from, month_to, account_from=account_from,
            account_to=account_to, nit=nit, center=center, voucher=voucher,
            voucher_to=voucher_to, document_type=document_type,
            document_type_to=document_type_to, document_from=document_from,
            document_to=document_to,
        )
        search_sql = search.replace("'", "''").upper()

        if report_id == "analisis-anual-mens":
            fields = ", ".join(f"MACMDEB{month:02d}, MACMCRE{month:02d}" for month in range(month_from, month_to + 1))
            condition = f"CIA = {company} AND {CATALOG_ACCOUNT_FILTER}" + _range("CODIGO", account_from, account_to)
            if search_sql:
                condition += f" AND (CODIGO LIKE '{search_sql}%' OR UPPER(MNOMBRE) LIKE '%{search_sql}%')"
            source_rows = _limited(connection, f"SELECT CODIGO, MNOMBRE, {fields} FROM CONMAE WHERE {condition} ORDER BY CODIGO")
            columns = [("CODIGO", "Cuenta", False), ("MNOMBRE", "Nombre", False)]
            columns += [(f"MES{month:02d}", f"Mes {month:02d}", True) for month in range(month_from, month_to + 1)]
            rows = []
            for row in source_rows:
                result = {"CODIGO": row["CODIGO"], "MNOMBRE": row["MNOMBRE"]}
                for month in range(month_from, month_to + 1):
                    result[f"MES{month:02d}"] = _number(row.get(f"MACMDEB{month:02d}")) + _number(row.get(f"MACMCRE{month:02d}"))
                if include_zero or any(result[f"MES{month:02d}"] for month in range(month_from, month_to + 1)):
                    rows.append(result)
            return _result(report_id, header, year, month_from, month_to, columns, rows, "CONMAE")

        if report_id in {"tercero-general", "tercero-cumpleanos", "tercero-etiquetas"}:
            condition = "1 = 1"
            if report_id == "tercero-cumpleanos":
                condition += " AND CCUMPLE > 0"
            if report_id == "tercero-etiquetas":
                condition += " AND CZONA IS NOT NULL AND CZONA <> ''"
            if nit:
                condition += f" AND CCODIGO = '{nit}'"
            if search_sql:
                condition += f" AND (CCODIGO LIKE '{search_sql}%' OR UPPER(CNOMBRE) LIKE '%{search_sql}%')"
            rows = _limited(connection, "SELECT CCODIGO, CNOMBRE, CTIPOCLI, CCUMPLE, CZONA, CSALDO, CCUPO "
                            f"FROM FADCLI WHERE {condition} ORDER BY CNOMBRE")
            if report_id == "tercero-cumpleanos":
                columns = [("CCODIGO", "Tercero", False), ("CNOMBRE", "Nombre", False),
                           ("CCUMPLE", "Cumpleaños", False)]
            elif report_id == "tercero-etiquetas":
                columns = [("CZONA", "Zona", False), ("CCODIGO", "Tercero", False),
                           ("CNOMBRE", "Nombre", False)]
            else:
                columns = [("CCODIGO", "Tercero", False), ("CNOMBRE", "Nombre", False),
                           ("CTIPOCLI", "Tipo", False), ("CZONA", "Zona", False),
                           ("CSALDO", "Saldo", True), ("CCUPO", "Cupo", True)]
            return _result(report_id, header, year, month_from, month_to, columns, rows, "FADCLI")

        if report_id in {"tercero-acumulacion", "tercero-cuenta-tercero", "comp-cta-tercero", "resumen-tipo-contribuyente"}:
            debit, credit = _accumulated_columns(month_from, month_to)
            condition = f"t.CIA = {company}" + _range("t.CODIGO", account_from, account_to)
            if nit:
                condition += f" AND t.NIT = '{nit}'"
            if search_sql:
                condition += (f" AND (t.CODIGO LIKE '{search_sql}%' OR t.NIT LIKE '{search_sql}%' "
                              f"OR UPPER(f.CNOMBRE) LIKE '%{search_sql}%')")
            if report_id == "resumen-tipo-contribuyente":
                rows = _limited(connection,
                    f"SELECT f.CTIPOCLI AS TIPO, SUM(t.MSALDO) AS SALDO, SUM({debit}) AS DEBITO, "
                    f"-SUM({credit}) AS CREDITO FROM CONTERCE t INNER JOIN FADCLI f ON f.CCODIGO = t.NIT "
                    f"WHERE {condition} GROUP BY f.CTIPOCLI ORDER BY f.CTIPOCLI")
                columns = [("TIPO", "Tipo de tercero", False), ("SALDO", "Saldo inicial", True),
                           ("DEBITO", "Débitos", True), ("CREDITO", "Créditos", True)]
            else:
                group = "t.NIT, f.CNOMBRE" if report_id == "tercero-acumulacion" else "t.CODIGO, t.NIT, f.CNOMBRE"
                select = group
                rows = _limited(connection,
                    f"SELECT {select}, SUM(t.MSALDO) AS SALDO, SUM({debit}) AS DEBITO, "
                    f"-SUM({credit}) AS CREDITO FROM CONTERCE t "
                    f"LEFT JOIN FADCLI f ON f.CCODIGO = t.NIT WHERE {condition} "
                    f"GROUP BY {group} ORDER BY {group}")
                columns = ([] if report_id == "tercero-acumulacion" else [("CODIGO", "Cuenta", False)]) + [
                    ("NIT", "Tercero", False), ("CNOMBRE", "Nombre", False), ("SALDO", "Saldo inicial", True),
                    ("DEBITO", "Débitos", True), ("CREDITO", "Créditos", True)]
            return _result(report_id, header, year, month_from, month_to, columns, rows, "CONTERCE")

        if report_id in {"balance-acumulado", "balance-mensual-centro", "clasificacion-centros", "clasificacion-centro-tercero", "discriminados-mes"}:
            first = 0 if report_id == "balance-acumulado" else month_from
            debit, credit = _cost_columns(first, month_to)
            condition = f"c.CIA = {company}" + _range("c.CODIGO", account_from, account_to)
            if center:
                condition += f" AND c.CENTRO = '{center}'"
            if nit:
                condition += f" AND c.NIT = '{nit}'"
            if search_sql:
                condition += (f" AND (c.CODIGO LIKE '{search_sql}%' OR c.CENTRO LIKE '{search_sql}%' "
                              f"OR UPPER(e.NOMBRE) LIKE '%{search_sql}%')")
            source = "COCENTRO c LEFT JOIN CONCECOS e ON e.CIA = c.CIA AND e.CODIGO = c.CENTRO"
            if report_id == "discriminados-mes":
                month_fields = [(f"MES{month:02d}", f"Mes {month:02d}", True) for month in range(month_from, month_to + 1)]
                select_fields = ", ".join(
                    f"SUM(COALESCE(DEB{month:02d}, 0) + COALESCE(CRE{month:02d}, 0)) AS MES{month:02d}"
                    for month in range(month_from, month_to + 1)
                )
                rows = _limited(connection,
                    f"SELECT c.CENTRO, e.NOMBRE, {select_fields} FROM {source} WHERE {condition} "
                    "GROUP BY c.CENTRO, e.NOMBRE ORDER BY c.CENTRO")
                return _result(report_id, header, year, month_from, month_to,
                               [("CENTRO", "Centro", False), ("NOMBRE", "Nombre", False)] + month_fields, rows, "COCENTRO")
            group = "c.CENTRO, e.NOMBRE, c.CODIGO, c.NIT" if report_id == "clasificacion-centro-tercero" else "c.CENTRO, e.NOMBRE, c.CODIGO"
            rows = _limited(connection,
                f"SELECT {group}, SUM({debit}) AS DEBITO, -SUM({credit}) AS CREDITO, "
                f"SUM(({debit}) + ({credit})) AS NETO FROM {source} "
                f"WHERE {condition} GROUP BY {group} ORDER BY {group}")
            columns = [("CENTRO", "Centro", False), ("NOMBRE", "Nombre", False),
                       ("CODIGO", "Cuenta", False)]
            if report_id == "clasificacion-centro-tercero":
                columns.append(("NIT", "Tercero", False))
            columns += [("DEBITO", "Débitos", True), ("CREDITO", "Créditos", True), ("NETO", "Neto", True)]
            return _result(report_id, header, year, month_from, month_to, columns, rows, "COCENTRO")

        if report_id == "listado-cuentas":
            condition = f"CIA = {company} AND {CATALOG_ACCOUNT_FILTER}"
            condition += _range("CODIGO", account_from, account_to)
            if search_sql:
                condition += f" AND (CODIGO LIKE '{search_sql}%' OR UPPER(MNOMBRE) LIKE '%{search_sql}%')"
            rows = _limited(connection, "SELECT CODIGO, MNOMBRE, MTC, MCTAPAGOS, MCOSTOS, MAJUSTE, MIVA_RET "
                            f"FROM CONMAE WHERE {condition} ORDER BY CODIGO")
            columns = [("CODIGO", "Cuenta", False), ("MNOMBRE", "Nombre", False),
                       ("MTC", "Afectable", False), ("MCTAPAGOS", "Tercero", False),
                       ("MCOSTOS", "Centro", False), ("MAJUSTE", "Ajuste", False),
                       ("MIVA_RET", "IVA/Ret.", False)]
            return _result(report_id, header, year, month_from, month_to, columns, rows, "CONMAE")

        group_keys = {
            "mov-comprobante": ("TCOMPR", "Comprobante"),
            "mov-tipo-doc": ("TIPODOC", "Tipo documento"),
            "mov-cuenta": ("CODIGO", "Cuenta"),
            "caja-diario-comp": ("TCOMPR", "Comprobante"),
            "caja-diario-cta": ("CODIGO", "Cuenta"),
        }
        if report_id in group_keys:
            key, label = group_keys[report_id]
            if search_sql:
                where += (f" AND (CODIGO LIKE '{search_sql}%' OR TDOCUM LIKE '{search_sql}%' "
                          f"OR NITN LIKE '{search_sql}%' OR UPPER(TDETALLE) LIKE '%{search_sql}%')")
            if report_id.startswith("caja-diario"):
                where += " AND CODIGO >= '11' AND CODIGO < '12'"
            rows = _limited(connection,
                f"SELECT {key} AS CLAVE, "
                "SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
                "SUM(CASE WHEN TVALOR < 0 THEN -TVALOR ELSE 0 END) AS CREDITO, "
                f"SUM(TVALOR) AS NETO FROM MOV01 WHERE {where} GROUP BY {key} ORDER BY {key}")
            columns = [("CLAVE", label, False), ("DEBITO", "Débitos", True),
                       ("CREDITO", "Créditos", True), ("NETO", "Neto", True)]
            return _result(report_id, header, year, month_from, month_to, columns, rows, "MOV01")

        detail_ids = {
            "aux-gral", "aux-doc-afectado", "diario-cta", "doc-formato", "doc-planilla",
            "diario-rangos-continuos", "diario-rangos-fijos", "tercero-especifico",
        }
        if report_id in detail_ids:
            if search_sql:
                where += (f" AND (CODIGO LIKE '{search_sql}%' OR TDOCUM LIKE '{search_sql}%' "
                          f"OR NITN LIKE '{search_sql}%' OR UPPER(TDETALLE) LIKE '%{search_sql}%')")
            if report_id == "tercero-especifico" and not nit:
                raise ValueError("Seleccione el tercero antes de generar este informe.")
            if report_id == "doc-formato" and not document_from:
                raise ValueError("Indique el número del documento que desea imprimir.")
            if report_id == "doc-formato" and document_from and not document_to:
                where += f" AND TDOCUM = '{document_from}'"
            if report_id == "aux-doc-afectado":
                where += " AND TDOCUM2 IS NOT NULL AND TDOCUM2 <> ''"
            order = {
                "diario-cta": "CODIGO, TFECHA, TDOCUM, TSEC",
                "diario-rangos-continuos": "TFASE, TFECHA, TDOCUM, TSEC",
                "diario-rangos-fijos": "TFASE, TDOCUM, TSEC",
                "tercero-especifico": "TFECHA, CODIGO, TDOCUM, TSEC",
            }.get(report_id, "TFECHA, TDOCUM, TSEC")
            rows = _limited(connection,
                "SELECT CODIGO, NITN, TFASE, TCOMPR, TIPODOC, TDOCUM, TDOCUM2, "
                "TFECHA, TDETALLE, "
                "CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END AS DEBITO, "
                f"CASE WHEN TVALOR < 0 THEN -TVALOR ELSE 0 END AS CREDITO FROM MOV01 WHERE {where} ORDER BY {order}")
            columns = [("TFECHA", "Fecha", False), ("CODIGO", "Cuenta", False),
                       ("NITN", "Tercero", False), ("TFASE", "Centro", False),
                       ("TCOMPR", "Comprobante", False), ("TIPODOC", "Tipo", False),
                       ("TDOCUM", "Documento", False), ("TDOCUM2", "Doc. afectado", False),
                       ("TDETALLE", "Concepto", False), ("DEBITO", "Débitos", True),
                       ("CREDITO", "Créditos", True)]
            note = "Formato predeterminado del documento." if report_id == "doc-formato" else ""
            return _result(report_id, header, year, month_from, month_to, columns, rows, "MOV01", note=note)

        if report_id in {"def-cuentas-flujo", "flujo-comparativo"}:
            raise ValueError("El flujo de caja requiere la definición de cuentas del sistema original, que aún no está disponible en esta instalación.")
        if report_id == "acum-corriente":
            raise ValueError("Falta la clasificación corriente/no corriente de los auxiliares por tercero para generar este informe.")
        if report_id in {"esfa-apertura", "nic-saldos"}:
            raise ValueError("Los informes NIC/NIIF requieren configurar la clasificación contable y los tipos documentales antes de generarse.")
        if report_id == "generador-personalizado":
            raise ValueError("El generador personalizado está pendiente de implementación.")
        raise ValueError("Este informe requiere una homologación específica y aún no está disponible.")


def export_additional_report(report: dict[str, Any], format_name: str) -> bytes:
    """Exporta exactamente las filas consultadas; nunca genera datos ficticios."""
    labels = [column["label"] for column in report["columnas"]]
    rows = report["filas"]
    if format_name == "csv":
        import csv

        output = StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(labels)
        writer.writerows(rows)
        return ("\ufeff" + output.getvalue()).encode("utf-8")

    if format_name == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Informe"
        sheet.append([report["compania"]["nombre"]])
        period_label = ("Directorio general de terceros" if report.get("source") == "FADCLI" else
                        f"Año {report['anio']} · meses {report['mesDesde']:02d}–{report['mesHasta']:02d}")
        sheet.append([period_label])
        sheet.append(labels)
        for row in rows:
            sheet.append(row)
        for cell in sheet[3]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="174E5A")
        sheet.freeze_panes = "A4"
        sheet.auto_filter.ref = f"A3:{sheet.cell(row=max(3, sheet.max_row), column=len(labels)).coordinate}"
        for column in sheet.columns:
            column_letter = column[0].column_letter
            sheet.column_dimensions[column_letter].width = min(44, max(13, max(len(str(cell.value or "")) for cell in column[:100]) + 2))
        output = BytesIO()
        workbook.save(output)
        return output.getvalue()

    if format_name == "pdf":
        from reportlab.lib.utils import simpleSplit

        output = BytesIO()
        if report["id"] == "doc-formato":
            doc = SimpleDocTemplate(output, pagesize=landscape(letter), leftMargin=28, rightMargin=28)
            styles = getSampleStyleSheet()
            story = []
            ordered = sorted(rows, key=lambda row: (str(row[6]), str(row[5]), str(row[4])))
            groups = groupby(ordered, key=lambda row: (str(row[6]), str(row[5]), str(row[4])))
            for index, (_, iterator) in enumerate(groups):
                group_rows = list(iterator)
                first_row = group_rows[0]
                if index:
                    story.append(PageBreak())
                story.extend([
                    Paragraph(escape(report["compania"]["nombre"]), styles["Title"]),
                    Paragraph(f"NIT {escape(report['compania']['nit'])} · Documento {escape(str(first_row[6]))}", styles["Normal"]),
                    Paragraph(
                        f"Fecha: {first_row[0]} · Comprobante: {escape(str(first_row[4]))} · "
                        f"Tipo: {escape(str(first_row[5]))}", styles["Normal"]),
                    Spacer(1, 12),
                ])
                data = [["Cuenta", "Tercero", "Centro", "Concepto", "Débito", "Crédito"]]
                for row in group_rows:
                    data.append([str(row[1]), str(row[2]), str(row[3]),
                                 Paragraph(escape(str(row[8])), styles["BodyText"]),
                                 f"{float(row[9]):,.2f}", f"{float(row[10]):,.2f}"])
                data.append(["", "", "", "TOTALES",
                             f"{sum(float(row[9]) for row in group_rows):,.2f}",
                             f"{sum(float(row[10]) for row in group_rows):,.2f}"])
                table = LongTable(data, colWidths=[82, 85, 55, 325, 76, 76], repeatRows=1)
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#174E5A")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.2, colors.lightgrey),
                    ("ALIGN", (-2, 1), (-1, -1), "RIGHT"),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EAF1F2")),
                ]))
                story.append(table)
            if not story:
                story = [Paragraph("Sin partidas para el período seleccionado.", styles["Normal"])]
            doc.build(story)
            return output.getvalue()
        document = SimpleDocTemplate(
            output, pagesize=landscape(A3), leftMargin=24, rightMargin=24,
            topMargin=25, bottomMargin=25,
        )
        width = landscape(A3)[0] - 48
        cell_width = width / max(1, len(labels))
        data = [[str(label) for label in labels]]
        for row in rows:
            data.append(["\n".join(simpleSplit(str(value), "Helvetica", 7, cell_width - 8)[:3]) for value in row])
        table = LongTable(data, colWidths=[cell_width] * len(labels), repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#174E5A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.2, colors.lightgrey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F8F8")]),
        ]))
        styles = getSampleStyleSheet()
        heading = Paragraph(escape(report["compania"]["nombre"]), styles["Heading1"])
        detail = ("Directorio general de terceros" if report.get("source") == "FADCLI" else
                  f"Año {report['anio']} · Meses {report['mesDesde']:02d}–{report['mesHasta']:02d}")
        subtitle = Paragraph(f"Informe {escape(report['id'])} · {detail}", styles["Normal"])
        document.build([heading, subtitle, Spacer(1, 12), table])
        return output.getvalue()
    raise ValueError("El formato de exportación no es válido.")

"""Acumulación general de retenciones: INFOR05(1) / INFOR53R.

MOV01 concentra todos los meses del antiguo MOV01..MOV12. CONRET guarda una
fila anual por CIA, ANO, cuenta y NIT, con columnas BASE/VALOR y BASCO por mes.
El reproceso reemplaza únicamente los meses pedidos y no altera MOV01; las
normalizaciones de TBASE y TIVA_RET se aplican al cálculo en memoria.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterator

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER, CompanyNotFound, _execute, _number,
    _open_recordset, _rows, _text, ads_odbc_connection, normalize_company_code,
)


def _one(connection: Any, sql: str) -> dict[str, Any] | None:
    recordset = _open_recordset(connection, sql)
    try:
        return next(_rows(recordset), None)
    finally:
        recordset.Close()


def _stream(connection: Any, sql: str) -> Iterator[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        names = [recordset.Fields.Item(i).Name for i in range(recordset.Fields.Count)]
        while not recordset.EOF:
            columns = recordset.GetRows(1000)
            if not columns or not columns[0]:
                break
            yield from (dict(zip(names, values)) for values in zip(*columns))
    finally:
        recordset.Close()


def _validate(connection: Any, cia: str, year: int, first: int, last: int) -> tuple[int, dict[str, Any]]:
    company = normalize_company_code(cia)
    if not 1 <= first <= last <= 12:
        raise ValueError("Seleccione un rango de meses entre 01 y 12.")
    row = _one(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
    if row is None:
        raise CompanyNotFound(f"No existe la compañía {company:03d}.")
    control = _one(connection, "SELECT TOP 1 CTANO FROM CONCTR")
    if control is None or int(_number(control.get("CTANO"))) != year:
        raise ValueError("La acumulación solo puede ejecutarse para el ejercicio contable activo.")
    for table, required in (
        ("CONRET", {"CIA", "ANO", "MES", "CODIGO", "NIT", "CTABASE"} |
         {f"{prefix}{m:02d}{suffix}" for m in range(first, last + 1)
          for prefix in ("BASE", "VALOR") for suffix in ("", "C")} |
         {f"BASCO{m:02d}{suffix}" for m in range(first, last + 1) for suffix in ("", "C")}),
        ("XADMOVI", {"CIA", "ANO", "XDOCUM", "XENTRY", "XPROVEE", "XVLRRETI", "XBRUTO", "XIVA"}),
    ):
        recordset = _open_recordset(connection, f"SELECT TOP 0 * FROM {table}")
        try:
            available = {recordset.Fields.Item(i).Name.upper() for i in range(recordset.Fields.Count)}
        finally:
            recordset.Close()
        if not required.issubset(available):
            raise ValueError(f"La estructura de {table} no está completa para el proceso de retenciones.")
    return company, row


def _retention_sql(company: int, year: int, first: int, last: int) -> str:
    master_filter = CATALOG_ACCOUNT_FILTER.replace("NITN", "a.NITN")
    return (
        "SELECT m.CONMES, m.CODIGO, m.NIT, m.TIPODOC, m.TDOCUM, m.TVALOR, m.TBASE, "
        "a.PORIVARET FROM MOV01 m "
        "INNER JOIN CONMAE a ON m.CONCIA = a.CIA AND m.CODIGO = a.CODIGO "
        f"WHERE m.CONCIA = {company} AND m.CONANO = {year} "
        f"AND m.CONMES >= {first} AND m.CONMES <= {last} "
        f"AND a.MIVA_RET = 'R' AND a.MTC = TRUE AND {master_filter} "
        "AND m.TVALOR <> 0 ORDER BY m.CONMES, m.CODIGO, m.NIT, m.TDOCUM"
    )


def _iva_document_bases(connection: Any, company: int, year: int, first: int, last: int) -> dict[tuple, tuple[float, float]]:
    """Alternativa de INFOR53R cuando el documento no existe en XADMOVI."""
    sql = (
        "SELECT CONMES, TDOCUM, TIPODOC, NIT, "
        "SUM(ABS(TBASE)) AS BRUTO, SUM(ABS(TVALOR)) AS IVA "
        "FROM MOV01 "
        f"WHERE CONCIA = {company} AND CONANO = {year} AND CONMES >= {first} AND CONMES <= {last} "
        "AND TIVA_RET = 'I' GROUP BY CONMES, TDOCUM, TIPODOC, NIT"
    )
    return {
        (int(_number(r["CONMES"])), _text(r["TDOCUM"]), _text(r["TIPODOC"]), _text(r["NIT"])):
        (_number(r["BRUTO"]), _number(r["IVA"])) for r in _stream(connection, sql)
    }


def _cxp_bases(connection: Any, company: int, year: int) -> dict[tuple, list[tuple[float, float, float]]]:
    """Solo filas identificadas con CIA y ANO: nunca se mezclan las históricas sin dueño."""
    result: dict[tuple, list[tuple[float, float, float]]] = defaultdict(list)
    sql = ("SELECT XDOCUM, XENTRY, XPROVEE, XVLRRETI, XBRUTO, XIVA FROM XADMOVI "
           f"WHERE CIA = {company} AND ANO = {year}")
    for row in _stream(connection, sql):
        key = (_text(row["XDOCUM"]), _text(row["XENTRY"]), _text(row["XPROVEE"]))
        result[key].append((_number(row["XVLRRETI"]), _number(row["XBRUTO"]), _number(row["XIVA"])))
    return result


def _calculate(connection: Any, company: int, year: int, first: int, last: int) -> dict[tuple, dict[str, float]]:
    """Agrega movimiento por mes/cuenta/tercero, conservando signos de crédito."""
    cxp = _cxp_bases(connection, company, year)
    iva = _iva_document_bases(connection, company, year, first, last)
    result: dict[tuple, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    special_seen: set[tuple] = set()
    for row in _stream(connection, _retention_sql(company, year, first, last)):
        month = int(_number(row["CONMES"]))
        account, nit = _text(row["CODIGO"]), _text(row["NIT"])
        amount = _number(row["TVALOR"])
        base = abs(_number(row["TBASE"]))
        document, document_type = _text(row["TDOCUM"]), _text(row["TIPODOC"])
        special = _number(row["PORIVARET"]) != 0
        side = "" if amount > 0 else "C"
        totals = result[(account, nit)]
        if special:
            document_key = (month, document, document_type, nit)
            cxp_key = (document, document_type, nit)
            if cxp_key in cxp:
                matching = [entry for entry in cxp[cxp_key] if entry[0] > 0 and round(entry[0], 2) == round(abs(amount), 2)]
                gross = sum(entry[1] for entry in matching)
                iva_value = sum(entry[2] for entry in matching)
            else:
                gross, iva_value = iva.get(document_key, (0.0, 0.0))
            if base == 0:
                base = iva_value
            # Harbour contabiliza BASCO una sola vez por grupo documento/valor.
            special_key = (month, account, nit, document, document_type, amount)
            if special_key not in special_seen:
                totals[f"BASCO{month:02d}{side}"] += gross if amount > 0 else -gross
                special_seen.add(special_key)
        totals[f"BASE{month:02d}{side}"] += base if amount > 0 else -base
        totals[f"VALOR{month:02d}{side}"] += amount
    return result


def _fields(first: int, last: int) -> list[str]:
    return [f"{prefix}{month:02d}{suffix}" for month in range(first, last + 1)
            for prefix, suffix in (("BASE", ""), ("VALOR", ""), ("BASE", "C"),
                                   ("VALOR", "C"), ("BASCO", ""), ("BASCO", "C"))]


def _replace(connection: Any, company: int, year: int, first: int, last: int,
             totals: dict[tuple, dict[str, float]]) -> int:
    """Elimina huérfanos previos y reemplaza solo los meses solicitados."""
    connection.Execute("DELETE FROM CONRET WHERE CIA IS NULL OR ANO IS NULL")
    fields = _fields(first, last)
    connection.Execute("UPDATE CONRET SET " + ", ".join(f"{field} = 0" for field in fields)
                       + f" WHERE CIA = {company} AND ANO = {year}")
    old_rows = list(_stream(connection,
                            f"SELECT CODIGO, NIT FROM CONRET WHERE CIA = {company} AND ANO = {year}"))
    existing = {(_text(row["CODIGO"]), _text(row["NIT"])) for row in old_rows}
    if len(existing) != len(old_rows):
        raise ValueError("Hay acumulados duplicados por cuenta y tercero; revise CONRET antes de reprocesar.")
    for (account, nit), monthly in totals.items():
        amounts = [(ADO_TYPE_DOUBLE, 0, round(monthly.get(field, 0.0), 2)) for field in fields]
        if (account, nit) in existing:
            _execute(connection,
                     "UPDATE CONRET SET " + ", ".join(f"{field} = ?" for field in fields)
                     + " WHERE CIA = ? AND ANO = ? AND CODIGO = ? AND NIT = ?",
                     amounts + [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, year),
                                (ADO_TYPE_VARCHAR, 12, account), (ADO_TYPE_VARCHAR, 15, nit)])
        else:
            _execute(connection,
                     "INSERT INTO CONRET (CIA, ANO, MES, CODIGO, NIT, " + ", ".join(fields)
                     + ") VALUES (" + ", ".join("?" for _ in range(5 + len(fields))) + ")",
                     [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, year),
                      (ADO_TYPE_INTEGER, 0, 0), (ADO_TYPE_VARCHAR, 12, account),
                      (ADO_TYPE_VARCHAR, 15, nit)] + amounts)
    return len(totals)


def _report(connection: Any, company: int, company_row: dict[str, Any], year: int,
            first: int, last: int, processed: int) -> dict[str, Any]:
    sums = [" + ".join(f"COALESCE({prefix}{m:02d}{suffix}, 0)" for m in range(first, last + 1))
            for prefix, suffix in (("BASE", ""), ("VALOR", ""), ("BASE", "C"),
                                   ("VALOR", "C"), ("BASCO", ""), ("BASCO", "C"))]
    sql = ("SELECT CODIGO, NIT, " + ", ".join(f"({expression}) AS V{i}" for i, expression in enumerate(sums))
           + f" FROM CONRET WHERE CIA = {company} AND ANO = {year} ORDER BY CODIGO, NIT")
    rows, totals = [], [0.0] * 6
    for item in _stream(connection, sql):
        values = [round(_number(item[f"V{i}"]), 2) for i in range(6)]
        if not any(values):
            continue
        totals = [round(a + b, 2) for a, b in zip(totals, values)]
        rows.append([_text(item["CODIGO"]), _text(item["NIT"]), *values,
                     round(values[0] + values[2], 2), round(values[1] + values[3], 2)])
    return {
        "id": "ret-acumulacion", "compania": {
            "codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM")),
            "nit": _text(company_row.get("EMPNIT")),
        }, "anio": year, "mesDesde": first, "mesHasta": last,
        "columnas": [{"label": label, "money": index >= 2} for index, label in enumerate(
            ("Cuenta", "Tercero", "Base débito", "Retención débito", "Base crédito",
             "Retención crédito", "Base compra débito", "Base compra crédito", "Base neta", "Retención neta"))],
        "filas": rows, "totales": ["", "TOTALES", *totals,
                                     round(totals[0] + totals[2], 2), round(totals[1] + totals[3], 2)],
        "count": len(rows), "source": "CONRET", "procesados": processed,
        "nota": f"Acumulación de retenciones de {first:02d} a {last:02d} del ejercicio {year}.",
    }


def read_retention_accumulation(cia: str, year: int, first: int, last: int) -> dict[str, Any]:
    with ads_odbc_connection() as connection:
        company, row = _validate(connection, cia, year, first, last)
        return _report(connection, company, row, year, first, last, 0)


def rebuild_retention_accumulation(cia: str, year: int, first: int, last: int) -> dict[str, Any]:
    with accounting_write_lock, ads_odbc_connection() as connection:
        company, row = _validate(connection, cia, year, first, last)
        totals = _calculate(connection, company, year, first, last)
        connection.BeginTrans()
        try:
            processed = _replace(connection, company, year, first, last, totals)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
        return _report(connection, company, row, year, first, last, processed)

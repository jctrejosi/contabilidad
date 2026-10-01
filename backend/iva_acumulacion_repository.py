"""Acumulación general de IVA de INFOR05(2)/INFOR51/INFOR53I.

El programa Harbour recorre MOV01..MOV18, selecciona las cuentas maestras de
CONMAE marcadas como IVA y suma por cuenta/tercero en CONIVA. En esta versión
todo el movimiento está en MOV01 y CONIVA es compartida entre compañías: la
columna CIA impide que un reproceso borre los importes de otra contabilidad.

La fuente contable nunca se modifica aquí. El original corregía TBASE y
TIVA_RET mientras acumulaba; calculamos la base con el signo de TVALOR en la
consulta, que produce el mismo acumulado sin cambiar el movimiento histórico.
"""

from __future__ import annotations

from typing import Any, Iterator

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, CATALOG_ACCOUNT_FILTER,
    CompanyNotFound, _execute, _number, _open_recordset, _rows, _text,
    ads_odbc_connection, normalize_company_code,
)


def _one(connection: Any, sql: str) -> dict[str, Any] | None:
    recordset = _open_recordset(connection, sql)
    try:
        return next(_rows(recordset), None)
    finally:
        recordset.Close()


def _stream(connection: Any, sql: str) -> Iterator[dict[str, Any]]:
    """GetRows por bloques evita crear una matriz COM de todo el ejercicio."""
    recordset = _open_recordset(connection, sql)
    try:
        fields = [recordset.Fields.Item(index).Name for index in range(recordset.Fields.Count)]
        while not recordset.EOF:
            columns = recordset.GetRows(1000)
            if not columns or not columns[0]:
                break
            yield from (dict(zip(fields, values)) for values in zip(*columns))
    finally:
        recordset.Close()


def _validate(connection: Any, cia: str, year: int, first: int, last: int) -> tuple[int, dict[str, Any]]:
    company = normalize_company_code(cia)
    if not 1 <= first <= last <= 12:
        raise ValueError("Seleccione un rango de meses entre 01 y 12.")
    company_row = _one(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
    if company_row is None:
        raise CompanyNotFound(f"No existe la compañía {company:03d}.")
    control = _one(connection, "SELECT TOP 1 CTANO FROM CONCTR")
    if control is None or int(_number(control.get("CTANO"))) != year:
        raise ValueError("La acumulación solo puede ejecutarse para el ejercicio contable activo.")
    fields = {field.upper() for field in _field_names(connection, "CONIVA")}
    required = {"CIA", "CODIGO", "NIT"}
    required.update(f"{prefix}{month:02d}{suffix}" for month in range(first, last + 1)
                    for prefix in ("BASE", "VALOR") for suffix in ("", "C"))
    if not required.issubset(fields):
        raise ValueError("La estructura de acumulación de IVA no está completa para los meses seleccionados.")
    return company, company_row


def _field_names(connection: Any, table: str) -> list[str]:
    recordset = _open_recordset(connection, f"SELECT TOP 0 * FROM {table}")
    try:
        return [recordset.Fields.Item(index).Name for index in range(recordset.Fields.Count)]
    finally:
        recordset.Close()


def _source_sql(company: int, year: int, first: int, last: int) -> str:
    """INFOR53I: solo cuentas MIVA_RET=I, MTC y movimientos no nulos.

    Agrupar también por mes permite actualizar los cuatro campos originales
    del mes sin sumar dos veces cuentas superiores ni mezclar compañías.
    """
    account_filter = CATALOG_ACCOUNT_FILTER.replace("NITN", "a.NITN")
    return (
        "SELECT m.CONMES AS MES, m.CODIGO AS CODIGO, m.NIT AS NIT, "
        "SUM(CASE WHEN m.TVALOR > 0 THEN ABS(m.TBASE) ELSE 0 END) AS BASE_DEB, "
        "SUM(CASE WHEN m.TVALOR > 0 THEN m.TVALOR ELSE 0 END) AS VALOR_DEB, "
        "SUM(CASE WHEN m.TVALOR < 0 THEN -ABS(m.TBASE) ELSE 0 END) AS BASE_CRE, "
        "SUM(CASE WHEN m.TVALOR < 0 THEN m.TVALOR ELSE 0 END) AS VALOR_CRE "
        "FROM MOV01 m INNER JOIN CONMAE a ON m.CONCIA = a.CIA AND m.CODIGO = a.CODIGO "
        f"WHERE m.CONCIA = {company} AND m.CONANO = {year} "
        f"AND m.CONMES >= {first} AND m.CONMES <= {last} "
        f"AND a.MIVA_RET = 'I' AND a.MTC = TRUE AND {account_filter} "
        "AND m.TVALOR <> 0 "
        "GROUP BY m.CONMES, m.CODIGO, m.NIT ORDER BY m.CONMES, m.CODIGO, m.NIT"
    )


def _month_fields(month: int) -> tuple[str, str, str, str]:
    return (f"BASE{month:02d}", f"VALOR{month:02d}",
            f"BASE{month:02d}C", f"VALOR{month:02d}C")


def _accumulate(connection: Any, company: int, year: int, first: int, last: int) -> int:
    """Pone en cero solo los meses pedidos y vuelve a sumar MOV01.

    Todo sucede dentro de la transacción del llamador. Si hay error, la tabla
    vuelve al estado anterior y una segunda ejecución no duplica importes.
    """
    # Cerrar completamente el Recordset de lectura antes de empezar los UPDATE:
    # Advantage/ADO puede deshabilitar el callback si una conexión mantiene
    # simultáneamente un cursor abierto y escrituras sobre la misma sesión.
    source_rows = list(_stream(connection, _source_sql(company, year, first, last)))
    columns = [field for month in range(first, last + 1) for field in _month_fields(month)]
    connection.Execute("UPDATE CONIVA SET " + ", ".join(f"{field} = 0" for field in columns)
                       + f" WHERE CIA = {company}")
    existing = [(_text(row["CODIGO"]).strip(), _text(row["NIT"]).strip())
                for row in _stream(connection, f"SELECT CODIGO, NIT FROM CONIVA WHERE CIA = {company}")]
    keys = set(existing)
    if len(keys) != len(existing):
        raise ValueError("Hay cuentas y terceros duplicados en la acumulación de IVA; revise los registros antes de reprocesar.")
    count = 0
    for source in source_rows:
        month = int(_number(source["MES"]))
        code = _text(source["CODIGO"]).strip()
        nit = _text(source["NIT"]).strip()
        amounts = [round(_number(source[name]), 2)
                   for name in ("BASE_DEB", "VALOR_DEB", "BASE_CRE", "VALOR_CRE")]
        fields = _month_fields(month)
        key = (code, nit)
        if key in keys:
            _execute(connection,
                     "UPDATE CONIVA SET " + ", ".join(f"{field} = ?" for field in fields)
                     + " WHERE CIA = ? AND CODIGO = ? AND NIT = ?",
                     [(ADO_TYPE_DOUBLE, 0, amount) for amount in amounts] +
                     [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, code),
                      (ADO_TYPE_VARCHAR, 15, nit)])
        else:
            _execute(connection,
                     "INSERT INTO CONIVA (CIA, CODIGO, NIT, " + ", ".join(fields)
                     + ") VALUES (?, ?, ?, ?, ?, ?, ?)",
                     [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, code),
                      (ADO_TYPE_VARCHAR, 15, nit)] +
                     [(ADO_TYPE_DOUBLE, 0, amount) for amount in amounts])
            keys.add(key)
        count += 1
    return count


def _report(connection: Any, company: int, company_row: dict[str, Any],
            year: int, first: int, last: int, processed: int = 0) -> dict[str, Any]:
    """Vista previa de lo ya grabado; los campos C conservan signo negativo."""
    sums = [" + ".join(f"COALESCE({name}, 0)" for month in range(first, last + 1)
                       for name in [_month_fields(month)[position]])
            for position in range(4)]
    sql = ("SELECT CODIGO, NIT, " + ", ".join(f"({expression}) AS V{index}"
           for index, expression in enumerate(sums))
           + f" FROM CONIVA WHERE CIA = {company} ORDER BY CODIGO, NIT")
    rows = []
    total = [0.0] * 4
    for item in _stream(connection, sql):
        values = [round(_number(item[f"V{index}"]), 2) for index in range(4)]
        if not any(values):
            continue
        total = [round(a + b, 2) for a, b in zip(total, values)]
        rows.append([_text(item["CODIGO"]).strip(), _text(item["NIT"]).strip(), *values,
                     round(values[0] + values[2], 2), round(values[1] + values[3], 2)])
    return {
        "id": "iva-acumulacion", "compania": {
            "codigo": f"{company:03d}", "nombre": _text(company_row.get("EMPNOM")).strip(),
            "nit": _text(company_row.get("EMPNIT")).strip(),
        }, "anio": year, "mesDesde": first, "mesHasta": last,
        "columnas": [{"label": name, "money": index >= 2} for index, name in enumerate(
            ("Cuenta", "Tercero", "Base débito", "IVA débito", "Base crédito", "IVA crédito",
             "Base neta", "IVA neto"))],
        "filas": rows, "totales": ["", "TOTALES", *total,
                                   round(total[0] + total[2], 2), round(total[1] + total[3], 2)],
        "count": len(rows), "source": "CONIVA", "procesados": processed,
        "nota": f"Acumulación de IVA de los meses {first:02d} a {last:02d} del ejercicio {year}.",
    }


def read_iva_accumulation(cia: str, year: int, first: int, last: int) -> dict[str, Any]:
    """Consulta sin procesar, útil para la vista previa y exportación."""
    with ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, first, last)
        return _report(connection, company, company_row, year, first, last)


def rebuild_iva_accumulation(cia: str, year: int, first: int, last: int) -> dict[str, Any]:
    """Equivalente transaccional de Procesar de INFOR05(2)."""
    with accounting_write_lock, ads_odbc_connection() as connection:
        company, company_row = _validate(connection, cia, year, first, last)
        connection.BeginTrans()
        try:
            processed = _accumulate(connection, company, year, first, last)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
        return _report(connection, company, company_row, year, first, last, processed)

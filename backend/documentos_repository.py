"""Consulta bajo demanda de documentos contabilizados en Advantage.

``CONDOCUM`` contiene una fila de cabecera por documento y ``MOV01`` conserva
sus partidas. Ninguna función de este módulo hace una lectura general al abrir
la pantalla: la cabecera exige al menos un filtro y ambos resultados se
consultan paginados o por la clave concreta del documento.
"""

from __future__ import annotations

from datetime import date
import re
from typing import Any, Iterable

from ._win32com import win32com
from .ads_repository import (
    ADO_COMMAND_TEXT,
    ADO_PARAMETER_INPUT,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _company_exists,
    _number,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)


SIMPLE_CODE = re.compile(r"^[A-Za-z0-9.-]+$")
DOCUMENT_CODE = re.compile(r"^[A-Za-z0-9 ._/-]+$")
NIT_CODE = re.compile(r"^[A-Za-z0-9.-]+$")


def _parameters(command: Any, values: Iterable[tuple[int, int, Any]]) -> None:
    """Agrega parámetros ADO sin interpolar valores escritos por el usuario."""
    for index, (ado_type, size, value) in enumerate(values):
        command.Parameters.Append(
            command.CreateParameter(f"p{index}", ado_type, ADO_PARAMETER_INPUT, size, value)
        )


def _query_rows(
    connection: Any,
    sql: str,
    parameters: list[tuple[int, int, Any]],
) -> list[dict[str, Any]]:
    command = win32com.client.Dispatch("ADODB.Command")
    command.ActiveConnection = connection
    command.CommandType = ADO_COMMAND_TEXT
    command.CommandText = sql
    _parameters(command, parameters)
    recordset, _ = command.Execute()
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _iso_date(value: Any) -> str:
    text = str(int(_number(value)))
    if len(text) != 8:
        return ""
    return f"{text[:4]}-{text[4:6]}-{text[6:8]}"


def _numeric_date(value: str, label: str) -> int | None:
    value = value.strip()
    if not value:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"La {label} no es válida.") from exc
    return int(parsed.strftime("%Y%m%d"))


def _code(value: str, label: str, maximum: int, pattern: re.Pattern[str]) -> str:
    value = value.strip()
    if value and (len(value) > maximum or not pattern.fullmatch(value)):
        raise ValueError(f"El filtro {label} contiene caracteres no válidos.")
    return value


def _third_party_names(connection: Any, nits: set[str]) -> dict[str, str]:
    """Resuelve en una sola lectura los nombres de los NIT visibles."""
    clean = sorted(nit for nit in nits if nit)
    if not clean:
        return {}
    placeholders = ", ".join("?" for _ in clean)
    rows = _query_rows(
        connection,
        f"SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO IN ({placeholders})",
        [(ADO_TYPE_VARCHAR, 15, nit) for nit in clean],
    )
    return {_text(row.get("CCODIGO")): _text(row.get("CNOMBRE")) for row in rows}


def _document_totals(
    connection: Any,
    conditions: list[str],
    parameters: list[tuple[int, int, Any]],
) -> tuple[int, float]:
    """Cuenta y suma TODOS los documentos filtrados, no solo la pagina.

    ``CONDOCUM`` guarda una cabecera por documento y conserva el importe en
    ``DVALOR``, de modo que el total es un agregado directo sobre las mismas
    condiciones de la pagina. Equivale al agregado del modelo nuevo en
    PostgreSQL, para que ambas herramientas reporten las mismas cifras.
    """
    sql = (
        "SELECT COUNT(*) AS TDOCS, SUM(DVALOR) AS TVALOR FROM CONDOCUM WHERE "
        + " AND ".join(conditions)
    )
    rows = _query_rows(connection, sql, parameters)
    row = rows[0] if rows else {}

    documents = row.get("TDOCS")
    value = row.get("TVALOR")
    if documents is None or value is None:
        # Algunos proveedores ADO no conservan el alias de una columna calculada;
        # ``_query_rows`` mantiene el orden de la proyeccion, asi que se cae a el.
        values = list(row.values())
        if documents is None and values:
            documents = values[0]
        if value is None and len(values) > 1:
            value = values[1]
    return int(_number(documents)), _number(value)


def list_documents(
    cia: str,
    *,
    page: int = 1,
    page_size: int = 50,
    period: str = "",
    voucher: str = "",
    document_type: str = "",
    nit: str = "",
    date_from: str = "",
    date_to: str = "",
    document: str = "",
) -> dict[str, Any]:
    """Consulta cabeceras de ``CONDOCUM`` solo después de confirmar filtros."""
    company = normalize_company_code(cia)
    if page < 1 or not 1 <= page_size <= 100:
        raise ValueError("La paginación solicitada no es válida.")
    period = period.strip()
    voucher = _code(voucher, "comprobante", 2, SIMPLE_CODE)
    document_type = _code(document_type, "tipo documental", 2, SIMPLE_CODE)
    nit = _code(nit, "NIT", 15, NIT_CODE)
    document = _code(document, "documento", 12, DOCUMENT_CODE)
    from_number = _numeric_date(date_from, "fecha inicial")
    to_number = _numeric_date(date_to, "fecha final")
    if from_number and to_number and from_number > to_number:
        raise ValueError("La fecha inicial no puede ser posterior a la fecha final.")

    period_start: int | None = None
    period_end: int | None = None
    if period:
        if not re.fullmatch(r"\d{4}-\d{2}", period):
            raise ValueError("El período debe tener el formato AAAA-MM.")
        year, month = (int(part) for part in period.split("-"))
        if not 1 <= month <= 12:
            raise ValueError("El mes del período no es válido.")
        period_start = year * 10000 + month * 100 + 1
        next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
        period_end = next_year * 10000 + next_month * 100

    # CIA identifica la sesión, pero no cuenta como filtro aplicado por el
    # usuario. Esto evita recorrer toda CONDOCUM por accidente.
    if not any((period, voucher, document_type, nit, from_number, to_number, document)):
        raise ValueError("Aplique al menos un filtro antes de consultar documentos.")

    conditions = ["CIA = ?"]
    parameters: list[tuple[int, int, Any]] = [(ADO_TYPE_INTEGER, 0, company)]
    if period_start is not None and period_end is not None:
        conditions.extend(["DFECHA >= ?", "DFECHA < ?"])
        parameters.extend([(ADO_TYPE_INTEGER, 0, period_start), (ADO_TYPE_INTEGER, 0, period_end)])
    if voucher:
        conditions.append("DCOMPRO = ?")
        parameters.append((ADO_TYPE_VARCHAR, 2, voucher))
    if document_type:
        conditions.append("DTIPODOC = ?")
        parameters.append((ADO_TYPE_VARCHAR, 2, document_type))
    if nit:
        conditions.append("DNIT = ?")
        parameters.append((ADO_TYPE_VARCHAR, 15, nit))
    if from_number is not None:
        conditions.append("DFECHA >= ?")
        parameters.append((ADO_TYPE_INTEGER, 0, from_number))
    if to_number is not None:
        conditions.append("DFECHA <= ?")
        parameters.append((ADO_TYPE_INTEGER, 0, to_number))
    if document:
        conditions.append("DDOCUM = ?")
        parameters.append((ADO_TYPE_VARCHAR, 12, document))

    start_at = (page - 1) * page_size + 1
    sql = (
        f"SELECT TOP {page_size + 1} START AT {start_at} "
        "DDOCUM, DDOCUMI, DNIT, DCOMPRO, DTIPODOC, DFECHA, DDETALLE, "
        "DVALOR, DMODULO, DDOCUM2, ID FROM CONDOCUM WHERE "
        + " AND ".join(conditions)
        + " ORDER BY DFECHA DESC, ID DESC"
    )
    # La lista alimenta el panel al iniciar sesión. ADO/ODBC mantiene la
    # misma consulta sin activar el callback nativo inestable de OLE DB.
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe en CONEMP.")
        rows = _query_rows(connection, sql, parameters)
        names = _third_party_names(
            connection,
            {_text(row.get("DNIT")) for row in rows[:page_size]},
        )
        total_documents, total_value = _document_totals(connection, conditions, parameters)

    has_more = len(rows) > page_size
    items = []
    for row in rows[:page_size]:
        row_nit = _text(row.get("DNIT"))
        items.append({
            "id": int(_number(row.get("ID"))),
            "fecha": _iso_date(row.get("DFECHA")),
            "comprobante": _text(row.get("DCOMPRO")),
            "tipoDocumento": _text(row.get("DTIPODOC")),
            "documento": _text(row.get("DDOCUM")),
            "documentoInterno": _text(row.get("DDOCUMI")),
            "nit": row_nit,
            "tercero": names.get(row_nit, ""),
            "detalle": _text(row.get("DDETALLE")),
            "valor": _number(row.get("DVALOR")),
            "modulo": int(_number(row.get("DMODULO"))),
            "documentoAfectado": _text(row.get("DDOCUM2")),
        })
    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "hasMore": has_more,
        "totalDocumentos": total_documents,
        "totalValor": total_value,
    }


def document_movements(
    cia: str,
    *,
    document: str,
    voucher: str,
    document_type: str,
    movement_date: str,
) -> list[dict[str, Any]]:
    """Obtiene de ``MOV01`` las partidas exactas de una cabecera seleccionada."""
    company = normalize_company_code(cia)
    document = _code(document, "documento", 12, DOCUMENT_CODE)
    voucher = _code(voucher, "comprobante", 6, SIMPLE_CODE)
    document_type = _code(document_type, "tipo documental", 2, SIMPLE_CODE)
    numeric_date = _numeric_date(movement_date, "fecha del documento")
    if not all((document, voucher, document_type, numeric_date)):
        raise ValueError("Documento, comprobante, tipo y fecha son obligatorios para ver el detalle.")
    year = int(movement_date[:4])
    month = int(movement_date[5:7])
    sql = (
        "SELECT CODIGO, NIT, NITN, TFECHA, TCOMPR, TFASE, TIPODOC, TDOCUM, "
        "TDOCUM2, TDETALLE, TVALOR, TBASE, TIVA_RET, TSEC, TUSUA, ID "
        "FROM MOV01 WHERE CONCIA = ? AND CONANO = ? AND CONMES = ? "
        "AND TDOCUM = ? AND TCOMPR = ? AND TIPODOC = ? ORDER BY TSEC, ID"
    )
    parameters = [
        (ADO_TYPE_INTEGER, 0, company),
        (ADO_TYPE_INTEGER, 0, year),
        (ADO_TYPE_INTEGER, 0, month),
        (ADO_TYPE_VARCHAR, 12, document),
        (ADO_TYPE_VARCHAR, 6, voucher),
        (ADO_TYPE_VARCHAR, 2, document_type),
    ]
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe en CONEMP.")
        rows = _query_rows(connection, sql, parameters)
        accounts = sorted({_text(row.get("CODIGO")) for row in rows if _text(row.get("CODIGO"))})
        account_names: dict[str, str] = {}
        if accounts:
            placeholders = ", ".join("?" for _ in accounts)
            account_rows = _query_rows(
                connection,
                "SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = ? AND "
                f"{CATALOG_ACCOUNT_FILTER} AND CODIGO IN ({placeholders})",
                [(ADO_TYPE_INTEGER, 0, company)]
                + [(ADO_TYPE_VARCHAR, 12, account) for account in accounts],
            )
            account_names = {
                _text(row.get("CODIGO")): _text(row.get("MNOMBRE")) for row in account_rows
            }

    items = []
    for row in rows:
        value = _number(row.get("TVALOR"))
        account = _text(row.get("CODIGO"))
        items.append({
            "id": int(_number(row.get("ID"))),
            "secuencia": int(_number(row.get("TSEC"))),
            "cuenta": account,
            "nombreCuenta": account_names.get(account, ""),
            "nit": _text(row.get("NITN")) or _text(row.get("NIT")),
            "centro": _text(row.get("TFASE")),
            "documentoAfectado": _text(row.get("TDOCUM2")),
            "concepto": _text(row.get("TDETALLE")),
            "debito": value if value > 0 else 0.0,
            "credito": abs(value) if value < 0 else 0.0,
            "base": _number(row.get("TBASE")),
            "claseFiscal": _text(row.get("TIVA_RET")),
            "usuario": _text(row.get("TUSUA")),
        })
    return items

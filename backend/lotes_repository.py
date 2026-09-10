"""Lectura de cabeceras CONMOVI y partidas CONLOTES por compañía.

La relación funcional es ``CIA + LOTE``. Ambas columnas se incluyen siempre
en las consultas para impedir que un lote de otra contabilidad aparezca en la
sesión activa, incluso si comparte el mismo código.
"""

from __future__ import annotations

from datetime import date, datetime
import re
from typing import Any, Iterable

import win32com.client

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
    normalize_company_code,
)


LOT_CODE = re.compile(r"^[A-Za-z0-9 ._/-]+$")


def _parameters(command: Any, values: Iterable[tuple[int, int, Any]]) -> None:
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


def _date_text(value: Any) -> str:
    """Convierte fechas ADO o fechas numéricas heredadas a AAAA-MM-DD."""
    if value in (None, ""):
        return ""
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    try:
        text = str(int(_number(value)))
    except (TypeError, ValueError):
        return ""
    if len(text) != 8:
        return ""
    return f"{text[:4]}-{text[4:6]}-{text[6:8]}"


def _validate_lot_code(value: str) -> str:
    value = value.strip()
    if not value or len(value) > 10 or not LOT_CODE.fullmatch(value):
        raise ValueError("El código del lote no es válido.")
    return value


def _state_label(raw: str, historical: str) -> str:
    """Presenta el código heredado sin ocultarlo cuando no está catalogado."""
    code = raw.strip().upper()
    if historical.strip().upper() in {"S", "Y", "1", "T"}:
        return "Histórico"
    labels = {
        "": "Activo",
        "A": "Activo",
        "B": "Borrador",
        "E": "Con errores",
        "V": "Verificado",
        "P": "Pendiente",
        "C": "Contabilizado",
        "N": "Anulado",
    }
    return labels.get(code, f"Estado {code}")


def list_lots(cia: str, *, page: int = 1, page_size: int = 100) -> dict[str, Any]:
    """Lista una página de CONMOVI limitada obligatoriamente por CIA."""
    company = normalize_company_code(cia)
    if page < 1 or not 1 <= page_size <= 200:
        raise ValueError("La paginación de lotes no es válida.")
    start_at = (page - 1) * page_size + 1
    sql = (
        f"SELECT TOP {page_size + 1} START AT {start_at} "
        "LOTE, NOMBRE, MES, ESTADO, USUA_I, USUA_F, FECHA, HORA, HIST, "
        "BORRAR, DEBITOS, CREDITOS, ITEMS, ARCHOK, ID "
        "FROM CONMOVI WHERE CIA = ? ORDER BY LOTE"
    )
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe en CONEMP.")
        rows = _query_rows(connection, sql, [(ADO_TYPE_INTEGER, 0, company)])

    has_more = len(rows) > page_size
    items = []
    for row in rows[:page_size]:
        state = _text(row.get("ESTADO"))
        historical = _text(row.get("HIST"))
        debit = _number(row.get("DEBITOS"))
        credit = _number(row.get("CREDITOS"))
        items.append({
            "id": int(_number(row.get("ID"))),
            "lote": _text(row.get("LOTE")),
            "nombre": _text(row.get("NOMBRE")),
            "mes": _text(row.get("MES")),
            "estadoCodigo": state,
            "estado": _state_label(state, historical),
            "usuarioInicial": _text(row.get("USUA_I")),
            "usuarioFinal": _text(row.get("USUA_F")),
            "fecha": _date_text(row.get("FECHA")),
            "hora": _text(row.get("HORA")),
            "historico": historical,
            "permiteBorrar": _text(row.get("BORRAR")),
            "debito": debit,
            "credito": credit,
            "diferencia": debit - credit,
            "items": int(_number(row.get("ITEMS"))),
            "archivoOk": _text(row.get("ARCHOK")),
        })
    return {"items": items, "page": page, "pageSize": page_size, "hasMore": has_more}


def list_lot_lines(
    cia: str,
    lot: str,
    *,
    page: int = 1,
    page_size: int = 200,
) -> dict[str, Any]:
    """Consulta CONLOTES por la misma CIA y el LOTE seleccionado."""
    company = normalize_company_code(cia)
    lot = _validate_lot_code(lot)
    if page < 1 or not 1 <= page_size <= 500:
        raise ValueError("La paginación del detalle no es válida.")
    start_at = (page - 1) * page_size + 1
    sql = (
        f"SELECT TOP {page_size + 1} START AT {start_at} "
        "CUENTA, NIT, NITN, DEBITO, CREDITO, BASE, TFASE, CONCEPTO, TCOMPR, "
        "TIPODOC, TFECHA, TDOCUM, TINCON, TDOCUM2, ID "
        "FROM CONLOTES WHERE CIA = ? AND LOTE = ? ORDER BY ID"
    )
    parameters = [
        (ADO_TYPE_INTEGER, 0, company),
        (ADO_TYPE_VARCHAR, 10, lot),
    ]
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe en CONEMP.")
        rows = _query_rows(connection, sql, parameters)
        visible_rows = rows[:page_size]
        accounts = sorted({_text(row.get("CUENTA")) for row in visible_rows if _text(row.get("CUENTA"))})
        names: dict[str, str] = {}
        if accounts:
            placeholders = ", ".join("?" for _ in accounts)
            account_rows = _query_rows(
                connection,
                "SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = ? AND "
                f"{CATALOG_ACCOUNT_FILTER} AND CODIGO IN ({placeholders})",
                [(ADO_TYPE_INTEGER, 0, company)]
                + [(ADO_TYPE_VARCHAR, 12, account) for account in accounts],
            )
            names = {_text(row.get("CODIGO")): _text(row.get("MNOMBRE")) for row in account_rows}

    items = []
    for row in visible_rows:
        account = _text(row.get("CUENTA"))
        items.append({
            "id": int(_number(row.get("ID"))),
            "cuenta": account,
            "nombreCuenta": names.get(account, ""),
            "nit": _text(row.get("NITN")) or _text(row.get("NIT")),
            "nitMovimiento": _text(row.get("NIT")),
            "debito": _number(row.get("DEBITO")),
            "credito": _number(row.get("CREDITO")),
            "base": _number(row.get("BASE")),
            "centro": _text(row.get("TFASE")),
            "concepto": _text(row.get("CONCEPTO")),
            "comprobante": _text(row.get("TCOMPR")),
            "tipoDocumento": _text(row.get("TIPODOC")),
            "fecha": _date_text(row.get("TFECHA")),
            "documento": _text(row.get("TDOCUM")),
            "inconsistencia": _text(row.get("TINCON")),
            "documentoAfectado": _text(row.get("TDOCUM2")),
        })
    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "hasMore": len(rows) > page_size,
        "pageDebit": sum(item["debito"] for item in items),
        "pageCredit": sum(item["credito"] for item in items),
    }

"""Lectura de cabeceras CONMOVI y partidas CONLOTES por compañía.

La relación funcional es ``CIA + LOTE``. Ambas columnas se incluyen siempre
en las consultas para impedir que un lote de otra contabilidad aparezca en la
sesión activa, incluso si comparte el mismo código.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Any, Iterable

import win32com.client

from .ads_repository import (
    ADO_COMMAND_TEXT,
    ADO_PARAMETER_INPUT,
    ADO_TYPE_DOUBLE,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _boolean,
    _company_exists,
    _execute,
    _number,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .accounting_lock import accounting_write_lock


LOT_CODE = re.compile(r"^[A-Za-z0-9 ._/-]+$")
NEW_LOT_CODE = re.compile(r"^[A-Za-z0-9]{4}$")
MONEY = Decimal("0.01")
ADO_TYPE_DBDATE = 133


class LotConflict(RuntimeError):
    """El lote o la partida cambió antes de completar la operación."""


class LotValidationError(ValueError):
    """La cabecera o una partida incumple las reglas contables de MOVI1."""


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


def _one(
    connection: Any,
    sql: str,
    parameters: list[tuple[int, int, Any]],
) -> dict[str, Any] | None:
    rows = _query_rows(connection, sql, parameters)
    return rows[0] if rows else None


def _money(value: Any) -> Decimal:
    try:
        amount = Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise LotValidationError("Los valores del movimiento deben ser numéricos.") from exc
    if amount < 0:
        raise LotValidationError("Débito, crédito y base no pueden ser negativos.")
    return amount


def _normalize_lot(payload: dict[str, Any], *, creating: bool) -> dict[str, Any]:
    code = str(payload.get("lote", "")).strip().upper()
    name = str(payload.get("nombre", "")).strip()
    month = str(payload.get("mes", "")).strip().zfill(2)
    user = str(payload.get("usuario", "WEB")).strip().upper() or "WEB"
    if creating and not NEW_LOT_CODE.fullmatch(code):
        raise LotValidationError("El código del lote debe tener exactamente 4 letras o números.")
    if not name or len(name) > 25:
        raise LotValidationError("La descripción del lote es obligatoria y admite máximo 25 caracteres.")
    if not month.isdigit() or not 0 <= int(month) <= 18:
        raise LotValidationError("El mes del lote debe estar entre 00 y 18.")
    if len(user) > 4:
        raise LotValidationError("El usuario del lote admite máximo 4 caracteres.")
    return {"lote": code, "nombre": name, "mes": month, "usuario": user}


def _normalize_lot_line(payload: dict[str, Any]) -> dict[str, Any]:
    movement_date = payload.get("fecha")
    if isinstance(movement_date, str):
        try:
            movement_date = date.fromisoformat(movement_date)
        except ValueError as exc:
            raise LotValidationError("La fecha del movimiento no es válida.") from exc
    if not isinstance(movement_date, date):
        raise LotValidationError("La fecha del movimiento es obligatoria.")
    data = {
        "cuenta": str(payload.get("cuenta", "")).strip(),
        "nit": str(payload.get("nit", "")).strip(),
        "centro": str(payload.get("centro", "")).strip().upper(),
        "comprobante": str(payload.get("comprobante", "")).strip().upper(),
        "tipoDocumento": str(payload.get("tipoDocumento", "")).strip().upper(),
        "documento": str(payload.get("documento", "")).strip().upper(),
        "documentoAfectado": str(payload.get("documentoAfectado", "")).strip().upper(),
        "concepto": str(payload.get("concepto", "")).strip(),
        "fecha": movement_date,
        "debito": _money(payload.get("debito")),
        "credito": _money(payload.get("credito")),
        "base": _money(payload.get("base")),
    }
    if not data["cuenta"].isdigit() or len(data["cuenta"]) > 12:
        raise LotValidationError("La cuenta debe contener entre 1 y 12 dígitos.")
    if len(data["nit"]) > 11:
        raise LotValidationError("El NIT admite máximo 11 caracteres en CONLOTES.")
    if len(data["centro"]) > 7:
        raise LotValidationError("El centro de costo admite máximo 7 caracteres.")
    if not 1 <= len(data["comprobante"]) <= 2:
        raise LotValidationError("El comprobante es obligatorio y admite máximo 2 caracteres.")
    if not 1 <= len(data["tipoDocumento"]) <= 2:
        raise LotValidationError("El tipo de documento es obligatorio y admite máximo 2 caracteres.")
    if not data["documento"] or len(data["documento"]) > 12:
        raise LotValidationError("El número de documento es obligatorio y admite máximo 12 caracteres.")
    if len(data["documentoAfectado"]) > 12:
        raise LotValidationError("El documento afectado admite máximo 12 caracteres.")
    if not data["concepto"] or len(data["concepto"]) > 50:
        raise LotValidationError("El concepto es obligatorio y admite máximo 50 caracteres.")
    if data["debito"] > 0 and data["credito"] > 0:
        raise LotValidationError("Una partida no puede tener débito y crédito simultáneamente.")
    if data["debito"] == 0 and data["credito"] == 0:
        raise LotValidationError("La partida debe tener un valor débito o crédito.")
    return data


def _next_id(connection: Any, table: str) -> int:
    row = _one(connection, f"SELECT MAX(ID) AS MAX_ID FROM {table}", [])
    return int(_number(row.get("MAX_ID"))) + 1 if row else 1


def _editable_lot(connection: Any, company: int, lot: str) -> dict[str, Any]:
    row = _one(
        connection,
        "SELECT TOP 1 LOTE, MES, ESTADO, HIST, USUA_I FROM CONMOVI "
        "WHERE CIA = ? AND LOTE = ?",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, lot)],
    )
    if row is None:
        raise LotConflict(f"El lote {lot} no existe para la compañía activa.")
    if _text(row.get("HIST")).strip() or _text(row.get("ESTADO")).strip().upper() in {"C", "N"}:
        raise LotValidationError("El lote está contabilizado, anulado o histórico y no se puede modificar.")
    return row


def _validate_line_masters(
    connection: Any, company: int, lot_row: dict[str, Any], data: dict[str, Any]
) -> None:
    lot_month = _text(lot_row.get("MES")).strip().zfill(2)
    actual_month = data["fecha"].month
    expected_month = int(lot_month) - 12 if lot_month.isdigit() and int(lot_month) > 12 else int(lot_month or 0)
    if expected_month and actual_month != expected_month:
        raise LotValidationError(
            f"La fecha debe corresponder al mes {expected_month:02d} definido en el lote."
        )
    month_field = f"CT{actual_month:02d}"
    control = _one(
        connection,
        f"SELECT TOP 1 CTANO, {month_field} AS HABILITADO FROM CONCTR",
        [],
    )
    if control is None:
        raise LotValidationError("No existe configuración contable en CONCTR.")
    if int(_number(control.get("CTANO"))) != data["fecha"].year:
        raise LotValidationError("La fecha no pertenece al ejercicio activo en CONCTR.")
    if not _boolean(control.get("HABILITADO")):
        raise LotValidationError(f"El mes {actual_month:02d} no está habilitado en CONCTR.")

    account = _one(
        connection,
        "SELECT TOP 1 MTC, MCTAPAGOS, MCOSTOS, MIVA_RET FROM CONMAE "
        f"WHERE CIA = ? AND CODIGO = ? AND {CATALOG_ACCOUNT_FILTER}",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, data["cuenta"])],
    )
    if account is None:
        raise LotValidationError("La cuenta no existe para la compañía activa.")
    if not _boolean(account.get("MTC")):
        raise LotValidationError("La cuenta no permite movimiento contable.")
    fiscal = _text(account.get("MIVA_RET")).strip().upper()
    requires_third = _boolean(account.get("MCTAPAGOS")) or fiscal in {"I", "R"}
    requires_center = _boolean(account.get("MCOSTOS"))
    if requires_third and not data["nit"]:
        raise LotValidationError("La cuenta seleccionada requiere tercero.")
    if not requires_third and data["nit"]:
        raise LotValidationError("La cuenta seleccionada no maneja tercero.")
    if data["nit"] and _one(
        connection,
        "SELECT TOP 1 CCODIGO FROM FADCLI WHERE CCODIGO = ?",
        [(ADO_TYPE_VARCHAR, 15, data["nit"])],
    ) is None:
        raise LotValidationError("El tercero no existe en FADCLI.")
    if requires_center and not data["centro"]:
        raise LotValidationError("La cuenta seleccionada requiere centro de costo.")
    if not requires_center and data["centro"]:
        raise LotValidationError("La cuenta seleccionada no maneja centro de costo.")
    if data["centro"] and _one(
        connection,
        "SELECT TOP 1 CODIGO FROM CONCECOS WHERE CIA = ? AND CODIGO = ?",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 7, data["centro"])],
    ) is None:
        raise LotValidationError("El centro de costo no existe para la compañía activa.")
    if fiscal in {"I", "R"} and data["base"] <= 0:
        raise LotValidationError("La cuenta de IVA o retención requiere una base.")
    if _one(
        connection,
        "SELECT TOP 1 CODIGO FROM CONTICOM WHERE CIA = ? AND CODIGO = ?",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 2, data["comprobante"])],
    ) is None:
        raise LotValidationError("El comprobante no existe para la compañía activa.")
    if _one(
        connection,
        "SELECT TOP 1 CODIGO FROM VISDOCUM WHERE CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, data["tipoDocumento"])],
    ) is None:
        raise LotValidationError("El tipo de documento no existe en VISDOCUM.")


def _refresh_lot_totals(connection: Any, company: int, lot: str) -> None:
    totals = _one(
        connection,
        "SELECT COUNT(*) AS ITEMS, COALESCE(SUM(DEBITO), 0) AS DEBITOS, "
        "COALESCE(SUM(CREDITO), 0) AS CREDITOS FROM CONLOTES WHERE CIA = ? AND LOTE = ?",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, lot)],
    ) or {}
    _execute(
        connection,
        "UPDATE CONMOVI SET ITEMS = ?, DEBITOS = ?, CREDITOS = ?, ESTADO = ? "
        "WHERE CIA = ? AND LOTE = ?",
        [
            (ADO_TYPE_INTEGER, 0, int(_number(totals.get("ITEMS")))),
            (ADO_TYPE_DOUBLE, 0, _number(totals.get("DEBITOS"))),
            (ADO_TYPE_DOUBLE, 0, _number(totals.get("CREDITOS"))),
            (ADO_TYPE_VARCHAR, 1, "B"),
            (ADO_TYPE_INTEGER, 0, company),
            (ADO_TYPE_VARCHAR, 10, lot),
        ],
    )


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


def create_lot(
    cia: str, payload: dict[str, Any], *, dry_run: bool = False
) -> dict[str, Any]:
    """Crea la cabecera equivalente a ``CREALOT2``/``GRABALOT`` de MOVI1."""
    company = normalize_company_code(cia)
    data = _normalize_lot(payload, creating=True)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe en CONEMP.")
        if _one(
            connection,
            "SELECT TOP 1 ID FROM CONMOVI WHERE CIA = ? AND LOTE = ?",
            [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, data["lote"])],
        ) is not None:
            raise LotConflict(f"El lote {data['lote']} ya existe para la compañía activa.")
        connection.BeginTrans()
        try:
            lot_id = _next_id(connection, "CONMOVI")
            _execute(
                connection,
                "INSERT INTO CONMOVI (CIA, LOTE, NOMBRE, MES, ESTADO, USUA_I, USUA_F, "
                "FECHA, HORA, HIST, BORRAR, DEBITOS, CREDITOS, ITEMS, ARCHOK, ID) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_INTEGER, 0, company),
                    (ADO_TYPE_VARCHAR, 10, data["lote"]),
                    (ADO_TYPE_VARCHAR, 35, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 2, data["mes"]),
                    (ADO_TYPE_VARCHAR, 1, "B"),
                    (ADO_TYPE_VARCHAR, 4, data["usuario"]),
                    (ADO_TYPE_VARCHAR, 4, ""),
                    # ADODB exige un datetime/pywintypes time; adDBDate guarda
                    # únicamente la parte de fecha en CONMOVI.FECHA.
                    (ADO_TYPE_DBDATE, 0, datetime.now()),
                    (ADO_TYPE_VARCHAR, 8, datetime.now().strftime("%H:%M:%S")),
                    (ADO_TYPE_VARCHAR, 1, ""),
                    (ADO_TYPE_VARCHAR, 1, ""),
                    (ADO_TYPE_DOUBLE, 0, 0.0),
                    (ADO_TYPE_DOUBLE, 0, 0.0),
                    (ADO_TYPE_INTEGER, 0, 0),
                    (ADO_TYPE_VARCHAR, 1, "S"),
                    (ADO_TYPE_INTEGER, 0, lot_id),
                ],
            )
            if dry_run:
                connection.RollbackTrans()
            else:
                connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    return {"id": lot_id, **data, "estado": "Borrador", "items": 0, "debito": 0, "credito": 0}


def update_lot(cia: str, lot: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Modifica descripción, mes y responsable sin cambiar CIA ni código."""
    company = normalize_company_code(cia)
    lot = _validate_lot_code(lot)
    data = _normalize_lot({**payload, "lote": lot}, creating=False)
    with accounting_write_lock, ads_odbc_connection() as connection:
        current = _editable_lot(connection, company, lot)
        current_month = _text(current.get("MES")).strip().zfill(2)
        if data["mes"] != current_month:
            count = _one(
                connection,
                "SELECT COUNT(*) AS N FROM CONLOTES WHERE CIA = ? AND LOTE = ?",
                [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, lot)],
            )
            if count and int(_number(count.get("N"))) > 0:
                raise LotValidationError("No se puede cambiar el mes de un lote que ya tiene partidas.")
        _execute(
            connection,
            "UPDATE CONMOVI SET NOMBRE = ?, MES = ?, USUA_I = ? WHERE CIA = ? AND LOTE = ?",
            [
                (ADO_TYPE_VARCHAR, 35, data["nombre"]),
                (ADO_TYPE_VARCHAR, 2, data["mes"]),
                (ADO_TYPE_VARCHAR, 4, data["usuario"]),
                (ADO_TYPE_INTEGER, 0, company),
                (ADO_TYPE_VARCHAR, 10, lot),
            ],
        )
    return {**data, "estado": "Borrador"}


def save_lot_line(
    cia: str,
    lot: str,
    payload: dict[str, Any],
    *,
    line_id: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Agrega o modifica una partida de CONLOTES con las reglas de EDITACELDA."""
    company = normalize_company_code(cia)
    lot = _validate_lot_code(lot)
    data = _normalize_lot_line(payload)
    with accounting_write_lock, ads_odbc_connection() as connection:
        lot_row = _editable_lot(connection, company, lot)
        _validate_line_masters(connection, company, lot_row, data)
        if line_id is not None and _one(
            connection,
            "SELECT TOP 1 ID FROM CONLOTES WHERE CIA = ? AND LOTE = ? AND ID = ?",
            [
                (ADO_TYPE_INTEGER, 0, company),
                (ADO_TYPE_VARCHAR, 10, lot),
                (ADO_TYPE_INTEGER, 0, line_id),
            ],
        ) is None:
            raise LotConflict("La partida ya no existe en el lote.")
        connection.BeginTrans()
        try:
            numeric_date = int(data["fecha"].strftime("%Y%m%d"))
            values = [
                (ADO_TYPE_VARCHAR, 12, data["cuenta"]),
                (ADO_TYPE_VARCHAR, 11, data["nit"]),
                (ADO_TYPE_DOUBLE, 0, float(data["debito"])),
                (ADO_TYPE_DOUBLE, 0, float(data["credito"])),
                (ADO_TYPE_DOUBLE, 0, float(data["base"])),
                (ADO_TYPE_VARCHAR, 7, data["centro"]),
                (ADO_TYPE_VARCHAR, 51, data["concepto"]),
                (ADO_TYPE_VARCHAR, 2, data["comprobante"]),
                (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
                (ADO_TYPE_INTEGER, 0, numeric_date),
                (ADO_TYPE_VARCHAR, 12, data["documento"]),
                (ADO_TYPE_VARCHAR, 1, ""),
                (ADO_TYPE_VARCHAR, 12, data["documentoAfectado"]),
                (ADO_TYPE_VARCHAR, 15, data["nit"]),
            ]
            if line_id is None:
                line_id = _next_id(connection, "CONLOTES")
                _execute(
                    connection,
                    "INSERT INTO CONLOTES (CIA, LOTE, CUENTA, NIT, DEBITO, CREDITO, BASE, "
                    "TFASE, CONCEPTO, TCOMPR, TIPODOC, TFECHA, TDOCUM, TINCON, TDOCUM2, NITN, ID) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, lot)]
                    + values
                    + [(ADO_TYPE_INTEGER, 0, line_id)],
                )
            else:
                _execute(
                    connection,
                    "UPDATE CONLOTES SET CUENTA = ?, NIT = ?, DEBITO = ?, CREDITO = ?, "
                    "BASE = ?, TFASE = ?, CONCEPTO = ?, TCOMPR = ?, TIPODOC = ?, TFECHA = ?, "
                    "TDOCUM = ?, TINCON = ?, TDOCUM2 = ?, NITN = ? "
                    "WHERE CIA = ? AND LOTE = ? AND ID = ?",
                    values
                    + [
                        (ADO_TYPE_INTEGER, 0, company),
                        (ADO_TYPE_VARCHAR, 10, lot),
                        (ADO_TYPE_INTEGER, 0, line_id),
                    ],
                )
            _refresh_lot_totals(connection, company, lot)
            if dry_run:
                connection.RollbackTrans()
            else:
                connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    return {"id": line_id, **data, "fecha": data["fecha"].isoformat()}


def delete_lot_line(cia: str, lot: str, line_id: int) -> None:
    """Elimina una partida aún no contabilizada y recalcula la cabecera."""
    company = normalize_company_code(cia)
    lot = _validate_lot_code(lot)
    with accounting_write_lock, ads_odbc_connection() as connection:
        _editable_lot(connection, company, lot)
        connection.BeginTrans()
        try:
            existing = _one(
                connection,
                "SELECT TOP 1 ID FROM CONLOTES WHERE CIA = ? AND LOTE = ? AND ID = ?",
                [
                    (ADO_TYPE_INTEGER, 0, company),
                    (ADO_TYPE_VARCHAR, 10, lot),
                    (ADO_TYPE_INTEGER, 0, line_id),
                ],
            )
            if existing is None:
                raise LotConflict("La partida ya no existe en el lote.")
            _execute(
                connection,
                "DELETE FROM CONLOTES WHERE CIA = ? AND LOTE = ? AND ID = ?",
                [
                    (ADO_TYPE_INTEGER, 0, company),
                    (ADO_TYPE_VARCHAR, 10, lot),
                    (ADO_TYPE_INTEGER, 0, line_id),
                ],
            )
            _refresh_lot_totals(connection, company, lot)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise

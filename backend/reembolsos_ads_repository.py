"""Reembolsos Harbour (REEMBOL01) sobre las tablas reales de Advantage.

CONREMAE guarda la cabecera y CONREITE los gastos. CONTAB_REEM no publica
directamente en MOV01: convierte cada gasto, usando DEB01/CRE01 y DEB02/CRE02
de los dos tipos de VISDOCUM, en partidas de un lote CONMOVI/CONLOTES. Ese lote
queda en borrador para verificación y actualización por el flujo existente.

Las tablas heredadas se ampliaron con CIA nullable. Solo se leen/escriben filas
con CIA de la sesión; las filas antiguas con CIA NULL se conservan sin atribuir.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _boolean,
    _company_exists,
    _execute,
    _number,
    _text,
    ads_odbc_connection,
    normalize_company_code,
)
from .lotes_repository import _next_id, _one, _query_rows, _refresh_lot_totals
from .visdocum_sucursal import VISDOCUM_SUCURSAL


CODE = re.compile(r"^[A-Za-z0-9._-]{1,12}$")
LOT_CODE = re.compile(r"^[A-Za-z0-9]{4}$")
MONEY = Decimal("0.01")
ADO_TYPE_DBDATE = 133  # ADODB: adDBDate, mismo tipo usado en CONMOVI.FECHA.


class ReembolsoError(ValueError):
    """Dato inválido o configuración contable insuficiente (HTTP 422)."""


class ReembolsoConflicto(RuntimeError):
    """Reembolso ya aplicado, código repetido o lote ocupado (HTTP 409)."""


class ReembolsoNoEncontrado(RuntimeError):
    """El código no corresponde a la compañía activa (HTTP 404)."""


def _code(value: Any, label: str, maximum: int = 12) -> str:
    code = _text(value).upper()
    if len(code) > maximum or not CODE.fullmatch(code):
        raise ReembolsoError(f"{label} debe contener de 1 a {maximum} letras o números.")
    return code


def _date(value: Any) -> date:
    try:
        result = value if isinstance(value, date) else date.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise ReembolsoError("La fecha del reembolso no es válida.") from exc
    return result


def _money(value: Any, label: str) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(MONEY)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ReembolsoError(f"{label} debe ser un valor numérico.") from exc
    if not amount.is_finite() or amount <= 0:
        raise ReembolsoError(f"{label} debe ser mayor que cero.")
    return amount


def _fecha_iso(value: Any) -> str:
    try:
        return date.fromisoformat(str(int(_number(value)))).isoformat()
    except ValueError:
        text = str(int(_number(value)))
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}" if len(text) == 8 else ""


def _normalize(payload: dict[str, Any]) -> dict[str, Any]:
    header = payload.get("encabezado")
    details = payload.get("items")
    if not isinstance(header, dict) or not isinstance(details, list) or not 1 <= len(details) <= 200:
        raise ReembolsoError("El reembolso necesita encabezado y entre 1 y 200 ítems.")
    fecha = _date(header.get("fecha"))
    concepto = _text(header.get("concepto"))
    if not concepto or len(concepto) > 50:
        raise ReembolsoError("El concepto general es obligatorio y admite máximo 50 caracteres.")
    total = _money(header.get("valorGeneral"), "El valor general")
    items: list[dict[str, Any]] = []
    for index, raw in enumerate(details, 1):
        if not isinstance(raw, dict):
            raise ReembolsoError(f"El ítem {index} no tiene un formato válido.")
        nit = _text(raw.get("tercero"))
        centro = _text(raw.get("centro")).upper()
        centro_cruce = _text(raw.get("centroCruce")).upper()
        detalle = _text(raw.get("concepto"))
        if not nit or len(nit) > 11:
            raise ReembolsoError(f"El tercero del ítem {index} es obligatorio y admite máximo 11 caracteres para el lote.")
        if not centro or len(centro) > 7 or not centro_cruce or len(centro_cruce) > 7:
            raise ReembolsoError(f"Los dos centros de costo del ítem {index} son obligatorios y admiten máximo 7 caracteres.")
        if not detalle or len(detalle) > 100:
            raise ReembolsoError(f"El concepto del ítem {index} es obligatorio y admite máximo 100 caracteres.")
        items.append({
            "tercero": nit, "centro": centro, "centroCruce": centro_cruce,
            "concepto": detalle, "valor": _money(raw.get("valor"), f"El valor del ítem {index}"),
        })
    sum_items = sum((item["valor"] for item in items), Decimal(0))
    if sum_items != total:
        raise ReembolsoError(f"El valor general ({total}) debe coincidir con los ítems ({sum_items}).")
    return {
        "lote": _code(header.get("lote"), "El código de reembolso"),
        "fecha": fecha,
        "concepto": concepto,
        "valorGeneral": total,
        "documentoCaja": _code(header.get("documentoCaja"), "El tipo de documento de caja", 2),
        "documentoCruce": _code(header.get("documentoCruce"), "El tipo de documento de cruce", 2),
        "comprobante": _code(header.get("comprobante"), "El comprobante", 2),
        "items": items,
    }


def _header(connection: Any, company: int, lote: str) -> dict[str, Any] | None:
    return _one(
        connection,
        "SELECT TOP 1 RMLOTE, RMFECHA, RMCONCEP, RMVLRTOT, RMCODCON, "
        "RMTDOCUM, RMTCOMPR, RMACTU FROM CONREMAE WHERE CIA = ? AND RMLOTE = ?",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, lote)],
    )


def _validate_masters(connection: Any, company: int, data: dict[str, Any]) -> None:
    if not _company_exists(connection, company):
        raise CompanyNotFound(f"La compañía {company:03d} no existe.")
    month = data["fecha"].month
    control = _one(connection, f"SELECT TOP 1 CTANO, CT{month:02d} AS ABIERTO FROM CONCTR", [])
    if control is None or int(_number(control.get("CTANO"))) != data["fecha"].year:
        raise ReembolsoError("La fecha no pertenece al ejercicio contable activo.")
    if not _boolean(control.get("ABIERTO")):
        raise ReembolsoError(f"El mes {month:02d} no está habilitado para movimientos.")
    if _one(
        connection, "SELECT TOP 1 CODIGO FROM CONTICOM WHERE CIA = ? AND CODIGO = ?",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 2, data["comprobante"])],
    ) is None:
        raise ReembolsoError("El comprobante no existe para la compañía activa.")
    for field, label in (("documentoCaja", "caja"), ("documentoCruce", "cruce")):
        if _document_type(connection, data[field]) is None:
            raise ReembolsoError(f"El tipo de documento de {label} no existe en la sucursal 1.")
    for nit in {item["tercero"] for item in data["items"]}:
        third = _one(
            connection, "SELECT TOP 1 CESTADO FROM FADCLI WHERE CCODIGO = ?",
            [(ADO_TYPE_VARCHAR, 15, nit)],
        )
        if third is None:
            raise ReembolsoError(f"El tercero {nit} no existe.")
        if int(_number(third.get("CESTADO"))) == 4:
            raise ReembolsoError(f"El tercero {nit} está inactivo y no admite movimientos.")
    for center in {c for item in data["items"] for c in (item["centro"], item["centroCruce"])}:
        if _one(
            connection, "SELECT TOP 1 CODIGO FROM CONCECOS WHERE CIA = ? AND CODIGO = ?",
            [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 7, center)],
        ) is None:
            raise ReembolsoError(f"El centro de costo {center} no existe para la compañía activa.")


def _document_type(connection: Any, code: str) -> dict[str, Any] | None:
    return _one(
        connection,
        f"SELECT TOP 1 CODIGO, CONSE, DEB01, CRE01, DEB02, CRE02 FROM VISDOCUM "
        f"WHERE SUC = {VISDOCUM_SUCURSAL} AND CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, code)],
    )


def list_reembolsos(cia: str) -> list[dict[str, Any]]:
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"La compañía {cia} no existe.")
        rows = _query_rows(
            connection,
            "SELECT RMLOTE, RMFECHA, RMCONCEP, RMVLRTOT, RMACTU FROM CONREMAE "
            "WHERE CIA = ? ORDER BY RMFECHA DESC, RMLOTE DESC",
            [(ADO_TYPE_INTEGER, 0, company)],
        )
    return [{
        "lote": _text(row.get("RMLOTE")), "fecha": _fecha_iso(row.get("RMFECHA")),
        "concepto": _text(row.get("RMCONCEP")), "valor": _number(row.get("RMVLRTOT")),
        "estado": "Lote generado" if _text(row.get("RMACTU")).upper() == "X" else "Borrador",
    } for row in rows]


def get_reembolso(cia: str, lote: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    lote = _code(lote, "El código de reembolso")
    with ads_odbc_connection() as connection:
        header = _header(connection, company, lote)
        if header is None:
            raise ReembolsoNoEncontrado("El reembolso no existe en la compañía activa.")
        rows = _query_rows(
            connection,
            "SELECT RITERCE, RICCOSTO, RICCOSCRU, RIDETALLE, RIVALOR "
            "FROM CONREITE WHERE CIA = ? AND RILOTE = ?",
            [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, lote)],
        )
    return {
        "encabezado": {
            "lote": _text(header.get("RMLOTE")), "fecha": _fecha_iso(header.get("RMFECHA")),
            "concepto": _text(header.get("RMCONCEP")),
            "valorGeneral": _number(header.get("RMVLRTOT")),
            "documentoCaja": _text(header.get("RMCODCON")),
            "documentoCruce": _text(header.get("RMTDOCUM")),
            "comprobante": _text(header.get("RMTCOMPR")),
        },
        "items": [{
            "tercero": _text(row.get("RITERCE")),
            "centro": _text(row.get("RICCOSTO")),
            "centroCruce": _text(row.get("RICCOSCRU")),
            "concepto": _text(row.get("RIDETALLE")),
            "valor": _number(row.get("RIVALOR")),
        } for row in rows if _text(row.get("RITERCE"))],
        "estado": "Lote generado" if _text(header.get("RMACTU")).upper() == "X" else "Borrador",
    }


def save_reembolso(
    cia: str, payload: dict[str, Any], *, original: str | None = None, dry_run: bool = False
) -> dict[str, Any]:
    company = normalize_company_code(cia)
    data = _normalize(payload)
    if original is not None and _code(original, "El código original") != data["lote"]:
        raise ReembolsoError("El código de un reembolso existente no se puede cambiar.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        _validate_masters(connection, company, data)
        previous = _header(connection, company, data["lote"])
        if original is None and previous is not None:
            raise ReembolsoConflicto("Ya existe un reembolso con ese código en la compañía.")
        if original is not None and previous is None:
            raise ReembolsoNoEncontrado("El reembolso no existe en la compañía activa.")
        if previous is not None and _text(previous.get("RMACTU")).upper() == "X":
            raise ReembolsoConflicto("Este reembolso ya generó un lote y no admite cambios.")
        connection.BeginTrans()
        try:
            header_params = [
                (ADO_TYPE_VARCHAR, 50, data["concepto"]),
                (ADO_TYPE_DOUBLE, 0, float(int(data["fecha"].strftime("%Y%m%d")))),
                (ADO_TYPE_DOUBLE, 0, float(data["valorGeneral"])),
                (ADO_TYPE_VARCHAR, 2, data["documentoCaja"]),
                (ADO_TYPE_VARCHAR, 2, data["documentoCruce"]),
                (ADO_TYPE_VARCHAR, 2, data["comprobante"]),
            ]
            if previous is None:
                _execute(
                    connection,
                    "INSERT INTO CONREMAE (CIA, RMLOTE, RMCONCEP, RMFECHA, RMVLRTOT, "
                    "RMCODCON, RMTDOCUM, RMTCOMPR, RMACTU) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, data["lote"]),
                     *header_params, (ADO_TYPE_VARCHAR, 1, "")],
                )
            else:
                _execute(
                    connection,
                    "UPDATE CONREMAE SET RMCONCEP = ?, RMFECHA = ?, RMVLRTOT = ?, "
                    "RMCODCON = ?, RMTDOCUM = ?, RMTCOMPR = ? WHERE CIA = ? AND RMLOTE = ?",
                    [*header_params, (ADO_TYPE_INTEGER, 0, company),
                     (ADO_TYPE_VARCHAR, 12, data["lote"])],
                )
                _execute(
                    connection, "DELETE FROM CONREITE WHERE CIA = ? AND RILOTE = ?",
                    [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, data["lote"])],
                )
            for item in data["items"]:
                _execute(
                    connection,
                    "INSERT INTO CONREITE (CIA, RILOTE, RIFECHA, RIDETALLE, RICCOSTO, "
                    "RITERCE, RIVALOR, RICCOSCRU) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        (ADO_TYPE_INTEGER, 0, company),
                        (ADO_TYPE_VARCHAR, 12, data["lote"]),
                        (ADO_TYPE_DOUBLE, 0, float(int(data["fecha"].strftime("%Y%m%d")))),
                        (ADO_TYPE_VARCHAR, 100, item["concepto"]),
                        (ADO_TYPE_VARCHAR, 7, item["centro"]),
                        (ADO_TYPE_VARCHAR, 15, item["tercero"]),
                        (ADO_TYPE_DOUBLE, 0, float(item["valor"])),
                        (ADO_TYPE_VARCHAR, 7, item["centroCruce"]),
                    ],
                )
            if dry_run:
                connection.RollbackTrans()
            else:
                connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {"lote": data["lote"], "estado": "Borrador", "items": len(data["items"]), "valor": float(data["valorGeneral"]), "dryRun": dry_run}


def _account(connection: Any, company: int, code: str) -> dict[str, Any]:
    row = _one(
        connection,
        "SELECT TOP 1 MTC, MCTAPAGOS, MCOSTOS, MIVA_RET FROM CONMAE "
        f"WHERE CIA = ? AND CODIGO = ? AND {CATALOG_ACCOUNT_FILTER}",
        [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, code)],
    )
    if row is None or not _boolean(row.get("MTC")):
        raise ReembolsoError(f"La cuenta {code} no existe o no admite movimientos en esta compañía.")
    if _text(row.get("MIVA_RET")).upper() in {"I", "R"}:
        raise ReembolsoError(f"La cuenta fiscal {code} requiere base y no puede generarse automáticamente desde reembolsos.")
    return row


def _build_lines(
    connection: Any, company: int, data: dict[str, Any], lot: str
) -> tuple[list[dict[str, Any]], int, int, str]:
    """Equivalente de las cuatro llamadas ACTULOT por ítem en CONTAB_REEM."""
    cash = _document_type(connection, data["documentoCaja"])
    cross = _document_type(connection, data["documentoCruce"])
    if cash is None or cross is None:
        raise ReembolsoError("Los tipos documentales del reembolso no existen en la sucursal 1.")
    if data["documentoCaja"] == data["documentoCruce"]:
        raise ReembolsoError("El documento de caja y el de cruce deben ser distintos para controlar sus consecutivos.")
    for doc, label in ((cash, "caja"), (cross, "cruce")):
        if not any(_text(doc.get(field)) for field in ("DEB01", "CRE01", "DEB02", "CRE02")):
            raise ReembolsoError(
                f"El tipo de documento de {label} ({_text(doc.get('CODIGO'))}) no tiene cuentas débito/crédito configuradas."
            )
    vision_rows = _query_rows(connection, "SELECT CTCODCIA, CTPRESOP, CTCONSOP FROM VISION", [])
    vision = next((row for row in vision_rows if _text(row.get("CTCODCIA")).zfill(3) == f"{company:03d}"), None)
    if vision is None and len(vision_rows) == 1:
        vision = vision_rows[0]  # instalación heredada con un único consecutivo global
    if vision is None:
        raise ReembolsoError("No se pudo identificar el consecutivo de reembolsos de la compañía.")
    prefix = _text(vision.get("CTPRESOP"))
    start = int(_number(vision.get("CTCONSOP")))
    cross_number = f"{data['documentoCruce']}{int(_number(cross.get('CONSE'))) + 1}"
    if len(cross_number) > 12:
        raise ReembolsoError("El consecutivo del documento de cruce excede 12 caracteres.")
    accounts: dict[str, dict[str, Any]] = {}
    result: list[dict[str, Any]] = []
    for number, item in enumerate(data["items"], 1):
        cash_number = f"{prefix}{start + number}"
        if len(cash_number) > 12:
            raise ReembolsoError("El consecutivo del documento de caja excede 12 caracteres.")
        for doc, doc_code, document, center, concept in (
            (cash, data["documentoCaja"], cash_number, item["centro"], item["concepto"]),
            (cross, data["documentoCruce"], cross_number, item["centroCruce"], data["concepto"]),
        ):
            for field, debit in (("DEB01", True), ("CRE01", False), ("DEB02", True), ("CRE02", False)):
                code = _text(doc.get(field))
                if not code:
                    continue
                if code not in accounts:
                    accounts[code] = _account(connection, company, code)
                account = accounts[code]
                requires_third = _boolean(account.get("MCTAPAGOS"))
                requires_center = _boolean(account.get("MCOSTOS"))
                result.append({
                    "cuenta": code,
                    "nit": item["tercero"] if requires_third else "",
                    "centro": center if requires_center else "",
                    "comprobante": data["comprobante"],
                    "tipoDocumento": doc_code,
                    "documento": document,
                    "fecha": data["fecha"],
                    "concepto": concept[:50],
                    "debito": float(item["valor"]) if debit else 0.0,
                    "credito": 0.0 if debit else float(item["valor"]),
                })
    debits = sum((Decimal(str(line["debito"])) for line in result), Decimal(0))
    credits = sum((Decimal(str(line["credito"])) for line in result), Decimal(0))
    if not result or debits != credits:
        raise ReembolsoError(
            f"La configuración de cuentas no cuadra el lote: débitos {debits}, créditos {credits}."
        )
    # El código del lote va en CONMOVI y CONLOTES; se comprueba antes de escribir.
    if _one(connection, "SELECT TOP 1 ID FROM CONMOVI WHERE CIA = ? AND LOTE = ?", [
        (ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, lot),
    ]) is not None:
        raise ReembolsoConflicto(f"Ya existe el lote contable {lot} en esta compañía.")
    return result, start, int(_number(cross.get("CONSE"))), _text(vision.get("CTCODCIA"))


def confirmar_reembolso(cia: str, lote_reembolso: str, lote_contable: str, usuario: str, *, dry_run: bool = False) -> dict[str, Any]:
    company = normalize_company_code(cia)
    lote_reembolso = _code(lote_reembolso, "El código de reembolso")
    lote_contable = _text(lote_contable).upper()
    if not LOT_CODE.fullmatch(lote_contable):
        raise ReembolsoError("El lote contable debe tener exactamente 4 letras o números.")
    usuario = _text(usuario).upper() or "WEB"
    if len(usuario) > 4:
        raise ReembolsoError("El usuario admite máximo 4 caracteres.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        header = _header(connection, company, lote_reembolso)
        if header is None:
            raise ReembolsoNoEncontrado("El reembolso no existe en la compañía activa.")
        if _text(header.get("RMACTU")).upper() == "X":
            raise ReembolsoConflicto("El reembolso ya generó un lote.")
        rows = _query_rows(connection,
            "SELECT RITERCE, RICCOSTO, RICCOSCRU, RIDETALLE, RIVALOR FROM CONREITE "
            "WHERE CIA = ? AND RILOTE = ?",
            [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 12, lote_reembolso)])
        payload = {"encabezado": {
            "lote": lote_reembolso, "fecha": _fecha_iso(header.get("RMFECHA")),
            "concepto": _text(header.get("RMCONCEP")), "valorGeneral": _number(header.get("RMVLRTOT")),
            "documentoCaja": _text(header.get("RMCODCON")),
            "documentoCruce": _text(header.get("RMTDOCUM")), "comprobante": _text(header.get("RMTCOMPR")),
        }, "items": [{
            "tercero": _text(row.get("RITERCE")), "centro": _text(row.get("RICCOSTO")),
            "centroCruce": _text(row.get("RICCOSCRU")), "concepto": _text(row.get("RIDETALLE")),
            "valor": _number(row.get("RIVALOR")),
        } for row in rows if _text(row.get("RITERCE"))]}
        data = _normalize(payload)
        _validate_masters(connection, company, data)
        lines, start_counter, cross_counter, vision_code = _build_lines(connection, company, data, lote_contable)
        result = {
            "loteContable": lote_contable, "partidas": len(lines),
            "documentos": len(data["items"]) + 1,
            "debito": sum(line["debito"] for line in lines),
            "credito": sum(line["credito"] for line in lines),
            "dryRun": dry_run,
        }
        if dry_run:
            return result
        now = datetime.now()
        connection.BeginTrans()
        try:
            lot_id = _next_id(connection, "CONMOVI")
            _execute(connection,
                "INSERT INTO CONMOVI (CIA, LOTE, NOMBRE, MES, ESTADO, USUA_I, USUA_F, "
                "FECHA, HORA, HIST, BORRAR, DEBITOS, CREDITOS, ITEMS, ARCHOK, ID) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, lote_contable),
                 (ADO_TYPE_VARCHAR, 35, f"Reembolso {lote_reembolso}"[:35]),
                 (ADO_TYPE_VARCHAR, 2, f"{data['fecha'].month:02d}"),
                 (ADO_TYPE_VARCHAR, 1, "B"), (ADO_TYPE_VARCHAR, 4, usuario),
                 (ADO_TYPE_VARCHAR, 4, ""), (ADO_TYPE_DBDATE, 0, now),
                 (ADO_TYPE_VARCHAR, 8, now.strftime("%H:%M:%S")),
                 (ADO_TYPE_VARCHAR, 1, ""), (ADO_TYPE_VARCHAR, 1, ""),
                 (ADO_TYPE_DOUBLE, 0, 0.0), (ADO_TYPE_DOUBLE, 0, 0.0),
                 (ADO_TYPE_INTEGER, 0, 0), (ADO_TYPE_VARCHAR, 1, "S"),
                 (ADO_TYPE_INTEGER, 0, lot_id)])
            next_id = _next_id(connection, "CONLOTES")
            for line in lines:
                _execute(connection,
                    "INSERT INTO CONLOTES (CIA, LOTE, CUENTA, NIT, DEBITO, CREDITO, BASE, "
                    "TFASE, CONCEPTO, TCOMPR, TIPODOC, TFECHA, TDOCUM, TINCON, TDOCUM2, NITN, ID) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 10, lote_contable),
                     (ADO_TYPE_VARCHAR, 12, line["cuenta"]), (ADO_TYPE_VARCHAR, 11, line["nit"]),
                     (ADO_TYPE_DOUBLE, 0, line["debito"]), (ADO_TYPE_DOUBLE, 0, line["credito"]),
                     (ADO_TYPE_DOUBLE, 0, 0.0), (ADO_TYPE_VARCHAR, 7, line["centro"]),
                     (ADO_TYPE_VARCHAR, 51, line["concepto"]),
                     (ADO_TYPE_VARCHAR, 2, line["comprobante"]),
                     (ADO_TYPE_VARCHAR, 2, line["tipoDocumento"]),
                     (ADO_TYPE_INTEGER, 0, int(line["fecha"].strftime("%Y%m%d"))),
                     (ADO_TYPE_VARCHAR, 12, line["documento"]), (ADO_TYPE_VARCHAR, 1, ""),
                     (ADO_TYPE_VARCHAR, 12, ""), (ADO_TYPE_VARCHAR, 15, line["nit"]),
                     (ADO_TYPE_INTEGER, 0, next_id)])
                next_id += 1
            _refresh_lot_totals(connection, company, lote_contable)
            _execute(connection, "UPDATE VISION SET CTCONSOP = ? WHERE CTCODCIA = ?", [
                (ADO_TYPE_DOUBLE, 0, float(start_counter + len(data["items"]))),
                (ADO_TYPE_VARCHAR, 3, vision_code),
            ])
            _execute(connection, f"UPDATE VISDOCUM SET CONSE = ? WHERE SUC = {VISDOCUM_SUCURSAL} AND CODIGO = ?", [
                (ADO_TYPE_INTEGER, 0, cross_counter + 1),
                (ADO_TYPE_VARCHAR, 2, data["documentoCruce"]),
            ])
            _execute(connection, "UPDATE CONREMAE SET RMACTU = ? WHERE CIA = ? AND RMLOTE = ?", [
                (ADO_TYPE_VARCHAR, 1, "X"), (ADO_TYPE_INTEGER, 0, company),
                (ADO_TYPE_VARCHAR, 12, lote_reembolso),
            ])
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return result

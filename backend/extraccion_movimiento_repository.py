"""Extracción especial de movimientos a lote (ESPE06, ESPE07 y ESPE08).

Las tres variantes del legado comparten la misma transferencia; varían solo
los filtros. La operación nueva trabaja sobre MOV01 consolidado por CIA/año/mes
y confirma lote, partidas, retiro y acumulados en una transacción de ADS.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from hashlib import sha256
import json
import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, _boolean, _company_exists,
    _execute, _number, _text, ads_odbc_connection, normalize_company_code,
)
from .anulacion_repository import _recalculate_cost_centers
from .auditoria_repository import _register_third_party_event
from .lotes_repository import ADO_TYPE_DBDATE, _next_id, _one, _query_rows
from .reproceso_mensual_repository import _build_plan, _replace_balances
from .visdocum_sucursal import VISDOCUM_SUCURSAL


class ExtractionConflict(RuntimeError):
    """La selección o el lote cambió desde la vista previa."""


_CODE = re.compile(r"^[A-Za-z0-9 ._/-]+$")
_LOT = re.compile(r"^[A-Za-z0-9]{4}$")
_MODES = {"comprobante", "documentos", "completo"}


def _code(value: Any, label: str, length: int, *, required: bool = True) -> str:
    code = str(value or "").strip().upper()
    if (required and not code) or len(code) > length or (code and not _CODE.fullmatch(code)):
        raise ValueError(f"El filtro {label} no es válido.")
    return code


def _request(raw: dict[str, Any]) -> dict[str, Any]:
    company = normalize_company_code(str(raw.get("cia", "")))
    year, month = int(raw.get("anio", 0)), int(raw.get("mes", 0))
    if not 1900 <= year <= 2100 or not 1 <= month <= 12:
        raise ValueError("Seleccione un año y un mes entre 01 y 12.")
    mode = str(raw.get("modo", "")).strip().lower()
    if mode not in _MODES:
        raise ValueError("Seleccione el alcance de la extracción.")
    lot = str(raw.get("lote", "")).strip().upper()
    if not _LOT.fullmatch(lot):
        raise ValueError("El lote nuevo debe tener exactamente cuatro letras o números.")
    voucher = _code(raw.get("comprobante"), "comprobante", 2, required=mode == "comprobante")
    kind = _code(raw.get("tipoDocumento"), "tipo de documento", 2, required=mode != "completo")
    first = _code(raw.get("documentoDesde"), "documento inicial", 12, required=mode == "documentos")
    last = _code(raw.get("documentoHasta"), "documento final", 12, required=mode == "documentos")
    if mode == "documentos" and first > last:
        raise ValueError("El rango de documentos está invertido.")
    return {"cia": company, "anio": year, "mes": month, "modo": mode,
            "lote": lot, "comprobante": voucher, "tipoDocumento": kind,
            "documentoDesde": first, "documentoHasta": last}


def _selection(connection: Any, data: dict[str, Any]) -> list[dict[str, Any]]:
    where = ["CONCIA = ?", "CONANO = ?", "CONMES = ?"]
    params = [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_INTEGER, 0, data["anio"]),
              (ADO_TYPE_INTEGER, 0, data["mes"])]
    if data["modo"] == "comprobante":
        where.extend(("TCOMPR = ?", "TIPODOC = ?"))
        params.extend(((ADO_TYPE_VARCHAR, 2, data["comprobante"]),
                       (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"])))
    elif data["modo"] == "documentos":
        where.extend(("TIPODOC = ?", "TDOCUM >= ?", "TDOCUM <= ?"))
        params.extend(((ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
                       (ADO_TYPE_VARCHAR, 12, data["documentoDesde"]),
                       (ADO_TYPE_VARCHAR, 12, data["documentoHasta"])))
    return _query_rows(connection,
        "SELECT ID, CODIGO, NIT, TFASE, TVALOR, TBASE, TDETALLE, TCOMPR, "
        "TIPODOC, TFECHA, TDOCUM, TDOCUM2 FROM MOV01 WHERE " + " AND ".join(where) + " ORDER BY ID",
        params)


def _period_open(connection: Any, data: dict[str, Any]) -> None:
    if not _company_exists(connection, data["cia"]):
        raise ValueError("La compañía seleccionada no existe.")
    month_field = f"CT{data['mes']:02d}"
    period = _one(connection, f"SELECT TOP 1 CTANO, {month_field} AS HABILITADO FROM CONCTR", [])
    if not period or int(_number(period.get("CTANO"))) != data["anio"] or not _boolean(period.get("HABILITADO")):
        raise ValueError("El ejercicio o mes seleccionado no está habilitado para extracción.")
    if _one(connection, "SELECT TOP 1 ID FROM CONMOVI WHERE CIA = ? AND LOTE = ?",
            [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 10, data["lote"])]) is not None:
        raise ExtractionConflict("El lote ya existe. Elija uno nuevo.")
    if data["modo"] == "comprobante" and _one(connection,
        "SELECT TOP 1 CODIGO FROM CONTICOM WHERE CIA = ? AND CODIGO = ?",
        [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 2, data["comprobante"])]) is None:
        raise ValueError("El comprobante no existe para la compañía.")
    if data["modo"] != "completo" and _one(connection,
        f"SELECT TOP 1 CODIGO FROM VISDOCUM WHERE SUC = {VISDOCUM_SUCURSAL} AND CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, data["tipoDocumento"])]) is None:
        raise ValueError("El tipo de documento no existe.")


def _summary(rows: list[dict[str, Any]], data: dict[str, Any]) -> dict[str, Any]:
    if not rows:
        raise ValueError("No hay partidas para los filtros seleccionados.")
    digest = sha256()
    documents: dict[tuple[str, str, str, int], Decimal] = defaultdict(Decimal)
    debit = Decimal("0")
    credit = Decimal("0")
    for row in rows:
        value = Decimal(str(_number(row.get("TVALOR"))))
        if value > 0:
            debit += value
        else:
            credit -= value
        key = (_text(row.get("TCOMPR")).strip(), _text(row.get("TIPODOC")).strip(),
               _text(row.get("TDOCUM")).strip(), int(_number(row.get("TFECHA"))))
        documents[key] += value
        digest.update(json.dumps(
            [str(row.get(name) if row.get(name) is not None else "").strip() for name in
             ("ID", "CODIGO", "NIT", "TFASE", "TVALOR", "TBASE", "TDETALLE", "TCOMPR",
              "TIPODOC", "TFECHA", "TDOCUM", "TDOCUM2")], ensure_ascii=False,
            separators=(",", ":")).encode("utf-8"))
        digest.update(b"\n")
    invalid = [key for key, total in documents.items() if total.quantize(Decimal("0.01"))]
    ids = [int(_number(row.get("ID"))) for row in rows]
    if any(row_id <= 0 for row_id in ids) or len(ids) != len(set(ids)):
        raise ValueError("La selección contiene identificadores de movimiento ausentes o repetidos.")
    too_long = [row for row in rows if len(_text(row.get("NIT")).strip()) > 11]
    if too_long:
        raise ValueError("La selección contiene NIT que superan la capacidad del lote (11 caracteres). No se trasladó nada.")
    return {"compania": f"{data['cia']:03d}", "anio": data["anio"], "mes": data["mes"],
            "modo": data["modo"], "lote": data["lote"], "partidas": len(rows),
            "documentos": len(documents), "debito": round(float(debit), 2),
            "credito": round(float(credit), 2), "diferencia": round(float(debit - credit), 2),
            "documentosDescuadrados": len(invalid), "huella": digest.hexdigest(),
            "advertencias": ([f"{len(invalid)} documento(s) están descuadrados; el lote deberá corregirse antes de actualizarlo."]
                             if invalid else [])}


def _master_warnings(connection: Any, data: dict[str, Any], rows: list[dict[str, Any]]) -> list[str]:
    """Advierte catálogos ausentes sin impedir retirar movimientos históricos."""
    vouchers = {_text(row.get("TCOMPR")).strip() for row in rows}
    kinds = {_text(row.get("TIPODOC")).strip() for row in rows}
    valid_vouchers = {_text(item.get("CODIGO")).strip() for item in _query_rows(connection,
        "SELECT CODIGO FROM CONTICOM WHERE CIA = ?", [(ADO_TYPE_INTEGER, 0, data["cia"])])}
    valid_kinds = {_text(item.get("CODIGO")).strip() for item in _query_rows(connection,
        f"SELECT CODIGO FROM VISDOCUM WHERE SUC = {VISDOCUM_SUCURSAL}", [])}
    warnings = []
    if missing := sorted(vouchers - valid_vouchers):
        warnings.append("Comprobantes sin definición actual: " + ", ".join(missing[:10]) + ". Revise el lote antes de actualizarlo.")
    if missing := sorted(kinds - valid_kinds):
        warnings.append("Tipos documentales sin definición actual: " + ", ".join(missing[:10]) + ". Revise el lote antes de actualizarlo.")
    return warnings


def preview_extraction(raw: dict[str, Any]) -> dict[str, Any]:
    data = _request(raw)
    with ads_odbc_connection() as connection:
        _period_open(connection, data)
        rows = _selection(connection, data)
        result = _summary(rows, data)
        result["advertencias"].extend(_master_warnings(connection, data, rows))
        return result


def _insert_lot(connection: Any, data: dict[str, Any], summary: dict[str, Any], user: str) -> None:
    now = datetime.now()
    name = {"comprobante": "Extracción comprobante", "documentos": "Extracción documentos",
            "completo": "Extracción movimiento"}[data["modo"]]
    _execute(connection,
        "INSERT INTO CONMOVI (CIA, LOTE, NOMBRE, MES, ESTADO, USUA_I, USUA_F, "
        "FECHA, HORA, HIST, BORRAR, DEBITOS, CREDITOS, ITEMS, ARCHOK, ID) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 10, data["lote"]),
         (ADO_TYPE_VARCHAR, 35, name), (ADO_TYPE_VARCHAR, 2, f"{data['mes']:02d}"),
         (ADO_TYPE_VARCHAR, 1, "B"), (ADO_TYPE_VARCHAR, 4, user),
         (ADO_TYPE_VARCHAR, 4, ""), (ADO_TYPE_DBDATE, 0, now),
         (ADO_TYPE_VARCHAR, 8, now.strftime("%H:%M:%S")),
         (ADO_TYPE_VARCHAR, 1, ""), (ADO_TYPE_VARCHAR, 1, ""),
         (ADO_TYPE_DOUBLE, 0, summary["debito"]), (ADO_TYPE_DOUBLE, 0, summary["credito"]),
         (ADO_TYPE_INTEGER, 0, summary["partidas"]), (ADO_TYPE_VARCHAR, 1, "S"),
         (ADO_TYPE_INTEGER, 0, _next_id(connection, "CONMOVI"))])


def _insert_lines(connection: Any, data: dict[str, Any], rows: list[dict[str, Any]]) -> None:
    next_id = _next_id(connection, "CONLOTES")
    for row in rows:
        value = float(_number(row.get("TVALOR")))
        nit = _text(row.get("NIT")).strip()
        _execute(connection,
            "INSERT INTO CONLOTES (CIA, LOTE, CUENTA, NIT, DEBITO, CREDITO, BASE, "
            "TFASE, CONCEPTO, TCOMPR, TIPODOC, TFECHA, TDOCUM, TINCON, TDOCUM2, NITN, ID) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 10, data["lote"]),
             (ADO_TYPE_VARCHAR, 12, _text(row.get("CODIGO")).strip()),
             (ADO_TYPE_VARCHAR, 11, nit), (ADO_TYPE_DOUBLE, 0, max(value, 0)),
             (ADO_TYPE_DOUBLE, 0, max(-value, 0)),
             (ADO_TYPE_DOUBLE, 0, float(_number(row.get("TBASE")))),
             (ADO_TYPE_VARCHAR, 7, _text(row.get("TFASE")).strip()),
             (ADO_TYPE_VARCHAR, 51, _text(row.get("TDETALLE"))[:50]),
             (ADO_TYPE_VARCHAR, 2, _text(row.get("TCOMPR")).strip()),
             (ADO_TYPE_VARCHAR, 2, _text(row.get("TIPODOC")).strip()),
             (ADO_TYPE_INTEGER, 0, int(_number(row.get("TFECHA")))),
             (ADO_TYPE_VARCHAR, 12, _text(row.get("TDOCUM")).strip()),
             (ADO_TYPE_VARCHAR, 1, ""),
             (ADO_TYPE_VARCHAR, 12, _text(row.get("TDOCUM2")).strip()),
             (ADO_TYPE_VARCHAR, 15, nit), (ADO_TYPE_INTEGER, 0, next_id)])
        next_id += 1


def _remove_movement(connection: Any, data: dict[str, Any], rows: list[dict[str, Any]]) -> None:
    ids = [int(_number(row.get("ID"))) for row in rows]
    for offset in range(0, len(ids), 100):
        chunk = ids[offset:offset + 100]
        placeholders = ", ".join("?" for _ in chunk)
        _execute(connection,
            f"DELETE FROM MOV01 WHERE CONCIA = ? AND CONANO = ? AND CONMES = ? AND ID IN ({placeholders})",
            [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_INTEGER, 0, data["anio"]),
             (ADO_TYPE_INTEGER, 0, data["mes"]),
             *((ADO_TYPE_INTEGER, 0, row_id) for row_id in chunk)])
    headers = {(_text(row.get("TCOMPR")).strip(), _text(row.get("TIPODOC")).strip(),
                _text(row.get("TDOCUM")).strip(), int(_number(row.get("TFECHA")))) for row in rows}
    for voucher, kind, number, when in sorted(headers):
        # La cabecera solo se elimina si no quedó una partida de ese mismo
        # documento (p. ej., datos históricos parcialmente clasificados).
        remaining = _one(connection,
            "SELECT TOP 1 ID FROM MOV01 WHERE CONCIA = ? AND CONANO = ? AND CONMES = ? "
            "AND TCOMPR = ? AND TIPODOC = ? AND TDOCUM = ? AND TFECHA = ?",
            [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_INTEGER, 0, data["anio"]),
             (ADO_TYPE_INTEGER, 0, data["mes"]), (ADO_TYPE_VARCHAR, 2, voucher),
             (ADO_TYPE_VARCHAR, 2, kind), (ADO_TYPE_VARCHAR, 12, number),
             (ADO_TYPE_INTEGER, 0, when)])
        if remaining is None:
            _execute(connection,
                "DELETE FROM CONDOCUM WHERE CIA = ? AND DCOMPRO = ? AND DTIPODOC = ? "
                "AND DDOCUM = ? AND DFECHA = ?",
                [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 2, voucher),
                 (ADO_TYPE_VARCHAR, 2, kind), (ADO_TYPE_VARCHAR, 12, number),
                 (ADO_TYPE_INTEGER, 0, when)])


def confirm_extraction(raw: dict[str, Any], *, fingerprint: str, user: str, reason: str,
                       dry_run: bool = False) -> dict[str, Any]:
    data = _request(raw)
    user = _code(user, "usuario", 4)
    reason = str(reason or "").strip()
    if len(reason) < 5 or len(reason) > 180:
        raise ValueError("Indique un motivo de entre 5 y 180 caracteres.")
    if not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        raise ValueError("La vista previa ya no es válida. Consúltela nuevamente.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        connection.BeginTrans()
        try:
            _period_open(connection, data)
            rows = _selection(connection, data)
            summary = _summary(rows, data)
            summary["advertencias"].extend(_master_warnings(connection, data, rows))
            if summary["huella"] != fingerprint:
                raise ExtractionConflict("El movimiento cambió desde la vista previa. Consulte nuevamente.")
            _insert_lot(connection, data, summary, user)
            _insert_lines(connection, data, rows)
            _remove_movement(connection, data, rows)
            plan = _build_plan(connection, data["cia"], data["anio"], data["mes"], data["mes"])
            if plan.errors:
                raise ExtractionConflict("No se pudieron reconstruir los acumulados: " + " ".join(plan.errors[:3]))
            _replace_balances(connection, plan)
            centers = {(_text(row.get("CODIGO")).strip(), _text(row.get("TFASE")).strip())
                       for row in rows if _text(row.get("TFASE")).strip()}
            _recalculate_cost_centers(connection, data["cia"], data["anio"], data["mes"], centers)
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
    warning = ""
    if not dry_run:
        try:
            _register_third_party_event(user, data["lote"],
                f"Extracción {data['modo']} {data['anio']}/{data['mes']:02d}: "
                f"{summary['partidas']} partidas. Motivo: {reason}")
        except Exception as exc:
            warning = f"La extracción se confirmó, pero no pudo registrarse en la bitácora: {exc}"
    return {**summary, "estado": "Simulado" if dry_run else "Lote borrador",
            "advertenciaAuditoria": warning}

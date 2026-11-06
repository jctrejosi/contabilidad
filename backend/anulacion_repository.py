"""Anulacion atomica de documentos contables en Advantage.

La operacion elimina la cabecera y sus partidas, y reconstruye los acumulados
del periodo a partir de los movimientos que permanecen. Recalcular, en vez de
restar importes a ciegas, evita conservar diferencias producidas por procesos
interrumpidos o acumulados previamente desactualizados.
"""

from __future__ import annotations

from datetime import date
import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _execute,
    _number,
    _text,
    ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import register_document_annulment
from .contabilizacion_repository import ACCOUNT_LEVELS, _one, _query_rows


DOCUMENT_CODE = re.compile(r"^[A-Za-z0-9 ._/-]+$")
SIMPLE_CODE = re.compile(r"^[A-Za-z0-9.-]+$")


class AnnulmentConflict(RuntimeError):
    """El documento cambio, ya fue anulado o no tiene partidas."""


class AnnulmentValidationError(ValueError):
    """La solicitud no permite una anulacion contable segura."""


def _clean_code(value: str, label: str, maximum: int, pattern: re.Pattern[str]) -> str:
    clean = value.strip()
    if not clean or len(clean) > maximum or not pattern.fullmatch(clean):
        raise AnnulmentValidationError(f"El {label} no es valido.")
    return clean


def _numeric_date(value: str) -> tuple[int, int, int]:
    try:
        parsed = date.fromisoformat(value.strip())
    except ValueError as exc:
        raise AnnulmentValidationError("La fecha del documento no es valida.") from exc
    return parsed.year, parsed.month, int(parsed.strftime("%Y%m%d"))


def _sum_movement(connection: Any, cia: int, year: int, month: int, condition: str,
                  parameters: list[tuple[int, int, Any]]) -> tuple[float, float]:
    row = _one(
        connection,
        "SELECT SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS DEBITO, "
        "SUM(CASE WHEN TVALOR < 0 THEN TVALOR ELSE 0 END) AS CREDITO "
        "FROM MOV01 WHERE CONCIA = ? AND CONANO = ? AND CONMES = ? AND " + condition,
        [
            (ADO_TYPE_INTEGER, 0, cia),
            (ADO_TYPE_INTEGER, 0, year),
            (ADO_TYPE_INTEGER, 0, month),
            *parameters,
        ],
    ) or {}
    return _number(row.get("DEBITO")), _number(row.get("CREDITO"))


def _recalculate_accounts(connection: Any, cia: int, year: int, month: int,
                          account_codes: set[str]) -> int:
    debit_field = f"MACMDEB{month:02d}"
    credit_field = f"MACMCRE{month:02d}"
    parents = {
        account[:length]
        for account in account_codes
        for length in ACCOUNT_LEVELS
        if length <= len(account)
    }
    for account in sorted(parents, key=lambda value: (len(value), value)):
        debit, credit = _sum_movement(
            connection, cia, year, month, "CODIGO LIKE ?",
            [(ADO_TYPE_VARCHAR, 13, account + "%")],
        )
        assignments = "MSALDO = ?" if month == 0 else f"{debit_field} = ?, {credit_field} = ?"
        amounts = (debit + credit,) if month == 0 else (debit, credit)
        _execute(
            connection,
            f"UPDATE CONMAE SET {assignments} "
            f"WHERE CIA = ? AND CODIGO = ? AND {CATALOG_ACCOUNT_FILTER}",
            [
                *((ADO_TYPE_DOUBLE, 0, amount) for amount in amounts),
                (ADO_TYPE_INTEGER, 0, cia),
                (ADO_TYPE_VARCHAR, 12, account),
            ],
        )
    return len(parents)


def _recalculate_third_parties(connection: Any, cia: int, year: int, month: int,
                               keys: set[tuple[str, str]]) -> int:
    debit_field = f"MACMDEB{month:02d}"
    credit_field = f"MACMCRE{month:02d}"
    for account, nit in sorted(keys):
        debit, credit = _sum_movement(
            connection, cia, year, month, "CODIGO = ? AND NIT = ?",
            [(ADO_TYPE_VARCHAR, 12, account), (ADO_TYPE_VARCHAR, 15, nit)],
        )
        assignments = "MSALDO = ?" if month == 0 else f"{debit_field} = ?, {credit_field} = ?"
        amounts = (debit + credit,) if month == 0 else (debit, credit)
        _execute(
            connection,
            f"UPDATE CONTERCE SET {assignments} "
            "WHERE CIA = ? AND CODIGO = ? AND NIT = ?",
            [
                *((ADO_TYPE_DOUBLE, 0, amount) for amount in amounts),
                (ADO_TYPE_INTEGER, 0, cia),
                (ADO_TYPE_VARCHAR, 12, account),
                (ADO_TYPE_VARCHAR, 15, nit),
            ],
        )
    return len(keys)


def _recalculate_cost_centers(connection: Any, cia: int, year: int, month: int,
                              keys: set[tuple[str, str]]) -> int:
    """Mantiene consistentes los auxiliares de centro afectados por el retiro."""
    debit_field = f"DEB{month:02d}"
    credit_field = f"CRE{month:02d}"
    for account, center in sorted(keys):
        debit, credit = _sum_movement(
            connection, cia, year, month, "CODIGO = ? AND TFASE = ?",
            [(ADO_TYPE_VARCHAR, 12, account), (ADO_TYPE_VARCHAR, 7, center)],
        )
        _execute(
            connection,
            f"UPDATE COCENTRO SET {debit_field} = ?, {credit_field} = ? "
            "WHERE CIA = ? AND CODIGO = ? AND (NIT IS NULL OR NIT = ?) AND CENTRO = ?",
            [
                (ADO_TYPE_DOUBLE, 0, debit),
                (ADO_TYPE_DOUBLE, 0, credit),
                (ADO_TYPE_INTEGER, 0, cia),
                (ADO_TYPE_VARCHAR, 12, account),
                (ADO_TYPE_VARCHAR, 15, " " * 15),
                (ADO_TYPE_VARCHAR, 7, center),
            ],
        )
    return len(keys)


def annul_document(
    cia: str,
    *,
    header_id: int,
    document: str,
    voucher: str,
    document_type: str,
    movement_date: str,
    user: str,
    reason: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Retira un documento y recalcula sus auxiliares dentro de una transaccion."""
    company = normalize_company_code(cia)
    document = _clean_code(document, "numero de documento", 12, DOCUMENT_CODE)
    voucher = _clean_code(voucher, "comprobante", 6, SIMPLE_CODE)
    document_type = _clean_code(document_type, "tipo de documento", 2, SIMPLE_CODE)
    year, month, numeric_date = _numeric_date(movement_date)
    user = user.strip()[:4] or "WEB"
    reason = reason.strip()
    if len(reason) < 5 or len(reason) > 180:
        raise AnnulmentValidationError("Indique un motivo de anulacion entre 5 y 180 caracteres.")

    audit_warning = ""
    with accounting_write_lock, ads_odbc_connection() as connection:
        transaction_started = False
        try:
            connection.BeginTrans()
            transaction_started = True
            company_row = _one(
                connection, "SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = ?",
                [(ADO_TYPE_INTEGER, 0, company)],
            )
            if company_row is None:
                raise CompanyNotFound(f"No existe la compania {company:03d}.")

            # El período 00 conserva una fecha calendario válida. El período
            # contable se obtiene del movimiento, nunca se deduce de esa fecha.
            periods = _query_rows(
                connection,
                "SELECT DISTINCT CONMES FROM MOV01 WHERE CONCIA = ? AND CONANO = ? "
                "AND TDOCUM = ? AND TCOMPR = ? AND TIPODOC = ? AND TFECHA = ?",
                [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, year),
                 (ADO_TYPE_VARCHAR, 12, document), (ADO_TYPE_VARCHAR, 6, voucher),
                 (ADO_TYPE_VARCHAR, 2, document_type), (ADO_TYPE_INTEGER, 0, numeric_date)],
            )
            if len(periods) > 1:
                raise AnnulmentConflict("El documento pertenece a varios períodos; requiere revisión.")
            if periods:
                month = int(_number(periods[0].get("CONMES")))
            if not 0 <= month <= 12:
                raise AnnulmentValidationError("El período del documento no está soportado.")
            control = _one(connection, f"SELECT TOP 1 CTANO, CT{month:02d} FROM CONCTR", [])
            if control is None or int(_number(control.get("CTANO"))) != year:
                raise AnnulmentValidationError(
                    "El documento no pertenece al ejercicio contable activo."
                )
            enabled = str(control.get(f"CT{month:02d}") or "").strip().upper()
            if enabled in {"", "0", "F", "FALSE", "N", "NO"}:
                raise AnnulmentValidationError("El periodo del documento esta cerrado.")

            header = _one(
                connection,
                "SELECT TOP 1 ID FROM CONDOCUM WHERE CIA = ? AND ID = ? AND DDOCUM = ? "
                "AND DCOMPRO = ? AND DTIPODOC = ? AND DFECHA = ?",
                [
                    (ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, int(header_id)),
                    (ADO_TYPE_VARCHAR, 12, document), (ADO_TYPE_VARCHAR, 6, voucher),
                    (ADO_TYPE_VARCHAR, 2, document_type), (ADO_TYPE_INTEGER, 0, numeric_date),
                ],
            )
            if header is None:
                raise AnnulmentConflict("El documento ya no existe o fue modificado.")

            movement_parameters = [
                (ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, year),
                (ADO_TYPE_INTEGER, 0, month), (ADO_TYPE_VARCHAR, 12, document),
                (ADO_TYPE_VARCHAR, 6, voucher), (ADO_TYPE_VARCHAR, 2, document_type),
            ]
            movements = _query_rows(
                connection,
                "SELECT CODIGO, NIT, TFASE, TVALOR FROM MOV01 WHERE CONCIA = ? "
                "AND CONANO = ? AND CONMES = ? AND TDOCUM = ? AND TCOMPR = ? "
                "AND TIPODOC = ?",
                movement_parameters,
            )
            if not movements:
                raise AnnulmentConflict("El documento no tiene partidas para anular.")

            total_debit = sum(_number(row.get("TVALOR")) for row in movements if _number(row.get("TVALOR")) > 0)
            total_credit = abs(sum(_number(row.get("TVALOR")) for row in movements if _number(row.get("TVALOR")) < 0))
            if abs(total_debit - total_credit) > 0.01:
                raise AnnulmentConflict("El documento esta descuadrado y no puede anularse automaticamente.")

            accounts = {_text(row.get("CODIGO")).strip() for row in movements if _text(row.get("CODIGO")).strip()}
            thirds = {
                (_text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip())
                for row in movements if _text(row.get("CODIGO")).strip() and _text(row.get("NIT")).strip()
            }
            centers = {
                (_text(row.get("CODIGO")).strip(), _text(row.get("TFASE")).strip())
                for row in movements if _text(row.get("CODIGO")).strip() and _text(row.get("TFASE")).strip()
            }

            _execute(
                connection,
                "DELETE FROM MOV01 WHERE CONCIA = ? AND CONANO = ? AND CONMES = ? "
                "AND TDOCUM = ? AND TCOMPR = ? AND TIPODOC = ?",
                movement_parameters,
            )
            account_count = _recalculate_accounts(connection, company, year, month, accounts)
            third_count = _recalculate_third_parties(connection, company, year, month, thirds)
            center_count = _recalculate_cost_centers(connection, company, year, month, centers)
            _execute(
                connection,
                "DELETE FROM CONDOCUM WHERE CIA = ? AND ID = ? AND DDOCUM = ? "
                "AND DCOMPRO = ? AND DTIPODOC = ? AND DFECHA = ?",
                [
                    (ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, int(header_id)),
                    (ADO_TYPE_VARCHAR, 12, document), (ADO_TYPE_VARCHAR, 6, voucher),
                    (ADO_TYPE_VARCHAR, 2, document_type), (ADO_TYPE_INTEGER, 0, numeric_date),
                ],
            )
            if dry_run:
                connection.RollbackTrans()
            else:
                connection.CommitTrans()
            transaction_started = False
        except Exception:
            if transaction_started:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
            raise

    if not dry_run:
        try:
            register_document_annulment(user, document, reason)
        except Exception as exc:  # La anulacion confirmada no puede deshacerse por la bitacora.
            audit_warning = f"La anulacion se completo, pero no fue posible registrar la bitacora: {exc}"

    return {
        "documento": document,
        "partidasRetiradas": len(movements),
        "totalDebito": round(total_debit, 2),
        "totalCredito": round(total_credit, 2),
        "cuentasRecalculadas": account_count,
        "tercerosRecalculados": third_count,
        "centrosRecalculados": center_count,
        "dryRun": dry_run,
        "advertencia": audit_warning,
    }

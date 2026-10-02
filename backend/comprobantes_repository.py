"""Consulta de comprobantes contables almacenados en CONTICOM.

CONTICOM depende de la contabilidad seleccionada. Su clave funcional es
``(CIA, CODIGO)``; nunca se consulta el catálogo sin aplicar CIA.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
    _company_exists,
    _execute,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import register_master_creation
from .lotes_repository import _one


# CONTICOM.CODIGO es de dos caracteres ('CE', 'RC', 'CP'…).
VOUCHER_CODE = re.compile(r"^[A-Za-z0-9]{1,2}$")
VOUCHER_NAME_SIZE = 40
VOUCHER_AUX_SIZE = 40


class VoucherAlreadyExists(RuntimeError):
    """Ya existe un comprobante con el mismo código en la compañía."""


class VoucherNotFound(RuntimeError):
    """No existe el comprobante pedido en la compañía."""


class VoucherValidationError(ValueError):
    """El comprobante incumple las reglas de CONTICOM/comprobantes."""


def normalize_voucher(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el alta de un comprobante (B2.2) antes del motor."""
    codigo = str(payload.get("codigo", "")).strip().upper()
    if not VOUCHER_CODE.fullmatch(codigo):
        raise VoucherValidationError(
            "El código del comprobante debe tener entre 1 y 2 letras o dígitos."
        )
    nombre = str(payload.get("nombre", "")).strip()
    if not nombre:
        raise VoucherValidationError("El nombre del comprobante es obligatorio.")
    if len(nombre) > VOUCHER_NAME_SIZE:
        raise VoucherValidationError(
            f"El nombre del comprobante admite máximo {VOUCHER_NAME_SIZE} caracteres."
        )
    descripcion = str(payload.get("descripcionAuxiliar", "") or "").strip()
    if len(descripcion) > VOUCHER_AUX_SIZE:
        raise VoucherValidationError(
            f"La descripción auxiliar admite máximo {VOUCHER_AUX_SIZE} caracteres."
        )
    return {"codigo": codigo, "nombre": nombre, "descripcionAuxiliar": descripcion}


def voucher_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento devuelto por el alta; ecoa el contrato de ``VoucherCreate``."""
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "descripcionAuxiliar": data["descripcionAuxiliar"],
    }


def _voucher_exists(connection: Any, company_id: int, code: str) -> bool:
    """¿Existe el comprobante dentro de la compañía en CONTICOM?"""
    return _one(
        connection,
        "SELECT TOP 1 CODIGO FROM CONTICOM WHERE CIA = ? AND CODIGO = ?",
        [(ADO_TYPE_INTEGER, 0, company_id), (ADO_TYPE_VARCHAR, 2, code)],
    ) is not None


def _voucher_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Mapea los cuatro campos propios de CONTICOM sin agregar reglas ficticias."""
    history_flag = _text(row.get("HIST"))
    return {
        "codigo": _text(row.get("CODIGO")),
        "nombre": _text(row.get("NOMBRE")),
        "hist": history_flag,
        "historico": history_flag.upper() in {"S", "Y", "1", "T"},
        "descripcionAuxiliar": _text(row.get("CTABDES")),
    }


def list_vouchers(company_code: str) -> list[dict[str, Any]]:
    """Devuelve únicamente los comprobantes de la compañía solicitada."""
    company_id = normalize_company_code(company_code)
    sql = (
        "SELECT CODIGO, NOMBRE, HIST, CTABDES FROM CONTICOM "
        f"WHERE CIA = {company_id} ORDER BY CODIGO"
    )
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        recordset = _open_recordset(connection, sql)
        try:
            return [_voucher_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()


def create_voucher(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un comprobante de la compañía activa (B2.2).

    No crea consecutivo: vive en ``consecutivos_comprobantes`` por compañía, año
    y comprobante y lo inicializa la primera contabilización.
    """
    data = normalize_voucher(payload)
    company_id = normalize_company_code(company_code)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        if _voucher_exists(connection, company_id, data["codigo"]):
            raise VoucherAlreadyExists(
                f"Ya existe el comprobante {data['codigo']} en la compañía {company_code}."
            )
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONTICOM (CIA, CODIGO, NOMBRE, CTABDES) VALUES (?, ?, ?, ?)",
                [
                    (ADO_TYPE_INTEGER, 0, company_id),
                    (ADO_TYPE_VARCHAR, 2, data["codigo"]),
                    (ADO_TYPE_VARCHAR, VOUCHER_NAME_SIZE, data["nombre"]),
                    (ADO_TYPE_VARCHAR, VOUCHER_AUX_SIZE, data["descripcionAuxiliar"]),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = voucher_item(data)
    try:
        register_master_creation(user, "CONTICOM", data["codigo"], "Alta de comprobante")
    except Exception as exc:
        item["advertencia"] = (
            f"El comprobante se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item

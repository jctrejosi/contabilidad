"""Mantenimiento MEDMAG01 de CONMAG1, compartido por todas las compañías.

El formulario original MEDMAG11 edita código, descripción, elemento y las
columnas lógicas. Los campos COMBO y VALOR1/VALOR2, que no edita ese diálogo,
se conservan al modificar un registro existente.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN, ADO_TYPE_VARCHAR, CompanyNotFound, _boolean,
    _company_exists, _execute, _open_recordset, _rows, _text,
    ads_connection, ads_odbc_connection, normalize_company_code,
)
from .auditoria_repository import register_master_creation, register_master_deletion, register_master_update


class FormatoExiste(RuntimeError):
    pass


class FormatoNoExiste(RuntimeError):
    pass


class FormatoInvalido(ValueError):
    pass


EDITABLE_FLAGS = ("CONCEPTO", "TIPODOC", "NIT", "DIGITO", "NOMBRE", "DIRECCION", "MUNICIPIO", "PAIS")
DISPLAY_FLAGS = EDITABLE_FLAGS + ("VALOR1", "VALOR2")
FLAG_KEYS = {"NOMBRE": "nombreCampo"}
SELECT_COLUMNS = ("CODFORMA", "NOMFORMA", "ELEMENTO") + DISPLAY_FLAGS
CODE_PATTERN = re.compile(r"^[A-Za-z0-9]{1,4}$")


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _item(row: dict[str, Any]) -> dict[str, Any]:
    item = {
        "codigo": _text(row.get("CODFORMA")).strip(),
        "nombre": _text(row.get("NOMFORMA")).strip(),
        "elemento": _text(row.get("ELEMENTO")).strip(),
    }
    item.update({FLAG_KEYS.get(flag, flag.lower()): _boolean(row.get(flag)) for flag in DISPLAY_FLAGS})
    return item


def _validate(payload: dict[str, Any]) -> dict[str, Any]:
    code = str(payload.get("codigo", "")).strip().upper()
    name = str(payload.get("nombre", "")).strip()
    element = str(payload.get("elemento", "")).strip()
    if not CODE_PATTERN.fullmatch(code):
        raise FormatoInvalido("El código debe tener entre 1 y 4 letras o números.")
    if not name or len(name) > 40:
        raise FormatoInvalido("La descripción debe tener entre 1 y 40 caracteres.")
    if len(element) > 10:
        raise FormatoInvalido("El elemento admite máximo 10 caracteres.")
    return {"codigo": code, "nombre": name, "elemento": element,
            **{FLAG_KEYS.get(flag, flag.lower()): bool(payload.get(FLAG_KEYS.get(flag, flag.lower()), True)) for flag in EDITABLE_FLAGS}}


def list_formatos(cia: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        rows = _read(connection, f"SELECT {', '.join(SELECT_COLUMNS)} FROM CONMAG1 ORDER BY CODFORMA")
    return {"items": [_item(row) for row in rows], "count": len(rows), "sharedAcrossCompanies": True}


def save_formato(cia: str, payload: dict[str, Any], *, original: str | None = None,
                 user: str = "WEB") -> dict[str, Any]:
    data = _validate(payload)
    company = normalize_company_code(cia)
    code = data["codigo"]
    if original is not None and original.strip().upper() != code:
        raise FormatoInvalido("No se puede cambiar el código de un formato existente.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        existing = _read(connection, f"SELECT CODFORMA FROM CONMAG1 WHERE CODFORMA = '{code}'")
        if original is None and existing:
            raise FormatoExiste(f"Ya existe el formato {code}.")
        if original is not None and not existing:
            raise FormatoNoExiste(f"No existe el formato {code}.")
        columns = ("CODFORMA", "NOMFORMA", "ELEMENTO") + EDITABLE_FLAGS
        values = [
            (ADO_TYPE_VARCHAR, 4, code),
            (ADO_TYPE_VARCHAR, 40, data["nombre"]),
            (ADO_TYPE_VARCHAR, 10, data["elemento"]),
            *[(ADO_TYPE_BOOLEAN, 0, data[FLAG_KEYS.get(flag, flag.lower())]) for flag in EDITABLE_FLAGS],
        ]
        connection.BeginTrans()
        try:
            if original is None:
                _execute(connection,
                         f"INSERT INTO CONMAG1 ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})",
                         values)
            else:
                update_columns = columns[1:]
                _execute(connection,
                         f"UPDATE CONMAG1 SET {', '.join(f'{field} = ?' for field in update_columns)} WHERE CODFORMA = ?",
                         values[1:] + values[:1])
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    try:
        if original is None:
            register_master_creation(user, "CONMAG1", code, "Creación de formato de medios magnéticos")
        else:
            register_master_update(user, "CONMAG1", code, "Modificación de formato de medios magnéticos")
    except Exception:
        pass  # La bitácora no revierte una operación ya confirmada.
    return {"item": data}


def delete_formato(cia: str, codigo: str, *, user: str = "WEB") -> None:
    code = str(codigo).strip().upper()
    if not CODE_PATTERN.fullmatch(code):
        raise FormatoInvalido("Código de formato inválido.")
    company = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if not _read(connection, f"SELECT CODFORMA FROM CONMAG1 WHERE CODFORMA = '{code}'"):
            raise FormatoNoExiste(f"No existe el formato {code}.")
        connection.BeginTrans()
        try:
            # BORRAMG intentaba eliminar también las filas hijas. Se realiza la
            # intención explícita sin dejar conceptos o cuentas huérfanas.
            _execute(connection, "DELETE FROM CONMAG3 WHERE FORMATO = ?", [(ADO_TYPE_VARCHAR, 4, code)])
            _execute(connection, "DELETE FROM CONMAG2 WHERE FORMATO = ?", [(ADO_TYPE_VARCHAR, 4, code)])
            _execute(connection, "DELETE FROM CONMAG1 WHERE CODFORMA = ?", [(ADO_TYPE_VARCHAR, 4, code)])
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    try:
        register_master_deletion(user, "CONMAG1", code, "Eliminación de formato de medios magnéticos")
    except Exception:
        pass

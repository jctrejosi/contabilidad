"""Mantenimiento MEDMAG02/MEDMAG21 de conceptos fiscales en CONMAG2.

CONMAG1 y CONMAG2 son catálogos globales. La clave de cada concepto es
FORMATO+CONCEPTO; el filtro de formato reproduce AYUDAFOR(1). La baja
reproduce BORRAR: elimina únicamente el registro seleccionado de CONMAG2.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN, ADO_TYPE_DOUBLE, ADO_TYPE_VARCHAR, CompanyNotFound,
    _boolean, _company_exists, _execute, _number, _open_recordset, _rows, _text,
    ads_connection, ads_odbc_connection, normalize_company_code,
)
from .auditoria_repository import register_master_creation, register_master_deletion, register_master_update


class ConceptoMedioExiste(RuntimeError):
    pass


class ConceptoMedioNoExiste(RuntimeError):
    pass


class ConceptoMedioInvalido(ValueError):
    pass


CODIGO = re.compile(r"^[A-Za-z0-9]{1,4}$")
COMBO_OPTIONS = ("No Reporta", "Cero", "Blanco", *(f"Valor {n}" for n in range(1, 12)), "Informacion Tercero")
COMBO_COLUMNS = tuple(f"COMBO{n}" for n in range(1, 8))
SELECT_COLUMNS = ("FORMATO", "CONCEPTO", "NOMCONCEP", "MONTO", "VALOR1", "VALOR2") + COMBO_COLUMNS


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _item(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "formato": _text(row.get("FORMATO")).strip(),
        "codigo": _text(row.get("CONCEPTO")).strip(),
        "nombre": _text(row.get("NOMCONCEP")).strip(),
        "monto": _number(row.get("MONTO")),
        "valor1": _boolean(row.get("VALOR1")),
        "valor2": _boolean(row.get("VALOR2")),
        "combos": [_text(row.get(column)).strip() for column in COMBO_COLUMNS],
    }


def _code(value: str, label: str) -> str:
    code = str(value or "").strip().upper()
    if not CODIGO.fullmatch(code):
        raise ConceptoMedioInvalido(f"{label} debe tener entre 1 y 4 letras o números.")
    return code


def _validate(formato: str, payload: dict[str, Any]) -> dict[str, Any]:
    form = _code(formato, "El formato")
    code = _code(payload.get("codigo", ""), "El concepto")
    name = str(payload.get("nombre", "")).strip()
    if not name or len(name) > 40:
        raise ConceptoMedioInvalido("La descripción debe tener entre 1 y 40 caracteres.")
    try:
        amount = float(payload.get("monto", 0))
    except (TypeError, ValueError) as exc:
        raise ConceptoMedioInvalido("El monto debe ser numérico.") from exc
    if amount < 0 or amount > 99_999_999 or round(amount, 2) != amount:
        raise ConceptoMedioInvalido("El monto debe estar entre 0 y 99.999.999, con máximo dos decimales.")
    combos = payload.get("combos", ["No Reporta"] * 7)
    if not isinstance(combos, list) or len(combos) != 7 or any(item not in COMBO_OPTIONS for item in combos):
        raise ConceptoMedioInvalido("Las siete columnas deben usar una opción válida del programa original.")
    return {"formato": form, "codigo": code, "nombre": name, "monto": amount,
            "valor1": bool(payload.get("valor1", True)), "valor2": bool(payload.get("valor2", True)),
            "combos": combos}


def list_conceptos(cia: str, formato: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    form = _code(formato, "El formato")
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        parent = _read(connection, f"SELECT CODFORMA, NOMFORMA FROM CONMAG1 WHERE CODFORMA = '{form}'")
        if not parent:
            raise ConceptoMedioNoExiste(f"No existe el formato {form}.")
        rows = _read(connection, f"SELECT {', '.join(SELECT_COLUMNS)} FROM CONMAG2 WHERE FORMATO = '{form}' ORDER BY CONCEPTO")
    return {"formato": {"codigo": form, "nombre": _text(parent[0].get("NOMFORMA")).strip()},
            "items": [_item(row) for row in rows], "count": len(rows), "sharedAcrossCompanies": True}


def save_concepto(cia: str, formato: str, payload: dict[str, Any], *, original: str | None = None,
                  user: str = "WEB") -> dict[str, Any]:
    data = _validate(formato, payload)
    form, code = data["formato"], data["codigo"]
    if original is not None and _code(original, "El concepto") != code:
        raise ConceptoMedioInvalido("No se puede cambiar el código de un concepto existente.")
    company = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if not _read(connection, f"SELECT CODFORMA FROM CONMAG1 WHERE CODFORMA = '{form}'"):
            raise ConceptoMedioNoExiste(f"No existe el formato {form}.")
        existing = _read(connection, f"SELECT CONCEPTO FROM CONMAG2 WHERE FORMATO = '{form}' AND CONCEPTO = '{code}'")
        if original is None and existing:
            raise ConceptoMedioExiste(f"Ya existe el concepto {code} en el formato {form}.")
        if original is not None and not existing:
            raise ConceptoMedioNoExiste(f"No existe el concepto {code} en el formato {form}.")
        columns = SELECT_COLUMNS
        values = [
            (ADO_TYPE_VARCHAR, 4, form), (ADO_TYPE_VARCHAR, 4, code),
            (ADO_TYPE_VARCHAR, 40, data["nombre"]), (ADO_TYPE_DOUBLE, 0, data["monto"]),
            (ADO_TYPE_BOOLEAN, 0, data["valor1"]), (ADO_TYPE_BOOLEAN, 0, data["valor2"]),
            *[(ADO_TYPE_VARCHAR, 20, value) for value in data["combos"]],
        ]
        connection.BeginTrans()
        try:
            if original is None:
                _execute(connection,
                         f"INSERT INTO CONMAG2 ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})", values)
            else:
                _execute(connection,
                         f"UPDATE CONMAG2 SET {', '.join(f'{column} = ?' for column in columns[2:])} WHERE FORMATO = ? AND CONCEPTO = ?",
                         values[2:] + values[:2])
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    try:
        if original is None:
            register_master_creation(user, "CONMAG2", f"{form}/{code}", "Creación de concepto de medios")
        else:
            register_master_update(user, "CONMAG2", f"{form}/{code}", "Modificación de concepto de medios")
    except Exception:
        pass
    return {"item": data}


def delete_concepto(cia: str, formato: str, codigo: str, *, user: str = "WEB") -> None:
    form, code = _code(formato, "El formato"), _code(codigo, "El concepto")
    company = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if not _read(connection, f"SELECT CONCEPTO FROM CONMAG2 WHERE FORMATO = '{form}' AND CONCEPTO = '{code}'"):
            raise ConceptoMedioNoExiste(f"No existe el concepto {code} en el formato {form}.")
        connection.BeginTrans()
        try:
            _execute(connection, "DELETE FROM CONMAG2 WHERE FORMATO = ? AND CONCEPTO = ?",
                     [(ADO_TYPE_VARCHAR, 4, form), (ADO_TYPE_VARCHAR, 4, code)])
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    try:
        register_master_deletion(user, "CONMAG2", f"{form}/{code}", "Eliminación de concepto de medios")
    except Exception:
        pass

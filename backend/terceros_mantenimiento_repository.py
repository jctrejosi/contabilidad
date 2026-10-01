"""Ficha completa de CLIENTES/TRAB_CLI2/GRABACLI sobre el FADCLI compartido.

Las cinco secciones del formulario Harbour escriben exclusivamente los campos
enumerados aquí. Saldo, ID y otros datos ajenos al formulario se conservan.
Una versión de lectura impide que dos usuarios se sobrescriban silenciosamente.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
from datetime import date
from pathlib import Path
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN, ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR,
    DEFAULT_ENV_FILE, _execute, _number, _rows, _text, _open_recordset,
    _read_env_file, ads_odbc_connection,
)
from .auditoria_repository import register_master_creation, register_third_party_update
from .lotes_repository import _one
from .terceros_repository import (
    ThirdPartyAlreadyExists, ThirdPartyNotFound, VERIFICATION_WEIGHTS,
)

# Longitudes reales consultadas en el diccionario Advantage; las columnas no
# incluidas (CSALDO, ID, etc.) no se modifican por este mantenimiento.
TEXT = {
    "CCODIGO": 10, "CDIGITO": 1, "CCODCIU": 5, "CNOMBRE": 60,
    "CSOCIAL": 60, "CNOM1": 20, "CNOM2": 20, "CAPE1": 20,
    "CAPE2": 20, "CDIREC": 25, "CCIUDAD": 12, "CTELEF": 15,
    "CEMAIL": 60, "CEMAILFE": 60, "CZONA": 2, "CVENDED": 2,
    "CTIPDOC": 2, "CLISTA": 1, "CPROPIETAR": 30, "CCONDICION": 20,
    "CAUTMORA": 4, "CTIPEMP": 2, "CTIPPAG": 2, "CACTIVI": 5,
    "CRETACTI": 2, "CCODBE": 10, "CBENEFI": 50, "BCOCTA": 60,
    "CODICEN": 13, "CDIASEM": 9, "CPROFESION": 25, "CDIROFI": 25,
    "CTELOFI": 15, "CSEXO": 1, "CCONYUGE": 30, "CPROFEC": 25,
    "CDIROFIC": 25, "CTELOFIC": 15, "CCARNET": 4, "CNIT": 11,
    "CMOTIVO": 30,
}
INTEGERS = {
    "CPLAZO", "CTIPOCLI", "CESTADO", "CRETEN", "CDIASROT",
    "CCUMPLE", "CCUMPLEC", "CFCHCREA", *{f"CPLAZO{i}" for i in range(1, 7)},
}
DOUBLES = {
    "CCUPO", "CDCTOFAC", "CDIASMOR", "CPORRETI", "CBASERETI",
    "CFCHACTI", "CMETCOMP", "CFCHVIGMC", "CPLAENTRE", "CFRECUVIS",
    "VLRLOGIS", "PORLOGIS", "CFCHMOD",
    *{f"CDCTO{i}" for i in range(1, 7)},
    *{f"DCTOC{i}" for i in range(1, 4)},
    *{f"DIASC{i}" for i in range(1, 4)},
}
BOOLEANS = {"CMODIFI", "CFACTU", "CINVE", "CCXP", "CTCIFIN",
            "OPELOGIS", "DEBLOGIS", "CBANMAIL"}
FORM_FIELDS = tuple(name for name in (*TEXT, *sorted(INTEGERS), *sorted(DOUBLES), *sorted(BOOLEANS))
                    if name not in {"CCODIGO", "CFCHMOD"})
READ_FIELDS = ("CCODIGO", *FORM_FIELDS, "CSALDO", "ID")
CODE_PATTERN = re.compile(r"^[A-Za-z0-9]{1,10}$")
REFERENCE = {
    "CTIPDOC": ("VISTDOC.ADT", "CODIGO", "NOMBRE"),
    "CCODCIU": ("CIUDAD.ADT", "CODIGO", "NOMBRE"),
    "CZONA": ("POS/FADTAB.ADT", "CTABCOD", "CTABDES"),
    "CVENDED": (":VEDVEN", "VCODIGO", "VNOMBRE"),
    "CTIPEMP": ("CXP/CADEMP.ADT", "CODIGO", "NOMBRE"),
    "CTIPPAG": ("CXP/XADPAGOS.ADT", "CODIGO", "NOMBRE"),
    "CACTIVI": ("ACTIVIDA.ADT", "CODIGO", "NOMBRE"),
}


class ThirdMaintenanceConflict(RuntimeError):
    """La ficha fue modificada por otro usuario desde que se abrió."""


def verification_digit(code: str) -> str:
    """DIGITOK: VAL() en Harbour trata letras del código alterno como cero."""
    digits = code.rjust(15)
    remainder = sum((int(char) if char.isdigit() else 0) * weight
                    for char, weight in zip(digits, VERIFICATION_WEIGHTS)) % 11
    return str(remainder if remainder in (0, 1) else 11 - remainder)


def _version(row: dict[str, Any]) -> str:
    data = {name: str(row.get(name) or "").strip() for name in READ_FIELDS}
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def _display(row: dict[str, Any]) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for name in TEXT:
        values[name] = _text(row.get(name)).strip()
    for name in INTEGERS | DOUBLES:
        if name != "CFCHMOD":
            values[name] = _number(row.get(name))
    for name in BOOLEANS:
        values[name] = bool(row.get(name))
    values["CSALDO"] = _number(row.get("CSALDO"))
    values["version"] = _version(row)
    return values


def default_form() -> dict[str, Any]:
    values = {name: "" for name in TEXT}
    values.update({name: 0 for name in INTEGERS | DOUBLES if name != "CFCHMOD"})
    values.update({name: False for name in BOOLEANS})
    values.update({"CTIPOCLI": 2, "CESTADO": 1, "CRETEN": 1,
                   "CFACTU": True, "CINVE": True, "CCXP": True,
                   "CFCHCREA": int(date.today().strftime("%Y%m%d")),
                   "CCUPO": 0, "CSALDO": 0, "CMOTIVO": "", "version": ""})
    return values


def _read(connection: Any, code: str) -> dict[str, Any]:
    row = _one(connection, "SELECT TOP 1 " + ", ".join(READ_FIELDS)
               + " FROM FADCLI WHERE CCODIGO = ?", [(ADO_TYPE_VARCHAR, 10, code)])
    if row is None:
        raise ThirdPartyNotFound(f"No existe el tercero {code}.")
    return row


def get_form(code: str) -> dict[str, Any]:
    if not CODE_PATTERN.fullmatch(code):
        raise ValueError("La identificación debe tener entre 1 y 10 letras o dígitos.")
    with ads_odbc_connection() as connection:
        return _display(_read(connection, code))


def _valid_date_number(value: int, label: str) -> None:
    if value == 0:
        return
    try:
        date.fromisoformat(f"{value:08d}"[:4] + "-" + f"{value:08d}"[4:6] + "-" + f"{value:08d}"[6:])
    except ValueError as exc:
        raise ValueError(f"{label} no es una fecha válida (AAAAMMDD).") from exc


def _reference_table(field: str) -> tuple[str, str, str]:
    relative, code_field, name_field = REFERENCE[field]
    if relative == ":VEDVEN":
        return "VEDVEN", code_field, name_field
    configured = _read_env_file(DEFAULT_ENV_FILE)
    source = os.environ.get("ADS_DATA_SOURCE") or configured.get("ADS_DATA_SOURCE", "")
    root = os.environ.get("ADS_REFERENCE_ROOT")
    if not root and source:
        root = str(Path(source).parent.parent)
    if not root:
        raise ValueError("Falta configurar la carpeta de catálogos del tercero.")
    path = Path(root, relative).resolve()
    if not path.is_file():
        raise ValueError(f"No está disponible el catálogo {field} para validar el tercero.")
    if "]" in str(path):
        raise ValueError("La ruta del catálogo no es válida.")
    return f"[{path}]", code_field, name_field


def reference_options(field: str, search: str = "") -> list[dict[str, str]]:
    """Subfunciones TDOCOK, CIUOK, PZONAOK, PVENOK, TEMPOK, TPAGOOK y ACTIOK."""
    if field not in REFERENCE:
        raise ValueError("El catálogo solicitado no existe.")
    search = search.strip()
    if len(search) > 40 or "'" in search:
        raise ValueError("La búsqueda no es válida.")
    table, code_field, name_field = _reference_table(field)
    where = (f" WHERE {code_field} LIKE '%{search}%' OR {name_field} LIKE '%{search}%'"
             if search else "")
    with ads_odbc_connection() as connection:
        recordset = _open_recordset(connection, f"SELECT TOP 50 {code_field}, {name_field} FROM {table}"
                                    + where + f" ORDER BY {code_field}")
        try:
            return [{"codigo": _text(row.get(code_field)).strip(),
                     "nombre": _text(row.get(name_field)).strip()} for row in _rows(recordset)]
        finally:
            recordset.Close()


def _validate_references(connection: Any, data: dict[str, Any], existing: dict[str, Any] | None) -> None:
    for field in REFERENCE:
        code = data[field]
        if not code or existing is not None and code == _text(existing.get(field)).strip():
            continue
        table, code_field, _ = _reference_table(field)
        if _one(connection, f"SELECT TOP 1 {code_field} FROM {table} WHERE {code_field} = ?",
                [(ADO_TYPE_VARCHAR, max(TEXT[field], 5), code)]) is None:
            raise ValueError(f"El código {code} no existe en el catálogo de {field}.")
    related = data["CNIT"]
    if related and (existing is None or related != _text(existing.get("CNIT")).strip()):
        if _one(connection, "SELECT TOP 1 CCODIGO FROM FADCLI WHERE CCODIGO = ?",
                [(ADO_TYPE_VARCHAR, 10, related)]) is None:
            raise ValueError("El NIT relacionado no existe en terceros.")


def _normalize(payload: dict[str, Any], code: str, existing: dict[str, Any] | None) -> dict[str, Any]:
    if not CODE_PATTERN.fullmatch(code):
        raise ValueError("La identificación debe tener entre 1 y 10 letras o dígitos.")
    unknown = set(payload) - set(FORM_FIELDS) - {"CCODIGO", "version", "CMOTIVO", "CSALDO"}
    if unknown:
        raise ValueError("El formulario contiene campos no autorizados: " + ", ".join(sorted(unknown)))
    data = default_form() if existing is None else _display(existing)
    for name in FORM_FIELDS:
        if name not in payload:
            continue
        raw = payload[name]
        if name in TEXT:
            value = str(raw or "").strip()
            if len(value) > TEXT[name]:
                raise ValueError(f"{name} admite máximo {TEXT[name]} caracteres.")
        elif name in BOOLEANS:
            if not isinstance(raw, bool):
                raise ValueError(f"{name} debe ser Sí o No.")
            value = raw
        else:
            if isinstance(raw, bool):
                raise ValueError(f"{name} debe ser numérico.")
            try:
                value = float(raw or 0)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{name} debe ser numérico.") from exc
            if not math.isfinite(value):
                raise ValueError(f"{name} no es un número válido.")
            if name in INTEGERS:
                if value != int(value) or not -32768 <= value <= 32767 and name != "CFCHCREA":
                    raise ValueError(f"{name} debe ser un entero dentro del rango permitido.")
                value = int(value)
            if name not in {"CCUMPLE", "CCUMPLEC", "CFCHCREA", "CFCHACTI", "CFCHVIGMC"} and value < 0:
                raise ValueError(f"{name} no puede ser negativo.")
        data[name] = value
    data["CCODIGO"] = code
    data["CDIGITO"] = verification_digit(code)
    if not data["CNOMBRE"]:
        raise ValueError("El nombre o razón social es obligatorio.")
    if not data["CTIPDOC"]:
        raise ValueError("Seleccione el tipo de documento.")
    if data["CTIPDOC"] != "31":
        for field, label in (("CNOM1", "primer nombre"), ("CAPE1", "primer apellido"),
                             ("CAPE2", "segundo apellido")):
            if not data[field] and (existing is None or data[field] != _text(existing.get(field)).strip()):
                raise ValueError(f"El {label} es obligatorio para una persona natural.")
        if "CTIPOCLI" not in payload:
            data["CTIPOCLI"] = 1
    elif "CTIPOCLI" not in payload:
        data["CTIPOCLI"] = 2
    if int(data["CTIPOCLI"]) not in (1, 2):
        raise ValueError("El tipo de persona no es válido.")
    if not data["CSOCIAL"]:
        data["CSOCIAL"] = data["CNOMBRE"]
    if not data["CCODBE"]:
        data["CCODBE"] = code
        data["CBENEFI"] = data["CNOMBRE"][:50]
    for name in ("CEMAIL", "CEMAILFE"):
        value = data[name]
        if value and (existing is None or value != _text(existing.get(name)).strip()) and (
            value.count("@") != 1 or "." not in value.split("@", 1)[1]
        ):
            raise ValueError(f"{name} debe ser un correo electrónico válido.")
    for name in ("CFCHCREA", "CFCHACTI", "CFCHVIGMC"):
        if existing is None or int(data[name]) != int(_number(existing.get(name))):
            _valid_date_number(int(data[name]), name)
    if int(data["CESTADO"]) not in (1, 2) or int(data["CRETEN"]) not in (1, 2, 3):
        raise ValueError("El estado o el régimen de retención no es válido.")
    if int(data["CESTADO"]) == 2 and not data["CMOTIVO"] and (
        existing is None or int(_number(existing.get("CESTADO"))) != 2
    ):
        raise ValueError("Indique el motivo del bloqueo.")
    if int(data["CESTADO"]) == 1:
        data["CMOTIVO"] = ""
    if int(data["CMETCOMP"]) not in (0, 1, 2, 3):
        raise ValueError("El método de compra no es válido.")
    return data


def _params(data: dict[str, Any], fields: list[str]) -> list[tuple[int, int, Any]]:
    return [(ADO_TYPE_VARCHAR, TEXT[name], data[name]) if name in TEXT else
            (ADO_TYPE_BOOLEAN, 0, data[name]) if name in BOOLEANS else
            (ADO_TYPE_INTEGER, 0, data[name]) if name in INTEGERS else
            (ADO_TYPE_DOUBLE, 0, data[name]) for name in fields]


def save_form(code: str, payload: dict[str, Any], *, create: bool) -> dict[str, Any]:
    """GRABACLI: INSERT/UPDATE transaccional, clave fija y campos no editables intactos."""
    with accounting_write_lock, ads_odbc_connection() as connection:
        current = _one(connection, "SELECT TOP 1 " + ", ".join(READ_FIELDS)
                       + " FROM FADCLI WHERE CCODIGO = ?", [(ADO_TYPE_VARCHAR, 10, code)])
        if create and current is not None:
            raise ThirdPartyAlreadyExists(f"El tercero {code} ya existe.")
        if not create and current is None:
            raise ThirdPartyNotFound(f"No existe el tercero {code}.")
        if not create and payload.get("version") != _version(current):
            raise ThirdMaintenanceConflict("La ficha cambió desde que la abrió. Actualícela antes de guardar.")
        data = _normalize(payload, code, current)
        _validate_references(connection, data, current)
        if data["CCODBE"] != code and _one(connection,
            "SELECT TOP 1 CCODIGO FROM FADCLI WHERE CCODIGO = ?",
            [(ADO_TYPE_VARCHAR, 10, data["CCODBE"])]) is None:
            raise ValueError("El beneficiario indicado no existe como tercero.")
        next_id = None
        if create:
            last = _one(connection, "SELECT MAX(ID) AS MAX_ID FROM FADCLI", [])
            next_id = int(_number(last.get("MAX_ID"))) + 1 if last else 1
        data["CFCHMOD"] = int(date.today().strftime("%Y%m%d"))
        connection.BeginTrans()
        try:
            if create:
                fields = ["CCODIGO", *FORM_FIELDS, "CFCHMOD", "CSALDO", "ID"]
                data["CSALDO"] = 0.0
                data["ID"] = next_id
                sql = ("INSERT INTO FADCLI (" + ", ".join(fields) + ") VALUES ("
                       + ", ".join("?" for _ in fields) + ")")
                params = _params(data, fields[:-1]) + [(ADO_TYPE_INTEGER, 0, next_id)]
            else:
                # Solo las columnas del formulario, no saldo ni ID.
                fields = [*FORM_FIELDS, "CFCHMOD"]
                sql = "UPDATE FADCLI SET " + ", ".join(f"{field} = ?" for field in fields) + " WHERE CCODIGO = ?"
                params = _params(data, fields) + [(ADO_TYPE_VARCHAR, 10, code)]
            _execute(connection, sql, params)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    # La bitácora no puede deshacer una transacción ya confirmada.
    try:
        if create:
            register_master_creation("WEB", "tercero", code, data["CNOMBRE"])
        else:
            register_third_party_update("WEB", code)
    except Exception:
        pass
    return get_form(code)

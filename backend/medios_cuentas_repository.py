"""MEDMAG03 y MEDMAG03T sobre CONMAG3 y CONMAE compartidos.

En Harbour, cada compañía tenía su carpeta. En este modelo, CONMAG3.CIA
separa las asignaciones manuales. MEDMAG03T no copia CONMAG3: traslada los
seis campos fiscales de CONMAE entre compañías, por CODIGO+NITN.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN, ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER, CATALOG_NIT, CompanyNotFound, _boolean, _company_exists,
    _execute, _number, _open_recordset, _rows, _text, ads_connection,
    ads_odbc_connection, normalize_company_code,
)


class MedioCuentaConflict(RuntimeError):
    pass


class MedioCuentaNotFound(RuntimeError):
    pass


class MedioCuentaValidation(ValueError):
    pass


CODE = re.compile(r"^[0-9]{1,12}$")
FORMAT = re.compile(r"^[A-Za-z0-9]{1,4}$")
ASSIGN_FIELDS = (
    "CUENTA", "FORMATO", "CONCEPTO", "TIPO", "CUENTA2", "TIPOMED",
    "PMED1", "PMED2", "PMED3", "PMED4", "PMED5", "PMED6",
    "FORMATO2", "CONCEPTO2", "MODCXP", "COLVALOR", "COLBASE",
    "MOVTIPO", "COLUMNA2", "DOCX", "DOCX2", "DOCX3", "NATURAL", "CIA",
)
COPY_FIELDS = ("FORMATO", "CONCEPTO", "TIPOMED", "VALMED", "RENGLON", "SUMARES")
INTEGER_FIELDS = {"TIPOMED", "MODCXP", "COLVALOR", "COLBASE", "MOVTIPO", "COLUMNA2"}
FLOAT_FIELDS = {f"PMED{n}" for n in range(1, 7)}
TEXT_SIZES = {"CUENTA": 12, "FORMATO": 4, "CONCEPTO": 4, "TIPO": 1,
              "CUENTA2": 12, "FORMATO2": 4, "CONCEPTO2": 4,
              "DOCX": 2, "DOCX2": 2, "DOCX3": 2}


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _code(value: Any, label: str, *, optional: bool = False, pattern: re.Pattern[str] = CODE) -> str:
    code = str(value or "").strip().upper()
    if optional and not code:
        return ""
    if not pattern.fullmatch(code):
        raise MedioCuentaValidation(f"{label} tiene un código inválido.")
    return code


def _row_to_item(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **{field.lower(): _text(row.get(field)).strip() for field in TEXT_SIZES},
        **{field.lower(): int(_number(row.get(field))) for field in INTEGER_FIELDS},
        **{field.lower(): _number(row.get(field)) for field in FLOAT_FIELDS},
        "natural": _boolean(row.get("NATURAL")),
        "cia": int(_number(row.get("CIA"))),
    }


def _normalize(account: str, payload: dict[str, Any]) -> dict[str, Any]:
    item: dict[str, Any] = {"cuenta": _code(account, "La cuenta")}
    item["formato"] = _code(payload.get("formato"), "El formato", pattern=FORMAT)
    item["concepto"] = _code(payload.get("concepto"), "El concepto", pattern=FORMAT)
    item["tipo"] = str(payload.get("tipo", "")).strip().upper()
    if item["tipo"] not in {"D", "C"}:
        raise MedioCuentaValidation("La naturaleza debe ser D o C.")
    item["cuenta2"] = _code(payload.get("cuenta2"), "La segunda cuenta", optional=True)
    item["formato2"] = _code(payload.get("formato2"), "El segundo formato", optional=True, pattern=FORMAT)
    item["concepto2"] = _code(payload.get("concepto2"), "El segundo concepto", optional=True, pattern=FORMAT)
    if bool(item["formato2"]) != bool(item["concepto2"]):
        raise MedioCuentaValidation("El segundo formato y concepto deben indicarse juntos.")
    for field in INTEGER_FIELDS:
        try:
            value = int(payload.get(field.lower(), 1 if field == "MOVTIPO" else 0))
        except (TypeError, ValueError) as exc:
            raise MedioCuentaValidation(f"{field} debe ser numérico.") from exc
        if value < 0 or value > 99:
            raise MedioCuentaValidation(f"{field} debe estar entre 0 y 99.")
        item[field.lower()] = value
    for field in FLOAT_FIELDS:
        try:
            value = float(payload.get(field.lower(), 0))
        except (TypeError, ValueError) as exc:
            raise MedioCuentaValidation(f"{field} debe ser numérico.") from exc
        if not 0 <= value <= 99.99999999:
            raise MedioCuentaValidation(f"{field} debe estar entre 0 y 99,99999999.")
        item[field.lower()] = value
    for field in ("docx", "docx2", "docx3"):
        value = str(payload.get(field, "")).strip().upper()
        if len(value) > 2:
            raise MedioCuentaValidation(f"{field.upper()} admite máximo dos caracteres.")
        item[field] = value
    item["natural"] = bool(payload.get("natural", False))
    return item


def _check_references(connection: Any, cia: int, item: dict[str, Any]) -> None:
    accounts = [item["cuenta"]] + ([item["cuenta2"]] if item["cuenta2"] else [])
    for account in accounts:
        if not _read(connection, f"SELECT TOP 1 CODIGO FROM CONMAE WHERE CIA = {cia} AND CODIGO = '{account}' AND {CATALOG_ACCOUNT_FILTER}"):
            raise MedioCuentaNotFound(f"La cuenta {account} no existe en la compañía seleccionada.")
    for form, concept in ((item["formato"], item["concepto"]), (item["formato2"], item["concepto2"])):
        if form and not _read(connection, f"SELECT TOP 1 CONCEPTO FROM CONMAG2 WHERE FORMATO = '{form}' AND CONCEPTO = '{concept}'"):
            raise MedioCuentaNotFound(f"El concepto {concept} no existe en el formato {form}.")


def list_accounts(cia: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        rows = _read(connection, f"SELECT CODIGO, MNOMBRE, MCTAPAGOS, MIVA_RET FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER} ORDER BY CODIGO")
    return {"items": [{"codigo": _text(row.get("CODIGO")).strip(), "nombre": _text(row.get("MNOMBRE")).strip(),
                       "tercero": _boolean(row.get("MCTAPAGOS")), "ivaRet": _text(row.get("MIVA_RET")).strip()}
                      for row in rows], "count": len(rows)}


def list_assignments(cia: str, account: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    code = _code(account, "La cuenta")
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if not _read(connection, f"SELECT TOP 1 CODIGO FROM CONMAE WHERE CIA = {company} AND CODIGO = '{code}' AND {CATALOG_ACCOUNT_FILTER}"):
            raise MedioCuentaNotFound(f"La cuenta {code} no existe en esta compañía.")
        rows = _read(connection, f"SELECT {', '.join(ASSIGN_FIELDS)} FROM CONMAG3 WHERE CIA = {company} AND CUENTA = '{code}' ORDER BY FORMATO, CONCEPTO, CUENTA2")
    return {"items": [_row_to_item(row) for row in rows], "count": len(rows)}


def _key_clause(cia: int, item: dict[str, Any]) -> str:
    return (f"CIA = {cia} AND CUENTA = '{item['cuenta']}' AND FORMATO = '{item['formato']}' "
            f"AND CONCEPTO = '{item['concepto']}' AND CUENTA2 = '{item['cuenta2']}'")


def save_assignment(cia: str, account: str, payload: dict[str, Any], *, original: dict[str, Any] | None = None) -> dict[str, Any]:
    company = normalize_company_code(cia)
    item = _normalize(account, payload)
    old = _normalize(account, original) if original is not None else None
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        _check_references(connection, company, item)
        if old is not None and not _read(connection, f"SELECT TOP 1 CUENTA FROM CONMAG3 WHERE {_key_clause(company, old)}"):
            raise MedioCuentaNotFound("La asignación original ya no existe.")
        if (old is None or _key_clause(company, old) != _key_clause(company, item)) and _read(connection, f"SELECT TOP 1 CUENTA FROM CONMAG3 WHERE {_key_clause(company, item)}"):
            raise MedioCuentaConflict("Esta cuenta ya tiene la misma asignación de formato, concepto y segunda cuenta.")
        values: list[tuple[int, int, Any]] = []
        for field in ASSIGN_FIELDS:
            if field == "CIA": values.append((ADO_TYPE_INTEGER, 0, company))
            elif field == "NATURAL": values.append((ADO_TYPE_BOOLEAN, 0, item["natural"]))
            elif field in TEXT_SIZES: values.append((ADO_TYPE_VARCHAR, TEXT_SIZES[field], item[field.lower()]))
            elif field in FLOAT_FIELDS: values.append((ADO_TYPE_DOUBLE, 0, item[field.lower()]))
            else: values.append((ADO_TYPE_DOUBLE, 0, item[field.lower()]))
        connection.BeginTrans()
        try:
            if old is None:
                _execute(connection, f"INSERT INTO CONMAG3 ({', '.join(ASSIGN_FIELDS)}) VALUES ({', '.join('?' for _ in ASSIGN_FIELDS)})", values)
            else:
                key_params = [(ADO_TYPE_INTEGER, 0, company),
                              *[(ADO_TYPE_VARCHAR, TEXT_SIZES[field], old[field.lower()]) for field in ("CUENTA", "FORMATO", "CONCEPTO", "CUENTA2")]]
                _execute(connection,
                         f"UPDATE CONMAG3 SET {', '.join(f'{field} = ?' for field in ASSIGN_FIELDS[:-1])} WHERE CIA = ? AND CUENTA = ? AND FORMATO = ? AND CONCEPTO = ? AND CUENTA2 = ?",
                         values[:-1] + key_params)
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {"item": {**item, "cia": company}}


def delete_assignment(cia: str, account: str, formato: str, concepto: str, cuenta2: str = "") -> None:
    company = normalize_company_code(cia)
    item = {"cuenta": _code(account, "La cuenta"), "formato": _code(formato, "El formato", pattern=FORMAT),
            "concepto": _code(concepto, "El concepto", pattern=FORMAT),
            "cuenta2": _code(cuenta2, "La segunda cuenta", optional=True)}
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if not _read(connection, f"SELECT TOP 1 CUENTA FROM CONMAG3 WHERE {_key_clause(company, item)}"):
            raise MedioCuentaNotFound("La asignación ya no existe.")
        connection.BeginTrans()
        try:
            _execute(connection, "DELETE FROM CONMAG3 WHERE CIA = ? AND CUENTA = ? AND FORMATO = ? AND CONCEPTO = ? AND CUENTA2 = ?",
                     [(ADO_TYPE_INTEGER, 0, company),
                      *[(ADO_TYPE_VARCHAR, TEXT_SIZES[field], item[field.lower()]) for field in ("CUENTA", "FORMATO", "CONCEPTO", "CUENTA2")]])
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise


def copy_account_assignments(cia: str, source: str, target: str) -> dict[str, Any]:
    """MEDMAG31COP/PEG: copia filas de una cuenta a otra, omitiendo duplicados."""
    company = normalize_company_code(cia)
    source_code, target_code = _code(source, "La cuenta origen"), _code(target, "La cuenta destino")
    if source_code == target_code:
        raise MedioCuentaValidation("Las cuentas origen y destino deben ser distintas.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        for code in (source_code, target_code):
            if not _read(connection, f"SELECT TOP 1 CODIGO FROM CONMAE WHERE CIA = {company} AND CODIGO = '{code}' AND {CATALOG_ACCOUNT_FILTER}"):
                raise MedioCuentaNotFound(f"La cuenta {code} no existe en esta compañía.")
        sources = [_row_to_item(row) for row in _read(connection, f"SELECT {', '.join(ASSIGN_FIELDS)} FROM CONMAG3 WHERE CIA = {company} AND CUENTA = '{source_code}'")]
        targets = {(item["formato"], item["concepto"], item["cuenta2"]) for item in
                   (_row_to_item(row) for row in _read(connection, f"SELECT {', '.join(ASSIGN_FIELDS)} FROM CONMAG3 WHERE CIA = {company} AND CUENTA = '{target_code}'"))}
        pending = [item for item in sources if (item["formato"], item["concepto"], item["cuenta2"]) not in targets]
        connection.BeginTrans()
        try:
            for item in pending:
                item["cuenta"] = target_code
                # MEDMAG31PEG solo copiaba hasta MOVTIPO; los cinco campos
                # siguientes quedaban con el valor inicial del registro nuevo.
                item.update({"columna2": 0, "docx": "", "docx2": "", "docx3": "", "natural": False})
                values = []
                for field in ASSIGN_FIELDS:
                    if field == "CIA": values.append((ADO_TYPE_INTEGER, 0, company))
                    elif field == "NATURAL": values.append((ADO_TYPE_BOOLEAN, 0, item["natural"]))
                    elif field in TEXT_SIZES: values.append((ADO_TYPE_VARCHAR, TEXT_SIZES[field], item[field.lower()]))
                    else: values.append((ADO_TYPE_DOUBLE, 0, item[field.lower()]))
                _execute(connection, f"INSERT INTO CONMAG3 ({', '.join(ASSIGN_FIELDS)}) VALUES ({', '.join('?' for _ in ASSIGN_FIELDS)})", values)
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {"copiadas": len(pending), "omitidas": len(sources) - len(pending)}


def copy_company_preview(cia: str, source: str) -> dict[str, Any]:
    dest, origin = normalize_company_code(cia), normalize_company_code(source)
    if dest == origin:
        raise MedioCuentaValidation("Seleccione otra compañía como origen.")
    with ads_connection() as connection:
        if not _company_exists(connection, dest) or not _company_exists(connection, origin):
            raise CompanyNotFound("La compañía de origen o destino no existe.")
        src = _read(connection, f"SELECT CODIGO, NITN FROM CONMAE WHERE CIA = {origin}")
        dst = _read(connection, f"SELECT CODIGO, NITN FROM CONMAE WHERE CIA = {dest}")
    keys = {(_text(row.get("CODIGO")).strip(), _text(row.get("NITN")).strip()) for row in dst}
    matched = sum((_text(row.get("CODIGO")).strip(), _text(row.get("NITN")).strip()) in keys for row in src)
    return {"origen": f"{origin:03d}", "destino": f"{dest:03d}", "origenFilas": len(src),
            "coincidentes": matched, "sinCorrespondencia": len(src) - matched}


def copy_company_definitions(cia: str, source: str) -> dict[str, Any]:
    """MEDMAG03T: sobrescribe seis campos en filas coincidentes de CONMAE."""
    dest, origin = normalize_company_code(cia), normalize_company_code(source)
    if dest == origin:
        raise MedioCuentaValidation("Seleccione otra compañía como origen.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, dest) or not _company_exists(connection, origin):
            raise CompanyNotFound("La compañía de origen o destino no existe.")
        src = _read(connection, f"SELECT CODIGO, NITN, {', '.join(COPY_FIELDS)} FROM CONMAE WHERE CIA = {origin}")
        dst = _read(connection, f"SELECT CODIGO, NITN FROM CONMAE WHERE CIA = {dest}")
        keys = {(_text(row.get("CODIGO")).strip(), _text(row.get("NITN")).strip()) for row in dst}
        matched = [row for row in src if (_text(row.get("CODIGO")).strip(), _text(row.get("NITN")).strip()) in keys]
        connection.BeginTrans()
        try:
            for row in matched:
                code = _text(row.get("CODIGO")).strip()
                nit = _text(row.get("NITN")).strip()
                params = [
                    (ADO_TYPE_VARCHAR, 4, _text(row.get("FORMATO")).strip()),
                    (ADO_TYPE_VARCHAR, 4, _text(row.get("CONCEPTO")).strip()),
                    *[(ADO_TYPE_INTEGER, 0, int(_number(row.get(field)))) for field in COPY_FIELDS[2:]],
                    (ADO_TYPE_INTEGER, 0, dest), (ADO_TYPE_VARCHAR, 12, code),
                ]
                if nit:
                    _execute(connection,
                             f"UPDATE CONMAE SET {', '.join(f'{field} = ?' for field in COPY_FIELDS)} WHERE CIA = ? AND CODIGO = ? AND NITN = ?",
                             params + [(ADO_TYPE_VARCHAR, 15, nit)])
                else:
                    _execute(connection,
                             f"UPDATE CONMAE SET {', '.join(f'{field} = ?' for field in COPY_FIELDS)} WHERE CIA = ? AND CODIGO = ? AND (NITN IS NULL OR NITN = '{CATALOG_NIT}')",
                             params)
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {"origen": f"{origin:03d}", "destino": f"{dest:03d}",
            "actualizadas": len(matched), "sinCorrespondencia": len(src) - len(matched)}

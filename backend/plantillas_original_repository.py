"""Plantillas contables de PLANTICO/AYUDPLA/GRABAPLA (DSITAB.PRG).

No existe una tabla de plantillas separada: se editan exclusivamente los 24
campos NOM01..08, DEB01..08 y CRE01..08 del documento de VISDOCUM, SUC=1.
Las cuentas vacías son válidas; las no vacías deben ser afectables en CONMAE.
"""

from __future__ import annotations

from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, CATALOG_ACCOUNT_FILTER,
    CompanyNotFound, _boolean, _company_exists, _execute, _open_recordset,
    _rows, _text, ads_connection, ads_odbc_connection, normalize_company_code,
)
from .lotes_repository import _one
from .visdocum_sucursal import VISDOCUM_SUCURSAL

POSITIONS = tuple(range(1, 9))
COLUMNS = tuple(f"{prefix}{position:02d}" for position in POSITIONS for prefix in ("NOM", "DEB", "CRE"))
SELECT = "CODIGO, NOMBRE, " + ", ".join(COLUMNS)


class PlantillaOriginalError(ValueError):
    """Selección o dato inválido para la plantilla original."""


def _map_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "codigo": _text(row.get("CODIGO")), "nombre": _text(row.get("NOMBRE")),
        "posiciones": [
            {"orden": position, "concepto": _text(row.get(f"NOM{position:02d}")),
             "cuentaDebito": _text(row.get(f"DEB{position:02d}")),
             "cuentaCredito": _text(row.get(f"CRE{position:02d}"))}
            for position in POSITIONS
        ],
    }


def list_plantillas_original(cia: str) -> list[dict[str, Any]]:
    company_id = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        recordset = _open_recordset(
            connection,
            f"SELECT {SELECT} FROM VISDOCUM WHERE SUC = {VISDOCUM_SUCURSAL} ORDER BY CODIGO",
        )
        try:
            return [_map_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()


def guardar_plantilla_original(cia: str, codigo: str, posiciones: list[dict[str, Any]]) -> dict[str, Any]:
    """Actualiza el bloque de ocho posiciones; deja intacto todo el resto del documento."""
    company_id = normalize_company_code(cia)
    code = codigo.strip().upper()
    if not code or len(code) > 2:
        raise PlantillaOriginalError("Seleccione un tipo de documento válido.")
    if len(posiciones) != 8:
        raise PlantillaOriginalError("La plantilla debe contener sus ocho posiciones.")
    values: dict[str, str] = {}
    for index, position in enumerate(posiciones, 1):
        if position.get("orden") != index:
            raise PlantillaOriginalError(f"La posición {index} no está en orden.")
        for property_name, prefix, maximum in (
            ("concepto", "NOM", 20), ("cuentaDebito", "DEB", 12), ("cuentaCredito", "CRE", 12)
        ):
            value = str(position.get(property_name, "") or "").strip()
            if len(value) > maximum:
                raise PlantillaOriginalError(f"La posición {index}, campo {property_name}, admite máximo {maximum} caracteres.")
            if prefix != "NOM" and value and not value.isdigit():
                raise PlantillaOriginalError(f"La cuenta de la posición {index} debe ser numérica.")
            values[f"{prefix}{index:02d}"] = value

    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        document = _one(
            connection,
            f"SELECT TOP 1 CODIGO, NOMBRE FROM VISDOCUM WHERE SUC = {VISDOCUM_SUCURSAL} AND CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, code)],
        )
        if document is None:
            raise PlantillaOriginalError(f"No existe el tipo de documento {code}.")
        for index in POSITIONS:
            for prefix in ("DEB", "CRE"):
                account = values[f"{prefix}{index:02d}"]
                if not account:
                    continue
                row = _one(
                    connection,
                    "SELECT TOP 1 CODIGO, MTC FROM CONMAE WHERE CIA = ? AND CODIGO = ? "
                    f"AND {CATALOG_ACCOUNT_FILTER}",
                    [(ADO_TYPE_INTEGER, 0, company_id), (ADO_TYPE_VARCHAR, 12, account)],
                )
                if row is None or not _boolean(row.get("MTC")):
                    raise PlantillaOriginalError(
                        f"Posición {index}: la cuenta {account} no existe o no es de movimiento en esta compañía."
                    )
        parameters = [
            (ADO_TYPE_VARCHAR, 20 if column.startswith("NOM") else 12, values[column])
            for column in COLUMNS
        ]
        connection.BeginTrans()
        try:
            _execute(
                connection,
                f"UPDATE VISDOCUM SET {', '.join(f'{column} = ?' for column in COLUMNS)} "
                f"WHERE SUC = {VISDOCUM_SUCURSAL} AND CODIGO = ?",
                [*parameters, (ADO_TYPE_VARCHAR, 2, code)],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    return _map_row({"CODIGO": code, "NOMBRE": document.get("NOMBRE"), **values})

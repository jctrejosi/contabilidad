"""Bitácora global VISAUDI usada por los módulos heredados.

VISAUDI es una tabla ADT libre ubicada fuera del diccionario ADD_CONTAB. Se
abre con una conexión ADO independiente después de confirmar el movimiento,
igual que ``AUDIVIS`` en el programa Harbour.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from ._win32com import pythoncom, win32com
from .ads_repository import ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, _execute


DEFAULT_AUDIT_DIRECTORY = Path(r"C:\VISADS")


@contextmanager
def audit_connection() -> Iterator[Any]:
    """Abre la carpeta de tablas libres que contiene VISAUDI.ADT.

    Se usa ADO sobre el controlador ODBC de Advantage. El proveedor OLE DB
    11.10 instalado genera de forma intermitente el callback nativo C0000005
    al cerrar esta conexión, justo después de terminar un reproceso.
    """
    directory = Path(os.environ.get("ADS_AUDIT_DATA_SOURCE", str(DEFAULT_AUDIT_DIRECTORY)))
    if not (directory / "VISAUDI.ADT").is_file():
        raise RuntimeError(f"No se encontró VISAUDI.ADT en {directory}.")
    pythoncom.CoInitialize()
    connection = None
    try:
        connection = win32com.client.Dispatch("ADODB.Connection")
        connection.Open(
            "Provider=MSDASQL.1;"
            "Driver={Advantage StreamlineSQL ODBC};"
            f"DataDirectory={directory};"
            "ServerTypes=1;DefaultType=Advantage;"
        )
        yield connection
    finally:
        if connection is not None:
            try:
                if connection.State:
                    connection.Close()
            except Exception:
                pass
        pythoncom.CoUninitialize()


def _register_third_party_event(user: str, document: str, reason: str) -> None:
    """Inserta una fila en VISAUDI con el patrón AUDIVIS del programa Harbour."""
    now = datetime.now()
    with audit_connection() as connection:
        _execute(
            connection,
            "INSERT INTO VISAUDI (USUARIO, HORA, MODULO, DOCUMENTO, MOTIVO, FECHA) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (ADO_TYPE_VARCHAR, 4, user[:4]),
                (ADO_TYPE_VARCHAR, 10, now.strftime("%H:%M:%S")),
                (ADO_TYPE_VARCHAR, 1, "T"),
                (ADO_TYPE_VARCHAR, 12, document[:12]),
                (ADO_TYPE_VARCHAR, 250, reason[:250]),
                (ADO_TYPE_INTEGER, 0, int(now.strftime("%Y%m%d"))),
            ],
        )


def register_third_party_deletion(user: str, nit: str, reason: str) -> None:
    """Deja trazabilidad de la baja de un tercero con el motivo indicado."""
    _register_third_party_event(user, nit, f"Baja de tercero. Motivo: {reason.strip()}")


def register_third_party_credit_limit(user: str, nit: str, credit_limit: float, reason: str) -> None:
    """Registra el cambio de cupo de cartera y el motivo opcional."""
    detail = f"Cambio de cupo de tercero a {credit_limit:.2f}."
    if reason.strip():
        detail = f"{detail} Motivo: {reason.strip()}"
    _register_third_party_event(user, nit, detail)


def register_third_party_update(user: str, nit: str) -> None:
    """Registra la modificación de la ficha del tercero."""
    _register_third_party_event(user, nit, "Modificacion de tercero")


def register_third_party_import(user: str, archivo: str, detail: str) -> None:
    """Registra la importación masiva con su archivo, conteo y mapeo."""
    _register_third_party_event(user, archivo, f"Importacion de terceros. {detail}")


def register_master_creation(user: str, table: str, code: str, detail: str = "") -> None:
    """Deja trazabilidad del alta de un catálogo (centros, comprobantes, tipos).

    Reutiliza el mismo patrón AUDIVIS que las escrituras de terceros: ``MODULO``
    es ``T`` (tablas maestras) y el código creado viaja en ``DOCUMENTO``.
    """
    reason = f"Alta de {table}. {detail}".strip() if detail else f"Alta de {table}"
    _register_third_party_event(user, code, reason)


def register_master_update(user: str, table: str, code: str, detail: str = "") -> None:
    """Registra la modificación de un registro de catálogo (B3).

    Mismo patrón AUDIVIS que el alta: ``MODULO`` es ``T`` y el código viaja en
    ``DOCUMENTO``, para que la bitácora del legado quede con una sola forma.
    """
    reason = f"Modificacion de {table}. {detail}".strip() if detail else f"Modificacion de {table}"
    _register_third_party_event(user, code, reason)


def register_master_deletion(user: str, table: str, code: str, reason: str) -> None:
    """Registra la baja de un registro de catálogo con su motivo (B3, R7)."""
    detail = f"Baja de {table}. Motivo: {str(reason).strip()}"
    _register_third_party_event(user, code, detail)


def register_direct_posting(user: str, document: str) -> None:
    """Registra el equivalente de AUDIVIS(..., 'T', documento, motivo)."""
    now = datetime.now()
    with audit_connection() as connection:
        _execute(
            connection,
            "INSERT INTO VISAUDI (USUARIO, HORA, MODULO, DOCUMENTO, MOTIVO, FECHA) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (ADO_TYPE_VARCHAR, 4, user[:4]),
                (ADO_TYPE_VARCHAR, 10, now.strftime("%H:%M:%S")),
                (ADO_TYPE_VARCHAR, 1, "T"),
                (ADO_TYPE_VARCHAR, 12, document[:12]),
                (ADO_TYPE_VARCHAR, 250, "Ingreso y Actualizacion Directa"),
                (ADO_TYPE_INTEGER, 0, int(now.strftime("%Y%m%d"))),
            ],
        )


def register_document_annulment(user: str, document: str, reason: str) -> None:
    """Deja trazabilidad de una anulacion confirmada sin alterar su transaccion."""
    now = datetime.now()
    audit_reason = f"Anulacion de documento. Motivo: {reason.strip()}"[:250]
    with audit_connection() as connection:
        _execute(
            connection,
            "INSERT INTO VISAUDI (USUARIO, HORA, MODULO, DOCUMENTO, MOTIVO, FECHA) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (ADO_TYPE_VARCHAR, 4, user[:4]),
                (ADO_TYPE_VARCHAR, 10, now.strftime("%H:%M:%S")),
                (ADO_TYPE_VARCHAR, 1, "T"),
                (ADO_TYPE_VARCHAR, 12, document[:12]),
                (ADO_TYPE_VARCHAR, 250, audit_reason),
                (ADO_TYPE_INTEGER, 0, int(now.strftime("%Y%m%d"))),
            ],
        )


def register_monthly_reprocess(
    user: str,
    year: int,
    month_from: int,
    month_to: int,
    reason: str,
) -> None:
    """Registra la revalorización mensual después del COMMIT en Advantage.

    Mantiene el patrón AUDIVIS del programa Harbour y añade el motivo indicado
    por el usuario para que la intervención contable quede trazable.
    """
    now = datetime.now()
    document = f"{int(year):04d}{int(month_from):02d}{int(month_to):02d}"
    audit_reason = (
        f"Revalorizacion mensual {int(month_from):02d}-{int(month_to):02d}. "
        f"Motivo: {reason.strip()}"
    )[:250]
    with audit_connection() as connection:
        _execute(
            connection,
            "INSERT INTO VISAUDI (USUARIO, HORA, MODULO, DOCUMENTO, MOTIVO, FECHA) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (ADO_TYPE_VARCHAR, 4, user[:4]),
                (ADO_TYPE_VARCHAR, 10, now.strftime("%H:%M:%S")),
                (ADO_TYPE_VARCHAR, 1, "T"),
                (ADO_TYPE_VARCHAR, 12, document),
                (ADO_TYPE_VARCHAR, 250, audit_reason),
                (ADO_TYPE_INTEGER, 0, int(now.strftime("%Y%m%d"))),
            ],
        )

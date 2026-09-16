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

import pythoncom
import win32com.client

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

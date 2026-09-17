"""Lectura segura de archivos usados para preparar lotes contables.

Este modulo solo interpreta el archivo y devuelve sus columnas y filas. La
validacion contable y la escritura atomica se realizan en lotes_repository.
"""

from __future__ import annotations

from datetime import date, datetime
from io import BytesIO, StringIO
import csv
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from openpyxl import load_workbook
import pythoncom
import win32com.client

from .ads_repository import _rows


MAX_IMPORT_MB = 25
MAX_IMPORT_BYTES = MAX_IMPORT_MB * 1024 * 1024
MAX_IMPORT_ROWS = 5000


class ImportFileValidationError(ValueError):
    """El archivo no tiene un formato utilizable para la importacion."""


def _json_value(value: Any) -> str | int | float | bool | None:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return str(value)


def _unique_headers(values: list[Any]) -> list[str]:
    headers: list[str] = []
    used: dict[str, int] = {}
    for index, value in enumerate(values, start=1):
        base = str(value or "").strip() or f"Columna {index}"
        count = used.get(base, 0) + 1
        used[base] = count
        headers.append(base if count == 1 else f"{base} ({count})")
    return headers


def _rows_to_dicts(headers: list[str], source: list[list[Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for values in source[:MAX_IMPORT_ROWS]:
        padded = values + [None] * max(0, len(headers) - len(values))
        if not any(value not in (None, "") for value in padded[:len(headers)]):
            continue
        result.append({header: _json_value(padded[index]) for index, header in enumerate(headers)})
    return result


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ImportFileValidationError("No fue posible identificar la codificacion del archivo.")


def _read_delimited(content: bytes) -> dict[str, Any]:
    text = _decode_text(content)
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
        dialect.delimiter = ";"
    raw = list(csv.reader(StringIO(text), dialect))
    if not raw:
        raise ImportFileValidationError("El archivo no contiene filas.")
    headers = _unique_headers(raw[0])
    return {
        "hojas": ["Datos"],
        "hoja": "Datos",
        "columnas": headers,
        "filas": _rows_to_dicts(headers, raw[1:]),
        "truncado": len(raw) - 1 > MAX_IMPORT_ROWS,
    }


def _read_xlsx(content: bytes, sheet_name: str = "") -> dict[str, Any]:
    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise ImportFileValidationError("El libro de Excel no es valido o esta protegido.") from exc
    try:
        sheets = list(workbook.sheetnames)
        if not sheets:
            raise ImportFileValidationError("El libro no contiene hojas.")
        selected = sheet_name.strip() or sheets[0]
        if selected not in sheets:
            raise ImportFileValidationError("La hoja seleccionada no existe en el archivo.")
        worksheet = workbook[selected]
        iterator = worksheet.iter_rows(values_only=True)
        first = next(iterator, None)
        if first is None:
            raise ImportFileValidationError("La hoja seleccionada esta vacia.")
        headers = _unique_headers(list(first))
        rows: list[list[Any]] = []
        truncated = False
        for index, values in enumerate(iterator):
            if index >= MAX_IMPORT_ROWS:
                truncated = True
                break
            rows.append(list(values))
        return {
            "hojas": sheets,
            "hoja": selected,
            "columnas": headers,
            "filas": _rows_to_dicts(headers, rows),
            "truncado": truncated,
        }
    finally:
        workbook.close()


def _read_adt(content: bytes) -> dict[str, Any]:
    """Lee una tabla ADT libre en un directorio temporal mediante ADS ODBC."""
    pythoncom.CoInitialize()
    connection = None
    try:
        with TemporaryDirectory(prefix="contabdsi_import_") as directory:
            Path(directory, "IMPORT.ADT").write_bytes(content)
            connection = win32com.client.Dispatch("ADODB.Connection")
            connection.Open(
                "Provider=MSDASQL.1;Driver={Advantage StreamlineSQL ODBC};"
                f"DataDirectory={directory};ServerTypes=1;DefaultType=Advantage;"
            )
            recordset, _ = connection.Execute("SELECT TOP 5001 * FROM IMPORT")
            try:
                raw_rows = list(_rows(recordset))
            finally:
                recordset.Close()
            columns = list(raw_rows[0].keys()) if raw_rows else []
            result = {
                "hojas": ["IMPORT"],
                "hoja": "IMPORT",
                "columnas": columns,
                "filas": [
                    {column: _json_value(row.get(column)) for column in columns}
                    for row in raw_rows[:MAX_IMPORT_ROWS]
                ],
                "truncado": len(raw_rows) > MAX_IMPORT_ROWS,
            }
            connection.Close()
            connection = None
            return result
    except ImportFileValidationError:
        raise
    except Exception as exc:
        raise ImportFileValidationError(
            "No fue posible leer la tabla ADT. Verifique que sea una tabla libre válida."
        ) from exc
    finally:
        if connection is not None:
            try:
                if connection.State:
                    connection.Close()
            except Exception:
                pass
        pythoncom.CoUninitialize()


def read_import_file(filename: str, content: bytes, *, sheet_name: str = "") -> dict[str, Any]:
    """Interpreta un archivo sin escribirlo en disco ni ejecutar macros."""
    if not content:
        raise ImportFileValidationError("Seleccione un archivo con informacion.")
    if len(content) > MAX_IMPORT_BYTES:
        raise ImportFileValidationError(
            f"El archivo supera el limite de {MAX_IMPORT_MB} MB."
        )
    extension = Path(filename or "").suffix.lower()
    if extension in {".csv", ".txt"}:
        result = _read_delimited(content)
    elif extension == ".xlsx":
        result = _read_xlsx(content, sheet_name)
    elif extension == ".adt":
        result = _read_adt(content)
    elif extension == ".xls":
        raise ImportFileValidationError(
            "El formato XLS antiguo no esta habilitado. Guarde el archivo como XLSX o CSV."
        )
    else:
        raise ImportFileValidationError("Use un archivo XLSX, CSV, TXT o ADT.")
    if not result["filas"]:
        raise ImportFileValidationError("No se encontraron filas de datos debajo del encabezado.")
    return {"archivo": Path(filename).name, **result}

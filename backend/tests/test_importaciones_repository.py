from __future__ import annotations

from io import BytesIO

import pytest
from openpyxl import Workbook

from backend.importaciones_repository import (
    MAX_IMPORT_BYTES,
    ImportFileValidationError,
    read_import_file,
)


def test_reads_semicolon_csv_with_headers_and_rows() -> None:
    content = (
        "Fecha;Cuenta;Débito;Crédito\n"
        "2026-09-01;110505;100;0\n"
        "2026-09-01;220505;0;100\n"
    ).encode("utf-8")

    result = read_import_file("movimientos.csv", content)

    assert result["columnas"] == ["Fecha", "Cuenta", "Débito", "Crédito"]
    assert len(result["filas"]) == 2
    assert result["filas"][0]["Cuenta"] == "110505"


def test_reads_selected_xlsx_sheet_and_serializes_dates() -> None:
    workbook = Workbook()
    first = workbook.active
    first.title = "Resumen"
    movement = workbook.create_sheet("Movimientos")
    movement.append(["Fecha", "Cuenta", "Débito"])
    movement.append(["2026-09-01", "110505", 100.25])
    output = BytesIO()
    workbook.save(output)

    result = read_import_file("movimientos.xlsx", output.getvalue(), sheet_name="Movimientos")

    assert result["hojas"] == ["Resumen", "Movimientos"]
    assert result["hoja"] == "Movimientos"
    assert result["filas"][0]["Débito"] == 100.25


def test_rejects_legacy_xls_with_actionable_message() -> None:
    with pytest.raises(ImportFileValidationError, match="XLSX o CSV"):
        read_import_file("movimientos.xls", b"legacy")


def test_rejects_files_larger_than_25_mb() -> None:
    assert MAX_IMPORT_BYTES == 25 * 1024 * 1024
    with pytest.raises(ImportFileValidationError, match="25 MB"):
        read_import_file("movimientos.csv", b"x" * (MAX_IMPORT_BYTES + 1))

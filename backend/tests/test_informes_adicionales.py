"""Contratos de filtrado y exportación de los informes adicionales."""

from io import BytesIO

import pytest
from openpyxl import load_workbook

from backend.informes_adicionales_repository import (
    _monthly_sum,
    _safe,
    export_additional_report,
)


REPORT = {
    "id": "mov-comprobante",
    "compania": {"codigo": "027", "nombre": "Empresa de prueba", "nit": "123"},
    "anio": 2025,
    "mesDesde": 1,
    "mesHasta": 1,
    "columnas": [{"label": "Comprobante", "money": False}, {"label": "Débitos", "money": True}],
    "filas": [["01", 2500.0], ["02", 700.0]],
}


def test_filters_reject_sql_injection() -> None:
    with pytest.raises(ValueError):
        _safe("01' OR 1=1", "comprobante", 20)


def test_month_columns_only_use_selected_months() -> None:
    assert _monthly_sum("MACMDEB", 2, 3) == "COALESCE(MACMDEB02, 0) + COALESCE(MACMDEB03, 0)"


def test_csv_export_contains_real_rows() -> None:
    data = export_additional_report(REPORT, "csv").decode("utf-8-sig")
    assert "Comprobante;Débitos" in data
    assert "01;2500.0" in data
    assert "02;700.0" in data


def test_xlsx_export_contains_real_rows() -> None:
    workbook = load_workbook(BytesIO(export_additional_report(REPORT, "xlsx")), read_only=True)
    sheet = workbook.active
    assert sheet["A4"].value == "01"
    assert sheet["B5"].value == 700


def test_pdf_export_is_a_pdf() -> None:
    assert export_additional_report(REPORT, "pdf").startswith(b"%PDF-")


def test_default_document_pdf_groups_partidas() -> None:
    document = {
        **REPORT,
        "id": "doc-formato",
        "filas": [["20250102", "111005013", "860017005", "", "06", "CE",
                   "000098003477", "", "Pago de factura", 0, 1500]],
    }
    assert export_additional_report(document, "pdf").startswith(b"%PDF-")

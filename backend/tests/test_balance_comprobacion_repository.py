from io import BytesIO

from openpyxl import load_workbook
from pypdf import PdfReader

from backend.balance_comprobacion_repository import (
    _account_values,
    export_trial_balance_pdf,
    export_trial_balance_xlsx,
)


def _source_row() -> dict[str, float]:
    row = {"MSALDO": 100.0}
    for month in range(1, 13):
        row[f"MACMDEB{month:02d}"] = 0.0
        row[f"MACMCRE{month:02d}"] = 0.0
    row.update({"MACMDEB01": 50.0, "MACMCRE01": -20.0, "MACMDEB02": 30.0, "MACMCRE02": -10.0})
    return row


def _report() -> dict[str, object]:
    return {
        "compania": {"codigo": "027", "nombre": "COMPAÑÍA PRUEBA", "nit": "900000000"},
        "periodo": "Enero a Febrero de 2026",
        "nombreNivel": "Subcuenta",
        "items": [
            {
                "cuenta": "11", "nombre": "DISPONIBLE", "nivel": 2,
                "saldoAnterior": 100.0, "debito": 80.0, "credito": 30.0, "saldoActual": 150.0,
            }
        ],
        "totales": {"saldoAnterior": 0.0, "debito": 80.0, "credito": 80.0, "diferencia": 0.0, "saldoActual": 0.0},
    }


def test_account_values_follow_harbour_accumulated_period_logic() -> None:
    assert _account_values(_source_row(), 2, 2) == (130.0, 30.0, 10.0, 150.0)


def test_xlsx_export_keeps_amounts_as_numeric_cells() -> None:
    content = export_trial_balance_xlsx(_report())
    workbook = load_workbook(BytesIO(content), data_only=False)
    sheet = workbook["Balance acumulado"]

    assert sheet["A1"].value == "BALANCE DE COMPROBACIÓN ACUMULADO"
    assert sheet["D8"].value == 80.0
    assert sheet["E8"].value == 30.0
    assert sheet.freeze_panes == "A8"


def test_pdf_export_is_readable_and_contains_report_title() -> None:
    content = export_trial_balance_pdf(_report())
    reader = PdfReader(BytesIO(content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)

    assert len(reader.pages) == 1
    assert "BALANCE DE COMPROBACIÓN ACUMULADO" in text
    assert "DISPONIBLE" in text

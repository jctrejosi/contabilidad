from io import BytesIO

from openpyxl import load_workbook
from pypdf import PdfReader

from backend.balance_comprobacion_repository import (
    _account_values,
    _assemble_report,
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
    assert sheet["E8"].value == 80.0
    assert sheet["F8"].value == 30.0
    assert sheet.freeze_panes == "A8"


def test_pdf_export_is_readable_and_contains_report_title() -> None:
    content = export_trial_balance_pdf(_report())
    reader = PdfReader(BytesIO(content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)

    assert len(reader.pages) == 1
    assert "BALANCE DE COMPROBACIÓN ACUMULADO" in text
    assert "DISPONIBLE" in text


def test_harbour_sections_and_result_are_added_only_to_equity_root() -> None:
    rows = [
        {"CODIGO": "1", "MNOMBRE": "ACTIVO", "MSALDO": 1000},
        {"CODIGO": "2", "MNOMBRE": "PASIVO", "MSALDO": -300},
        {"CODIGO": "3", "MNOMBRE": "PATRIMONIO", "MSALDO": -500},
        {"CODIGO": "31", "MNOMBRE": "CAPITAL", "MSALDO": -500},
        {"CODIGO": "4", "MNOMBRE": "INGRESOS", "MSALDO": -300},
        {"CODIGO": "5", "MNOMBRE": "GASTOS", "MSALDO": 100},
    ]
    report = _assemble_report(27, {"EMPNOM": "PRUEBA", "EMPNIT": "1"}, 2026, 1, 1, 4, False, rows)
    assert [item["seccion"] for item in report["items"] if item["tipo"] == "seccion"] == ["resultados", "balance"]
    equity = next(item for item in report["items"] if item["tipo"] == "cuenta" and item["cuenta"] == "3")
    capital = next(item for item in report["items"] if item["tipo"] == "cuenta" and item["cuenta"] == "31")
    assert equity["saldoActual"] == 700
    assert capital["saldoActual"] == 500
    assert report["totales"]["resultadoEjercicio"] == 200
    assert report["totales"]["diferencia"] == 0


def test_hidden_results_follow_original_456_rule() -> None:
    rows = [
        {"CODIGO": "1", "MNOMBRE": "ACTIVO", "MSALDO": 0},
        {"CODIGO": "2", "MNOMBRE": "PASIVO", "MSALDO": 0},
        {"CODIGO": "3", "MNOMBRE": "PATRIMONIO", "MSALDO": 0},
        {"CODIGO": "4", "MNOMBRE": "INGRESOS", "MSALDO": -100},
        {"CODIGO": "5", "MNOMBRE": "GASTOS", "MSALDO": 20},
        {"CODIGO": "6", "MNOMBRE": "COSTOS", "MSALDO": 30},
        {"CODIGO": "7", "MNOMBRE": "OTROS", "MSALDO": 40},
    ]
    report = _assemble_report(27, {"EMPNOM": "PRUEBA", "EMPNIT": "1"}, 2026, 1, 1, 4, False, rows, include_results=False)
    assert sum(item["tipo"] == "seccion" for item in report["items"]) == 1
    assert report["totales"]["resultadoEjercicio"] == 50


def test_special_months_are_counted_in_opening_and_period() -> None:
    row = {"MSALDO": 100, "MACMDEB13": 30, "MACMCRE13": -10, "MACMDEB14": 5}
    assert _account_values(row, 14, 14) == (120, 5, 0, 125)

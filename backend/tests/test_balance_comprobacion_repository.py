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


def _account(code: str, opening: float, debit: float = 0, credit: float = 0) -> dict[str, object]:
    row: dict[str, object] = {"CODIGO": code, "MNOMBRE": f"Cuenta {code}", "MSALDO": opening}
    for month in range(1, 19):
        row[f"MACMDEB{month:02d}"] = 0
        row[f"MACMCRE{month:02d}"] = 0
    row["MACMDEB01"] = debit
    row["MACMCRE01"] = credit
    return row


def test_report_reproduces_harbour_sections_and_result_in_equity() -> None:
    rows = [_account("1", 100), _account("11", 100), _account("2", -60),
            _account("3", -30), _account("4", -20, 0, -5),
            _account("5", 10, 2), _account("6", 0), _account("7", 0)]
    report = _assemble_report(27, {"EMPNOM": "Prueba", "EMPNIT": "1"}, 2025, 1, 1, 4,
                              False, rows)
    items = report["items"]
    assert [item["seccion"] for item in items if item["tipo"] == "seccion"] == ["resultados", "balance"]
    equity = next(item for item in items if item["cuenta"] == "3" and item["tipo"] == "cuenta")
    result = next(item for item in items if item["tipo"] == "resultado")
    assert equity["saldoAnterior"] == 40
    assert equity["saldoActual"] == 43
    assert result["saldoActual"] == 13
    assert not any(item["cuenta"] == "6" and item["tipo"] == "cuenta" for item in items)
    assert any(item["tipo"] == "total-balance" for item in items)


def test_without_results_only_prints_balance_but_keeps_result_in_equity() -> None:
    rows = [_account("1", 100), _account("2", -60), _account("3", -30),
            _account("4", -20), _account("5", 10), _account("7", 50)]
    report = _assemble_report(27, {"EMPNOM": "Prueba", "EMPNIT": "1"}, 2025, 1, 1, 4,
                              False, rows, include_results=False)
    assert [item["seccion"] for item in report["items"] if item["tipo"] == "seccion"] == ["balance"]
    assert report["totales"]["resultadoEjercicio"] == 10


def test_v2_exports_preserve_section_rows() -> None:
    rows = [_account("1", 100), _account("2", -60), _account("3", -30),
            _account("4", -20), _account("5", 10)]
    report = _assemble_report(27, {"EMPNOM": "Prueba", "EMPNIT": "1"}, 2025, 1, 1, 4,
                              False, rows)
    workbook = load_workbook(BytesIO(export_trial_balance_xlsx(report)))
    sheet = workbook.active
    values = [sheet.cell(row, 1).value for row in range(1, sheet.max_row + 1)]
    assert any("ESTADO DE RESULTADOS" in str(value) for value in values)
    assert any("BALANCE DE COMPROBACIÓN" in str(value) for value in values)
    pdf_text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(export_trial_balance_pdf(report))).pages)
    assert "RESULTADO DEL EJERCICIO" in pdf_text
    assert "PASIVO Y PATRIMONIO" in pdf_text

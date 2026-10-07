"""Regresión de INFOR02(2): filtro mensual, resultado y formatos impresos."""

from io import BytesIO

from openpyxl import load_workbook
from pypdf import PdfReader

from backend import balance_mensual_repository as monthly
from backend.balance_comprobacion_repository import _assemble_report


def _source():
    return [
        {"CODIGO": "1", "MNOMBRE": "ACTIVO", "MSALDO": 100, "MACMDEB02": 30},
        {"CODIGO": "11", "MNOMBRE": "CUENTA SIN MOVIMIENTO", "MSALDO": 100},
        {"CODIGO": "2", "MNOMBRE": "PASIVO", "MSALDO": -40},
        {"CODIGO": "3", "MNOMBRE": "PATRIMONIO", "MSALDO": -50},
        {"CODIGO": "4", "MNOMBRE": "INGRESOS", "MSALDO": -10, "MACMCRE02": -30},
    ]


def _report(monkeypatch):
    def trial(_company, year, first, last, **_kwargs):
        return _assemble_report(27, {"EMPNOM": "COMPAÑÍA PRUEBA", "EMPNIT": "900000000"},
                                year, first, last, 4, True, _source())

    monkeypatch.setattr(monthly, "build_trial_balance", trial)
    return monthly.build_monthly_balance("027", 2026, 2, 2)


def test_monthly_uses_period_net_and_excludes_opening_only_accounts(monkeypatch):
    report = _report(monkeypatch)
    active = next(item for item in report["items"] if item["tipo"] == "cuenta" and item["cuenta"] == "1")
    assert active["saldoActual"] == 30  # No incluye MSALDO=100.
    assert not any(item["cuenta"] == "11" for item in report["items"])
    assert report["periodo"] == "FEBRERO-FEBRERO 2026"
    assert report["tipoInforme"] == "mensual"
    assert [item["nombre"] for item in report["items"] if item["tipo"] == "seccion"] == [
        "ESTADO DE RESULTADOS MENSUAL", "BALANCE DE COMPROBACIÓN MENSUAL",
    ]


def test_monthly_can_include_zero_movement_rows(monkeypatch):
    def trial(_company, year, first, last, **_kwargs):
        return _assemble_report(27, {"EMPNOM": "PRUEBA", "EMPNIT": "1"},
                                year, first, last, 4, True, _source())
    monkeypatch.setattr(monthly, "build_trial_balance", trial)
    report = monthly.build_monthly_balance("027", 2026, 2, 2, include_zero=True)
    assert any(item["cuenta"] == "11" for item in report["items"])


def test_pdf_print_has_original_monthly_columns_and_sections(monkeypatch):
    pdf = monthly.export_monthly_balance_pdf(_report(monkeypatch))
    reader = PdfReader(BytesIO(pdf))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    # Resultado, activo y pasivo/patrimonio empiezan en páginas separadas.
    assert len(reader.pages) == 3
    assert "ESTADO DE RESULTADOS MENSUAL A FEBRERO-FEBRERO 2026" in text
    assert "BALANCE DE COMPROBACION MENSUAL A FEBRERO-FEBRERO 2026" in text
    assert "Saldo anterior" not in text
    assert "Saldo Actual" in text


def test_xlsx_keeps_legacy_empty_opening_column(monkeypatch):
    xlsx = monthly.export_monthly_balance_xlsx(_report(monkeypatch))
    sheet = load_workbook(BytesIO(xlsx), data_only=False).active
    assert sheet["D5"].value == "Saldo anterior"
    assert sheet["A1"].value == "BALANCE DE COMPROBACIÓN MENSUAL"
    assert sheet["A1"].fill.fgColor.rgb == "00003366"
    assert sheet["A5"].fill.fgColor.rgb == "00003366"
    assert sheet.freeze_panes == "A6"
    account_row = next(row for row in sheet.iter_rows(min_row=6)
                       if row[0].value == "1" and row[2].value == "ACTIVO")
    assert account_row[3].value is None
    assert account_row[4].value == 30
    assert account_row[6].value == 30

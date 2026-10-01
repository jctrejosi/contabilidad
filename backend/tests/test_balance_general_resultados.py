"""Regresión de INFOR04: un mes, clases 4–9 y traslado a patrimonio."""

import unittest
from io import BytesIO
from unittest.mock import patch

from openpyxl import load_workbook
from pypdf import PdfReader

from backend import informes_adicionales_repository as reports
from backend import balance_comprobacion_repository as balance_repository
from backend.balance_comprobacion_repository import _assemble_report


def _balance(*, include_results: bool = True):
    roots = [
        ("1", "ACTIVO", 1000), ("2", "PASIVO", -300),
        ("3", "PATRIMONIO", -500), ("4", "INGRESOS", -300),
        ("5", "GASTOS", 100), ("6", "COSTOS", 50),
        ("7", "OTROS GASTOS", 20), ("8", "OTROS INGRESOS", -10),
        ("9", "OTRAS CUENTAS", 5),
    ]
    rows = [{"CODIGO": code, "MNOMBRE": name, "MSALDO": opening}
            for code, name, opening in roots]
    return _assemble_report(
        27, {"EMPNOM": "PRUEBA", "EMPNIT": "900"}, 2025,
        1, 1, 4, False, rows, include_results=include_results,
    )


class BalanceGeneralResultadosTest(unittest.TestCase):
    def test_one_month_and_all_result_classes_are_preserved(self):
        with patch.object(reports, "build_trial_balance", return_value=_balance()) as builder:
            report = reports.build_additional_report(
                "bal-gral-resultados", "027", 2025, 1, 1,
                level=4, include_results=True, include_thirds=True,
            )
        self.assertEqual(builder.call_args.args[2:4], (1, 1))
        self.assertIsNone(builder.call_args.kwargs["detail_limit"])
        self.assertTrue(builder.call_args.kwargs["include_thirds"])
        headings = [row[2] for row, kind in zip(report["filas"], report["tipos"])
                    if kind == "seccion"]
        self.assertEqual(headings, ["ESTADO DE RESULTADOS A ENERO 2025",
                                    "BALANCE GENERAL A ENERO 2025"])
        self.assertTrue({"7", "8", "9"}.issubset({row[0] for row in report["filas"]}))
        self.assertEqual(next(row[3] for row in report["filas"]
                              if row[2] == "RESULTADO DEL EJERCICIO"), 135)
        self.assertEqual(next(row[3] for row in report["filas"]
                              if row[2] == "PASIVO Y PATRIMONIO"), 935)

    def test_hidden_results_keep_original_456_calculation(self):
        with patch.object(reports, "build_trial_balance", return_value=_balance(include_results=False)):
            report = reports.build_additional_report(
                "bal-gral-resultados", "027", 2025, 1, 1,
                include_results=False,
            )
        self.assertEqual(sum(kind == "seccion" for kind in report["tipos"]), 1)
        self.assertEqual(report["filas"][0][2], "BALANCE GENERAL A ENERO 2025")
        self.assertEqual(next(row[3] for row in report["filas"]
                              if row[2] == "RESULTADO DEL EJERCICIO"), 150)

    def test_special_month_title_and_single_month_filter(self):
        with patch.object(reports, "build_trial_balance", return_value=_balance()) as builder:
            report = reports.build_additional_report("bal-gral-resultados", "027", 2025, 13, 13)
        self.assertIn("ENERO 2025 (MES 13)", report["filas"][0][2])
        self.assertEqual(builder.call_args.args[2:4], (13, 13))
        with self.assertRaisesRegex(ValueError, "solo mes"):
            reports.build_additional_report("bal-gral-resultados", "027", 2025, 1, 2)

    def test_pdf_has_separate_sections_and_xlsx_has_numeric_saldos(self):
        with patch.object(reports, "build_trial_balance", return_value=_balance()):
            report = reports.build_additional_report("bal-gral-resultados", "027", 2025, 1, 1)
        pdf = PdfReader(BytesIO(reports.export_additional_report(report, "pdf")))
        self.assertEqual(len(pdf.pages), 2)
        self.assertIn("ESTADO DE RESULTADOS", pdf.pages[0].extract_text() or "")
        self.assertIn("BALANCE GENERAL", pdf.pages[1].extract_text() or "")
        workbook = load_workbook(BytesIO(reports.export_additional_report(report, "xlsx")), read_only=True)
        self.assertTrue(any(cell.data_type == "n" for row in workbook.active.iter_rows(min_row=4) for cell in row))

    def test_third_party_reader_uses_selected_month_and_batches_without_cap(self):
        class Fields:
            Count = 6

            @staticmethod
            def Item(index):
                names = ("CODIGO", "NIT", "MNOMBRE", "MSALDO", "MACMDEB01", "MACMCRE01")
                return type("Field", (), {"Name": names[index]})()

        class Recordset:
            EOF = False

            def __init__(self):
                self.Fields = Fields()
                self.batch_sizes = []
                self.closed = False

            def GetRows(self, size):
                self.batch_sizes.append(size)
                self.EOF = True
                return (("4",), ("900",), ("Cliente",), (0,), (10,), (-2,))

            def Close(self):
                self.closed = True

        recordset = Recordset()
        with patch.object(balance_repository, "_open_recordset", return_value=recordset) as open_recordset:
            rows = balance_repository._load_thirds(
                object(), 27, 4, "", "", ["4"], month_to=1, max_rows=None,
            )
        sql = open_recordset.call_args.args[1]
        self.assertEqual(len(rows), 1)
        self.assertEqual(recordset.batch_sizes, [1000])
        self.assertTrue(recordset.closed)
        self.assertNotIn("TOP", sql)
        self.assertNotIn("MACMDEB02", sql)


if __name__ == "__main__":
    unittest.main()

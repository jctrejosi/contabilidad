"""Regresión de INFOR15(2): meses, filtros, edición y certificados locales."""

import unittest
from contextlib import contextmanager
from io import BytesIO
from unittest.mock import patch

from openpyxl import load_workbook
from pypdf import PdfReader

from backend import iva_analisis_repository as iva


def row(code="240805", nit="900", debit=0, credit=0):
    result = {"CODIGO": code, "NIT": nit}
    for month in range(1, 13):
        result.update({f"BASE{month:02d}": 100 if month == 1 else 0,
                       f"VALOR{month:02d}": debit if month == 1 else 0,
                       f"BASE{month:02d}C": -50 if month == 1 else 0,
                       f"VALOR{month:02d}C": credit if month == 1 else 0})
    return result


class Connection:
    def __init__(self):
        self.events = []

    def BeginTrans(self): self.events.append("begin")
    def CommitTrans(self): self.events.append("commit")
    def RollbackTrans(self): self.events.append("rollback")


@contextmanager
def session(connection):
    yield connection


class IvaAnalysisTest(unittest.TestCase):
    def test_months_and_annual_keep_original_four_signed_columns(self):
        item = iva._item(row(debit=19, credit=-9.5), {"240805": "IVA"}, {"900": "Cliente"})
        self.assertEqual(len(item["meses"]), 12)
        self.assertEqual(item["meses"][0]["baseNeta"], 50)
        self.assertEqual(item["anual"]["ivaNeto"], 9.5)
        self.assertEqual(item["nombreTercero"], "Cliente")

    def test_filter_is_company_scoped_and_resumes_after_last_key(self):
        clause = iva._where(27, "2408", "2409", "100", "999", "240", "240805", "900")
        self.assertIn("CIA = 27", clause)
        self.assertIn("CODIGO >= '2408'", clause)
        self.assertIn("NIT <= '999'", clause)
        self.assertIn("CODIGO LIKE '240%'", clause)
        self.assertIn("NIT > '900'", clause)

    def test_save_uses_version_transaction_and_all_48_month_values(self):
        connection = Connection()
        existing = row(debit=19, credit=-9.5)
        item = iva._item(existing, {}, {})
        sent = []
        with patch.object(iva, "ads_odbc_connection", return_value=session(connection)), patch.object(
            iva, "_validate", return_value=(27, {})
        ), patch.object(iva, "_stream", return_value=iter([existing])), patch.object(
            iva, "_execute", side_effect=lambda _conn, sql, params: sent.append((sql, params))
        ), patch.object(iva, "get_iva_analysis_item", return_value=item):
            iva.update_iva_analysis_item("027", 2026, "240805", "900", item["version"], item["meses"])
        self.assertEqual(connection.events, ["begin", "commit"])
        self.assertEqual(len(sent[0][1]), 51)
        self.assertIn("WHERE CIA = ? AND CODIGO = ? AND NIT = ?", sent[0][0])

    def test_stale_version_rolls_back_without_writing(self):
        connection = Connection()
        existing = row(debit=19, credit=-9.5)
        with patch.object(iva, "ads_odbc_connection", return_value=session(connection)), patch.object(
            iva, "_validate", return_value=(27, {})
        ), patch.object(iva, "_stream", return_value=iter([existing])), patch.object(iva, "_execute") as execute:
            with self.assertRaises(iva.IvaAnalysisConflict):
                iva.update_iva_analysis_item("027", 2026, "240805", "900", "a" * 64,
                                             iva._periods(existing))
        self.assertEqual(connection.events, ["begin", "rollback"])
        execute.assert_not_called()

    def test_certificates_group_by_third_and_export_pdf_excel(self):
        connection = Connection()
        source = [row("240805", "900", 19, -9.5), row("240810", "900", 38, 0)]
        def stream(_connection, sql):
            self.assertIn("CIA = 27", sql)
            return iter(source)
        with patch.object(iva, "ads_odbc_connection", return_value=session(connection)), patch.object(
            iva, "_validate", return_value=(27, {"EMPNOM": "Empresa", "EMPNIT": "123"})
        ), patch.object(iva, "_one", return_value={"CTDIRECC": "Calle 1", "CTCODCIU": "Bogotá"}), patch.object(
            iva, "_stream", side_effect=stream
        ), patch.object(iva, "_lookup_names", return_value=({"240805": "IVA A", "240810": "IVA B"}, {"900": "Cliente"})):
            report = iva.build_iva_certificates("027", 2026, account_from="", account_to="",
                                                 nit_from="", nit_to="", frequency="anual",
                                                 period="todos", include_rate=True)
        self.assertEqual(report["cantidad"], 1)
        self.assertEqual(report["certificados"][0]["totalIva"], 47.5)
        self.assertEqual(report["certificados"][0]["filas"][0]["porcentaje"], 19)
        excel = load_workbook(BytesIO(iva.export_iva_certificates(report, "xlsx")), read_only=True)
        self.assertIn("CERTIFICADO", " ".join(str(cell.value) for row in excel.active for cell in row).upper())
        pdf = PdfReader(BytesIO(iva.export_iva_certificates(report, "pdf")))
        self.assertIn("CERTIFICADO DE IVA", " ".join(page.extract_text() or "" for page in pdf.pages))


if __name__ == "__main__":
    unittest.main()

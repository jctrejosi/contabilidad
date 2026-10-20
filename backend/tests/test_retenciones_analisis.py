"""Análisis y certificados de CONRET, sin escrituras a Advantage."""

import unittest
from contextlib import contextmanager
from io import BytesIO
from unittest.mock import patch

from openpyxl import load_workbook
from pypdf import PdfReader

from backend import retenciones_analisis_repository as ret


class FakeConnection:
    def __init__(self):
        self.events = []

    def BeginTrans(self):
        self.events.append("begin")

    def CommitTrans(self):
        self.events.append("commit")

    def RollbackTrans(self):
        self.events.append("rollback")


class RetencionesAnalisisTest(unittest.TestCase):
    def test_months_nets_credits_and_purchase_base(self):
        months = ret._months({"BASE01": 100, "BASE01C": -20, "VALOR01": 10,
                              "VALOR01C": -2, "BASCO01": 500, "BASCO01C": -100})
        self.assertEqual(months[0]["baseNeta"], 80)
        self.assertEqual(months[0]["retencionNeta"], 8)
        self.assertEqual(months[0]["baseCompraNeta"], 400)
        self.assertEqual(ret._total(months)["retencionNeta"], 8)

    def test_certificates_filter_company_year_and_group_by_third(self):
        source = [
            {"CODIGO": "2365", "NIT": "900", "BASE01": 100, "BASE01C": -20,
             "VALOR01": 10, "VALOR01C": -2, "BASCO01": 500, "BASCO01C": -100},
            {"CODIGO": "2366", "NIT": "900", "BASE01": 200, "VALOR01": 20},
            {"CODIGO": "2365", "NIT": "901", "BASE01": 300, "VALOR01": 30},
        ]
        captured = []

        @contextmanager
        def connection():
            yield object()

        def stream(_connection, sql):
            captured.append(sql)
            return iter(source)

        def one(_connection, sql):
            return {"CTDIRECC": "Calle 1"} if "CONCTR" in sql else {"PORIVARET": 0}

        with patch.object(ret, "ads_odbc_connection", connection), patch.object(
            ret, "_validate", return_value=(27, {"EMPNOM": "Prueba", "EMPNIT": "800"})
        ), patch.object(ret, "_stream", side_effect=stream), patch.object(
            ret, "_lookup_names", return_value=({"2365": "Retención A", "2366": "Retención B"},
                                                {"900": "Tercero Uno", "901": "Tercero Dos"})
        ), patch.object(ret, "_one", side_effect=one):
            report = ret.build_retention_certificates("027", 2026, account_from="", account_to="",
                                                      nit_from="", nit_to="", frequency="mensual", period="1")
        self.assertIn("CIA = 27", captured[0])
        self.assertIn("ANO = 2026", captured[0])
        self.assertEqual(report["cantidad"], 2)
        self.assertEqual(report["certificados"][0]["totalRetencion"], 28)
        self.assertEqual(report["certificados"][0]["filas"][0]["base"], 80)
        pdf = PdfReader(BytesIO(ret.export_retention_certificates(report, "pdf")))
        self.assertIn("CERTIFICADO DE RETENCIONES", " ".join(page.extract_text() or "" for page in pdf.pages))
        excel = load_workbook(BytesIO(ret.export_retention_certificates(report, "xlsx")), read_only=True)
        self.assertIn("CERTIFICADO DE RETENCIONES", excel.active["A2"].value)
        self.assertEqual(excel.active["A1"].font.sz, 14)
        self.assertEqual(excel.active["A2"].font.sz, 11)
        self.assertEqual(excel.active["A3"].font.sz, 10)
        self.assertEqual(excel.active["A1"].fill.fgColor.rgb, "00003366")
        self.assertEqual(excel.active["A3"].fill.fgColor.rgb, "000073C0")

    def test_manual_update_rolls_back_when_version_changed(self):
        connection = FakeConnection()

        @contextmanager
        def fake_connection():
            yield connection

        months = [{"mes": month, **{key: 0 for key in ret.MONEY_KEYS}} for month in range(1, 13)]
        with patch.object(ret, "ads_odbc_connection", fake_connection), patch.object(
            ret, "_validate", return_value=(27, {})
        ), patch.object(ret, "_stream", return_value=iter([])):
            with self.assertRaises(ret.IvaAnalysisConflict):
                ret.update_retention_analysis_item("027", 2026, "2365", "900", "0" * 64, months)
        self.assertEqual(connection.events, ["begin", "rollback"])


if __name__ == "__main__":
    unittest.main()

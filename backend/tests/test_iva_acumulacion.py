"""Regresión de la opción INFOR05(2): rango, signos y aislamiento por CIA."""

import unittest
from contextlib import contextmanager
from io import BytesIO
from unittest.mock import patch

from openpyxl import load_workbook
from pypdf import PdfReader

from backend import iva_acumulacion_repository as iva
from backend.informes_adicionales_repository import export_additional_report


class FakeConnection:
    def __init__(self):
        self.statements = []
        self.events = []

    def Execute(self, sql):
        self.statements.append(sql)

    def BeginTrans(self):
        self.events.append("begin")

    def CommitTrans(self):
        self.events.append("commit")

    def RollbackTrans(self):
        self.events.append("rollback")


class IvaAcumulacionTest(unittest.TestCase):
    def test_source_uses_current_company_iva_accounts_and_signed_bases(self):
        sql = iva._source_sql(27, 2026, 2, 3)
        self.assertIn("m.CONCIA = 27", sql)
        self.assertIn("m.CONANO = 2026", sql)
        self.assertIn("m.CONMES >= 2 AND m.CONMES <= 3", sql)
        self.assertIn("a.MIVA_RET = 'I'", sql)
        self.assertIn("a.MTC = TRUE", sql)
        self.assertIn("ABS(m.TBASE)", sql)
        self.assertIn("-ABS(m.TBASE)", sql)
        self.assertIn("m.TVALOR <> 0", sql)

    def test_rebuild_resets_only_requested_month_and_upserts_once_per_key(self):
        connection = FakeConnection()
        source = [
            {"MES": 2, "CODIGO": "240805", "NIT": "900", "BASE_DEB": 100,
             "VALOR_DEB": 19, "BASE_CRE": -50, "VALOR_CRE": -9.5},
            {"MES": 3, "CODIGO": "240805", "NIT": "900", "BASE_DEB": 200,
             "VALOR_DEB": 38, "BASE_CRE": 0, "VALOR_CRE": 0},
        ]
        statements = []

        def stream(_connection, sql):
            return iter(source if "FROM MOV01" in sql else [])

        with patch.object(iva, "_stream", side_effect=stream), patch.object(
            iva, "_execute", side_effect=lambda _connection, sql, params: statements.append((sql, params))
        ):
            count = iva._accumulate(connection, 27, 2026, 2, 3)
        self.assertEqual(count, 2)
        self.assertIn("BASE02 = 0", connection.statements[0])
        self.assertIn("BASE03 = 0", connection.statements[0])
        self.assertNotIn("BASE01 = 0", connection.statements[0])
        self.assertIn("WHERE CIA = 27", connection.statements[0])
        self.assertTrue(statements[0][0].startswith("INSERT INTO CONIVA"))
        self.assertTrue(statements[1][0].startswith("UPDATE CONIVA"))
        self.assertEqual([item[2] for item in statements[0][1][-4:]], [100, 19, -50, -9.5])

    def test_failed_rebuild_rolls_back(self):
        connection = FakeConnection()

        @contextmanager
        def fake_connection():
            yield connection

        with patch.object(iva, "ads_odbc_connection", fake_connection), patch.object(
            iva, "_validate", return_value=(27, {"EMPNOM": "Prueba", "EMPNIT": "900"})
        ), patch.object(iva, "_accumulate", side_effect=RuntimeError("falló")):
            with self.assertRaisesRegex(RuntimeError, "falló"):
                iva.rebuild_iva_accumulation("027", 2026, 1, 2)
        self.assertEqual(connection.events, ["begin", "rollback"])

    def test_report_uses_requested_months_and_nets_signed_credit(self):
        with patch.object(iva, "_stream", return_value=iter([
            {"CODIGO": "240805", "NIT": "900", "V0": 100, "V1": 19,
             "V2": -50, "V3": -9.5},
        ])):
            report = iva._report(object(), 27, {"EMPNOM": "Prueba", "EMPNIT": "900"}, 2026, 2, 3)
        self.assertEqual(report["filas"][0][-2:], [50, 9.5])
        self.assertEqual(report["totales"][-2:], [50, 9.5])
        self.assertEqual(report["mesDesde"], 2)
        self.assertEqual(report["mesHasta"], 3)
        xlsx = load_workbook(BytesIO(export_additional_report(report, "xlsx")), read_only=True)
        self.assertEqual(xlsx.active.cell(xlsx.active.max_row, 2).value, "TOTALES")
        pdf = PdfReader(BytesIO(export_additional_report(report, "pdf")))
        self.assertIn("TOTALES", " ".join(page.extract_text() or "" for page in pdf.pages))


if __name__ == "__main__":
    unittest.main()

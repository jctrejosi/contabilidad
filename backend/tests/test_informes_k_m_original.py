"""Regresiones de los diarios K y la definición M por compañía."""

import unittest
from contextlib import nullcontext
from unittest.mock import patch

from backend import diario_centros_original_repository as diario
from backend import flujo_comparativo_original_repository as flujo


class ReportsKMTests(unittest.TestCase):
    def test_k_account_center_day_and_signed_credit(self):
        def fake_read(_connection, sql):
            if "FROM CONEMP" in sql:
                return [{"EMPCOD": 27, "EMPNOM": "Empresa", "EMPNIT": "900"}]
            if "FROM MOV01" in sql:
                self.assertIn("CONCIA = 27", sql)
                self.assertIn("CONMES = 9", sql)
                return [{"CODIGO": "110505", "TFASE": "021", "NIT": "123", "TFECHA": 20260901,
                         "TCOMPR": "01", "TIPODOC": "FV", "TDOCUM": "1", "TDETALLE": "Prueba", "TVALOR": 100},
                        {"CODIGO": "110505", "TFASE": "021", "NIT": "123", "TFECHA": 20260901,
                         "TCOMPR": "01", "TIPODOC": "FV", "TDOCUM": "1", "TDETALLE": "Prueba", "TVALOR": -40}]
            if "FROM CONMAE" in sql:
                return [{"CODIGO": "110505", "MNOMBRE": "Caja"}]
            if "FROM CONCECOS" in sql:
                return [{"CODIGO": "021", "NOMBRE": "Administración"}]
            if "FROM FADCLI" in sql:
                return [{"CCODIGO": "123", "CNOMBRE": "Cliente"}]
            raise AssertionError(sql)

        with patch.object(diario, "ads_odbc_connection", return_value=nullcontext(object())), \
             patch.object(diario, "_read", side_effect=fake_read):
            report = diario.build_center_journal("diario-rangos-continuos", "027", 2026, 9)
        self.assertEqual(report["filas"][-1][-2:], [100.0, -40.0])
        self.assertTrue(any(str(row[0]).startswith("TOTAL DÍA") for row in report["filas"]))

    def test_m_creation_is_scoped_to_company(self):
        class FakeConnection:
            def BeginTrans(self): pass
            def CommitTrans(self): pass
            def RollbackTrans(self): raise AssertionError("No debe fallar")

        statements = []
        def fake_read(_connection, sql):
            if "FROM CONMAE" in sql:
                return [{"CODIGO": "1105"}]
            if "FROM CONINF1" in sql:
                return []
            raise AssertionError(sql)

        with patch.object(flujo, "ads_connection", return_value=nullcontext(FakeConnection())), \
             patch.object(flujo, "_read", side_effect=fake_read), \
             patch.object(flujo, "_execute", side_effect=lambda _c, sql, params: statements.append((sql, params))):
            result = flujo.save_flow_definition("027", {"nivel": "0101", "cuenta": "1105",
                "nombre": "Caja", "tipo": "+", "presupuesto": 100, "valorBase": True})
        self.assertEqual(result["nivel"], "0101")
        self.assertIn("INSERT INTO CONINF1 (CIA,", statements[0][0])
        self.assertEqual(statements[0][1][0][2], 27)

    def test_m_annual_comparison_uses_defined_account(self):
        def fake_read(_connection, sql):
            if "FROM CONEMP" in sql:
                return [{"EMPCOD": 27, "EMPNOM": "Actual", "EMPNIT": "900"},
                        {"EMPCOD": 26, "EMPNOM": "Anterior", "EMPNIT": "800"}]
            if "FROM CONCTR" in sql:
                return [{"CTANO": 2026}]
            if "FROM CONINF1" in sql:
                return [{"NIVEL": "0101", "CUENTA": "1105", "NOMBRE": "Caja", "TIPO": "+",
                         "PPTO": 2_000_000, "VLRBASE": True}]
            if "FROM CONMAE" in sql:
                debit = 1_000_000 if "CIA = 27" in sql else 500_000
                return [{"CODIGO": "1105", "MACMDEB01": debit}]
            raise AssertionError(sql)

        with patch.object(flujo, "ads_odbc_connection", return_value=nullcontext(object())), \
             patch.object(flujo, "_read", side_effect=fake_read):
            report = flujo.build_flow_comparison("027", 2026, "026")
        self.assertEqual(report["filas"][0][1], 1.0)
        self.assertEqual(report["filas"][0][13], 1.0)
        self.assertEqual(report["filas"][0][15], 0.5)
        from backend.informes_adicionales_repository import export_additional_report
        self.assertTrue(export_additional_report(report, "xlsx"))
        self.assertTrue(export_additional_report(report, "pdf"))


if __name__ == "__main__":
    unittest.main()

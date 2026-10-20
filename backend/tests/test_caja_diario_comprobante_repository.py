"""Pruebas de la opción E y del resumen INFOR12G."""

import unittest
from unittest.mock import patch

from backend import caja_diario_comprobante_repository as journal


class CajaDiarioComprobanteTests(unittest.TestCase):
    def test_groups_voucher_and_account_then_builds_hierarchical_summary(self):
        def fake_read(_connection, sql):
            if "FROM CONEMP" in sql:
                return [{"EMPCOD": 27, "EMPNOM": "Empresa", "EMPNIT": "800"}]
            if "FROM CONTICOM" in sql:
                return [{"CODIGO": "01", "NOMBRE": "Caja"}, {"CODIGO": "99", "NOMBRE": "Otros"}]
            if "FROM VISDOCUM" in sql:
                return [{"CODIGO": "FV", "COMPRO": "01"}]
            if "FROM CONMAE" in sql:
                return [{"CODIGO": "11", "MNOMBRE": "Efectivo"},
                        {"CODIGO": "1105", "MNOMBRE": "Caja"}]
            if "FROM MOV01" in sql:
                return [
                    {"TCOMPR": "", "TIPODOC": "FV", "CODIGO": "110505001",
                     "DEBITO": 100, "CREDITO": 0},
                    {"TCOMPR": "01", "TIPODOC": "FV", "CODIGO": "110505002",
                     "DEBITO": 0, "CREDITO": -40},
                ]
            raise AssertionError(sql)

        with patch.object(journal, "ads_connection"), patch.object(journal, "_read", side_effect=fake_read):
            report = journal.build_cash_journal_by_voucher("027", 2026, 9, level=2)
        self.assertEqual(report["filas"][0][:2], ["01", "Caja"])
        self.assertEqual(report["filas"][1], ["1105", "Caja", 100.0, 40.0])
        self.assertEqual(report["filas"][2][-2:], [100.0, 40.0])
        self.assertEqual(report["filas"][3][-2:], [100.0, 40.0])
        self.assertEqual(report["filas"][-1], ["1105", "Caja", 100.0, -40.0])

    def test_rejects_inverted_range(self):
        with self.assertRaisesRegex(ValueError, "comprobante inicial"):
            journal.build_cash_journal_by_voucher("027", 2026, 9,
                                                  voucher_from="99", voucher_to="01")


if __name__ == "__main__":
    unittest.main()

"""Reglas de INFOR11 adaptadas a MOV01 y CONTERCE."""

import unittest
from unittest.mock import patch

from backend import diario_cuenta_repository as journal


class DiarioCuentaTests(unittest.TestCase):
    def test_groups_by_account_and_third_with_signed_credit(self):
        movements = [
            {"CODIGO": "110505", "NIT": "123", "TFECHA": 20260901, "TCOMPR": "01",
             "TIPODOC": "FV", "TDOCUM": "1", "TDETALLE": "Compra", "TVALOR": 120},
            {"CODIGO": "110505", "NIT": "123", "TFECHA": 20260902, "TCOMPR": "01",
             "TIPODOC": "FV", "TDOCUM": "2", "TDETALLE": "Pago", "TVALOR": -20},
            {"CODIGO": "110505", "NIT": "456", "TFECHA": 20260903, "TCOMPR": "01",
             "TIPODOC": "FV", "TDOCUM": "3", "TDETALLE": "Otro", "TVALOR": -50},
        ]

        def fake_read(_connection, sql):
            if "FROM CONEMP" in sql:
                return [{"EMPCOD": 27, "EMPNOM": "Compañía", "EMPNIT": "800"}]
            if "FROM MOV01" in sql:
                return movements
            if "FROM CONMAE" in sql:
                return [{"CODIGO": "110505", "MNOMBRE": "Caja"}]
            if "FROM CONTERCE" in sql:
                return [{"CODIGO": "110505", "NIT": "123", "MNOMBRE": "Tercero 123"},
                        {"CODIGO": "110505", "NIT": "456", "MNOMBRE": "Tercero 456"}]
            raise AssertionError(sql)

        with patch.object(journal, "ads_connection"), patch.object(journal, "_read", side_effect=fake_read):
            report = journal.build_account_journal("027", 2026, 9)

        self.assertEqual(report["tipos"], ["detalle", "detalle", "subtotal", "detalle", "subtotal", "total-general"])
        self.assertEqual(report["filas"][0][2:4], ["Tercero 123", "2026/09/01"])
        self.assertEqual(report["filas"][2][-2:], [120.0, -20.0])
        self.assertEqual(report["filas"][-1][-2:], [120.0, -70.0])

    def test_rejects_inverted_range(self):
        with self.assertRaisesRegex(ValueError, "cuenta inicial"):
            journal.build_account_journal("027", 2026, 9, account_from="2", account_to="1")


if __name__ == "__main__":
    unittest.main()

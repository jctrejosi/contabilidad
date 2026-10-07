"""Regresión de acumulación de retenciones sin modificar la base Advantage."""

import unittest
from contextlib import contextmanager
from unittest.mock import patch

from backend import retenciones_acumulacion_repository as ret


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


class RetencionesAcumulacionTest(unittest.TestCase):
    def test_source_filters_company_period_and_retention_accounts(self):
        sql = ret._retention_sql(27, 2026, 2, 3)
        for fragment in ("m.CONCIA = 27", "m.CONANO = 2026", "m.CONMES >= 2",
                         "m.CONMES <= 3", "a.MIVA_RET = 'R'", "a.MTC = TRUE"):
            self.assertIn(fragment, sql)

    def test_calculation_separates_debit_credit_and_uses_cxp_base_once(self):
        movements = [
            {"CONMES": 2, "CODIGO": "2365", "NIT": "900", "TIPODOC": "FV",
             "TDOCUM": "123", "TVALOR": 10, "TBASE": 0, "PORIVARET": 1},
            {"CONMES": 2, "CODIGO": "2365", "NIT": "900", "TIPODOC": "FV",
             "TDOCUM": "123", "TVALOR": 10, "TBASE": 0, "PORIVARET": 1},
            {"CONMES": 2, "CODIGO": "2365", "NIT": "900", "TIPODOC": "FV",
             "TDOCUM": "124", "TVALOR": -5, "TBASE": 50, "PORIVARET": 0},
        ]

        def stream(_connection, sql):
            return iter(movements if "INNER JOIN CONMAE" in sql else [])

        with patch.object(ret, "_stream", side_effect=stream), patch.object(
            ret, "_cxp_bases", return_value={("123", "FV", "900"): [(10, 100, 19)]}
        ), patch.object(ret, "_iva_document_bases", return_value={}):
            result = ret._calculate(object(), 27, 2026, 2, 2)
        monthly = result[("2365", "900")]
        self.assertEqual(monthly["BASE02"], 38)
        self.assertEqual(monthly["VALOR02"], 20)
        self.assertEqual(monthly["BASCO02"], 100)
        self.assertEqual(monthly["BASE02C"], -50)
        self.assertEqual(monthly["VALOR02C"], -5)

    def test_replace_cleans_unassigned_rows_and_only_requested_months(self):
        connection = FakeConnection()
        commands = []
        with patch.object(ret, "_stream", return_value=iter([])), patch.object(
            ret, "_execute", side_effect=lambda _connection, sql, params: commands.append((sql, params))
        ):
            count = ret._replace(connection, 27, 2026, 2, 2,
                                 {("2365", "900"): {"BASE02": 100, "VALOR02": 10}})
        self.assertEqual(count, 1)
        self.assertEqual(connection.statements[0], "DELETE FROM CONRET WHERE CIA IS NULL OR ANO IS NULL")
        self.assertIn("BASE02 = 0", connection.statements[1])
        self.assertNotIn("BASE01 = 0", connection.statements[1])
        self.assertIn("WHERE CIA = 27 AND ANO = 2026", connection.statements[1])
        self.assertIn("INSERT INTO CONRET", commands[0][0])

    def test_failure_rolls_back(self):
        connection = FakeConnection()

        @contextmanager
        def fake_connection():
            yield connection

        with patch.object(ret, "ads_odbc_connection", fake_connection), patch.object(
            ret, "_validate", return_value=(27, {"EMPNOM": "Prueba", "EMPNIT": "900"})
        ), patch.object(ret, "_calculate", return_value={}), patch.object(
            ret, "_replace", side_effect=RuntimeError("falló")
        ):
            with self.assertRaisesRegex(RuntimeError, "falló"):
                ret.rebuild_retention_accumulation("027", 2026, 2, 2)
        self.assertEqual(connection.events, ["begin", "rollback"])


if __name__ == "__main__":
    unittest.main()

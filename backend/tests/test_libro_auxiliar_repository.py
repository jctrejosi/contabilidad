"""Casos de regresión para INFOR03 e INFOR03_2 sin abrir Advantage."""

import unittest
from contextlib import contextmanager
from unittest.mock import patch

from backend import libro_auxiliar_repository as book


class LibroAuxiliarTest(unittest.TestCase):
    def setUp(self) -> None:
        @contextmanager
        def connection():
            yield object()

        self.connection_patch = patch.object(book, "ads_odbc_connection", connection)
        self.connection_patch.start()
        self.addCleanup(self.connection_patch.stop)
        self.real_movement_reader = book._read_movements
        self.movement_patch = patch.object(
            book, "_read_movements",
            side_effect=lambda connection, _where, _order: iter(self._query(connection, "FROM MOV01")),
        )
        self.movement_patch.start()
        self.addCleanup(self.movement_patch.stop)

    def _query(self, _connection: object, sql: str):
        if "FROM CONEMP" in sql:
            return [{"EMPCOD": 27, "EMPNOM": "Prueba", "EMPNIT": "123"}]
        if "FROM CONCTR" in sql:
            return [{"CTANO": 2025}]
        if "FROM CONMAE" in sql:
            return [{"CODIGO": "110505", "MNOMBRE": "Caja", "MTC": True,
                     "MCTAPAGOS": False, "TIPONIIF": "10", "MSALDO": 100,
                     "MACMDEB01": 20, "MACMCRE01": -5}]
        if "FROM MOV01" in sql:
            return [
                {"CODIGO": "110505", "NIT": "123", "TFECHA": 20250201,
                 "CONMES": 2, "TCOMPR": "01", "TDOCUM": "F1", "TDOCUM2": "A1",
                 "TIPODOC": "FV", "TDETALLE": "Antes", "TVALOR": 10, "TSEC": 1},
                {"CODIGO": "110505", "NIT": "123", "TFECHA": 20250215,
                 "CONMES": 2, "TCOMPR": "01", "TDOCUM": "F2", "TDOCUM2": "A1",
                 "TIPODOC": "FV", "TDETALLE": "Durante", "TVALOR": -30, "TSEC": 2},
            ]
        if "FROM CONTERCE" in sql:
            return []
        if "FROM FADCLI" in sql:
            return [{"CNOMBRE": "Tercero de prueba"}]
        raise AssertionError(sql)

    def test_general_uses_account_opening_and_prior_days(self):
        with patch.object(book, "_read", side_effect=self._query):
            result = book.build_auxiliary_book(
                "aux-gral", "027", 2025, 2, 2,
                date_from="2025-02-10", date_to="2025-02-28",
                account_from="110505", account_to="110505",
            )
        self.assertEqual(result["filas"][0][8], 125)  # 100 + 20 - 5 + 10.
        self.assertEqual(result["filas"][1][3], "F2")
        self.assertEqual(result["filas"][1][8], 95)
        self.assertEqual(result["filas"][-1][6:9], [0, 30, 95])
        self.assertEqual(result["tipos"], ["seccion", "movimiento", "subtotal", "total-general"])

    def test_affected_document_uses_prior_months_for_opening(self):
        def query(connection: object, sql: str):
            if "FROM MOV01" in sql:
                return [
                    {"CODIGO": "110505", "TFECHA": 20250115, "CONMES": 1,
                     "TVALOR": 40, "TDOCUM": "F1", "TDOCUM2": "A1"},
                    {"CODIGO": "110505", "TFECHA": 20250215, "CONMES": 2,
                     "TVALOR": -15, "TDOCUM": "F2", "TDOCUM2": "A1"},
                ]
            return self._query(connection, sql)

        with patch.object(book, "_read", side_effect=query), patch.object(
            book, "_read_movements",
            side_effect=lambda connection, _where, _order: iter(query(connection, "FROM MOV01")),
        ):
            result = book.build_auxiliary_book(
                "aux-doc-afectado", "027", 2025, 2, 2, affected_document="A1")
        self.assertEqual(result["filas"][0][8], 40)
        self.assertEqual(result["filas"][1][0], "110505")
        self.assertEqual(result["filas"][1][8], 25)
        self.assertEqual(result["filas"][-1][6:9], [0, 15, 25])

    def test_rejects_cross_year_date_range(self):
        with self.assertRaisesRegex(ValueError, "ejercicio 2025"):
            book.build_auxiliary_book(
                "aux-gral", "027", 2025, 1, 2,
                date_from="2024-12-31", date_to="2025-02-01",
            )

    def test_general_includes_accounts_regardless_of_old_classification(self):
        account_sql = []

        def query(connection: object, sql: str):
            rows = self._query(connection, sql)
            if "FROM CONMAE" in sql:
                account_sql.append(sql)
                rows[0]["TIPONIIF"] = "70"
            return rows

        with patch.object(book, "_read", side_effect=query):
            result = book.build_auxiliary_book(
                "aux-gral", "027", 2025, 2, 2,
                date_from="2025-02-01", date_to="2025-02-28",
            )
        self.assertIn("seccion", result["tipos"])
        self.assertNotIn("TIPONIIF", account_sql[0])

    def test_general_includes_more_than_twenty_thousand_movements(self):
        row = {"CODIGO": "110505", "NIT": "123", "TFECHA": 20250215,
               "CONMES": 2, "TCOMPR": "01", "TDOCUM": "F2",
               "TIPODOC": "FV", "TDETALLE": "Partida", "TVALOR": 1, "TSEC": 1}

        with patch.object(book, "_read", side_effect=self._query), patch.object(
            book, "_read_movements", return_value=iter([row] * 20001),
        ):
            result = book.build_auxiliary_book(
                "aux-gral", "027", 2025, 2, 2,
                date_from="2025-02-01", date_to="2025-02-28",
            )
        self.assertEqual(result["count"], 20004)
        self.assertEqual(result["filas"][-1][6:9], [20001, 0, 20116])

    def test_ado_reader_fetches_in_batches_without_sql_limit(self):
        class Fields:
            Count = 2

            @staticmethod
            def Item(index):
                return type("Field", (), {"Name": ("CODIGO", "TVALOR")[index]})()

        class Recordset:
            EOF = False

            def __init__(self):
                self.Fields = Fields()
                self.batch_sizes = []
                self.closed = False

            def GetRows(self, size):
                self.batch_sizes.append(size)
                self.EOF = True
                return (("110505",), (1,))

            def Close(self):
                self.closed = True

        recordset = Recordset()
        captured = []

        def open_recordset(_connection, sql):
            captured.append(sql)
            return recordset

        with patch.object(book, "_open_recordset", side_effect=open_recordset):
            rows = list(self.real_movement_reader(object(), "CONCIA = 27", "CODIGO"))
        self.assertEqual(rows, [{"CODIGO": "110505", "TVALOR": 1}])
        self.assertEqual(recordset.batch_sizes, [1000])
        self.assertTrue(recordset.closed)
        self.assertNotIn("TOP", captured[0])


if __name__ == "__main__":
    unittest.main()

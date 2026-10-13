"""Ejemplos de MEDMAG04 y garantías de reemplazo por compañía, sin escribir ADS."""

import re
import unittest
from contextlib import ExitStack, contextmanager
from unittest.mock import MagicMock, patch

from backend import medios_generacion_repository as medios


def assignment(**changes):
    row = {"CUENTA": "4135", "FORMATO": "1001", "CONCEPTO": "5001",
           "TIPO": "C", "CUENTA2": "", "TIPOMED": 1, "MODCXP": 1,
           "COLVALOR": 1, "COLBASE": 2, "MOVTIPO": 1, "COLUMNA2": 0,
           "NATURAL": False, "CIA": 27}
    row.update(changes)
    return row


def movement(**changes):
    row = {"CODIGO": "4135", "NIT": "900123", "TFECHA": 20260115,
           "TCOMPR": "01", "TFASE": "L1", "TIPODOC": "FV", "TDOCUM": "123",
           "TDOCUM2": "", "TDETALLE": "Venta", "TVALOR": -100.0, "TBASE": 0}
    row.update(changes)
    return row


class GenerationTests(unittest.TestCase):
    def run_generation(self, definitions, movements=None, balances=None, invoices=None,
                       first=1, last=1, missing_cxp=False, fail_insert=False):
        connection = MagicMock()
        writes = []
        self.connection = connection
        self.writes = writes

        @contextmanager
        def connect(**_kwargs):
            yield connection

        def read(_connection, sql):
            if "FROM CONEMP" in sql:
                return [{"EMPCOD": 27}]
            if "FROM CONCTR" in sql:
                return [{"CTANO": 2026}]
            if "FROM CONMAG3" in sql:
                return definitions
            if "FROM XADMAE" in sql:
                return invoices or []
            raise AssertionError(sql)

        def stream(_connection, sql):
            if "FROM FADCLI" in sql:
                return iter([{"CCODIGO": "900123", "CDIGITO": "8"}])
            if "FROM MOV01" in sql:
                self.assertIn("CONCIA = 27", sql)
                self.assertIn("CONANO = 2026", sql)
                account = re.search(r"CODIGO = '([0-9]+)'", sql)[1]
                month = int(re.search(r"CONMES = ([0-9]+)", sql)[1])
                return iter((movements or {}).get((month, account), []))
            if "FROM CONTERCE" in sql:
                self.assertIn("CIA = 27", sql)
                return iter(balances or [])
            raise AssertionError(sql)

        def schema(_connection, table, _required):
            if missing_cxp and table == "XADMAE":
                raise medios.MediosGeneracionError("Falta XADMAE en el diccionario activo.")

        def execute(_connection, sql, params):
            if fail_insert and sql.startswith("INSERT"):
                raise RuntimeError("Fallo simulado de escritura")
            writes.append((sql, [value for _type, _size, value in params]))

        with ExitStack() as stack:
            for name, replacement in (("ads_odbc_connection", connect), ("_read", read),
                                      ("_stream", stream), ("_schema", schema),
                                      ("_check_references", lambda *_args: None),
                                      ("_execute", execute)):
                stack.enter_context(patch.object(medios, name, replacement))
            result = medios.generate_medios("027", first, last)
        return result, writes

    def detail(self):
        return [values for sql, values in self.writes if sql.startswith("INSERT INTO CONMAGIT")]

    def totals(self):
        return [values for sql, values in self.writes if sql.startswith("INSERT INTO CONMAGDT")]

    def test_direct_filters_documents_and_preserves_credit_orientation(self):
        result, _writes = self.run_generation(
            [assignment(DOCX="FV")],
            {(1, "4135"): [movement(), movement(TIPODOC="NC", TVALOR=50)]})
        self.assertEqual(result["partidas"], 1)
        self.assertEqual(self.detail()[0][12], 100)
        self.assertEqual(self.totals()[0][6:8], [100, 0])
        self.assertEqual(self.totals()[0][5], "8")

    def test_bimonthly_parameter_splits_main_and_secondary_format(self):
        self.run_generation([assignment(PMED2=.7, COLUMNA2=2, FORMATO2="1002", CONCEPTO2="5002")],
                            {(3, "4135"): [movement(TFECHA=20260315)]}, first=3, last=3)
        self.assertEqual([r[12] for r in self.detail()], [-70, -30])
        self.assertEqual([r[2] for r in self.detail()], ["1001", "1002"])
        self.assertEqual(self.totals()[1][6:8], [0, -30])

    def test_second_account_keeps_each_partida_and_marks_it_across_assignments(self):
        first = assignment(CUENTA2="2365", MOVTIPO=2)
        second = assignment(CUENTA2="2365", MOVTIPO=2, FORMATO="1002")
        self.run_generation([first, second], {
            (1, "4135"): [movement()],
            (1, "2365"): [movement(CODIGO="2365", TVALOR=-80),
                          movement(CODIGO="2365", TVALOR=-20),
                          movement(CODIGO="2365", TDOCUM="999", TVALOR=-90)]})
        self.assertEqual([r[12] for r in self.detail()], [80, 20])
        self.assertEqual(len(self.totals()), 1)
        self.assertEqual(self.totals()[0][6], 100)

    def test_natural_reverses_second_account_amount(self):
        self.run_generation([assignment(CUENTA2="2365", MOVTIPO=2, NATURAL=True)],
                            {(1, "4135"): [movement()],
                             (1, "2365"): [movement(CODIGO="2365", TVALOR=-100)]})
        self.assertEqual(self.detail()[0][12], -100)

    def test_retention_branch_uses_absolute_base_and_document_key(self):
        self.run_generation([assignment(MODCXP=3, CUENTA2="2365")], {
            (1, "4135"): [movement()],
            (1, "2365"): [movement(CODIGO="2365", TBASE=-80)]})
        self.assertEqual([r[12] for r in self.detail()], [80, 20])
        self.assertEqual(self.totals()[0][6:8], [80, 20])

    def test_cxp_branch_splits_base_and_iva_proportionally(self):
        self.run_generation([assignment(CUENTA="2205", MODCXP=2)],
                            {(1, "2205"): [movement(CODIGO="2205", TVALOR=-119)]},
                            invoices=[{"CVLRBRU": 1000, "CVLRIVA": 190}])
        self.assertEqual([r[12] for r in self.detail()], [100, 19])
        self.assertEqual(self.totals()[0][6:8], [100, 19])

    def test_annual_saldo_adds_signed_credits_and_ignores_selected_months(self):
        result, _writes = self.run_generation([assignment(CUENTA="1305", TIPOMED=4)],
            balances=[{"CODIGO": "1305", "NIT": "900123", "MSALDO": 100,
                       "MACMDEB01": 20, "MACMCRE01": -5, "MACMDEB12": 10}], first=3, last=4)
        self.assertEqual(result["partidas"], 1)
        self.assertEqual(self.detail()[0][12], 125)
        self.assertEqual(self.detail()[0][5], 0)

    def test_zero_main_partida_is_preserved_like_original(self):
        self.run_generation([assignment()], {(1, "4135"): [movement(TVALOR=0)]})
        self.assertEqual(len(self.detail()), 1)
        self.assertEqual(len(self.totals()), 1)

    def test_replacement_only_targets_requested_company_and_commits_together(self):
        self.run_generation([assignment()], {(1, "4135"): [movement()]})
        deletes = [(sql, values) for sql, values in self.writes if sql.startswith("DELETE")]
        self.assertEqual(deletes, [("DELETE FROM CONMAGIT WHERE CIA = ?", [27]),
                                   ("DELETE FROM CONMAGDT WHERE CIA = ?", [27])])
        self.assertTrue(all(values[0] == 27 for _sql, values in self.writes))
        self.connection.BeginTrans.assert_called_once()
        self.connection.CommitTrans.assert_called_once()
        self.connection.RollbackTrans.assert_not_called()

    def test_write_failure_rolls_back_both_output_tables(self):
        with self.assertRaisesRegex(RuntimeError, "Fallo simulado"):
            self.run_generation([assignment()], {(1, "4135"): [movement()]}, fail_insert=True)
        self.connection.RollbackTrans.assert_called_once()
        self.connection.CommitTrans.assert_not_called()

    def test_missing_cxp_dependency_does_not_delete_previous_generation(self):
        with self.assertRaisesRegex(medios.MediosGeneracionError, "XADMAE"):
            self.run_generation([assignment(MODCXP=2)], missing_cxp=True)
        self.assertEqual(self.writes, [])
        self.connection.BeginTrans.assert_not_called()

    def test_missing_assignments_do_not_delete_previous_generation(self):
        with self.assertRaisesRegex(medios.MediosGeneracionError, "No hay cuentas"):
            self.run_generation([])
        self.assertEqual(self.writes, [])

    def test_invalid_month_range_rejected_before_connection(self):
        with patch.object(medios, "ads_odbc_connection") as connect:
            with self.assertRaises(ValueError):
                medios.generate_medios("027", 12, 1)
            connect.assert_not_called()


if __name__ == "__main__":
    unittest.main()

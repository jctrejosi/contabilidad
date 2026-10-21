"""Prueba experimental de unión: no depende de Advantage en desarrollo."""
import unittest
from decimal import Decimal
from unittest.mock import Mock, patch
from backend.reproceso_benchmark import _staging_comparison, benchmark


class StagingTests(unittest.TestCase):
    def test_flags_mutually_exclusive(self):
        with self.assertRaises(ValueError):
            benchmark("026", 3, 3000, confirmed=True, staging=True, extended=True)

    def test_both_methods_restore_and_drop_only_after_rollback(self):
        connection = Mock()
        original = {7: (Decimal("5"), None)}
        changed = {7: (Decimal("5.01"), Decimal(0))}
        with patch("backend.reproceso_benchmark._read_sample", return_value=original), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[changed, original, changed, original]), \
             patch("backend.reproceso_benchmark._execute") as insert:
            result = _staging_comparison(connection, 26, 3, 250, [], lambda _: None)
        self.assertEqual(len(result["resultados"]), 2)
        self.assertEqual(connection.RollbackTrans.call_count, 2)
        connection.CommitTrans.assert_not_called()
        insert.assert_called_once()
        sql = [call.args[0] for call in connection.Execute.call_args_list]
        self.assertTrue(any("INNER JOIN #DSIRP" in statement and "CONTERCE.CIA = 26" in statement for statement in sql))
        self.assertTrue(sql[-1].startswith("DROP TABLE #DSIRP"))
        self.assertEqual(connection.mock_calls[-2][0], "RollbackTrans")
        self.assertEqual(connection.mock_calls[-1][0], "Execute")

    def test_unsupported_create_never_opens_target_transaction(self):
        connection = Mock()
        original = {7: (Decimal(5), None)}
        changed = {7: (Decimal("5.01"), 0)}
        def execute(sql):
            if sql.startswith("CREATE TABLE"):
                raise RuntimeError("syntax")
        connection.Execute.side_effect = execute
        with patch("backend.reproceso_benchmark._read_sample", return_value=original), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[changed, original]):
            with self.assertRaisesRegex(RuntimeError, "syntax"):
                _staging_comparison(connection, 26, 3, 250, [], lambda _: None)
        self.assertEqual(connection.BeginTrans.call_count, 1)  # Solo referencia CASE.
        connection.CommitTrans.assert_not_called()
        self.assertFalse(any(c.args[0].startswith("DROP") for c in connection.Execute.call_args_list))

    def test_failed_join_rolls_back_and_drops_temp(self):
        connection = Mock()
        original = {7: (5, None)}
        changed = {7: (Decimal("5.01"), 0)}
        def execute(sql):
            if "INNER JOIN" in sql:
                raise RuntimeError("join")
        connection.Execute.side_effect = execute
        with patch("backend.reproceso_benchmark._read_sample", return_value=original), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[changed, original]), \
             patch("backend.reproceso_benchmark._execute"):
            with self.assertRaisesRegex(RuntimeError, "join"):
                _staging_comparison(connection, 26, 3, 250, [], lambda _: None)
        self.assertEqual(connection.RollbackTrans.call_count, 2)
        self.assertTrue(connection.Execute.call_args.args[0].startswith("DROP"))

    def test_failed_rollback_skips_ddl_cleanup(self):
        connection = Mock()
        original = {7: (5, None)}
        changed = {7: (Decimal("5.01"), 0)}
        connection.RollbackTrans.side_effect = [None, RuntimeError("rollback")]
        with patch("backend.reproceso_benchmark._read_sample", return_value=original), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[changed, original, changed]), \
             patch("backend.reproceso_benchmark._execute"):
            with self.assertRaisesRegex(RuntimeError, "rollback"):
                _staging_comparison(connection, 26, 3, 250, [], lambda _: None)
        self.assertFalse(any(c.args[0].startswith("DROP") for c in connection.Execute.call_args_list))

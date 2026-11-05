"""Pruebas del arnés, sin escrituras Advantage reales."""
import unittest
from contextlib import nullcontext
from decimal import Decimal
from unittest.mock import Mock, patch
from backend.reproceso_benchmark import benchmark, _extended, _case_write


class BenchmarkTests(unittest.TestCase):
    def test_extended_requires_enough_rows_and_remains_bounded(self):
        for count in (250, 2999, 10001):
            with self.assertRaises(ValueError):
                benchmark("026", 3, count, confirmed=True, extended=True)

    def test_extended_rotates_sizes_and_rolls_back_all_nine_trials(self):
        connection = Mock()
        original = {7: (Decimal("5"), None)}
        changed = {7: (Decimal("5.01"), Decimal("0"))}
        with patch("backend.reproceso_benchmark._query_rows", return_value=[{"FIRST_ID": 1, "LAST_ID": 99}]), \
             patch("backend.reproceso_benchmark._read_sample", return_value=original), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[v for _ in range(9) for v in (changed, original)]):
            result = _extended(connection, 26, 3, 3000, [], lambda _: None)
        self.assertEqual([r["tamano"] for r in result["resultados"]],
                         [250, 500, 1000, 500, 1000, 250, 1000, 250, 500])
        self.assertEqual(connection.RollbackTrans.call_count, 9)
        connection.CommitTrans.assert_not_called()

    def test_case_progress_covers_consecutive_blocks(self):
        connection = Mock()
        events = []
        values = [(n, Decimal("1"), Decimal("-2")) for n in range(1, 2101)]
        _case_write(connection, 26, 3, values, 1000, events.append)
        self.assertEqual(connection.Execute.call_count, 3)
        self.assertEqual([(e["desde"], e["hasta"]) for e in events if e["etapa"] == "fin_bloque"],
                         [(1, 1000), (1001, 2000), (2001, 2100)])
        self.assertTrue(all("CIA = 26" in call.args[0] for call in connection.Execute.call_args_list))

    def test_extended_failed_verification_rolls_back_and_stops(self):
        connection = Mock()
        with patch("backend.reproceso_benchmark._query_rows", return_value=[{"FIRST_ID": 1, "LAST_ID": 99}]), \
             patch("backend.reproceso_benchmark._read_sample", return_value={7: (1, 0)}), \
             patch("backend.reproceso_benchmark._read_ids", return_value={7: (999, 0)}):
            with self.assertRaisesRegex(ValueError, "no coincide"):
                _extended(connection, 26, 3, 3000, [], lambda _: None)
        connection.RollbackTrans.assert_called_once()
        connection.CommitTrans.assert_not_called()

    def test_requires_explicit_confirmation_and_bounded_sample(self):
        with self.assertRaises(ValueError):
            benchmark("026", 3)
        for month, count in [(0, 250), (13, 250), (3, 1001), (3, 0)]:
            with self.assertRaises(ValueError):
                benchmark("026", month, count, confirmed=True)

    def test_each_method_verifies_write_and_rollback_never_commits(self):
        connection = Mock()
        original = {7: (Decimal("5.00"), None)}
        changed = {7: (Decimal("5.01"), Decimal("0"))}
        reads = [original] + [r for _ in range(4) for r in (changed, original)]
        with patch("backend.reproceso_benchmark.ads_odbc_connection", return_value=nullcontext(connection)), \
             patch("backend.reproceso_benchmark._query_rows", return_value=[]), \
             patch("backend.reproceso_benchmark._read_sample", side_effect=reads), \
             patch("backend.reproceso_benchmark._case_write") as case, \
             patch("backend.reproceso_benchmark._prepared_write") as prepared:
            result = benchmark("026", 3, confirmed=True, emit=lambda _: None)
        self.assertEqual(len(result["resultados"]), 4)
        self.assertEqual(connection.RollbackTrans.call_count, 4)
        connection.CommitTrans.assert_not_called()
        self.assertEqual(case.call_count, 3)
        prepared.assert_called_once()

    def test_write_error_rolls_back_and_stops(self):
        connection = Mock()
        with patch("backend.reproceso_benchmark.ads_odbc_connection", return_value=nullcontext(connection)), \
             patch("backend.reproceso_benchmark._query_rows", return_value=[]), \
             patch("backend.reproceso_benchmark._read_sample", return_value={7: (1, 0)}), \
             patch("backend.reproceso_benchmark._case_write", side_effect=RuntimeError("motor")) as case:
            with self.assertRaisesRegex(RuntimeError, "motor"):
                benchmark("026", 3, confirmed=True, emit=lambda _: None)
        connection.RollbackTrans.assert_called_once()
        connection.CommitTrans.assert_not_called()
        case.assert_called_once()

    def test_failed_restoration_does_not_try_next_method(self):
        connection = Mock()
        with patch("backend.reproceso_benchmark.ads_odbc_connection", return_value=nullcontext(connection)), \
             patch("backend.reproceso_benchmark._query_rows", return_value=[]), \
             patch("backend.reproceso_benchmark._read_sample", side_effect=[{7: (1, 0)}, {7: (Decimal("1.01"), 0)}, {7: (2, 0)}]), \
             patch("backend.reproceso_benchmark._case_write") as case:
            with self.assertRaisesRegex(ValueError, "restauración"):
                benchmark("026", 3, confirmed=True, emit=lambda _: None)
        case.assert_called_once()

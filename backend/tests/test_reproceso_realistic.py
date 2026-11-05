"""Carga realista acotada, sin conexión real al servidor."""
import unittest
from decimal import Decimal as D
from unittest.mock import Mock, patch
from backend.reproceso_benchmark import benchmark, _realistic_comparison, _case_write


class RealisticTests(unittest.TestCase):
    def test_limits_and_exclusive_flags(self):
        for sample in (2999, 30001):
            with self.assertRaises(ValueError):
                benchmark("026", 5, sample, confirmed=True, realistic=True)
        with self.assertRaises(ValueError):
            benchmark("026", 5, 10000, confirmed=True, realistic=True, staging=True)

    def test_deduplicated_windows_restore_each_transaction(self):
        original = {1: (D(5), None), 2: (D(7), D(-1))}
        changed = {1: (D("5.02"), D("-.02")), 2: (D("7.03"), D("-1.03"))}
        connection = Mock()
        with patch("backend.reproceso_benchmark._query_rows", return_value=[{"FIRST_ID": 1, "LAST_ID": 100}]), \
             patch("backend.reproceso_benchmark._read_sample", return_value=original) as read, \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[changed, original, changed, original]):
            result = _realistic_comparison(connection, 26, 5, 10000, [], lambda _: None)
        self.assertEqual(read.call_count, 11)
        self.assertEqual([r["filas"] for r in result["resultados"]], [2, 2])
        self.assertEqual(connection.RollbackTrans.call_count, 2)
        connection.CommitTrans.assert_not_called()

    def test_sql_build_and_ads_call_measured_separately(self):
        events = []
        _case_write(Mock(), 26, 5, [(7, D(1), D(-2))], 1000, events.append)
        self.assertIn("construccionSQLSegundos", events[-1])
        self.assertIn("llamadaADSSegundos", events[-1])
        self.assertGreater(events[-1]["caracteresSQL"], 0)

    def test_write_failure_rolls_back_without_continuing(self):
        connection = Mock()
        connection.Execute.side_effect = RuntimeError("motor")
        with patch("backend.reproceso_benchmark._query_rows", return_value=[{"FIRST_ID": 1, "LAST_ID": 100}]), \
             patch("backend.reproceso_benchmark._read_sample", return_value={1: (D(5), None)}):
            with self.assertRaisesRegex(RuntimeError, "motor"):
                _realistic_comparison(connection, 26, 5, 10000, [], lambda _: None)
        connection.RollbackTrans.assert_called_once()
        connection.CommitTrans.assert_not_called()

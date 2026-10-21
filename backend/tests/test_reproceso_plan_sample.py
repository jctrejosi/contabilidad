import unittest
from decimal import Decimal as D
from types import SimpleNamespace
from unittest.mock import Mock, patch
from backend.reproceso_benchmark import _plan_comparison


def sample(updates):
    return SimpleNamespace(errors=[], third_row_updates={5: updates}, third_values={}, third_existing_ids={})


class PlanSampleTests(unittest.TestCase):
    def test_same_ids_and_amounts_in_both_orders_then_restore(self):
        connection = Mock()
        pending = [(9, D(90), D(-9)), (2, D(20), D(-2))]
        original = {9: (D(1), None), 2: (D(2), D(0))}
        changed = {9: (D(90), D(-9)), 2: (D(20), D(-2))}
        events = []
        with patch("backend.reproceso_benchmark._one", return_value={"CTANO": 2026}), \
             patch("backend.reproceso_benchmark._build_plan", return_value=sample(pending)), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[original, changed, original, changed, original]):
            result = _plan_comparison(connection, 26, 5, 10000, [], events.append)
        sqls = [call.args[0] for call in connection.Execute.call_args_list]
        self.assertIn("ID IN (9,2)", sqls[0])
        self.assertIn("ID IN (2,9)", sqls[1])
        self.assertEqual(connection.RollbackTrans.call_count, 2)
        connection.CommitTrans.assert_not_called()
        self.assertEqual(len(result["resultados"]), 2)

    def test_no_differences_does_not_force_writes(self):
        connection = Mock()
        with patch("backend.reproceso_benchmark._one", return_value={"CTANO": 2026}), \
             patch("backend.reproceso_benchmark._build_plan", return_value=sample([])):
            result = _plan_comparison(connection, 26, 5, 10000, [], lambda _: None)
        self.assertEqual(result["resultados"], [])
        connection.BeginTrans.assert_not_called()

    def test_write_failure_reverts_and_does_not_try_next_order(self):
        connection = Mock()
        connection.Execute.side_effect = RuntimeError("motor")
        with patch("backend.reproceso_benchmark._one", return_value={"CTANO": 2026}), \
             patch("backend.reproceso_benchmark._build_plan", return_value=sample([(9, D(90), D(-9))])), \
             patch("backend.reproceso_benchmark._read_ids", return_value={9: (D(1), None)}):
            with self.assertRaisesRegex(RuntimeError, "motor"):
                _plan_comparison(connection, 26, 5, 10000, [], lambda _: None)
        connection.RollbackTrans.assert_called_once()
        connection.BeginTrans.assert_called_once()
        connection.CommitTrans.assert_not_called()

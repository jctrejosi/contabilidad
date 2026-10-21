import unittest
from decimal import Decimal as D
from types import SimpleNamespace
from unittest.mock import Mock, patch
from backend.reproceso_benchmark import benchmark, _plan_comparison


class ReverseLoadTests(unittest.TestCase):
    def test_limits_and_exclusive_flags(self):
        for count in (9999, 10500, 301000):
            with self.assertRaises(ValueError):
                benchmark("026", 7, count, confirmed=True, reverse_load=True)
        with self.assertRaises(ValueError):
            benchmark("026", 7, 100000, confirmed=True, reverse_load=True, plan_sample=True)

    def test_same_full_blocks_identified_in_reverse_and_no_commit(self):
        pending = [(n, D(n), -D(n)) for n in range(10001, 0, -1)]
        plan = SimpleNamespace(errors=[], third_row_updates={7: pending}, third_values={}, third_existing_ids={})
        selected = pending[:10000]
        original = {n: (D(0), None) for n, _, _ in selected}
        changed = {n: (d, c) for n, d, c in selected}
        connection = Mock()
        calls = []
        def write(conn, company, month, values, size, progress):
            calls.append(list(values))
            for start in range(0, len(values), size):
                progress({"etapa": "fin_bloque", "desde": start + 1, "hasta": start + size,
                          "llamadaADSSegundos": .1, "construccionSQLSegundos": .001})
        with patch("backend.reproceso_benchmark._one", return_value={"CTANO": 2026}), \
             patch("backend.reproceso_benchmark._build_plan", return_value=plan), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[original, changed, original, changed, original]), \
             patch("backend.reproceso_benchmark._case_write", side_effect=write):
            result = _plan_comparison(connection, 26, 7, 11000, [], lambda _: None, reverse_load=True)
        self.assertEqual(calls[0], selected)
        self.assertEqual(calls[1], list(reversed(selected)))
        self.assertEqual([b["grupoOriginal"] for b in result["resultados"][1]["bloques"]], list(range(10, 0, -1)))
        self.assertEqual(result["resultados"][0]["promedioPrimeros5Segundos"], .1)
        self.assertEqual(connection.RollbackTrans.call_count, 2)
        connection.CommitTrans.assert_not_called()

    def test_too_few_differences_does_not_write(self):
        connection = Mock()
        plan = SimpleNamespace(errors=[], third_row_updates={}, third_values={}, third_existing_ids={})
        with patch("backend.reproceso_benchmark._one", return_value={"CTANO": 2026}), \
             patch("backend.reproceso_benchmark._build_plan", return_value=plan):
            result = _plan_comparison(connection, 26, 7, 100000, [], lambda _: None, reverse_load=True)
        self.assertEqual(result["resultados"], [])
        connection.BeginTrans.assert_not_called()

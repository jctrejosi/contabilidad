"""Escritura diferencial: equivalencia con limpiar y reconstruir el período."""
import unittest
import random
from decimal import Decimal as D
from types import SimpleNamespace
from unittest.mock import Mock, patch
from backend.reproceso_mensual_repository import _third_row_differences, _replace_balances


def row(identity, code, nit, debit, credit):
    return dict(ID=identity, CODIGO=code, NIT=nit, MACMDEB01=debit, MACMCRE01=credit)


class DifferentialTests(unittest.TestCase):
    def test_writer_splits_1001_changes_without_losing_last_row(self):
        updates = [(n, D(n), -D(n)) for n in range(1, 1002)]
        sample = SimpleNamespace(company=26, month_from=1, month_to=1,
            accounts={}, account_values={}, third_values={}, third_existing_ids={},
            third_row_updates={1: updates}, third_names={})
        connection = Mock()
        with patch("backend.reproceso_mensual_repository._execute"):
            with self.assertLogs("backend.reproceso_mensual_repository", level="INFO") as captured:
                _replace_balances(connection, sample)
        self.assertEqual(connection.Execute.call_count, 2)
        first, last = [c.args[0] for c in connection.Execute.call_args_list]
        self.assertIn("WHEN 1000 THEN -1000.00", first)
        self.assertNotIn("WHEN 1001 ", first)
        self.assertIn("MACMCRE01 = -1001.00", last)
        self.assertIn("WHERE CIA = 26 AND ID IN (1001)", last)
        self.assertTrue(any("registros 1001-1001/1001" in line for line in captured.output))
        connection.CommitTrans.assert_not_called()

    def test_randomized_rows_match_full_reset_and_rebuild(self):
        rng = random.Random(27)
        for _ in range(50):
            rows, existing, expected = [], {}, {}
            identity = 0
            for key in range(12):
                code, nit = "13", str(key)
                has_movement = rng.choice([True, False])
                if has_movement:
                    expected[(1, code, nit)] = [D(rng.randrange(100)), -D(rng.randrange(100))]
                for duplicate in range(rng.randrange(1, 4)):
                    identity += 1
                    if has_movement and duplicate == 0:
                        existing[(code, nit)] = identity
                    rows.append(row(identity, code, nit, rng.randrange(100), -rng.randrange(100)))
            changes = _third_row_differences(rows, existing, expected, 1, 1)
            actual = {r["ID"]: (D(r["MACMDEB01"]), D(r["MACMCRE01"])) for r in rows}
            for row_id, debit, credit in changes.get(1, []):
                actual[row_id] = (debit, credit)
            for r in rows:
                key = (r["CODIGO"], r["NIT"])
                target = tuple(expected[(1, *key)]) if existing.get(key) == r["ID"] else (D(0), D(0))
                self.assertEqual(actual[r["ID"]], target)

    def test_equal_row_is_not_written(self):
        changes = _third_row_differences([row(1, "13", "9", 50, -20)],
            {("13", "9"): 1}, {(1, "13", "9"): [D(50), D(-20)]}, 1, 1)
        self.assertEqual(changes, {})

    def test_missing_movement_is_zeroed(self):
        changes = _third_row_differences([row(1, "13", "9", 50, -20)], {}, {}, 1, 1)
        self.assertEqual(changes, {1: [(1, D(0), D(0))]})

    def test_duplicate_sum_equal_still_consolidates(self):
        changes = _third_row_differences(
            [row(1, "13", "9", 30, -10), row(2, "13", "9", 20, -10)],
            {("13", "9"): 1}, {(1, "13", "9"): [D(50), D(-20)]}, 1, 1)
        self.assertEqual(changes, {1: [(1, D(50), D(-20)), (2, D(0), D(0))]})

    def test_zero_null_and_empty_duplicate_are_unchanged(self):
        self.assertEqual(_third_row_differences(
            [row(1, "13", "9", 50, -20), row(2, "13", "9", None, None)],
            {("13", "9"): 1}, {(1, "13", "9"): [D(50), D(-20)]}, 1, 1), {})

    def test_accounts_unchanged_skipped_and_obsolete_zeroed(self):
        sample = SimpleNamespace(company=26, month_from=1, month_to=1,
            accounts={"1": SimpleNamespace(current={1: (D(50), D(-20))}),
                      "2": SimpleNamespace(current={1: (D(9), D(0))})},
            account_values={(1, "1"): [D(50), D(-20)]}, third_values={},
            third_existing_ids={}, third_row_updates={}, third_names={})
        connection = Mock()
        with patch("backend.reproceso_mensual_repository._execute") as execute:
            _replace_balances(connection, sample)
        self.assertEqual(execute.call_count, 2)  # Heredados + una cuenta obsoleta.
        self.assertEqual([v for _, _, v in execute.call_args.args[2]], [0.0, 0.0, 26, "2"])
        self.assertIn("AND NOT", execute.call_args_list[0].args[1])
        connection.Execute.assert_not_called()

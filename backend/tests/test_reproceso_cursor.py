import unittest
from decimal import Decimal as D
from types import SimpleNamespace
from unittest.mock import Mock, patch
from backend.reproceso_benchmark import _cursor_write, _plan_comparison, benchmark


class Recordset:
    def __init__(self, identities, supported=True):
        self.ids, self.position = identities, 0
        self.CursorType, self.LockType, self.CursorLocation = 1, 3, 2
        self.Open, self.Close, self.CancelUpdate, self.Update = Mock(), Mock(), Mock(), Mock()
        self.Supports = Mock(return_value=supported)
        self.Fields = SimpleNamespace(Item=lambda _: SimpleNamespace(Value=self.ids[self.position]))

    @property
    def EOF(self):
        return self.position >= len(self.ids)

    def MoveNext(self):
        self.position += 1


class CursorTests(unittest.TestCase):
    def test_updates_exact_values_on_same_connection_and_closes(self):
        connection = Mock()
        rs = Recordset([9, 2])
        with patch("backend.reproceso_benchmark.win32com.client.Dispatch", return_value=rs):
            _cursor_write(connection, 26, 7, [(2, D(20), D(-2)), (9, D(90), D(-9))], lambda _: None)
        self.assertIs(rs.Open.call_args.args[1], connection)
        self.assertIn("CIA = 26 AND ID IN (2,9)", rs.Open.call_args.args[0])
        self.assertEqual(rs.Update.call_args_list[0].args, (("MACMDEB07", "MACMCRE07"), (90., -9.)))
        self.assertEqual(rs.Update.call_count, 2)
        rs.Close.assert_called_once()
        connection.CommitTrans.assert_not_called()

    def test_readonly_or_missing_ids_abort_and_close(self):
        for identities, supported in [([2], False), ([], True), ([2, 2], True)]:
            rs = Recordset(identities, supported)
            with patch("backend.reproceso_benchmark.win32com.client.Dispatch", return_value=rs):
                with self.assertRaises(ValueError):
                    _cursor_write(Mock(), 26, 7, [(2, D(1), D(-1))], lambda _: None)
            rs.Close.assert_called_once()
            rs.CancelUpdate.assert_called_once()
            if not supported:
                rs.Update.assert_not_called()

    def test_cursor_error_rolls_back_and_never_commits(self):
        connection = Mock()
        plan = SimpleNamespace(errors=[], third_row_updates={7: [(9, D(90), D(-9))]},
                               third_values={}, third_existing_ids={})
        original, changed = {9: (D(1), None)}, {9: (D(90), D(-9))}
        with patch("backend.reproceso_benchmark._one", return_value={"CTANO": 2026}), \
             patch("backend.reproceso_benchmark._build_plan", return_value=plan), \
             patch("backend.reproceso_benchmark._read_ids", side_effect=[original, changed, original]), \
             patch("backend.reproceso_benchmark._cursor_write", side_effect=RuntimeError("cursor")):
            with self.assertRaisesRegex(RuntimeError, "cursor"):
                _plan_comparison(connection, 26, 7, 1000, [], lambda _: None, cursor_test=True)
        self.assertEqual(connection.RollbackTrans.call_count, 2)
        connection.CommitTrans.assert_not_called()

    def test_cursor_mode_is_bounded_and_exclusive(self):
        with self.assertRaises(ValueError):
            benchmark("026", 7, 10001, confirmed=True, cursor_test=True)
        with self.assertRaises(ValueError):
            benchmark("026", 7, 1000, confirmed=True, cursor_test=True, reverse_load=True)

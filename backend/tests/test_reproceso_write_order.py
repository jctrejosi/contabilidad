"""Orden de escritura sin perder la transacción global del reproceso."""
import unittest
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import Mock, patch
from backend.reproceso_mensual_repository import _replace_balances, execute_monthly_reprocess


def plan():
    return SimpleNamespace(company=26, month_from=1, month_to=1, accounts={},
        account_values={}, third_values={}, third_existing_ids={}, third_row_updates={},
        errors=[], differences_conmae=0, differences_conterce=1)


class WriteOrderTests(unittest.TestCase):
    def test_existing_before_new_no_partial_commit(self):
        connection = Mock()
        events = []
        with patch("backend.reproceso_mensual_repository._execute"), \
             patch("backend.reproceso_mensual_repository._update_existing_thirds", side_effect=lambda *_: events.append("existing")), \
             patch("backend.reproceso_mensual_repository._insert_new_thirds", side_effect=lambda *_: events.append("new")):
            _replace_balances(connection, plan())
        self.assertEqual(events, ["existing", "new"])
        connection.CommitTrans.assert_not_called()
        connection.RollbackTrans.assert_not_called()

    def test_insertion_failure_rolls_back_previous_updates(self):
        connection = Mock()
        events = []
        with patch("backend.reproceso_mensual_repository.ads_odbc_connection", return_value=nullcontext(connection)), \
             patch("backend.reproceso_mensual_repository._build_plan", return_value=plan()), \
             patch("backend.reproceso_mensual_repository._execute"), \
             patch("backend.reproceso_mensual_repository._update_existing_thirds", side_effect=lambda *_: events.append("existing")), \
             patch("backend.reproceso_mensual_repository._insert_new_thirds", side_effect=RuntimeError("insert")):
            with self.assertLogs("backend.reproceso_mensual_repository", level="ERROR"):
                with self.assertRaisesRegex(RuntimeError, "insert"):
                    execute_monthly_reprocess("026", 2026, 1, 1, user="WEB", reason="prueba")
        self.assertEqual(events, ["existing"])
        connection.BeginTrans.assert_called_once()
        connection.RollbackTrans.assert_called_once()
        connection.CommitTrans.assert_not_called()

    def test_update_failure_does_not_insert(self):
        with patch("backend.reproceso_mensual_repository._execute"), \
             patch("backend.reproceso_mensual_repository._update_existing_thirds", side_effect=RuntimeError("update")), \
             patch("backend.reproceso_mensual_repository._insert_new_thirds") as insert:
            with self.assertRaisesRegex(RuntimeError, "update"):
                _replace_balances(Mock(), plan())
        insert.assert_not_called()

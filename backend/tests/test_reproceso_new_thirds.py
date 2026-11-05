"""Optimización de auxiliares nuevos, sin ejecutar Advantage real."""
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

from backend.reproceso_mensual_repository import _insert_new_thirds, _replace_balances


def plan():
    return SimpleNamespace(
        company=26, month_from=1, month_to=2,
        accounts={"1305": SimpleNamespace(requires_cost_center=True,
                                         current={1: (Decimal("0"), Decimal("0")),
                                                  2: (Decimal("0"), Decimal("0"))})},
        account_values={}, third_nonzero_ids={},
        third_existing_ids={}, third_names={"900": "Nombre"},
        third_row_updates={},
        third_values={(1, "1305", "900"): [Decimal("123.45"), Decimal("-20.50")]},
    )


class NewThirdTests(unittest.TestCase):
    def test_insert_preserves_defaults_for_months_without_movement(self):
        connection = Mock()
        with patch("backend.reproceso_mensual_repository._execute") as execute:
            _insert_new_thirds(connection, plan())
        execute.assert_called_once()
        _, sql, parameters = execute.call_args.args
        self.assertIn("MACMDEB01, MACMCRE01", sql)
        self.assertNotIn("MACMDEB02", sql)
        self.assertNotIn("MACMDEB03", sql)
        self.assertNotIn("MSALDO", sql)
        self.assertEqual([value for _, _, value in parameters],
                         [26, "1305", "900", "Nombre", True, 123.45, -20.5])
        connection.Execute.assert_not_called()
        connection.CommitTrans.assert_not_called()

    def test_existing_key_is_not_inserted(self):
        sample = plan()
        sample.third_existing_ids = {("1305", "900"): 7}
        with patch("backend.reproceso_mensual_repository._execute") as execute:
            _insert_new_thirds(Mock(), sample)
        execute.assert_not_called()

    def test_new_key_has_no_id_lookup_or_case_update(self):
        connection = Mock()
        with patch("backend.reproceso_mensual_repository._execute") as execute, \
             patch("backend.reproceso_mensual_repository._one") as one:
            _replace_balances(connection, plan())
        self.assertEqual(execute.call_count, 3)  # Dos limpiezas maestro y una inserción.
        one.assert_not_called()
        connection.Execute.assert_not_called()

    def test_error_propagates_without_retry_or_partial_commit(self):
        connection = Mock()
        with patch("backend.reproceso_mensual_repository._execute", side_effect=RuntimeError("test")) as execute:
            with self.assertLogs("backend.reproceso_mensual_repository", level="ERROR"):
                with self.assertRaisesRegex(RuntimeError, "test"):
                    _insert_new_thirds(connection, plan())
        execute.assert_called_once()
        connection.CommitTrans.assert_not_called()

    def test_blocks_only_change_logging_not_number_of_inserts(self):
        sample = plan()
        sample.third_values = {(1, "1305", str(n)): [Decimal(n), Decimal("0")]
                               for n in range(501)}
        with patch("backend.reproceso_mensual_repository._execute") as execute:
            with self.assertLogs("backend.reproceso_mensual_repository", level="INFO") as captured:
                _insert_new_thirds(Mock(), sample)
        self.assertEqual(execute.call_count, 501)
        self.assertTrue(any("501-501/501" in line for line in captured.output))

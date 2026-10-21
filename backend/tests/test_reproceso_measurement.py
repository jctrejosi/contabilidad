"""Diagnóstico del reproceso: pruebas sin conexión ni escritura en Advantage."""
import unittest
from unittest.mock import Mock, patch
from types import SimpleNamespace
from decimal import Decimal

from backend.reproceso_mensual_repository import _measure_operation, _measurement, _stage, _write_step, _replace_balances


class MeasurementTests(unittest.TestCase):
    def test_write_call_logs_begin_end_and_preserves_arguments(self):
        action = Mock(return_value=123)
        with self.assertLogs("backend.reproceso_mensual_repository", level="INFO") as captured:
            self.assertEqual(_write_step("Prueba", action, "query", flag=True), 123)
        action.assert_called_once_with("query", flag=True)
        self.assertIn("SQL inicio Prueba", captured.output[0])
        self.assertIn("SQL fin Prueba", captured.output[1])

    def test_failed_write_does_not_log_success_or_retry(self):
        action = Mock(side_effect=RuntimeError("motor"))
        with self.assertLogs("backend.reproceso_mensual_repository", level="INFO") as captured:
            with self.assertRaisesRegex(RuntimeError, "motor"):
                _write_step("Prueba", action)
        action.assert_called_once()
        self.assertIn("SQL fallo Prueba", captured.output[-1])
        self.assertFalse(any("SQL fin" in line for line in captured.output))

    def test_write_diagnostics_preserve_calls_and_transaction_ownership(self):
        plan = SimpleNamespace(
            company=26, month_from=1, month_to=1,
            account_values={(1, "1"): [Decimal("50"), Decimal("-20")]},
            third_values={(1, "1", "900"): [Decimal("50"), Decimal("-20")]},
            third_existing_ids={("1", "900"): 7}, third_nonzero_ids={1: [7]},
            third_row_updates={1: [(7, Decimal("50"), Decimal("-20"))]},
            accounts={"1": SimpleNamespace(current={1: (Decimal("0"), Decimal("0"))})},
        )
        connection = Mock()
        with patch("backend.reproceso_mensual_repository._execute") as execute:
            with self.assertLogs("backend.reproceso_mensual_repository", level="INFO") as captured:
                _replace_balances(connection, plan)
        self.assertEqual(execute.call_count, 2)  # Limpieza maestro y cuenta.
        self.assertEqual(connection.Execute.call_count, 1)  # Valor final, sin limpieza previa.
        self.assertIn("WHERE CIA = 26 AND ID IN (7)", connection.Execute.call_args.args[0])
        self.assertIn("MACMCRE01 = -20.00", connection.Execute.call_args.args[0])
        connection.CommitTrans.assert_not_called()
        connection.RollbackTrans.assert_not_called()
        self.assertTrue(any("registros 1-1/1" in line for line in captured.output))

    def test_attaches_stage_without_changing_result(self):
        @_stage("Lectura de prueba")
        def read():
            return 42

        @_measure_operation
        def run():
            return {"value": read()}

        result = run()
        self.assertEqual(result["value"], 42)
        self.assertEqual(result["tiemposEtapas"][0]["etapa"], "Lectura de prueba")
        self.assertGreaterEqual(result["tiemposEtapas"][0]["segundos"], 0)
        self.assertIsNone(_measurement.get())
        self.assertNotEqual(result["idOperacion"], run()["idOperacion"])

    def test_failure_preserves_exception_and_cleans_context(self):
        @_measure_operation
        @_stage("Error de prueba")
        def run():
            raise ValueError("original")

        with self.assertLogs("backend.reproceso_mensual_repository", level="INFO"):
            with self.assertRaisesRegex(ValueError, "original"):
                run()
        self.assertIsNone(_measurement.get())

    def test_stage_can_be_used_outside_operation(self):
        @_stage("Independiente")
        def run(value):
            return value
        self.assertEqual(run(7), 7)

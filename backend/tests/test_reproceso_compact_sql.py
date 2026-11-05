"""Equivalencia de expresiones SQL compactas con asignación por ID anterior."""
import random
import re
import unittest
from decimal import Decimal as D
from unittest.mock import Mock, patch
from types import SimpleNamespace
from backend.reproceso_mensual_repository import _compact_balance_expression, _sql_money_literal, _update_existing_thirds


def evaluate(expression, identity):
    if not expression.startswith("CASE"):
        return D(expression)
    if expression.startswith("CASE ID "):
        for candidate, literal in re.findall(r"WHEN (\d+) THEN (-?\d+\.\d+)", expression):
            if int(candidate) == identity:
                return D(literal)
    else:
        for ids, literal in re.findall(r"WHEN ID IN \(([\d,]+)\) THEN (-?\d+\.\d+)", expression):
            if identity in map(int, ids.split(",")):
                return D(literal)
    return None  # ELSE mantiene columna.


class CompactTests(unittest.TestCase):
    def test_uniform_zero_is_direct_assignment(self):
        expr, mode, saved = _compact_balance_expression("MACMCRE07", [(n, D(0)) for n in range(1, 1001)])
        self.assertEqual((expr, mode), ("0.00", "constante"))
        self.assertGreater(saved, 10000)

    def test_repeated_values_grouped_and_signed_values_preserved(self):
        values = [(n, D("0") if n % 2 else D("-123.45")) for n in range(1, 1001)]
        expr, mode, saved = _compact_balance_expression("MACMCRE07", values)
        self.assertEqual(mode, "agrupado")
        self.assertGreater(saved, 0)
        for identity, expected in values:
            self.assertEqual(evaluate(expr, identity), expected)
        self.assertIsNone(evaluate(expr, 1001))

    def test_unique_values_keep_original_case_when_shorter(self):
        _, mode, saved = _compact_balance_expression("MACMDEB07", [(n, D(n)) for n in range(1, 1001)])
        self.assertEqual((mode, saved), ("individual", 0))

    def test_randomized_equivalence_and_never_longer(self):
        rng = random.Random(27)
        for _ in range(50):
            values = [(n, D(rng.choice([0, 0, -12, 99, rng.randrange(-500, 500)])) / 100)
                      for n in range(1, 201)]
            expr, _, _ = _compact_balance_expression("MACMDEB07", values)
            old = "CASE ID " + " ".join(f"WHEN {n} THEN {_sql_money_literal(v)}" for n, v in values) + " ELSE MACMDEB07 END"
            self.assertLessEqual(len(expr), len(old))
            for identity, expected in values:
                self.assertEqual(evaluate(expr, identity), D(_sql_money_literal(expected)))

    def test_writer_keeps_company_and_exact_ids(self):
        connection = Mock()
        plan = SimpleNamespace(company=26, third_row_updates={7: [(3, D(0), D(-5)), (9, D(0), D(-5))]})
        _update_existing_thirds(connection, plan)
        sql = connection.Execute.call_args.args[0]
        self.assertIn("SET MACMDEB07 = 0.00, MACMCRE07 = -5.00", sql)
        self.assertIn("WHERE CIA = 26 AND ID IN (3,9)", sql)
        connection.CommitTrans.assert_not_called()

    def test_rejects_duplicate_ids_or_empty_block(self):
        for values in ([], [(1, D(0)), (1, D(5))]):
            with self.assertRaises(ValueError):
                _compact_balance_expression("MACMDEB07", values)

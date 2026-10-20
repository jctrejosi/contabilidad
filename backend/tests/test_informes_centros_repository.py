"""Cálculos deterministas de los informes de centros de costo."""

import unittest

from backend.informes_centros_repository import _center_balances, _range, _selection


class CenterReportRules(unittest.TestCase):
    def test_ccsaldo_suma_apertura_y_meses_previos(self):
        row = {"DEB00": 100, "CRE00": -10, "DEB01": 20, "CRE01": -5,
               "DEB02": 30, "CRE02": -12}
        self.assertEqual(_center_balances(row, 2, 2), (105.0, 30.0, -12.0, 123.0))

    def test_sin_saldo_anterior(self):
        row = {"DEB00": 100, "CRE00": -10, "DEB01": 20, "CRE01": -5}
        self.assertEqual(_center_balances(row, 1, 1, False), (0.0, 20.0, -5.0, 15.0))

    def test_mes_cero(self):
        self.assertEqual(_center_balances({"DEB00": 10, "CRE00": -4}, 0, 0),
                         (0.0, 10.0, -4.0, 6.0))

    def test_rangos_y_selecciones(self):
        self.assertIn("c.CODIGO >= '5105'", _range("5105", "5199", "c.CODIGO"))
        self.assertEqual(_selection("111, 112,111", "centros", 7), ("111", "112"))
        with self.assertRaisesRegex(ValueError, "invertido"):
            _range("5200", "5100", "c.CODIGO")
        with self.assertRaisesRegex(ValueError, "válid"):
            _selection("111,'112", "centros", 7)


if __name__ == "__main__":
    unittest.main()

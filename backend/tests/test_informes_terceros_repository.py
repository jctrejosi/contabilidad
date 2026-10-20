"""Reglas de cálculo y filtros de los informes de terceros Harbour 8.2/8.3."""

import unittest

from backend.informes_terceros_repository import _balances, _bounds, _where


class ThirdPartyReportRules(unittest.TestCase):
    def test_saldo_anterior_incluye_meses_previos_y_creditos_negativos(self):
        row = {"MSALDO": 100, "MACMDEB01": 20, "MACMCRE01": -5,
               "MACMDEB02": 30, "MACMCRE02": -12, "MACMDEB03": 4, "MACMCRE03": -7}
        self.assertEqual(_balances(row, 2, 3), (115.0, 34.0, -19.0, 130.0))

    def test_periodo_cero_usa_saldo_inicial_sin_duplicarlo(self):
        row = {"MSALDO": -50, "MACMDEB01": 20, "MACMCRE01": -5}
        self.assertEqual(_balances(row, 0, 1), (0.0, 20.0, -55.0, -35.0))


    def test_rangos_de_cuentas_y_terceros(self):
        self.assertEqual(_bounds("1105", "1199", "10", "30"), ("1105", "1199", "10", "30"))
        where = _where("1105", "1199", "10", "30", alias="m.")
        self.assertIn("m.CODIGO >= '1105'", where)
        self.assertIn("m.NIT <= '30'", where)
        with self.assertRaisesRegex(ValueError, "invertido"):
            _bounds("1199", "1105", "", "")
        with self.assertRaisesRegex(ValueError, "válido"):
            _bounds("", "", "1' OR 1=1", "")

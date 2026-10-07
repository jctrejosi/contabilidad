import unittest
from contextlib import contextmanager
from unittest.mock import patch

from backend import retenciones_reportes_repository as reports


class RetencionesReportesTest(unittest.TestCase):
    def test_totales_por_cuenta_suma_creditos_signed(self):
        source = [{"CODIGO": "2365", "NIT": "900", "BASE01": 100, "BASE01C": -25,
                   "VALOR01": 10, "VALOR01C": -2}]

        @contextmanager
        def connection():
            yield object()

        with patch.object(reports, "ads_odbc_connection", connection), patch.object(
            reports, "_validate", return_value=(27, {"EMPNOM": "Prueba", "EMPNIT": "800"})
        ), patch.object(reports, "_stream", return_value=iter(source)), patch.object(
            reports, "_lookup_names", return_value=({"2365": "Retención"}, {"900": "Tercero"})
        ):
            report = reports.build_retention_report("ret-totales-cuenta", "027", 2026, 1, 1)
        self.assertEqual(report["filas"][0][2:], [75, 8])
        self.assertEqual(report["filas"][-1][0], "TOTAL GENERAL")

    def test_relacion_detallada_grouped_by_third(self):
        source = [{"CODIGO": "2365", "NIT": "900", "BASE01": 100, "BASE01C": 0,
                   "VALOR01": 10, "VALOR01C": 0}]

        @contextmanager
        def connection():
            yield object()

        with patch.object(reports, "ads_odbc_connection", connection), patch.object(
            reports, "_validate", return_value=(27, {"EMPNOM": "Prueba", "EMPNIT": "800"})
        ), patch.object(reports, "_stream", return_value=iter(source)), patch.object(
            reports, "_lookup_names", return_value=({"2365": "Retención"}, {"900": "Tercero"})
        ):
            report = reports.build_retention_report("ret-relacion", "027", 2026, 1, 1,
                                                   order="tercero", detailed=True)
        self.assertTrue(any(kind == "total-cuenta" for kind in report["tipos"]))
        self.assertEqual(report["filas"][-1][0], "TOTAL GENERAL")


if __name__ == "__main__":
    unittest.main()

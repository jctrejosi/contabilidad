"""El reporte N comparte el libro diario, pero agrupa por VISDOCUM."""

import unittest
from unittest.mock import patch

from backend import informe_movimiento_comprobante_repository as report


class MovimientoTipoDocumentoTests(unittest.TestCase):
    def test_grouping_and_totals_follow_document_type(self):
        def read(_connection, sql):
            if "FROM CONEMP" in sql:
                return [{"EMPCOD": 27, "EMPNOM": "Empresa", "EMPNIT": "900"}]
            if "FROM CONCTR" in sql:
                return [{"CTANO": 2026}]
            if "FROM MOV01" in sql:
                self.assertIn("ORDER BY m.TIPODOC", sql)
                self.assertIn("d.SUC = 1", sql)
                return [
                    {"TIPODOC": "FV", "DOCUMENTO_NOMBRE": "Factura", "CODIGO": "1105",
                     "NIT": "123", "TFECHA": 20260901, "TDOCUM": "001", "TVALOR": 100},
                    {"TIPODOC": "FV", "DOCUMENTO_NOMBRE": "Factura", "CODIGO": "1105",
                     "NIT": "123", "TFECHA": 20260901, "TDOCUM": "001", "TVALOR": -30},
                ]
            raise AssertionError(sql)

        with patch.object(report, "ads_odbc_connection"), patch.object(report, "_read", side_effect=read):
            result = report.build_voucher_journal("027", 2026, 9, 9, by_document_type=True)
        self.assertEqual(result["id"], "mov-tipo-doc")
        self.assertIn("TIPO DOCUMENTO FV", result["filas"][0][0])
        self.assertEqual(result["filas"][-2][0], "TOTAL TIPO DOC. FV")
        self.assertEqual(result["filas"][-1][-3:-1], [100.0, -30.0])


if __name__ == "__main__":
    unittest.main()

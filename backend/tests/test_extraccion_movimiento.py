"""Selección y garantías de la extracción unificada ESPE06/07/08."""

import unittest
from unittest.mock import patch

from backend import extraccion_movimiento_repository as extraction


class ExtractionTests(unittest.TestCase):
    def test_three_modes_have_distinct_filters(self):
        base = {"cia": "027", "anio": 2026, "mes": 9, "lote": "AB12"}
        cases = [
            ({**base, "modo": "comprobante", "comprobante": "01", "tipoDocumento": "FV"},
             ("TCOMPR = ?", "TIPODOC = ?")),
            ({**base, "modo": "documentos", "tipoDocumento": "FV", "documentoDesde": "1", "documentoHasta": "9"},
             ("TIPODOC = ?", "TDOCUM >= ?", "TDOCUM <= ?")),
            ({**base, "modo": "completo"}, ()),
        ]
        for request, expected in cases:
            with self.subTest(mode=request["modo"]), patch.object(extraction, "_query_rows", return_value=[]) as query:
                extraction._selection(object(), extraction._request(request))
                sql = query.call_args.args[1]
                self.assertIn("CONCIA = ?", sql)
                self.assertIn("CONANO = ?", sql)
                self.assertIn("CONMES = ?", sql)
                for clause in expected:
                    self.assertIn(clause, sql)
                if request["modo"] == "completo":
                    self.assertNotIn("TCOMPR = ?", sql)
                    self.assertNotIn("TIPODOC = ?", sql)

    def test_preview_flags_unbalanced_document_but_keeps_it(self):
        row = {"ID": 1, "CODIGO": "110505", "NIT": "", "TFASE": "",
               "TVALOR": 50, "TBASE": 0, "TDETALLE": "Ajuste", "TCOMPR": "01",
               "TIPODOC": "FV", "TFECHA": 20260901, "TDOCUM": "1", "TDOCUM2": ""}
        request = extraction._request({"cia": "027", "anio": 2026, "mes": 9,
                                       "lote": "AB12", "modo": "completo"})
        result = extraction._summary([row], request)
        self.assertEqual(result["partidas"], 1)
        self.assertEqual(result["documentosDescuadrados"], 1)
        self.assertEqual(result["diferencia"], 50)

    def test_invalid_range_and_lot_rejected_before_connection(self):
        with self.assertRaises(ValueError):
            extraction._request({"cia": "027", "anio": 2026, "mes": 9,
                                 "lote": "A", "modo": "completo"})
        with self.assertRaises(ValueError):
            extraction._request({"cia": "027", "anio": 2026, "mes": 9,
                                 "lote": "AB12", "modo": "documentos", "tipoDocumento": "FV",
                                 "documentoDesde": "9", "documentoHasta": "1"})


if __name__ == "__main__":
    unittest.main()

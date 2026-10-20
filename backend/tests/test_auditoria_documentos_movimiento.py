"""Regresiones de la auditoría mensual adaptada de MOVDOCK2."""

import unittest

from backend.auditoria_documentos_movimiento_repository import analyze_movement


class DocumentMovementAuditTests(unittest.TestCase):
    def test_document_identity_prevents_mixing_same_number(self):
        accounts = {"110505": {"MCTAPAGOS": False, "MCOSTOS": False, "MIVA_RET": "O"}}
        rows = [
            {"TCOMPR": "01", "TIPODOC": "FV", "TDOCUM": "1", "TFECHA": 20260101,
             "TSEC": 1, "CODIGO": "110505", "NIT": "", "TFASE": "", "TVALOR": 100},
            {"TCOMPR": "02", "TIPODOC": "FV", "TDOCUM": "1", "TFECHA": 20260101,
             "TSEC": 1, "CODIGO": "110505", "NIT": "", "TFASE": "", "TVALOR": -100},
        ]
        result = analyze_movement(rows, accounts, set(), set())
        self.assertEqual(result["documentos"], 2)
        self.assertEqual(result["documentosDescuadrados"], 2)

    def test_reports_auxiliaries_without_changing_rows(self):
        accounts = {"130505": {"MCTAPAGOS": True, "MCOSTOS": True, "MIVA_RET": "O"}}
        row = {"TCOMPR": "01", "TIPODOC": "FV", "TDOCUM": "2", "TFECHA": 20260101,
               "TSEC": 1, "CODIGO": "130505", "NIT": "", "TFASE": "", "TVALOR": 0}
        result = analyze_movement([row], accounts, set(), set())
        self.assertEqual(result["conteos"], {"tercero_faltante": 1, "centro_faltante": 1})
        self.assertEqual(row["NIT"], "")
        self.assertEqual(row["TFASE"], "")


if __name__ == "__main__":
    unittest.main()

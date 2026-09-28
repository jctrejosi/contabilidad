"""Reglas puras de la migración REEMBOL01, sin escribir en Advantage."""

import unittest
from unittest.mock import patch

from backend import reembolsos_ads_repository as refunds


def sample_payload():
    return {
        "encabezado": {
            "lote": "RB09001", "fecha": "2026-09-28", "concepto": "Reembolso caja menor",
            "valorGeneral": 100, "documentoCaja": "AA", "documentoCruce": "BB",
            "comprobante": "00",
        },
        "items": [{
            "tercero": "111222333", "centro": "001", "centroCruce": "011",
            "concepto": "Transporte", "valor": 100,
        }],
    }


class RefundRulesTest(unittest.TestCase):
    def test_header_total_must_match_items(self):
        data = sample_payload()
        data["encabezado"]["valorGeneral"] = 101
        with self.assertRaisesRegex(refunds.ReembolsoError, "coincidir"):
            refunds._normalize(data)

    def test_rejects_missing_cross_cost_center(self):
        data = sample_payload()
        data["items"][0]["centroCruce"] = ""
        with self.assertRaisesRegex(refunds.ReembolsoError, "centros de costo"):
            refunds._normalize(data)

    def test_original_document_accounts_produce_balanced_lot_lines(self):
        data = refunds._normalize(sample_payload())
        documents = {
            "AA": {"CODIGO": "AA", "CONSE": 2, "DEB01": "110505", "CRE01": "230505", "DEB02": "", "CRE02": ""},
            "BB": {"CODIGO": "BB", "CONSE": 7, "DEB01": "230505", "CRE01": "110505", "DEB02": "", "CRE02": ""},
        }
        with (
            patch.object(refunds, "_document_type", side_effect=lambda _conn, code: documents[code]),
            patch.object(refunds, "_query_rows", return_value=[{"CTCODCIA": "1", "CTPRESOP": "SO01", "CTCONSOP": 33}]),
            patch.object(refunds, "_account", return_value={"MTC": True, "MCTAPAGOS": True, "MCOSTOS": True}),
            patch.object(refunds, "_one", return_value=None),
        ):
            lines, first_counter, second_counter, vision_code = refunds._build_lines(object(), 27, data, "R001")
        self.assertEqual((first_counter, second_counter, vision_code), (33, 7, "1"))
        self.assertEqual(len(lines), 4)
        self.assertEqual(sum(line["debito"] for line in lines), 200)
        self.assertEqual(sum(line["credito"] for line in lines), 200)
        self.assertEqual({line["documento"] for line in lines}, {"SO0134", "BB8"})
        self.assertEqual({line["centro"] for line in lines}, {"001", "011"})

    def test_confirmation_blocks_unconfigured_accounts(self):
        data = refunds._normalize(sample_payload())
        with patch.object(refunds, "_document_type", return_value={"CODIGO": "AA", "DEB01": "", "CRE01": "", "DEB02": "", "CRE02": ""}):
            with self.assertRaisesRegex(refunds.ReembolsoError, "no tiene cuentas"):
                refunds._build_lines(object(), 27, data, "R001")


if __name__ == "__main__":
    unittest.main()

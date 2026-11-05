"""Contabilidad no limita VISDOCUM al módulo9 ni al indicador ICONTAB."""
import unittest
from contextlib import nullcontext
from unittest.mock import Mock, patch
from backend import tipos_documento_repository as catalog
from backend import reembolsos_ads_repository as refunds


class AllModulesTests(unittest.TestCase):
    def test_catalog_preserves_all_modules_and_false_accounting_flag(self):
        rows = [{"CODIGO": str(module), "NOMBRE": f"Documento {module}",
                 "MODULO": module, "ICONTAB": False} for module in (0, 1, 2, 3, 9, 99)]
        recordset = Mock()
        with patch.object(catalog, "ads_connection", return_value=nullcontext(Mock())), \
             patch.object(catalog, "_open_recordset", return_value=recordset) as query, \
             patch.object(catalog, "_rows", return_value=iter(rows)):
            result = catalog.list_document_types()
        self.assertEqual([item["modulo"] for item in result], [0, 1, 2, 3, 9, 99])
        self.assertTrue(all(item["contabiliza"] is False for item in result))
        sql = query.call_args.args[1]
        self.assertIn("WHERE SUC = 1 ORDER BY CODIGO", sql)
        self.assertNotIn("MODULO =", sql)
        self.assertNotIn("ICONTAB =", sql)
        recordset.Close.assert_called_once()

    def test_refunds_validate_code_and_branch_without_module_restriction(self):
        with patch.object(refunds, "_one", return_value={"CODIGO": "FV"}) as query:
            result = refunds._document_type(Mock(), "FV")
        self.assertEqual(result["CODIGO"], "FV")
        sql = query.call_args.args[1]
        self.assertIn("WHERE SUC = 1 AND CODIGO = ?", sql)
        self.assertNotIn("MODULO", sql)

"""MEDMAG05: transacciones, aislamiento, fidelidad de exportación y regresiones.

Las escrituras se simulan. No se crean, eliminan ni alteran registros reales.
"""
from contextlib import contextmanager, ExitStack
from decimal import Decimal
from io import BytesIO
import unittest
from unittest.mock import MagicMock, patch

from openpyxl import load_workbook
from pypdf import PdfReader

from backend import medios_revision_repository as repo
from backend.medios_revision_export import build_delivery_rows, _rounded, _xlsx, _pdf


def row(**changes):
    return dict(RID='opaque-row', FORMATO='1001', CONCEPTO='5001', CUENTA='', TERCERO='9001',
                TERCERO2='ALT', DIGITO='1', SALE=True, MODCXP=False, COLBASE=0, COLIVA=0,
                CIA=27, **{f'VALOR{i}': i for i in range(1, 12)}, **changes)


@contextmanager
def transaction_test(selected=None):
    connection = MagicMock()
    @contextmanager
    def connect():
        yield connection
    with ExitStack() as stack:
        stack.enter_context(patch.object(repo, 'ads_odbc_connection', connect))
        stack.enter_context(patch.object(repo, '_context', return_value=(27, {'CODFORMA': '1001'})))
        query = stack.enter_context(patch.object(repo, '_read', return_value=[{'CCODIGO': '9001'}]))
        stack.enter_context(patch.object(repo, '_selected', return_value=selected or row()))
        change = stack.enter_context(patch.object(repo, '_change'))
        execute = stack.enter_context(patch.object(repo, '_execute'))
        stack.enter_context(patch.object(repo, '_audit', return_value=''))
        yield connection, query, change, execute


class RevisionTests(unittest.TestCase):
    def payload(self, **changes):
        return dict(concepto='5001', tercero='9001', digito='1', valor1=10.25, valor2=2, **changes)

    def test_manual_update_only_edits_original_five_fields(self):
        with transaction_test() as (connection, _, change, _):
            repo.save_revision('027', '1001', self.payload(id='opaque-row', revision='revision'))
            sql, params = change.call_args.args[1:]
            assignments = sql.split(' WHERE ')[0]
            for field in ['VALOR3', 'TERCERO2', 'SALE', 'MODCXP', 'CUENTA']:
                self.assertNotIn(field, assignments)
            self.assertIn('CIA = ? AND FORMATO = ? AND ROWID = ?', sql)
            self.assertEqual([p[2] for p in params][5:8], [27, '1001', 'opaque-row'])
            connection.CommitTrans.assert_called_once()

    def test_create_initializes_other_columns_and_company(self):
        with transaction_test() as (connection, _, _, execute):
            repo.save_revision('027', '1001', self.payload())
            sql, params = execute.call_args.args[1:]
            self.assertEqual(sql.count('?'), len(params))
            self.assertEqual([p[2] for p in params][:2], [27, '1001'])
            self.assertIn('VALOR11', sql)
            self.assertNotIn('MOV01', sql)
            self.assertNotIn('CONMAGIT', sql)
            connection.CommitTrans.assert_called_once()

    def test_rollback_on_write_failure(self):
        with transaction_test() as (connection, _, change, _):
            change.side_effect = RuntimeError('write failed')
            with self.assertRaises(RuntimeError):
                repo.save_revision('027', '1001', self.payload(id='opaque-row', revision='revision'))
            connection.RollbackTrans.assert_called_once()
            connection.CommitTrans.assert_not_called()

    def test_missing_third_rejected_before_transaction(self):
        with transaction_test() as (connection, query, _, _):
            query.side_effect = [[{}], []]
            with self.assertRaisesRegex(ValueError, 'tercero no existe'):
                repo.save_revision('027', '1001', self.payload())
            connection.BeginTrans.assert_not_called()

    def test_wrong_concept_rejected(self):
        with transaction_test() as (connection, query, _, _):
            query.return_value = []
            with self.assertRaisesRegex(ValueError, 'concepto no pertenece'):
                repo.save_revision('027', '1001', self.payload())
            connection.BeginTrans.assert_not_called()

    def test_delete_only_selected_row(self):
        with transaction_test() as (connection, _, change, _):
            repo.delete_revision('027', '1001', 'opaque-row', 'revision')
            sql, params = change.call_args.args[1:]
            self.assertTrue(sql.startswith('DELETE FROM CONMAGDT WHERE CIA = ? AND FORMATO = ? AND ROWID = ?'))
            self.assertEqual([p[2] for p in params][:3], [27, '1001', 'opaque-row'])
            connection.CommitTrans.assert_called_once()

    def test_stale_or_wrong_company_row_is_rejected(self):
        original = row()
        with patch.object(repo, '_read', return_value=[original]):
            with self.assertRaises(repo.RevisionConflict):
                repo._selected(object(), 27, '1001', 'opaque-row', 'wrong-hash')
        with patch.object(repo, '_read', return_value=[]):
            with self.assertRaises(repo.RevisionConflict):
                repo._selected(object(), 28, '1001', 'opaque-row', repo._revision(original))

    def test_guard_includes_all_values_and_handles_null(self):
        source = row(); source['TERCERO2'] = None
        where, params = repo._guard(source, 27, '1001')
        self.assertIn('TERCERO2 IS NULL', where)
        self.assertIn('VALOR11 = ?', where)
        self.assertEqual(where.count('?'), len(params))

    def test_invalid_money_not_written(self):
        for value in ['NaN', 'Infinity', '100000000000', '1.001']:
            with self.subTest(value=value), self.assertRaises(ValueError): repo._money(value)
        self.assertEqual(repo._money('-15.25'), Decimal('-15.25'))

    def test_id_preview_does_not_write_and_confirm_updates_only_third(self):
        with transaction_test() as (connection, _, change, _), \
             patch.object(repo, '_rows', return_value=[row()]), \
             patch.object(repo, '_thirds', return_value={'9001': {'CNIT': '123456'}}):
            preview = repo.reassign_ids('027', '1001')
            self.assertEqual(preview['cantidad'], 1)
            change.assert_not_called()
            repo.reassign_ids('027', '1001', preview['token'])
            self.assertTrue(change.call_args.args[1].startswith('UPDATE CONMAGDT SET TERCERO = ? WHERE CIA = ?'))
            self.assertEqual(change.call_args.args[2][0][2], '123456')

    def test_id_preview_change_rolls_back(self):
        with transaction_test() as (connection, _, change, _), \
             patch.object(repo, '_rows', return_value=[row()]), \
             patch.object(repo, '_thirds', return_value={}):
            with self.assertRaises(repo.RevisionConflict): repo.reassign_ids('027', '1001', 'old-preview')
            change.assert_not_called()
            connection.RollbackTrans.assert_called_once()

    def test_detail_filters_all_three_keys_and_company(self):
        with transaction_test() as (_, query, _, _), patch.object(repo, '_schema'):
            query.return_value = []
            repo.detail_revision('027', '1001', 'opaque-row', 'revision')
            self.assertIn('WHERE CIA = ? AND FORMATO = ? AND CONCEPTO = ? AND NIT = ?', query.call_args.args[1])
            self.assertEqual(query.call_args.args[2:], (27, '1001', '5001', '9001'))


class DeliveryTests(unittest.TestCase):
    def build(self, rows=None, form=None, config=None, identification='codigo', third=None):
        default_form = dict(CONCEPTO=True, TIPODOC=True, NIT=True, DIGITO=True, NOMBRE=False)
        default_config = dict(VALOR1=True, VALOR2=True, **{f'COMBO{i}': 'No Reporta' for i in range(1, 8)})
        return build_delivery_rows(form or default_form, {'5001': config or default_config}, rows or [row()],
                                   {'9001': third or dict(CTIPDOC='31', CNIT='1234', CCODBE='9999', CNOMBRE='Nombre')}, identification)

    def test_groups_duplicates_before_rounding(self):
        first = row(); first['VALOR1'] = .25
        second = row(); second['VALOR1'] = .25
        data = self.build([first, second])
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0][-2:], [1, 4])

    def test_rounding_is_harbour_not_python_bankers(self):
        self.assertEqual(_rounded('2.5'), 3)
        self.assertEqual(_rounded('-2.6'), -2)

    def test_identification_options_leave_source_unchanged(self):
        source = row()
        self.assertEqual(self.build([source], identification='identificacion')[0][2], '1234')
        self.assertEqual(self.build([source], identification='beneficiario')[0][2], '9999')
        self.assertEqual(source['TERCERO'], '9001')

    def test_natural_person_has_blank_digit(self):
        data = self.build(third={'CTIPDOC': '13'})
        self.assertEqual(data[0][3], '')

    def test_combo_columns_including_ten_and_eleven(self):
        config = dict(VALOR1=False, VALOR2=False, COMBO1='Cero', COMBO2='Blanco', COMBO3='Valor 10', COMBO4='Valor 11', COMBO5='Informacion Tercero')
        self.assertEqual(self.build(config=config)[0][-5:], [0, '', 10, 11, '9001'])

    def test_cxp_positions_and_combo_overwrite_follow_original_order(self):
        source = row(); source.update(MODCXP=True, COLBASE=1, COLIVA=3)
        self.assertEqual(self.build([source], config={'COMBO1': 'Valor 9'})[0][-3:], [9, '', 1])

    def test_names_follow_document_type(self):
        data = self.build(form={'NOMBRE': True}, config={'VALOR1': False}, third={'CTIPDOC': '31', 'CAPE1': 'A', 'CNOMBRE': 'Empresa'})
        self.assertEqual(data[0], ['A', '', '', '', 'Empresa'])

    def test_unknown_concept_or_third_blocks_delivery(self):
        with self.assertRaises(ValueError): build_delivery_rows({}, {}, [row()], {}, 'codigo')
        with self.assertRaises(ValueError): build_delivery_rows({}, {'5001': {}}, [row()], {}, 'codigo')

    def test_workbook_has_no_header_for_delivery_and_text_is_not_formula(self):
        data = _xlsx([['00123', '=DANGEROUS()', 5]], 'ignored')
        sheet = load_workbook(BytesIO(data)).active
        self.assertEqual(sheet['A1'].value, '00123')
        self.assertEqual(sheet['B1'].data_type, 's')
        self.assertEqual(sheet['C1'].value, 5)

    def test_pdf_is_readable_and_has_dsi_footer(self):
        data = _pdf([['5001', 'Nombre & detalle']], 'Revisión medios', ['Concepto', 'Nombre'])
        reader = PdfReader(BytesIO(data))
        self.assertIn('5001', reader.pages[0].extract_text())
        self.assertIn('DSI', reader.pages[0].extract_text())


if __name__ == '__main__': unittest.main()

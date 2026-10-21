"""Casos de MEDMAG06 sin escribir ni abrir la base de datos activa."""
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from openpyxl import load_workbook
from pypdf import PdfReader

from backend import medios_detalle_tercero_repository as repo
from backend import medios_detalle_tercero_api as api
from backend import report_snapshots as snapshots


def movement(form='1001', concept='5001', value=100, base=80):
    return dict(FORMATO=form, CONCEPTO=concept, CODIGO='510505', TCOMPR='01', TFASE='ADM',
                TIPODOC='FV', TDOCUM='00012', TFECHA=20260115, TVALOR=value, TBASE=base)


class DetailTests(unittest.TestCase):
    def report(self, mode='detallado'):
        return repo.build_report([movement(), movement(value=-20, base=0), movement(concept='5002', value=50, base=10),
                                  movement(form='1002', value=10, base=2)],
                                 {('1001', '5001'): 'Servicios', ('1001', '5002'): 'Compras', ('1002', '5001'): 'Otro'},
                                 {'1001': 'Formato uno', '1002': 'Formato dos'}, mode)

    def test_detailed_original_columns_and_cuts(self):
        report = self.report()
        self.assertEqual(len(report['columnas']), 10)
        self.assertEqual(report['tipos'].count('movimiento'), 4)
        self.assertEqual(report['tipos'].count('subtotal-concepto'), 3)
        self.assertEqual(report['tipos'].count('subtotal-formato'), 2)
        self.assertEqual(report['filas'][-1][-2:], [140, 92])
        for row in report['filas']: self.assertEqual(len(row), 10)
        concept = report['filas'][2]
        self.assertEqual(concept[-2:], [80, ''])

    def test_summary_uses_format_and_concept_not_concept_alone(self):
        report = self.report('resumido')
        summaries = [row for row, kind in zip(report['filas'], report['tipos']) if kind == 'resumen']
        self.assertEqual(len(summaries), 3)
        self.assertEqual(summaries[0], ['1001', '5001', 'Servicios', 80, 80])
        self.assertEqual(summaries[-1][2], 'Otro')
        for row in report['filas']: self.assertEqual(len(row), 5)

    def test_same_totals_in_both_variants_without_counting_subtotals_twice(self):
        detailed, summary = self.report(), self.report('resumido')
        self.assertEqual(detailed['totalValor'], summary['totalValor'])
        self.assertEqual(detailed['totalBase'], summary['totalBase'])
        self.assertEqual(detailed['movimientos'], 4)

    def test_decimal_sum_and_negative_values(self):
        report = repo.build_report([movement(value=.1, base=.1), movement(value=.2, base=.2)], {}, {}, 'resumido')
        self.assertEqual(report['totalValor'], .3)
        self.assertEqual(report['totalBase'], .3)

    def test_no_reuse_of_previous_concept_name(self):
        report = repo.build_report([movement(concept='9999')], {}, {}, 'resumido')
        self.assertEqual(report['filas'][0][2], '')

    def test_empty_result_and_invalid_mode(self):
        report = repo.build_report([], {}, {}, 'detallado')
        self.assertEqual(report['movimientos'], 0)
        self.assertEqual(report['totalValor'], 0)
        with self.assertRaises(ValueError): repo.build_report([], {}, {}, 'incorrecto')

    def test_company_and_third_filter_no_year_or_month_and_no_state_restriction(self):
        @contextmanager
        def connection(): yield object()
        with patch.object(repo, 'ads_odbc_connection', connection), patch.object(repo, '_schema'), \
             patch.object(repo, '_read', side_effect=[[{'EMPNOM': 'Prueba', 'EMPNIT': '1'}],
                                                    [{'CCODIGO': '9001', 'CNOMBRE': 'Tercero'}], []]) as query:
            result = repo.consultar_detalle_tercero('027', '9001', 'detallado')
            sql = query.call_args.args[1]
            self.assertIn('FROM CONMAGIT WHERE CIA = ? AND NIT = ?', sql)
            self.assertEqual(query.call_args.args[2:], (27, '9001'))
            self.assertNotIn('CONANO', sql); self.assertNotIn('CONMES', sql)
            self.assertNotIn('CESTADO', query.call_args_list[1].args[1])
            self.assertEqual(result['cia'], '027')

    def test_invalid_third_rejected_before_connection(self):
        with patch.object(repo, 'ads_odbc_connection') as connect:
            for third in ['', "a' OR 1=1"]:
                with self.assertRaises(ValueError): repo.consultar_detalle_tercero('027', third, 'detallado')
            connect.assert_not_called()

    def test_nonexistent_third_rejected(self):
        @contextmanager
        def connection(): yield object()
        with patch.object(repo, 'ads_odbc_connection', connection), \
             patch.object(repo, '_read', side_effect=[[{'EMPNOM': 'Prueba', 'EMPNIT': '1'}], []]):
            with self.assertRaisesRegex(ValueError, 'tercero no existe'):
                repo.consultar_detalle_tercero('027', '9001', 'resumido')

    def test_export_full_snapshot_not_only_first_page_and_company_guard(self):
        report = self.report()
        report.update(id='medios-detalle-tercero', cia='027', titulo='Prueba · Tercero 9001', tercero='9001', nombre='Prueba', modo='detallado', totalFilas=len(report['filas']))
        with tempfile.TemporaryDirectory() as directory, patch.object(snapshots, 'CACHE_DIR', Path(directory)):
            token = snapshots.save(report)
            first = api._snapshot('027', token, 0)
            full = api._snapshot('027', token)
            self.assertGreater(len(full['filas']), len(first['filas']))
            exported = repo.export_detalle_tercero(full, 'xlsx')
            sheet = load_workbook(BytesIO(exported)).active
            self.assertEqual(sheet.cell(sheet.max_row, 1).value, 'TOTALES GENERALES EN MEDIOS')
            self.assertEqual(sheet.cell(sheet.max_row, 9).value, 140)
            self.assertEqual(sheet['E3'].value, '00012')
            with self.assertRaises(HTTPException) as error: api._snapshot('028', token)
            self.assertEqual(error.exception.status_code, 404)

    def test_expired_snapshot_returns_actionable_error(self):
        with patch.object(snapshots, 'load', side_effect=snapshots.SnapshotNotFound):
            with self.assertRaises(HTTPException) as error: api._snapshot('027', 'a' * 32)
            self.assertEqual(error.exception.status_code, 410)

    def test_pdf_contains_summary_and_totals(self):
        report = self.report('resumido'); report['titulo'] = 'Detalle de medios · Resumido'
        content = repo.export_detalle_tercero(report, 'pdf')
        text = ''.join(page.extract_text() for page in PdfReader(BytesIO(content)).pages)
        self.assertIn('Servicios', text); self.assertIn('TOTALES GENERALES', text)
        self.assertIn('DSI', text)


if __name__ == '__main__': unittest.main()

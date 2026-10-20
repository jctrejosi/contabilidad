"""Regresiones de copia de partidas; no abren ni escriben la base real."""
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from backend import captura_documento_origen_repository as repo
from backend.contabilizacion_repository import _normalize_line


@contextmanager
def connection():
    yield object()


def movement(**changes):
    row = dict(ID=1, TFECHA=20260105, TCOMPR='01', TIPODOC='FV', TDOCUM='10',
               TSEC=1, CODIGO='110505', NIT='9001', NITN='', TFASE='ADM',
               TVALOR=100, TBASE=80, TDETALLE='Concepto de la partida')
    return {**row, **changes}


class CopyDocumentTests(unittest.TestCase):
    def run_query(self, rows, **filters):
        with patch.object(repo, 'ads_connection', connection), \
             patch.object(repo, '_company_exists', return_value=True), \
             patch.object(repo, '_third_party_names', return_value={'9001': 'Tercero real'}), \
             patch.object(repo, '_query_rows', return_value=rows) as query:
            result = repo.buscar_documento_origen('027', 2026, 1, '10', **filters)
            return result, query.call_args

    def test_groups_full_document_identity(self):
        result, _ = self.run_query([movement(), movement(ID=2, TVALOR=-100),
                                   movement(TCOMPR='02'), movement(TIPODOC='CE'),
                                   movement(TFECHA=20260106)])
        self.assertEqual(len(result), 4)
        self.assertEqual(len(result[0]['partidas']), 2)
        self.assertEqual(result[0]['partidas'][1]['credito'], 100)
        self.assertEqual(result[0]['partidas'][1]['debito'], 0)

    def test_company_period_and_exact_number_are_parameterized(self):
        _, call = self.run_query([], comprobante='02', tipo_documento='FV')
        sql, params = call.args[1:]
        self.assertIn('FROM MOV01 WHERE CONCIA = ? AND CONANO = ? AND CONMES = ? AND TDOCUM = ?', sql)
        self.assertNotIn('CONDOCUM', sql)
        self.assertEqual([p[2] for p in params], [27, 2026, 1, '10', '02', 'FV'])
        self.assertIn('ORDER BY TCOMPR, TIPODOC, TFECHA, TSEC, ID', sql)

    def test_preserves_detail_and_resolves_third_party(self):
        result, _ = self.run_query([movement()])
        partida = result[0]['partidas'][0]
        self.assertEqual(partida['concepto'], 'Concepto de la partida')
        self.assertEqual(partida['base'], 80)
        self.assertEqual(partida['centro'], 'ADM')
        self.assertEqual(partida['nit'], '9001')
        self.assertTrue(partida['terceroValidado'])

    def test_no_results(self):
        result, _ = self.run_query([])
        self.assertEqual(result, [])

    def test_posting_preserves_line_concept_without_changing_header_default(self):
        line = dict(cuenta='110505', debito=100, documentoAfectado='ORIG-1', concepto='Detalle original')
        normalized = _normalize_line(line, 1, 'Nuevo encabezado')
        self.assertEqual(normalized['concepto'], 'Detalle original')
        self.assertEqual(normalized['documentoAfectado'], 'ORIG-1')
        del line['concepto']
        self.assertEqual(_normalize_line(line, 1, 'Nuevo encabezado')['concepto'], 'Nuevo encabezado')

    def test_rejects_invalid_filter_before_connection(self):
        with patch.object(repo, 'ads_connection') as connect:
            for document in ['', "10'; DROP TABLE MOV01"]:
                with self.assertRaises(ValueError):
                    repo.buscar_documento_origen('027', 2026, 1, document)
            with self.assertRaises(ValueError):
                repo.buscar_documento_origen('027', 2026, 19, '10')
            connect.assert_not_called()

    def test_supports_adjustment_period_without_date_derived_month(self):
        with patch.object(repo, 'ads_connection', connection), \
             patch.object(repo, '_company_exists', return_value=True), \
             patch.object(repo, '_third_party_names', return_value={}), \
             patch.object(repo, '_query_rows', return_value=[]) as query:
            repo.buscar_documento_origen('027', 2026, 13, '10')
            self.assertEqual(query.call_args.args[2][2][2], 13)

    def test_capture_copy_does_not_change_header(self):
        source = (Path(__file__).parents[2] / 'Interface_web/src/pages/CapturaDirecta.tsx').read_text(encoding='utf-8')
        copy = source.split('  function cargarDocumento(', 1)[1].split('  function guardarBorrador', 1)[0]
        for setter in ['setFecha(', 'setPeriodo(', 'setNumDoc(', 'setTipoDoc(', 'setComprobante(', 'setConcepto(']:
            self.assertNotIn(setter, copy)
        self.assertIn('documento: numDoc', copy)
        self.assertIn('concepto: partida.concepto', copy)
        self.assertNotIn('MOVIMIENTOS_FEB', source)
        self.assertNotIn('F5 Plantilla', source)

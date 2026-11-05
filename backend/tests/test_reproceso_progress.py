"""Seguimiento aislado, concurrente y sin conexión a base de datos."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from backend.reproceso_progress import tracking, snapshot, stage, advance


class ProgressTests(unittest.TestCase):
    def test_stage_counts_finish_and_company_scope(self):
        identity = uuid4().hex
        with tracking(identity, "026"):
            stage("Actualizando auxiliares", 2500)
            advance(1000)
            self.assertEqual(snapshot(identity, 26)["procesados"], 1000)
            self.assertIsNone(snapshot(identity, 27))
            stage("Confirmando cambios")
            self.assertIsNone(snapshot(identity, 26)["total"])
            self.assertEqual(snapshot(identity, 26)["estado"], "activo")
        self.assertEqual(snapshot(identity, 26)["estado"], "finalizado")

    def test_error_and_reference_cannot_be_reused(self):
        identity = uuid4().hex
        with self.assertRaisesRegex(RuntimeError, "original"):
            with tracking(identity, 26):
                raise RuntimeError("original")
        self.assertEqual(snapshot(identity, 26)["estado"], "error")
        with self.assertRaises(ValueError):
            with tracking(identity, 26):
                pass

    def test_contexts_do_not_mix_between_threads(self):
        def worker(company):
            identity = uuid4().hex
            with tracking(identity, company):
                stage("Prueba", 10)
                advance(company)
            return identity, company
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(worker, (1, 2)))
        for identity, company in results:
            self.assertEqual(snapshot(identity, company)["procesados"], company)

    def test_old_calls_without_tracking_still_work(self):
        with tracking(None, 26):
            stage("Prueba", 10)
            advance(1)

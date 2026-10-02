"""Verifica que una única generación sirva para páginas y exportación."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend import app as api
from backend import report_snapshots as snapshots


class ReportSnapshotsTest(unittest.TestCase):
    def setUp(self) -> None:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        cache_patch = patch.object(snapshots, "CACHE_DIR", Path(temp.name))
        cache_patch.start()
        self.addCleanup(cache_patch.stop)

    def test_preview_pages_and_full_export_have_identical_rows(self):
        report = {
            "id": "aux-gral", "anio": 2025, "columnas": [{"label": "Cuenta"}],
            "filas": [[str(index), index] for index in range(21)],
            "tipos": ["seccion" if index == 0 else "movimiento" for index in range(21)],
            "count": 21, "nota": "Prueba",
        }
        token = snapshots.save(report)
        first = snapshots.load(token, page=0)
        second = snapshots.load(token, page=1)
        last = snapshots.load(token, page=2)
        full = snapshots.load(token)

        self.assertEqual(first["filas"], report["filas"][:8])
        self.assertEqual(second["filas"], report["filas"][8:16])
        self.assertEqual(last["filas"], report["filas"][16:])
        self.assertEqual(full["filas"], report["filas"])
        self.assertEqual(full["tipos"], report["tipos"])
        self.assertEqual(first["count"], 21)
        self.assertEqual(first["snapshotId"], token)

    def test_invalid_or_expired_token_cannot_read_another_file(self):
        with self.assertRaises(snapshots.SnapshotNotFound):
            snapshots.load("../outside", page=0)
        with self.assertRaises(snapshots.SnapshotNotFound):
            snapshots.load("0" * 32, page=0)

    def test_preview_page_and_export_do_not_query_advantage_again(self):
        report = {
            "id": "aux-gral", "anio": 2025, "mesDesde": 1, "mesHasta": 2,
            "compania": {"nombre": "Prueba", "nit": "123"}, "nota": "Prueba",
            "columnas": [{"label": "Cuenta", "money": False}],
            "filas": [[str(index)] for index in range(21)],
            "tipos": ["movimiento"] * 21, "count": 21,
        }
        with patch.object(api.store, "build_additional_report", return_value=report) as build:
            first = api.additional_report_endpoint(
                report_id="aux-gral", cia="027", anio=2025,
                mes_hasta=2, vista_paginada=True,
            )
            second = api.additional_report_snapshot_page(
                report_id="aux-gral", snapshot_id=first["snapshotId"], pagina=1,
            )
            export = api.export_additional_report_snapshot(
                report_id="aux-gral", snapshot_id=first["snapshotId"],
                formato="csv", visualizar=False,
            )
            excel = api.export_additional_report_snapshot(
                report_id="aux-gral", snapshot_id=first["snapshotId"],
                formato="xlsx", visualizar=False,
            )
            pdf = api.export_additional_report_snapshot(
                report_id="aux-gral", snapshot_id=first["snapshotId"],
                formato="pdf", visualizar=False,
            )
        build.assert_called_once()
        self.assertEqual(len(first["filas"]), 8)
        self.assertEqual(second["filas"][0], ["8"])
        self.assertEqual(export.body.decode("utf-8-sig").splitlines()[-1], "20")
        self.assertTrue(excel.body.startswith(b"PK"))
        self.assertTrue(pdf.body.startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()

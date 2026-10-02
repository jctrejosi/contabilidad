"""Cobertura de los cinco grupos de la ficha CLIENTES/TRAB_CLI2."""

import unittest
from contextlib import contextmanager
from unittest.mock import patch

from backend import terceros_mantenimiento_repository as m


class FakeConnection:
    def __init__(self): self.events = []
    def BeginTrans(self): self.events.append("begin")
    def CommitTrans(self): self.events.append("commit")
    def RollbackTrans(self): self.events.append("rollback")


@contextmanager
def fake_session(connection):
    yield connection


class ThirdMaintenanceTest(unittest.TestCase):
    def payload(self):
        return {"CCODIGO": "900123456", "CTIPDOC": "31", "CNOMBRE": "Empresa de prueba",
                "CSOCIAL": "Empresa", "CEMAIL": "prueba@empresa.co", "CCUPO": 1000,
                "CPLAZO1": 30, "CDCTO1": 2.5, "CPROFESION": "", "OPELOGIS": True}

    def test_defaults_and_verification_digit_match_original(self):
        form = m.default_form()
        self.assertEqual(form["CRETEN"], 1)
        self.assertTrue(form["CFACTU"])
        self.assertEqual(m._normalize(self.payload(), "900123456", None)["CDIGITO"],
                         m.verification_digit("900123456"))
        self.assertEqual(len(m.verification_digit("123456A")), 1)

    def test_full_update_preserves_other_values_and_does_not_touch_balance(self):
        connection = FakeConnection()
        existing = m.default_form()
        existing.update(self.payload())
        existing.update({"ID": 10, "CSALDO": 500, "CMOTIVO": "", "CDIGITO": "1", "CFCHMOD": 20260101})
        payload = {"version": m._version(existing), "CNOMBRE": "Nombre corregido"}
        sent = []
        with patch.object(m, "ads_odbc_connection", return_value=fake_session(connection)), patch.object(
            m, "_one", return_value=existing
        ), patch.object(m, "_execute", side_effect=lambda _conn, sql, params: sent.append((sql, params))), patch.object(
            m, "get_form", return_value={"CCODIGO": "900123456"}
        ), patch.object(m, "register_third_party_update"):
            m.save_form("900123456", payload, create=False)
        self.assertEqual(connection.events, ["begin", "commit"])
        self.assertNotIn("CSALDO = ?", sent[0][0])
        self.assertNotIn("ID = ?", sent[0][0])
        self.assertIn("CNOMBRE = ?", sent[0][0])

    def test_create_writes_full_form_with_zero_balance(self):
        connection = FakeConnection()
        sent = []
        def one(_connection, sql, _params):
            return {"MAX_ID": 52} if "MAX(ID)" in sql else None
        with patch.object(m, "ads_odbc_connection", return_value=fake_session(connection)), patch.object(
            m, "_one", side_effect=one
        ), patch.object(m, "_validate_references"), patch.object(
            m, "_execute", side_effect=lambda _conn, sql, params: sent.append((sql, params))
        ), patch.object(m, "get_form", return_value={"CCODIGO": "900123456"}), patch.object(
            m, "register_master_creation"
        ):
            m.save_form("900123456", self.payload(), create=True)
        sql, params = sent[0]
        self.assertEqual(connection.events, ["begin", "commit"])
        self.assertEqual(sql.count("?"), len(params))
        self.assertIn("CSALDO", sql)
        self.assertEqual(params[-2][-1], 0.0)
        self.assertEqual(params[-1][-1], 53)

    def test_version_conflict_rejects_write(self):
        existing = m.default_form()
        existing.update(self.payload())
        existing.update({"ID": 10, "CSALDO": 0, "CFCHMOD": 20260101})
        with patch.object(m, "ads_odbc_connection", return_value=fake_session(FakeConnection())), patch.object(
            m, "_one", return_value=existing
        ), patch.object(m, "_execute") as execute:
            with self.assertRaises(m.ThirdMaintenanceConflict):
                m.save_form("900123456", {"version": "vieja"}, create=False)
        execute.assert_not_called()

    def test_person_requires_original_name_parts_and_valid_mail(self):
        payload = {"CTIPDOC": "13", "CNOMBRE": "Persona", "CEMAIL": "incorrecto"}
        with self.assertRaises(ValueError): m._normalize(payload, "123456", None)
        payload.update({"CNOM1": "Ana", "CAPE1": "Pérez", "CAPE2": "Gómez"})
        with self.assertRaisesRegex(ValueError, "correo"):
            m._normalize(payload, "123456", None)


if __name__ == "__main__": unittest.main()

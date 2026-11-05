"""Identidad Fortuner real en sesión y escritura; ASGI sin servidor ni ADS."""
import asyncio
import json
import unittest
from dataclasses import FrozenInstanceError
from unittest.mock import patch
from fastapi import HTTPException, Response
from starlette.requests import Request
from pydantic import ValidationError
from backend import access_session as access
from backend import app as accounting


def authorization(code="ABCD", name="Nombre real", administrator=False):
    return {"authorized": True, "moduleId": "contabilidad",
            "user": {"code": code, "name": name, "administrator": administrator}}


def request(token):
    return Request({"type": "http", "headers": [(b"cookie", f"{access.COOKIE_NAME}={token}".encode())]})


async def call_api(path, payload, token=None):
    headers = [(b"content-type", b"application/json")]
    if token:
        headers.append((b"cookie", f"{access.COOKIE_NAME}={token}".encode()))
    messages = []
    sent = False
    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": json.dumps(payload).encode(), "more_body": False}
        await asyncio.Event().wait()
    async def send(message):
        messages.append(message)
    await accounting.app({"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
                          "method": "POST", "scheme": "http", "path": path, "raw_path": path.encode(),
                          "query_string": b"cia=026", "headers": headers,
                          "server": ("test", 8443), "client": ("127.0.0.1", 1)}, receive, send)
    return next(m["status"] for m in messages if m["type"] == "http.response.start")


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.store = access.AccessSessionStore()
        self.patcher = patch.object(access, "_SESSIONS", self.store)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_exchange_preserves_identity_and_opaque_cookie(self):
        response = Response()
        with patch.object(access, "_post_to_fortuner", return_value=authorization()):
            result = access.exchange_fortuner_code(access.FortunerCodeRequest(code="x" * 32), response)
        self.assertEqual(result["user"]["code"], "ABCD")
        cookie = response.headers["set-cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=strict", cookie)
        self.assertNotIn("ABCD", cookie)
        token = cookie.split(";", 1)[0].split("=", 1)[1]
        self.assertEqual(access.session_status(request(token))["user"], result["user"])

    def test_invalid_identity_never_issues_cookie(self):
        invalid = [None, {}, {"code": "", "name": "N", "administrator": False},
                   {"code": "ABCDE", "name": "N", "administrator": False},
                   {"code": "AB", "name": " ", "administrator": False},
                   {"code": "AB", "name": "N", "administrator": "false"},
                   {"code": "AB", "name": "N", "administrator": 1},
                   {"code": 123, "name": "N", "administrator": False}]
        for user in invalid:
            response = Response()
            with self.subTest(user=user), patch.object(access, "_post_to_fortuner", return_value={**authorization(), "user": user}):
                with self.assertRaises(HTTPException) as raised:
                    access.exchange_fortuner_code(access.FortunerCodeRequest(code="x" * 32), response)
                self.assertEqual(raised.exception.status_code, 502)
                self.assertNotIn("set-cookie", response.headers)

    def test_administrator_identity_and_logout(self):
        response = Response()
        with patch.object(access, "_post_to_fortuner", return_value=authorization("Ha27", "Administrador", True)):
            result = access.administrator_access(access.AdministratorRequest(key="test"), response)
        self.assertEqual(result["user"]["code"], "Ha27")
        token = response.headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]
        self.assertEqual(access.require_authenticated_user(request(token)).code, "Ha27")
        access.logout(request(token), Response())
        with self.assertRaises(HTTPException):
            access.require_authenticated_user(request(token))

    def test_expiration_isolation_and_immutable_user(self):
        clock = [1.0]
        store = access.AccessSessionStore(clock=lambda: clock[0])
        a = store.issue("fortuner", access.ModuleUser("ABCD", "A", False), ttl_seconds=300)
        b = store.issue("fortuner", access.ModuleUser("EFGH", "B", False), ttl_seconds=300)
        self.assertEqual(store.get(a).user.code, "ABCD")
        self.assertEqual(store.get(b).user.code, "EFGH")
        with self.assertRaises(FrozenInstanceError):
            store.get(a).user.code = "FAKE"
        clock[0] = 302
        self.assertIsNone(store.get(a))

    def test_frontend_cannot_supply_identity_to_exchange(self):
        with self.assertRaises(ValidationError):
            access.FortunerCodeRequest(code="x" * 32, user=authorization()["user"])

    def test_real_operation_ignores_forged_actor_from_browser(self):
        token = self.store.issue("fortuner", access.ModuleUser("ABCD", "Nombre", False))
        with patch.object(accounting.store, "post_lot", return_value={}) as post:
            status = asyncio.run(call_api("/api/lotes/LOTE1/actualizar", {"usuario": "FAKE"}, token))
        self.assertEqual(status, 200)
        self.assertEqual(post.call_args.kwargs["user"], "ABCD")

    def test_unauthenticated_write_does_not_reach_repository(self):
        with patch.object(accounting.store, "post_lot") as post:
            status = asyncio.run(call_api("/api/lotes/LOTE1/actualizar", {"usuario": "FAKE"}))
        self.assertEqual(status, 401)
        post.assert_not_called()

    def test_payload_actor_comes_from_session(self):
        token = self.store.issue("fortuner", access.ModuleUser("Ha27", "Administrador", True))
        with patch.object(accounting.store, "create_lot", return_value={}) as create:
            status = asyncio.run(call_api("/api/lotes", {"usuario": "FAKE", "lote": "0001", "nombre": "Prueba", "mes": "07"}, token))
        self.assertEqual(status, 201)
        self.assertEqual(create.call_args.args[1]["usuario"], "Ha27")

    def test_wrong_module_and_non_admin_response_rejected(self):
        with patch.object(access, "_post_to_fortuner", return_value={**authorization(), "moduleId": "cartera"}):
            with self.assertRaises(HTTPException):
                access.exchange_fortuner_code(access.FortunerCodeRequest(code="x" * 32), Response())
        with patch.object(access, "_post_to_fortuner", return_value=authorization()):
            with self.assertRaises(HTTPException):
                access.administrator_access(access.AdministratorRequest(key="test"), Response())

    def test_cookie_identity_not_header_or_query_and_context_does_not_leak(self):
        for code in ("ABCD", "EFGH"):
            token = self.store.issue("fortuner", access.ModuleUser(code, code, False))
            with patch.object(accounting.store, "post_lot", return_value={}) as post:
                self.assertEqual(asyncio.run(call_api("/api/lotes/LOTE1/actualizar", {"usuario": "FAKE"}, token)), 200)
            self.assertEqual(post.call_args.kwargs["user"], code)
        with self.assertRaises(HTTPException):
            access.session_user_code()

    def test_direct_capture_uses_session_in_payload(self):
        token = self.store.issue("fortuner", access.ModuleUser("ABCD", "Nombre", False))
        payload = {"cia": "026", "fecha": "2026-10-22", "comprobante": "01",
                   "tipoDocumento": "FV", "concepto": "Prueba", "usuario": "FAKE",
                   "lineas": [{"cuenta": "1105", "debito": 10}, {"cuenta": "1305", "credito": 10}]}
        with patch.object(accounting.store, "post_direct_movement", return_value={}) as post:
            self.assertEqual(asyncio.run(call_api("/api/movimientos/contabilizar", payload, token)), 200)
        self.assertEqual(post.call_args.args[0]["usuario"], "ABCD")

    def test_revoked_session_rejects_operation(self):
        token = self.store.issue("fortuner", access.ModuleUser("ABCD", "Nombre", False))
        self.store.revoke(token)
        with patch.object(accounting.store, "post_lot") as post:
            self.assertEqual(asyncio.run(call_api("/api/lotes/LOTE1/actualizar", {"usuario": "FAKE"}, token)), 401)
        post.assert_not_called()

    def test_reprocess_uses_session_actor(self):
        token = self.store.issue("fortuner", access.ModuleUser("ABCD", "Nombre", False))
        payload = {"cia": "026", "anio": 2026, "mesDesde": 7, "mesHasta": 7,
                   "usuario": "FAKE", "motivo": "Prueba identidad"}
        with patch.object(accounting.store, "execute_monthly_reprocess", return_value={}) as post:
            self.assertEqual(asyncio.run(call_api("/api/reprocesos/mensual/ejecutar", payload, token)), 200)
        self.assertEqual(post.call_args.kwargs["user"], "ABCD")

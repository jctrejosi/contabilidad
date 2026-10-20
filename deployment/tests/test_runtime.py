"""Comprobaciones del paquete sin abrir puertos ni modificar Advantage."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI

from deployment.runtime import create_application, load_configuration, main


class InstalledSiteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.site = Path(self.temporary.name)
        (self.site / "index.html").write_text("<html>Contabilidad instalada</html>", encoding="utf-8")
        (self.site / "app.js").write_text("console.log('web')", encoding="utf-8")
        api = FastAPI()

        @api.get("/api/ping")
        def ping():
            return {"status": "ok"}

        self.app = create_application(self.site, api)

    async def asyncTearDown(self):
        self.temporary.cleanup()

    async def request(self, path):
        messages = []
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
                 "method": "GET", "scheme": "http", "path": path,
                 "raw_path": path.encode(), "root_path": "", "query_string": b"",
                 "headers": [], "server": ("test", 80), "client": ("test", 1)}

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            messages.append(message)

        await self.app(scope, receive, send)
        return messages[0]["status"], b"".join(m.get("body", b"") for m in messages)

    async def test_serves_frontend_and_api_on_the_same_application(self):
        self.assertEqual((await self.request("/"))[0], 200)
        status, body = await self.request("/api/ping")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"status": "ok"})

    async def test_reload_of_spa_route_returns_index(self):
        status, body = await self.request("/informes/balance")
        self.assertEqual(status, 200)
        self.assertIn(b"Contabilidad instalada", body)

    async def test_unknown_api_and_missing_assets_do_not_return_html_success(self):
        self.assertEqual((await self.request("/api/no-existe"))[0], 404)
        self.assertEqual((await self.request("/missing.js"))[0], 404)

    async def test_optional_assistant_reports_its_independent_configuration(self):
        self.assertEqual((await self.request("/bot-api/chat"))[0], 503)


class InstalledConfigurationTests(unittest.TestCase):
    @unittest.skipUnless(os.name == "nt", "DPAPI requiere Windows")
    def test_encrypted_configuration_overrides_development_and_never_stores_plain_password(self):
        import win32crypt

        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=False):
            root = Path(directory)
            secret = {"ADS_DATA_SOURCE": "C:\\datos\\empresa.add", "ADS_USER_ID": "test",
                      "ADS_PASSWORD": "clave-de-prueba", "IGNORED_VARIABLE": "ignored"}
            encrypted = win32crypt.CryptProtectData(json.dumps(secret).encode(), "Contabilidad", None, None, None, 4)
            (root / "credentials.dpapi").write_bytes(encrypted)
            config = root / "service.json"
            config.write_text(json.dumps({"schemaVersion": 1, "credentialsFile": "credentials.dpapi", "port": 8443}), encoding="utf-8")
            os.environ["ADS_DEV_FALLBACK"] = "1"
            os.environ["ADS_CONNECTION_STRING"] = "development"
            os.environ["CONTABDSI_STORE"] = "postgres"
            data = load_configuration(config)
            self.assertEqual(data["port"], 8443)
            self.assertEqual(os.environ["ADS_PASSWORD"], "clave-de-prueba")
            self.assertEqual(os.environ["CONTABDSI_STORE"], "ads")
            self.assertNotIn("ADS_DEV_FALLBACK", os.environ)
            self.assertNotIn("ADS_CONNECTION_STRING", os.environ)
            self.assertNotIn("IGNORED_VARIABLE", os.environ)
            self.assertNotIn(b"clave-de-prueba", encrypted)

    def test_check_validates_without_starting_server(self):
        with patch("deployment.runtime.load_configuration", return_value={}), \
             patch("deployment.runtime.create_application"), \
             patch("deployment.runtime.check_database") as check, patch("uvicorn.run") as serve:
            self.assertEqual(main(["check", "--config", "service.json"]), 0)
            check.assert_called_once()
            serve.assert_not_called()

    def test_inspect_does_not_connect_to_database_or_start_server(self):
        with patch("deployment.runtime.create_application") as app, \
             patch("deployment.runtime.check_database") as check, patch("uvicorn.run") as serve:
            app.return_value.routes = []
            self.assertEqual(main(["inspect"]), 0)
            check.assert_not_called()
            serve.assert_not_called()


if __name__ == "__main__":
    unittest.main()

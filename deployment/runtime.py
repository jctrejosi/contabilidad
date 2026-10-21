"""Entrada del paquete Windows distribuible, sin servidor de desarrollo.

El ejecutable sirve React compilado y la API en el mismo puerto. Fortuner
decide cuándo ejecutarlo; instalar y comprobar la conexión nunca escuchan en
un puerto. Los secretos se reciben de un archivo DPAPI del servidor cliente.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any


def asset_root() -> Path:
    """PyInstaller coloca los recursos en _MEIPASS; desarrollo usa dist."""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "site"  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent / "Interface_web" / "dist"


def load_configuration(path: Path) -> dict[str, Any]:
    """Descifra bajo Windows y carga únicamente variables ADS autorizadas."""
    import win32crypt

    configuration = json.loads(path.read_text(encoding="utf-8-sig"))
    if configuration.get("schemaVersion") != 1:
        raise ValueError("La configuración del servicio tiene una versión inválida.")
    secret_path = path.parent / configuration["credentialsFile"]
    _description, clear = win32crypt.CryptUnprotectData(secret_path.read_bytes(), None, None, None, 0)
    secrets = json.loads(clear.decode("utf-8-sig"))
    required = ("ADS_DATA_SOURCE", "ADS_USER_ID", "ADS_PASSWORD")
    if any(not secrets.get(key) for key in required):
        raise ValueError("La conexión Advantage está incompleta. Ejecute de nuevo el instalador.")
    allowed = set(required) | {"ADS_PROVIDER", "ADS_SERVER_TYPE", "ADS_ODBC_DRIVER",
                               "ADS_AUDIT_DATA_SOURCE", "ADS_REFERENCE_ROOT"}
    # No heredar un fallback de desarrollo ni otro motor del equipo servidor.
    for key in ("ADS_CONNECTION_STRING", "ADS_DEV_FALLBACK", *allowed):
        os.environ.pop(key, None)
    os.environ.update({key: str(value) for key, value in secrets.items() if key in allowed})
    os.environ["CONTABDSI_STORE"] = "ads"
    configuration["port"] = int(configuration.get("port", 8443))
    if not 1 <= configuration["port"] <= 65535:
        raise ValueError("El puerto del servicio no es válido.")
    return configuration


def create_application(site: Path | None = None, api: Any = None) -> Any:
    """Publica los recursos SPA después de las rutas reales de la API."""
    from starlette.exceptions import HTTPException
    from starlette.responses import JSONResponse
    from starlette.staticfiles import StaticFiles

    if api is None:
        from backend.app import app as api

    root = site or asset_root()
    if not (root / "index.html").is_file():
        raise ValueError("El paquete está incompleto: falta la interfaz compilada.")

    class Site(StaticFiles):
        async def get_response(self, path: str, scope: Any) -> Any:
            # StaticFiles normaliza con os.path: Windows entrega separadores \.
            path = path.replace("\\", "/").lstrip("/")
            # Una ruta API inexistente nunca debe devolver HTML con estado 200.
            if path == "api" or path.startswith("api/"):
                return JSONResponse({"detail": "Not Found"}, status_code=404)
            if path == "bot-api" or path.startswith("bot-api/"):
                return JSONResponse({"detail": "El asistente requiere su servicio y configuración propios."}, status_code=503)
            try:
                return await super().get_response(path, scope)
            except HTTPException as exc:
                if exc.status_code == 404 and "." not in Path(path).name:
                    return await super().get_response("index.html", scope)
                raise

    api.mount("/", Site(directory=root, html=True), name="contabilidad-web")
    return api


def check_database() -> None:
    """Verifica las dos conexiones usadas por la aplicación, sin escribir."""
    from backend.ads_repository import ads_connection, ads_odbc_connection, _open_recordset

    for connect in (ads_connection, ads_odbc_connection):
        with connect() as connection:
            for table in ("CONEMP", "CONMAE", "MOV01", "FADCLI", "CONCTR"):
                recordset = _open_recordset(connection, f"SELECT TOP 0 * FROM {table}")
                recordset.Close()


def check_com_date_support() -> None:
    """Detecta en el paquete la dependencia usada por ADO al devolver fechas.

    SELECT TOP 0 no convierte valores: puede pasar aunque GetRows falle con
    fechas reales. Esta prueba local no consulta ni modifica ninguna tabla.
    """
    if os.name != "nt":
        return
    from datetime import datetime
    import pywintypes
    import win32timezone

    sample = pywintypes.Time(datetime(2026, 1, 15, 12, tzinfo=win32timezone.TimeZoneInfo.utc()))
    if sample.year != 2026 or sample.utcoffset() is None:
        raise ValueError("El paquete no permite convertir fechas COM correctamente.")


def main(arguments: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Servicio de Contabilidad 27 DSI, administrado por Fortuner27.")
    parser.add_argument("command", choices=("serve", "check", "inspect", "benchmark-reproceso"))
    parser.add_argument("--config", type=Path)
    parser.add_argument("--host")
    parser.add_argument("--port", type=int)
    parser.add_argument("--company")
    parser.add_argument("--month", type=int)
    parser.add_argument("--sample", type=int, default=250)
    parser.add_argument("--extended", action="store_true")
    parser.add_argument("--staging", action="store_true")
    parser.add_argument("--realistic", action="store_true")
    parser.add_argument("--plan-sample", action="store_true")
    parser.add_argument("--reverse-load", action="store_true")
    parser.add_argument("--cursor-test", action="store_true")
    parser.add_argument("--confirm-test-writes", action="store_true")
    args = parser.parse_args(arguments)
    try:
        if args.command == "inspect":
            check_com_date_support()
            app = create_application()
            print(json.dumps({"status": "ok", "routes": len(app.routes), "web": True,
                              "architecture": "x64", "listening": False}))
            return 0
        if args.config is None:
            raise ValueError("Debe indicar --config con la configuración creada por el instalador.")
        configuration = load_configuration(args.config.resolve())
        if args.command == "benchmark-reproceso":
            if not args.company or args.month is None or not args.confirm_test_writes:
                raise ValueError("Indique --company, --month y --confirm-test-writes. Solo copia de pruebas sin usuarios.")
            import socket
            with socket.socket() as probe:
                probe.settimeout(1)
                if probe.connect_ex(("127.0.0.1", configuration["port"])) == 0:
                    raise ValueError("Detenga Contabilidad desde Fortuner antes de la prueba.")
            from backend.reproceso_benchmark import benchmark
            emit = lambda value: print(json.dumps(value, ensure_ascii=True), flush=True)
            emit(benchmark(args.company, args.month, args.sample,
                           confirmed=True, emit=emit, extended=args.extended, staging=args.staging,
                           realistic=args.realistic, plan_sample=args.plan_sample,
                           reverse_load=args.reverse_load, cursor_test=args.cursor_test))
            return 0
        app = create_application()
        if args.command == "check":
            check_com_date_support()
            check_database()
            print("OK: interfaz, API y conexiones ADO/OLE DB y ADO/ODBC. Servicio detenido.")
            return 0
        log_root = Path(configuration["logDirectory"])
        log_root.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(log_root / "servicio.log", maxBytes=10_000_000,
                                      backupCount=5, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        logging.basicConfig(level=logging.INFO, handlers=[handler])
        import uvicorn

        uvicorn.run(app, host=args.host or configuration.get("bindHost", "0.0.0.0"),
                    port=args.port or configuration["port"], workers=1,
                    reload=False, log_config=None, access_log=False)
        return 0
    except Exception as exc:
        # Las excepciones COM pueden incluir rutas/credenciales en su cadena.
        # El instalador registra el tipo, sin volcar la conexión ni los secretos.
        if isinstance(exc, (ValueError, FileNotFoundError)):
            print(f"ERROR: {exc}", file=sys.stderr)
        else:
            print(f"ERROR: {type(exc).__name__}. Verifique permisos y conectores Advantage x64.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    from multiprocessing import freeze_support

    freeze_support()
    if not getattr(sys, "frozen", False):
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    raise SystemExit(main())

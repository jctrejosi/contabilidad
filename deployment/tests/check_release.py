"""Verifica un ZIP extraído sin instalar ni iniciar el servicio.

Uso interno: --ads-env puede apuntar al .env de este equipo de desarrollo.
Sus valores se cifran en un directorio temporal y nunca se copian al paquete.
"""

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("package", type=Path)
    parser.add_argument("--ads-env", type=Path)
    args = parser.parse_args()
    package = args.package.resolve()
    manifest = json.loads((package / 'manifest.json').read_text(encoding='utf-8-sig'))
    listed = {entry['path'].replace('\\', '/') for entry in manifest['files']}
    assert {'Configurar-Conexion-Contabilidad27.bat', 'configurar-conexion.ps1'} <= listed
    for entry in manifest['files']:
        path = (package / entry['path']).resolve()
        assert path.is_relative_to(package)
        assert hashlib.sha256(path.read_bytes()).hexdigest().upper() == entry['sha256'].upper()
    assert not any('tests/' in name or name.startswith('test_') for name in listed)
    print('PASS: manifiesto SHA256 incluye la utilidad instalada, sin archivos de prueba.')
    executable = package / "payload" / "Contabilidad27" / "Contabilidad27.exe"
    result = subprocess.run([str(executable), "inspect"], check=True, capture_output=True, text=True)
    state = json.loads(result.stdout)
    assert state["listening"] is False and state["web"] is True
    print("PASS: ejecutable carga interfaz y API, sin escuchar en puertos.")
    if args.ads_env:
        sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
        from backend.ads_repository import _read_env_file
        import win32crypt

        credentials = _read_env_file(args.ads_env.resolve())
        assert all(credentials.get(key) for key in ("ADS_DATA_SOURCE", "ADS_USER_ID", "ADS_PASSWORD"))
        with tempfile.TemporaryDirectory(prefix="contabdsi-package-check-") as directory:
            root = Path(directory)
            secret = win32crypt.CryptProtectData(json.dumps(credentials).encode(), "Prueba instalador", None, None, None, 4)
            (root / "credentials.dpapi").write_bytes(secret)
            config = root / "service.json"
            config.write_text(json.dumps({"schemaVersion": 1, "credentialsFile": "credentials.dpapi", "port": 8443,
                                          "logDirectory": str(root / "logs")}), encoding="utf-8")
            result = subprocess.run([str(executable), "check", "--config", str(config)], capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(result.stderr.strip())
            print("PASS: ejecutable abre Advantage con ADO/OLE DB y ADO/ODBC, sin escribir ni iniciar servicio.")
    forbidden = {".py", ".pyw", ".tsx", ".ts", ".map", ".adt", ".add", ".adi"}
    assert not [p for p in (package / "payload").rglob("*") if p.is_file() and (p.suffix.lower() in forbidden or p.name == ".env")]
    print("PASS: paquete sin fuentes del proyecto, .env ni bases del cliente.")


if __name__ == "__main__":
    main()

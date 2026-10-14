"""Instalación y reparación en carpetas temporales, sin iniciar servicios.

Se usa una copia de prueba del instalador: UAC se omite y se sustituyen ACL
y tareas Windows. Esas sustituciones nunca se distribuyen. Todas las copias,
respaldos y cambios de Fortuner quedan dentro del directorio temporal.
La comprobación ADS del ejecutable es real y de solo lectura.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("package", type=Path)
    parser.add_argument("--ads-env", required=True, type=Path)
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(project))
    from backend.ads_repository import _read_env_file
    import win32crypt

    credentials = _read_env_file(args.ads_env.resolve())
    with tempfile.TemporaryDirectory(prefix="contabilidad-install-sandbox-") as directory:
        root = Path(directory).resolve()
        package = root / "Package"
        shutil.copytree(args.package, package)
        installer = (project / "deployment" / "instalar.ps1").read_text(encoding="utf-8")
        installer, count = re.subn(r"(?m)^\s+\$administrator = .*?$", "    $administrator = $true # SOLO SANDBOX", installer)
        assert count == 1
        guard = str(root).replace("'", "''")
        mocks = f"""
function Set-Acl {{
    param([string]$LiteralPath, $AclObject)
    if (-not $LiteralPath.StartsWith('{guard}', [StringComparison]::OrdinalIgnoreCase)) {{ throw 'ACL fuera del sandbox.' }}
}}
function Get-ScheduledTask {{ param([string]$TaskName, [string]$ErrorAction) return $null }}
"""
        installer = installer.replace("$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop'\n" + mocks, 1)
        (package / "instalar.ps1").write_text(installer, encoding="utf-8")
        manifest_file = package / "manifest.json"
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        for entry in manifest["files"]:
            if entry["path"] == "instalar.ps1":
                entry["sha256"] = hashlib.sha256((package / "instalar.ps1").read_bytes()).hexdigest().upper()
        manifest_file.write_text(json.dumps(manifest), encoding="utf-8")
        fortuner = root / "Fortuner27"
        (fortuner / "Config").mkdir(parents=True)
        (fortuner / "Frontend").mkdir()
        start = fortuner / "start-fortuner.ps1"
        start.write_text('$configurationPath = if ($env:FORTUNER_MODULES_CONFIG) { $env:FORTUNER_MODULES_CONFIG } else { Join-Path $PSScriptRoot "Config/modules.json" }\nexit 0\n', encoding="utf-8")
        modules_file = fortuner / "Config" / "modules.json"
        modules_file.write_text(json.dumps({"schemaVersion": 1, "defaults": {"projectsRoot": ".."},
            "fortuner": {"frontend": {"port": 8444}, "backend": {"port": 8004}},
            "modules": [{"id": "contabilidad", "status": "active", "visible": True,
                         "services": {"frontend": {"port": 8443}, "backend": {"port": 8001}}}]}), encoding="utf-8")
        (fortuner / "Frontend" / ".env.local").write_text("VITE_OTHER=preservar\nVITE_CONTABILIDAD_URL=http://antiguo/\n", encoding="utf-8")
        installed = root / "Installed"
        config = installed / "config"
        config.mkdir(parents=True)
        secret = win32crypt.CryptProtectData(json.dumps(credentials).encode(), "Sandbox", None, None, None, 4)
        (config / "credentials.dpapi").write_bytes(secret)
        (config / "service.json").write_text(json.dumps({"schemaVersion": 1, "credentialsFile": "credentials.dpapi", "port": 18443}), encoding="utf-8")

        def install(*extra):
            result = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                                     str(package / "instalar.ps1"), "-InstallRoot", str(installed),
                                     "-NoFirewall", *extra], capture_output=True, text=True)
            assert credentials["ADS_PASSWORD"] not in result.stdout + result.stderr
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)

        install("-FortunerRoot", str(fortuner), "-Port", "18443")
        installation = json.loads((installed / "installation.json").read_text(encoding="utf-8"))
        assert installation["state"] == "installed-stopped"
        registered = json.loads(modules_file.read_text(encoding="utf-8"))["modules"][0]
        assert list(registered["services"]) == ["frontend"]
        assert registered["services"]["frontend"]["npmScript"] == "start:fortuner"
        assert registered["services"]["frontend"]["port"] == 18443
        assert start.read_text(encoding="utf-8").count("# BEGIN CONTABDSI27 INSTALLED") == 1
        env = (fortuner / "Frontend" / ".env.local").read_text(encoding="utf-8")
        assert "VITE_OTHER=preservar" in env and env.count("VITE_CONTABILIDAD_URL=") == 1
        print("PASS: instalacion completa en sandbox, registrada en Fortuner y detenida.")
        install()
        assert start.read_text(encoding="utf-8").count("# BEGIN CONTABDSI27 INSTALLED") == 1
        assert json.loads((config / "service.json").read_text(encoding="utf-8"))["port"] == 18443
        print("PASS: repetir el instalador conserva puerto, conexion y una sola integracion.")
        # Forzar un fallo despues de modificar la integracion: se deben
        # recuperar exactamente los archivos anteriores, sin tocar el equipo.
        observed = [start, modules_file, config / "service.json", installed / "package.json",
                    installed / "installation.json", fortuner / "Frontend" / ".env.local"]
        before_failure = {path: path.read_bytes() for path in observed}
        failing, count = re.subn(r"(?m)^        Write-Utf8 \$frontendEnv.*$",
                                "        throw 'Fallo controlado de integracion'", installer)
        assert count == 1
        (package / "instalar.ps1").write_text(failing, encoding="utf-8")
        for entry in manifest["files"]:
            if entry["path"] == "instalar.ps1":
                entry["sha256"] = hashlib.sha256((package / "instalar.ps1").read_bytes()).hexdigest().upper()
        manifest_file.write_text(json.dumps(manifest), encoding="utf-8")
        failure = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                                  str(package / "instalar.ps1"), "-InstallRoot", str(installed), "-NoFirewall", "-Port", "18444"],
                                 capture_output=True, text=True)
        assert failure.returncode == 1 and "Fallo controlado" in failure.stdout
        assert all(path.read_bytes() == content for path, content in before_failure.items())
        print("PASS: un fallo posterior revierte configuracion e integracion de Fortuner.")
        # Comprobar el comando npm generado usando inspect, nunca serve.
        package_json = installed / "package.json"
        runtime_package = json.loads(package_json.read_text(encoding="utf-8"))
        runtime_package["scripts"]["start:fortuner"] = runtime_package["scripts"]["start:fortuner"].replace(" serve --config", " inspect --config")
        package_json.write_text(json.dumps(runtime_package), encoding="utf-8")
        npm = shutil.which("npm.cmd")
        result = subprocess.run(["cmd.exe", "/d", "/c", npm, "run", "start:fortuner"], cwd=installed,
                                capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
        assert '"listening": false' in result.stdout
        print("PASS: el comando npm registrado carga el ejecutable empaquetado.")


if __name__ == "__main__":
    main()

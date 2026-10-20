#!/usr/bin/env python3
"""Genera el Caddyfile del contenedor único de CONTABDSI.

Los dominios/hosts NO se hornean en la imagen: se leen de variables de entorno
en cada arranque. El Caddyfile resultante:

  - sirve la SPA compilada desde /srv/web;
  - proxya /api/*     → backend FastAPI   (127.0.0.1:8001);
  - proxya /bot-api/* → ia-service        (127.0.0.1:8003, sin prefijo);
  - añade cabeceras de seguridad, límite de cuerpo y (opcional) Basic Auth.

Modos:
  TLS=true  → Caddy termina TLS (modo directo; publica 80/443 hacia 8080/8443).
  TLS=false → Caddy habla HTTP en :8080 y va detrás del edge compartido, que
              termina TLS y reenvía a `contabdsi_app:8080` (modo recomendado en
              dsi-vps, donde `edge_caddy` ya ocupa 80/443).

Variables principales:
  HOST_APP          dominio público (p. ej. contabilidad.jcti.xyz)
  TLS               true|false (false requiere ALLOW_INSECURE=true en entrypoint)
  ACME_EMAIL        email para Let's Encrypt (modo TLS=true)
  HTTP_PORT         puerto HTTP interno de Caddy   (def. 8080)
  HTTPS_PORT        puerto HTTPS interno de Caddy  (def. 8443)
  BACKEND_PORT      puerto interno del backend     (def. 8001)
  IA_SERVICE_PORT   puerto interno del ia-service  (def. 8003)
  MAX_REQUEST_BODY  tamaño máximo del cuerpo       (def. 50MB; "0" = sin límite)
  CSP_POLICY        "off"/"" = sin CSP; si no, política explícita
  FRAME_ANCESTORS   orígenes que pueden embeber la app (def. 'self'). Si
                    Fortuner27 la muestra en un iframe, añade su origen
                    (p. ej. "'self' https://fortuner.jcti.xyz"); en ese caso
                    se omite X-Frame-Options y manda la CSP.
  PROTECT_APP       true ⇒ Basic Auth en toda la app (def. false)
  APP_USER          usuario del Basic Auth         (def. admin)
  APP_PASSWORD      contraseña en claro (se hashea con `caddy hash-password`)
  APP_PASSWORD_HASH hash bcrypt ya calculado (tiene prioridad)
  CADDYFILE_OUT     ruta de salida (def. /config/Caddyfile.generated)
"""

from __future__ import annotations

import os
import subprocess
import sys

env = os.environ


def text(name: str, default: str = "") -> str:
    return (env.get(name) or default).strip()


def flag(name: str, default: bool = False) -> bool:
    value = env.get(name)
    if value is None:
        return default
    return value.strip().lower() not in {"", "0", "false", "no", "off"}


TLS = flag("TLS", True)
HOST = text("HOST_APP") or text("HOST_CONTAB")
EMAIL = text("ACME_EMAIL")
HTTP_PORT = text("HTTP_PORT", "8080")
HTTPS_PORT = text("HTTPS_PORT", "8443")
BACKEND_PORT = text("BACKEND_PORT", "8001")
IA_PORT = text("IA_SERVICE_PORT", "8003")
BACKEND = f"127.0.0.1:{BACKEND_PORT}"
IA = f"127.0.0.1:{IA_PORT}"
CADDYFILE_OUT = text("CADDYFILE_OUT", "/config/Caddyfile.generated")

# Límite de cuerpo en el borde (importaciones XLSX, etc.).
MAX_BODY = text("MAX_REQUEST_BODY", "50MB")
body_limit = ""
if MAX_BODY and MAX_BODY != "0":
    body_limit = f"\trequest_body {{\n\t\tmax_size {MAX_BODY}\n\t}}\n"

# Orígenes que pueden embeber la app. Por defecto solo el mismo origen.
FRAME_ANCESTORS = text("FRAME_ANCESTORS", "'self'") or "'self'"

# CSP por defecto para una SPA servida en el mismo origen. La app usa estilos
# inline de React, imágenes locales/data: y llamadas a /api y /bot-api.
DEFAULT_CSP = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        f"frame-ancestors {FRAME_ANCESTORS}",
        "form-action 'self'",
    ]
)
csp_env = env.get("CSP_POLICY")
if csp_env is None:
    CSP = DEFAULT_CSP
elif csp_env.strip().lower() in {"", "off", "none", "false", "0"}:
    CSP = ""
else:
    CSP = csp_env.strip()

# ── Basic Auth opcional (defensa en profundidad) ────────────
# La app ya tiene AccessGate (Fortuner27 o clave administrativa). El Basic Auth
# añade una barrera exterior, pero puede romper el lanzamiento SSO desde
# Fortuner; por eso viene desactivado por defecto.
PROTECT_APP = flag("PROTECT_APP", False)
basic_auth = ""
if PROTECT_APP:
    password_hash = text("APP_PASSWORD_HASH")
    if not password_hash:
        password = env.get("APP_PASSWORD") or ""
        if password:
            result = subprocess.run(
                ["caddy", "hash-password", "--plaintext", password],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0:
                password_hash = result.stdout.strip()
            else:
                print(
                    "⚠️  No se pudo hashear APP_PASSWORD; se omite Basic Auth.",
                    file=sys.stderr,
                )
    if password_hash:
        basic_auth = f"\tbasic_auth {{\n\t\t{text('APP_USER', 'admin')} {password_hash}\n\t}}\n"
    else:
        print(
            "⚠️  PROTECT_APP=true pero falta APP_PASSWORD/APP_PASSWORD_HASH; "
            "NO se protege el sitio.",
            file=sys.stderr,
        )

# ── Cabeceras comunes ───────────────────────────────────────
header_lines = [
    '\t\tX-Content-Type-Options "nosniff"',
    '\t\tReferrer-Policy "strict-origin-when-cross-origin"',
    '\t\tCross-Origin-Opener-Policy "same-origin-allow-popups"',
    '\t\tPermissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"',
    "\t\t-Server",
]
# X-Frame-Options no admite varios orígenes. Si se autoriza un iframe externo
# (Fortuner), se omite y la restricción queda en CSP frame-ancestors.
if FRAME_ANCESTORS.strip() == "'self'":
    header_lines.insert(1, '\t\tX-Frame-Options "SAMEORIGIN"')
if TLS:
    header_lines.insert(0, '\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"')
if CSP:
    header_lines.append(f'\t\tContent-Security-Policy "{CSP}"')
header_block = "\theader {\n" + "\n".join(header_lines) + "\n\t}\n"

# Detrás del edge, el backend debe ver el esquema público real (https).
proto_up = "" if TLS else " {\n\t\t\theader_up X-Forwarded-Proto https\n\t\t}"

handlers = (
    f"{header_block}{basic_auth}{body_limit}"
    "\tencode zstd gzip\n"
    "\tlog {\n"
    "\t\toutput stdout\n"
    "\t\tformat json\n"
    "\t}\n"
    "\thandle_path /bot-api/* {\n"
    f"\t\treverse_proxy {IA}{proto_up}\n"
    "\t}\n"
    "\thandle /api/* {\n"
    f"\t\treverse_proxy {BACKEND}{proto_up}\n"
    "\t}\n"
    "\thandle {\n"
    "\t\troot * /srv/web\n"
    "\t\ttry_files {path} /index.html\n"
    "\t\tfile_server\n"
    "\t}"
)

if HOST:
    site = HOST if TLS else f"http://{HOST}"
else:
    # Sin dominio: vhost mínimo para smoke test (solo HTTP interno).
    site = f":{HTTP_PORT}"
    print(
        "⚠️  No definiste HOST_APP. Se genera un vhost mínimo en "
        f":{HTTP_PORT} (solo smoke test, sin TLS).",
        file=sys.stderr,
    )

opts = ["\tadmin off", f"\thttp_port {HTTP_PORT}", f"\thttps_port {HTTPS_PORT}"]
if TLS:
    if EMAIL:
        opts.append(f"\temail {EMAIL}")
else:
    opts.append("\tauto_https off")
    # El edge compartido es un proxy de confianza en la red Docker privada.
    opts.append("\tservers {\n\t\ttrusted_proxies static private_ranges\n\t}")

out = "{\n" + "\n".join(opts) + "\n}\n\n" + f"{site} {{\n{handlers}\n}}\n"

with open(CADDYFILE_OUT, "w", encoding="utf-8") as handle:
    handle.write(out)

print(f"Caddyfile generado en {CADDYFILE_OUT}:\n{out}")

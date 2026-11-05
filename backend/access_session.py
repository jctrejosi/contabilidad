"""Sesiones de acceso a Contabilidad autorizadas centralmente por Fortuner."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass
from dataclasses import asdict
from contextvars import ContextVar
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.types import ASGIApp, Scope, Receive, Send
from starlette.responses import JSONResponse


MODULE_ID = "contabilidad"
COOKIE_NAME = "contabilidad_session"
DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60
FORTUNER_API_URL_ENV = "FORTUNER_API_URL"
COOKIE_SECURE_ENV = "CONTABDSI_COOKIE_SECURE"

router = APIRouter(prefix="/api/access", tags=["access"])


@dataclass(frozen=True)
class ModuleUser:
    code: str
    name: str
    administrator: bool


@dataclass(frozen=True)
class AccessSession:
    method: str
    expires_at: float
    user: ModuleUser


class AccessSessionStore:
    """Mantiene sesiones opacas; el navegador solo conoce el token aleatorio."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._sessions: dict[str, AccessSession] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def issue(self, method: str, user: ModuleUser, ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS) -> str:
        ttl = max(300, min(ttl_seconds, 24 * 60 * 60))
        token = secrets.token_urlsafe(48)
        with self._lock:
            self._remove_expired_locked()
            self._sessions[self._digest(token)] = AccessSession(
                method=method,
                expires_at=self._clock() + ttl,
                user=user,
            )
        return token

    def get(self, token: str | None) -> AccessSession | None:
        if not token:
            return None
        with self._lock:
            self._remove_expired_locked()
            return self._sessions.get(self._digest(token))

    def revoke(self, token: str | None) -> None:
        if not token:
            return
        with self._lock:
            self._sessions.pop(self._digest(token), None)

    def _remove_expired_locked(self) -> None:
        now = self._clock()
        expired = [digest for digest, session in self._sessions.items() if session.expires_at <= now]
        for digest in expired:
            self._sessions.pop(digest, None)


class FortunerCodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=20, max_length=200)


class AdministratorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(min_length=1, max_length=512)


class FortunerAuthorizationError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


_SESSIONS = AccessSessionStore()
_CURRENT_USER: ContextVar[ModuleUser | None] = ContextVar("contabilidad_user", default=None)


def _validated_user(authorization: dict[str, Any]) -> ModuleUser:
    raw = authorization.get("user")
    if (not isinstance(raw, dict) or not isinstance(raw.get("code"), str)
        or not raw["code"].strip() or len(raw["code"]) > 4
        or not isinstance(raw.get("name"), str) or not raw["name"].strip()
        or type(raw.get("administrator")) is not bool):
        raise HTTPException(502, "Fortuner devolvió una identidad de usuario inválida. Actualice Fortuner y vuelva a ingresar.")
    if authorization.get("moduleId") != MODULE_ID:
        raise HTTPException(502, "Fortuner devolvió una autorización para otro módulo.")
    return ModuleUser(raw["code"].strip(), raw["name"].strip(), raw["administrator"])


def require_authenticated_user(request: Request) -> ModuleUser:
    """Dependencia reutilizable: identidad exclusivamente de cookie opaca."""
    session = _SESSIONS.get(request.cookies.get(COOKIE_NAME))
    if session is None:
        raise HTTPException(401, "Sesión vencida o inexistente. Ingrese nuevamente desde Fortuner.")
    return session.user


def session_user_code() -> str:
    """Actor para APIs heredadas; nunca acepta sustituciones JSON/query/header.

    Mantiene el código tal como Fortuner lo entregó (incluido Ha27). Cada
    repositorio conserva su normalización histórica cuando la tabla la exige.
    """
    user = _CURRENT_USER.get()
    if user is None:
        raise HTTPException(401, "Sesión vencida o inexistente. Ingrese nuevamente desde Fortuner.")
    return user.code


def session_payload(model) -> dict[str, Any]:
    """Compatibilidad: sustituir actor heredado también dentro de payloads.

    Solo el campo actor `usuario`; no toca códigos del catálogo de usuarios ni
    filtros de informes. Repositorios no reciben el actor elegido por navegador.
    """
    payload = model.model_dump()
    if "usuario" in payload:
        payload["usuario"] = session_user_code()
    return payload


class SessionIdentityMiddleware:
    """Propaga identidad por petición, también a endpoints síncronos de AnyIO.

    No autoriza por valores del cuerpo ni cambia las rutas públicas de acceso.
    Las APIs auditadas llaman session_user_code, que exige sesión válida.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        session = _SESSIONS.get(Request(scope).cookies.get(COOKIE_NAME))
        if (scope.get("path", "").startswith("/api/")
            and not scope["path"].startswith("/api/access/")
            and scope.get("method") in {"POST", "PUT", "PATCH", "DELETE"}
            and session is None):
            return await JSONResponse({"detail": "Sesión vencida o inexistente. Ingrese nuevamente desde Fortuner."},
                                      status_code=401)(scope, receive, send)
        token = _CURRENT_USER.set(session.user if session else None)
        try:
            await self.app(scope, receive, send)
        finally:
            _CURRENT_USER.reset(token)


def _session_ttl_seconds() -> int:
    try:
        configured = int(os.getenv("CONTABDSI_SESSION_TTL_SECONDS", str(DEFAULT_SESSION_TTL_SECONDS)))
    except ValueError:
        return DEFAULT_SESSION_TTL_SECONDS
    return max(300, min(configured, 24 * 60 * 60))


def _cookie_secure() -> bool:
    return os.getenv(COOKIE_SECURE_ENV, "").strip().lower() in {"1", "true", "yes", "si"}


def _fortuner_url(path: str) -> str:
    base_url = os.getenv(FORTUNER_API_URL_ENV, "http://127.0.0.1:8004").rstrip("/")
    return f"{base_url}{path}"


def _error_detail(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        detail = payload.get("detail")
        if isinstance(detail, str) and detail:
            return detail
    return fallback


def _post_to_fortuner(path: str, payload: dict[str, str]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = UrlRequest(
        _fortuner_url(path),
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=3) as response:  # noqa: S310 - URL controlada por el servidor.
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        try:
            payload_error = json.loads(error.read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            payload_error = None
        raise FortunerAuthorizationError(
            error.code,
            _error_detail(payload_error, "Fortuner rechazó la autorización."),
        ) from error
    except (URLError, OSError, TimeoutError) as error:
        raise FortunerAuthorizationError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "No fue posible consultar el servicio de autorización de Fortuner.",
        ) from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise FortunerAuthorizationError(
            status.HTTP_502_BAD_GATEWAY,
            "Fortuner devolvió una respuesta de autorización inválida.",
        ) from error

    if not isinstance(result, dict):
        raise FortunerAuthorizationError(
            status.HTTP_502_BAD_GATEWAY,
            "Fortuner devolvió una respuesta de autorización inválida.",
        )
    return result


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=_session_ttl_seconds(),
        httponly=True,
        secure=_cookie_secure(),
        samesite="strict",
        path="/",
    )


def _create_session(response: Response, method: str, user: ModuleUser) -> dict[str, Any]:
    ttl = _session_ttl_seconds()
    token = _SESSIONS.issue(method, user, ttl)
    _set_session_cookie(response, token)
    return {
        "authorized": True,
        "moduleId": MODULE_ID,
        "method": method,
        "expiresIn": ttl,
        "user": asdict(user),
    }


@router.post("/fortuner")
def exchange_fortuner_code(payload: FortunerCodeRequest, response: Response) -> dict[str, Any]:
    try:
        authorization = _post_to_fortuner(
            "/api/access/launch-grants/redeem",
            {"moduleId": MODULE_ID, "code": payload.code},
        )
    except FortunerAuthorizationError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error

    if authorization.get("authorized") is not True:
        raise HTTPException(status_code=401, detail="Fortuner no autorizó el acceso a Contabilidad.")
    return _create_session(response, "fortuner", _validated_user(authorization))


@router.post("/administrator")
def administrator_access(payload: AdministratorRequest, response: Response) -> dict[str, Any]:
    try:
        authorization = _post_to_fortuner(
            "/api/access/admin/verify",
            {"moduleId": MODULE_ID, "key": payload.key},
        )
    except FortunerAuthorizationError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error

    if authorization.get("authorized") is not True:
        raise HTTPException(status_code=401, detail="Fortuner no autorizó el acceso administrativo.")
    user = _validated_user(authorization)
    if user.code != "Ha27" or not user.administrator:
        raise HTTPException(502, "Fortuner devolvió una identidad administrativa inválida.")
    return _create_session(response, "administrator", user)


@router.get("/session")
def session_status(request: Request) -> dict[str, Any]:
    session = _SESSIONS.get(request.cookies.get(COOKIE_NAME))
    if session is None:
        raise HTTPException(status_code=401, detail="No existe una sesión válida de Contabilidad.")
    return {"authorized": True, "moduleId": MODULE_ID, "method": session.method, "user": asdict(session.user)}


@router.post("/logout")
def logout(request: Request, response: Response) -> dict[str, bool]:
    _SESSIONS.revoke(request.cookies.get(COOKIE_NAME))
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="strict")
    return {"closed": True}

"""Sesiones de acceso a Contabilidad autorizadas centralmente por Fortuner."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, Field


MODULE_ID = "contabilidad"
COOKIE_NAME = "contabilidad_session"
DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60
FORTUNER_API_URL_ENV = "FORTUNER_API_URL"
COOKIE_SECURE_ENV = "CONTABDSI_COOKIE_SECURE"

router = APIRouter(prefix="/api/access", tags=["access"])


@dataclass(frozen=True)
class AccessSession:
    method: str
    expires_at: float


class AccessSessionStore:
    """Mantiene sesiones opacas; el navegador solo conoce el token aleatorio."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._sessions: dict[str, AccessSession] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def issue(self, method: str, ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS) -> str:
        ttl = max(300, min(ttl_seconds, 24 * 60 * 60))
        token = secrets.token_urlsafe(48)
        with self._lock:
            self._remove_expired_locked()
            self._sessions[self._digest(token)] = AccessSession(
                method=method,
                expires_at=self._clock() + ttl,
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
    code: str = Field(min_length=20, max_length=200)


class AdministratorRequest(BaseModel):
    key: str = Field(min_length=1, max_length=512)


class FortunerAuthorizationError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


_SESSIONS = AccessSessionStore()


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


def _create_session(response: Response, method: str) -> dict[str, Any]:
    ttl = _session_ttl_seconds()
    token = _SESSIONS.issue(method, ttl)
    _set_session_cookie(response, token)
    return {
        "authorized": True,
        "moduleId": MODULE_ID,
        "method": method,
        "expiresIn": ttl,
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
    return _create_session(response, "fortuner")


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
    return _create_session(response, "administrator")


@router.get("/session")
def session_status(request: Request) -> dict[str, Any]:
    session = _SESSIONS.get(request.cookies.get(COOKIE_NAME))
    if session is None:
        raise HTTPException(status_code=401, detail="No existe una sesión válida de Contabilidad.")
    return {"authorized": True, "moduleId": MODULE_ID, "method": session.method}


@router.post("/logout")
def logout(request: Request, response: Response) -> dict[str, bool]:
    _SESSIONS.revoke(request.cookies.get(COOKIE_NAME))
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="strict")
    return {"closed": True}

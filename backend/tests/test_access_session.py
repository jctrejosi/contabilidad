from unittest.mock import patch

import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request

from backend.access_session import (
    COOKIE_NAME,
    AccessSessionStore,
    AdministratorRequest,
    FortunerCodeRequest,
    administrator_access,
    exchange_fortuner_code,
    logout,
)


class MutableClock:
    def __init__(self) -> None:
        self.value = 100.0

    def __call__(self) -> float:
        return self.value


def test_session_is_opaque_and_expires() -> None:
    clock = MutableClock()
    store = AccessSessionStore(clock=clock)
    token = store.issue("fortuner", ttl_seconds=300)

    assert store.get(token) is not None
    assert store.get(token).method == "fortuner"
    clock.value += 301
    assert store.get(token) is None


def test_session_can_be_revoked() -> None:
    store = AccessSessionStore()
    token = store.issue("administrator")

    store.revoke(token)
    assert store.get(token) is None


@patch("backend.access_session._post_to_fortuner", return_value={"authorized": True})
def test_fortuner_code_creates_http_only_cookie(post_to_fortuner) -> None:
    response = Response()

    result = exchange_fortuner_code(FortunerCodeRequest(code="x" * 32), response)

    assert result["authorized"] is True
    assert result["method"] == "fortuner"
    assert COOKIE_NAME in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]
    post_to_fortuner.assert_called_once_with(
        "/api/access/launch-grants/redeem",
        {"moduleId": "contabilidad", "code": "x" * 32},
    )


@patch("backend.access_session._post_to_fortuner", return_value={"authorized": True})
def test_administrator_access_creates_session(post_to_fortuner) -> None:
    response = Response()

    result = administrator_access(AdministratorRequest(key="clave de prueba"), response)

    assert result["method"] == "administrator"
    assert COOKIE_NAME in response.headers["set-cookie"]


@patch("backend.access_session._post_to_fortuner", return_value={"authorized": False})
def test_rejected_code_does_not_create_cookie(_post_to_fortuner) -> None:
    response = Response()

    with pytest.raises(HTTPException) as captured:
        exchange_fortuner_code(FortunerCodeRequest(code="x" * 32), response)

    assert captured.value.status_code == 401
    assert "set-cookie" not in response.headers


def test_logout_revokes_cookie() -> None:
    response = Response()
    request = Request({"type": "http", "headers": [(b"cookie", f"{COOKIE_NAME}=token".encode())]})

    result = logout(request, response)

    assert result == {"closed": True}
    assert f"{COOKIE_NAME}=\"\"" in response.headers["set-cookie"]

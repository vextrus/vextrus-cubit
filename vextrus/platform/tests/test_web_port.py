"""The API trusts the web dev server's origin on `VEXTRUS_WEB_PORT`, as web/vite.config.ts serves it."""

import importlib
from collections.abc import Iterator
from types import ModuleType
from typing import Any

import pytest
from django.core.exceptions import ImproperlyConfigured

import vextrus.settings.auth
from vextrus.testing.auth import Api

VARIABLES = ("VEXTRUS_WEB_PORT", "VEXTRUS_CSRF_TRUSTED_ORIGINS", "VEXTRUS_WEB_ORIGIN")


@pytest.fixture
def auth_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[Any]:
    """Reads the auth settings afresh under the given environment; restores them after."""
    for name in VARIABLES:
        monkeypatch.delenv(name, raising=False)

    def read(**environ: str) -> ModuleType:
        for name, value in environ.items():
            monkeypatch.setenv(name, value)
        return importlib.reload(vextrus.settings.auth)

    yield read
    monkeypatch.undo()
    importlib.reload(vextrus.settings.auth)


def test_the_web_port_defaults_to_5410(auth_settings: Any) -> None:
    auth = auth_settings()
    assert auth.CSRF_TRUSTED_ORIGINS == ["http://127.0.0.1:5410"]
    assert auth.VEXTRUS_WEB_ORIGIN == "http://127.0.0.1:5410"


def test_an_empty_web_port_is_unset(auth_settings: Any) -> None:
    auth = auth_settings(VEXTRUS_WEB_PORT="", VEXTRUS_CSRF_TRUSTED_ORIGINS="")
    assert auth.CSRF_TRUSTED_ORIGINS == ["http://127.0.0.1:5410"]


def test_the_trusted_origin_and_invitation_origin_follow_the_web_port(auth_settings: Any) -> None:
    auth = auth_settings(VEXTRUS_WEB_PORT="5423")
    assert auth.CSRF_TRUSTED_ORIGINS == ["http://127.0.0.1:5423"]
    assert auth.VEXTRUS_WEB_ORIGIN == "http://127.0.0.1:5423"


def test_explicit_origins_win_over_the_web_port(auth_settings: Any) -> None:
    auth = auth_settings(
        VEXTRUS_WEB_PORT="5423",
        VEXTRUS_CSRF_TRUSTED_ORIGINS="https://app.vextrus.example",
        VEXTRUS_WEB_ORIGIN="https://app.vextrus.example",
    )
    assert auth.CSRF_TRUSTED_ORIGINS == ["https://app.vextrus.example"]
    assert auth.VEXTRUS_WEB_ORIGIN == "https://app.vextrus.example"


@pytest.mark.parametrize("bad", ["abc", "5410x", "54.10", "-1", "0", "65536", "99999", "٥٤١٠"])
def test_a_malformed_web_port_is_refused_naming_the_variable_value_and_range(
    auth_settings: Any, bad: str
) -> None:
    with pytest.raises(ImproperlyConfigured) as refusal:
        auth_settings(VEXTRUS_WEB_PORT=bad)
    message = str(refusal.value)
    assert "VEXTRUS_WEB_PORT" in message
    assert repr(bad) in message
    assert "1 to 65535" in message


def sign_in_from(origin: str) -> Any:
    api = Api()
    token = api.csrf_token()
    return api.client.post(
        "/api/auth/sign-in",
        data='{"email": "nobody@example.com", "password": "not the password at all"}',
        content_type="application/json",
        headers={"X-CSRFToken": token, "Origin": origin},
    )


@pytest.mark.django_db
def test_sign_in_from_the_web_port_passes_csrf(auth_settings: Any, settings: Any) -> None:
    settings.CSRF_TRUSTED_ORIGINS = auth_settings(VEXTRUS_WEB_PORT="5423").CSRF_TRUSTED_ORIGINS
    # Past CSRF, the sign-in itself is refused: wrong credentials, not a forbidden origin.
    trusted = sign_in_from("http://127.0.0.1:5423")
    assert trusted.status_code == 401
    assert trusted.json()["code"] != "platform.auth.csrf_failed"
    untrusted = sign_in_from("http://127.0.0.1:5410")
    assert untrusted.status_code == 403
    assert untrusted.json() == {"code": "platform.auth.csrf_failed", "params": {}}

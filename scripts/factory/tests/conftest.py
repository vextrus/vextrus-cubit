"""The launcher refuses any folder but the main checkout (`VEXTRUS_MAIN_CHECKOUT`, default the
owner's). The launch tests build their main checkout at `<tmp_path>/main`, so that is the main
checkout for every test here; a test that needs another sets the variable itself."""

import importlib
from pathlib import Path
from typing import Any

import pytest


@pytest.fixture(autouse=True)
def main_checkout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    main = tmp_path / "main"
    monkeypatch.setenv("VEXTRUS_MAIN_CHECKOUT", str(main))
    return main


@pytest.fixture(autouse=True)
def account_a(monkeypatch: pytest.MonkeyPatch) -> None:
    """The launcher refuses another account's config; a VM that sets CLAUDE_CONFIG_DIR must not leak
    it into these tests (a test that wants it sets it itself)."""
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)


# The tests of the Jev client itself: they need the real `ask`.
JEV_OWN_TESTS = ("test_jev_unit", "test_factory_jev")


@pytest.fixture(autouse=True)
def no_jev_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, request: pytest.FixtureRequest
) -> list[tuple[object, object]]:
    """A cloud VM carries TYPESAFE_API_KEY: no test here may reach the real Jev. Jev's log and cache
    go under tmp_path, and outside Jev's own tests `jev.ask` (what `launch.default_ask` looks up at
    call time, so `launch.main` too) is a fake that answers unavailable and writes nothing. Returns
    the fake's calls. The module is looked up per test: Jev's own tests re-import it."""
    jev: Any = importlib.import_module("scripts.factory.jev")
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    monkeypatch.setenv(jev.FACTORY_VARIABLE, str(tmp_path / "factory"))
    calls: list[tuple[object, object]] = []
    if request.module.__name__.rsplit(".", 1)[-1] not in JEV_OWN_TESTS:

        def unavailable(state: object, questions: object, **_: object) -> object:
            calls.append((state, questions))
            return jev.Unavailable(jev.Why.NO_KEY)

        monkeypatch.setattr(jev, "ask", unavailable)
    return calls

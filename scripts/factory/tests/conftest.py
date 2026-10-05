"""The launcher refuses any folder but the main checkout (`VEXTRUS_MAIN_CHECKOUT`, default the
owner's). The launch tests build their main checkout at `<tmp_path>/main`, so that is the main
checkout for every test here; a test that needs another sets the variable itself."""

from pathlib import Path

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


@pytest.fixture(autouse=True)
def no_jev_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """A cloud VM carries TYPESAFE_API_KEY: no test here may reach the real Jev."""
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)

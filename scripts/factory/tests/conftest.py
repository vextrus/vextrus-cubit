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

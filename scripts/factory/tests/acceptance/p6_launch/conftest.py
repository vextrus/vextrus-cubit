"""The `world` fixture of ticket T-LAUNCH's tests (built in `_support.make_world`)."""

from pathlib import Path

import pytest

from ._support import World, make_world


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return make_world(tmp_path, monkeypatch)

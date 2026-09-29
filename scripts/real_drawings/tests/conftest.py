"""The command reads with the product's job by default (21c), which needs PostgreSQL 18's binaries: a
test on the fake sandbox (`world.py`) gets a fake `initdb`, so it runs where PostgreSQL 18 is not
installed (CI's runners hold it in a service container). The real sandbox's tests keep the real ones."""

from pathlib import Path

import pytest

from scripts.real_drawings import sandbox


@pytest.fixture(autouse=True)
def fake_postgresql_18(
    request: pytest.FixtureRequest,
    tmp_path_factory: pytest.TempPathFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if request.node.get_closest_marker("needs_bwrap"):
        return
    binaries: Path = tmp_path_factory.mktemp("fake-postgresql-18") / "bin"
    binaries.mkdir()
    (binaries / "initdb").write_text("#!/bin/sh\n")
    monkeypatch.setattr(sandbox, "PG_BIN", binaries)

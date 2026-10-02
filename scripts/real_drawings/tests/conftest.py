"""The command reads with the product's job by default (21d), which needs PostgreSQL 18's binaries
(`sandbox.PG_BIN`): the fake sandbox's tests are given a stand-in folder for them, so they run where
none is installed (CI); a test of the real sandbox (`needs_bwrap`) uses the installed ones."""

import pytest

from scripts.real_drawings import sandbox


@pytest.fixture(autouse=True)
def postgresql_18(
    request: pytest.FixtureRequest,
    tmp_path_factory: pytest.TempPathFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if request.node.get_closest_marker("needs_bwrap") is not None:
        return
    binaries = tmp_path_factory.mktemp("stand-in-postgresql-18") / "bin"
    binaries.mkdir()
    (binaries / "initdb").write_text("#!/bin/sh\n")
    monkeypatch.setattr(sandbox, "PG_BIN", binaries)

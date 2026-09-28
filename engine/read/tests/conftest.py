"""The reader's fixtures: synthetic DWGs built once per test session (engine/fixtures/dwg/)."""

from collections.abc import Callable
from pathlib import Path

import pytest

from engine.fixtures import dwg


@pytest.fixture(scope="session")
def dwg_fixture(tmp_path_factory: pytest.TempPathFactory) -> Callable[[str], Path]:
    """`dwg_fixture("title_block")`: the fixture's DWG, built on first use and kept for the session."""
    folder = tmp_path_factory.mktemp("dwg-fixtures")
    built: dict[str, Path] = {}
    writer: list[Path] = []

    def get(name: str) -> Path:
        if name not in built:
            if not writer:
                writer.append(dwg.build_writer(folder))
            built[name] = dwg.build(name, folder, writer[0])
        return built[name]

    return get

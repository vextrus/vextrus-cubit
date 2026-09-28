"""11's DWG fixtures (engine/fixtures/dwg/), built once per test session through the real writer."""

from collections.abc import Callable
from pathlib import Path

import pytest

from engine.fixtures import dwg


@pytest.fixture(scope="session")
def dwg_fixture(tmp_path_factory: pytest.TempPathFactory) -> Callable[[str], Path]:
    """`dwg_fixture("mirrored_insert")`: the fixture's DWG, built on first use and kept."""
    folder = tmp_path_factory.mktemp("dwg-fixtures-11")
    built: dict[str, Path] = {}
    writer: list[Path] = []

    def get(name: str) -> Path:
        if name not in built:
            if not writer:
                writer.append(dwg.build_writer(folder))
            built[name] = dwg.build(name, folder, writer[0])
        return built[name]

    return get

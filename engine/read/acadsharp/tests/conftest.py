"""The dumper, built once per test session (build.py), and the DWG fixtures (engine/fixtures/dwg/).

Both are kept under the session's base temporary folder, so the check's tests
(engine/check/tests/test_decoders_agree.py, which import these fixtures) reuse what these built.
"""

from collections.abc import Callable
from pathlib import Path

import pytest

from engine.fixtures import dwg
from engine.read.acadsharp.tests.build import build_dumper


@pytest.fixture(scope="session")
def dumper_prefix(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The folder holding the dumper built from the tree, for `VEXTRUS_ACADSHARP_DUMP`."""
    folder = tmp_path_factory.getbasetemp() / "acadsharp-dump"
    prefix = folder / "prefix"
    if not (prefix / "acadsharp-dump").is_file():
        prefix = build_dumper(folder)
    return prefix


@pytest.fixture(scope="session")
def dwg_fixture(tmp_path_factory: pytest.TempPathFactory) -> Callable[..., Path]:
    """`dwg_fixture("entity_kinds")`: the fixture's DWG, built on first use and kept for the session;
    `dwg_fixture("entity_kinds", version="AC1024")` saves it as another DWG version."""
    folder = tmp_path_factory.getbasetemp() / "acadsharp-dwg-fixtures"
    folder.mkdir(exist_ok=True)

    def get(name: str, version: str | None = None) -> Path:
        module = dwg.generator(name)
        pinned: str = getattr(module, "VERSION")  # noqa: B009 (a generator's constant; no stub types it)
        version = version or pinned
        target = folder / f"{name}-{version}.dwg"
        if not target.is_file():
            writer = folder / "writer" / "Writer.dll"
            if not writer.is_file():
                writer = dwg.build_writer(folder)
            setattr(module, "VERSION", version)  # noqa: B010
            try:
                built = dwg.build(name, folder, writer)
            finally:
                setattr(module, "VERSION", pinned)  # noqa: B010
            patch = getattr(module, "patch", None)  # a change neither writer can make (zero_z_scale)
            if patch is not None:
                built.write_bytes(patch(built.read_bytes()))
            built.rename(target)
        return target

    return get

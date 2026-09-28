"""The PDF reader's fixtures: synthetic PDFs built per test session (engine/fixtures/pdf/).

The reader runs its child in the sandbox. A test marked `needs_bwrap` runs it in bubblewrap, as
production does; every other test runs the same child directly (`VEXTRUS_SANDBOX=off`, allowed only
inside a test), under the same CPU, memory, file-size and wall-clock limits.
"""

from collections.abc import Callable
from pathlib import Path

import pytest

from engine.fixtures import pdf
from engine.read.sandbox import Limits

SMALL = Limits(cpu_seconds=5, memory_bytes=512 * 2**20, wall_seconds=30.0, output_bytes=64 * 2**20)
"""Limits a hostile fixture meets quickly: a bomb stops at half a gigabyte, a loop at five seconds."""


@pytest.fixture(autouse=True)
def _sandbox(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    if request.node.get_closest_marker("needs_bwrap") is None:
        monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    else:
        monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)


@pytest.fixture(scope="session")
def pdf_fixture(tmp_path_factory: pytest.TempPathFactory) -> Callable[..., Path]:
    """`pdf_fixture("plot")`, `pdf_fixture("scan", share=0.51)`: the fixture's PDF, built on first use
    and kept for the session."""
    folder = tmp_path_factory.mktemp("pdf-fixtures")
    built: dict[tuple[str, tuple[tuple[str, object], ...]], Path] = {}

    def get(name: str, **options: object) -> Path:
        key = (name, tuple(sorted(options.items())))
        if key not in built:
            built[key] = pdf.build(name, folder, **options)
        return built[key]

    return get

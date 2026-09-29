"""Ticket 18's acceptance for the renderer it edits: #87 ("A layout's paper is read in millimetres when
the layout is in inches") and "never changing the buffer format's version in wave 4, while 16 decodes
it" (docs/plans/M0.md, 18; the orchestrator's rulings, session 06, 18).

The layouts are drawn here with ezdxf and written to DWG by the repo's writer
(`engine.fixtures.dwg.build_writer`), then read by the real reader: the same sheet on an ANSI D layout
in inches and on an A1 layout in millimetres, each frame drawn 0.5 unit inside the paper's edge (as
most frames are, so the frame alone is no standard sheet), and an A3 layout drawn to its edge.

    uv run pytest -m needs_toolchain -rf engine/render/tests/acceptance/t18
    uv run pytest -rf engine/render/tests/acceptance/t18      # the buffer version alone
"""

import os
import struct
import subprocess
from pathlib import Path

import pytest
from ezdxf.document import Drawing

from engine.fixtures import dwg
from engine.read import read
from engine.recognise.types import SheetCandidate, SheetLocation
from engine.render import buffers

FIXTURES = Path(buffers.__file__).with_name("fixtures")
INCH = 25.4


def _drawing() -> Drawing:
    doc = dwg.new_drawing()
    doc.header["$INSUNITS"] = 4
    doc.modelspace().add_line((0, 0), (1000, 0))
    inch = doc.layouts.new("ANSI D inch")
    inch.page_setup(size=(34, 22), margins=(0, 0, 0, 0), units="inch")
    inch.add_lwpolyline([(0.5, 0.5), (33.5, 0.5), (33.5, 21.5), (0.5, 21.5)], close=True)
    inch.add_line((2, 2), (32, 20))
    metric = doc.layouts.new("A1 mm")
    metric.page_setup(size=(841, 594), margins=(0, 0, 0, 0), units="mm")
    metric.add_lwpolyline([(10, 10), (831, 10), (831, 584), (10, 584)], close=True)
    metric.add_line((50, 50), (800, 550))
    a3 = doc.layouts.new("A3 mm")
    a3.page_setup(size=(420, 297), margins=(0, 0, 0, 0), units="mm")
    a3.add_lwpolyline([(0, 0), (420, 0), (420, 297), (0, 297)], close=True)
    return doc


@pytest.fixture(scope="module")
def artefact(tmp_path_factory: pytest.TempPathFactory) -> object:
    folder = tmp_path_factory.mktemp("t18-paper")
    writer = dwg.build_writer(folder)
    dxf, out = folder / "paper.dxf", folder / "paper.dwg"
    _drawing().saveas(dxf)
    env = {**os.environ, "DOTNET_CLI_TELEMETRY_OPTOUT": "1", "DOTNET_NOLOGO": "1"}
    done = subprocess.run(
        [str(dwg.dotnet()), str(writer), str(dxf), str(out), "AC1032"],
        capture_output=True, text=True, timeout=120, env=env, check=False,
    )  # fmt: skip
    assert done.returncode == 0, done.stdout + done.stderr
    return read(out)


def _paper(artefact: object, layout: str) -> buffers.Paper:
    sheet = SheetCandidate(SheetLocation(layout=layout))
    built = buffers.build(artefact, sheet)  # type: ignore[arg-type]
    # through the published format, as 16 reads it
    return buffers.SheetBuffers.from_bytes(built.to_bytes()).paper


@pytest.mark.needs_toolchain
def test_an_inch_layouts_paper_is_read_in_inches(artefact: object) -> None:
    paper = _paper(artefact, "ANSI D inch")

    assert paper.mm_per_unit == pytest.approx(INCH)
    # Its frame spans 33 x 21 in: the sheet is 34 x 22 in (863.6 x 558.8 mm), never 33 x 21 mm.
    assert 33 * INCH - 1 <= paper.width_mm <= 34 * INCH + 1, paper
    assert 21 * INCH - 1 <= paper.height_mm <= 22 * INCH + 1, paper


@pytest.mark.needs_toolchain
def test_the_same_sheet_on_a_millimetre_layout_is_read_in_millimetres(artefact: object) -> None:
    paper = _paper(artefact, "A1 mm")

    assert paper.mm_per_unit == pytest.approx(1.0)
    assert 821 - 1 <= paper.width_mm <= 841 + 1, paper
    assert 574 - 1 <= paper.height_mm <= 594 + 1, paper


@pytest.mark.needs_toolchain
def test_an_a3_sheet_is_not_drawn_at_a_multiple_of_its_size(artefact: object) -> None:
    paper = _paper(artefact, "A3 mm")

    assert paper.mm_per_unit == pytest.approx(1.0)
    assert paper.width_mm == pytest.approx(420, abs=1)
    assert paper.height_mm == pytest.approx(297, abs=1)


def test_the_buffer_formats_version_is_still_1() -> None:
    for name in ("tiny-sheet.bin", "lineweight-ramp.bin"):
        head = (FIXTURES / name).read_bytes()[:8]
        magic, version = struct.unpack_from("<4sH", head)
        assert (magic, version) == (b"VXSB", 1), name
    assert buffers.VERSION == 1

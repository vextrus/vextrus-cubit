"""The review of 18, round 1 (score 75): #87 read a layout's paper units but not its plot scale, so a
layout drawn in millimetres whose page setup states inches came out 25.4 times too large. Through the
repo's DWG writer and the real reader:

    uv run pytest -m needs_toolchain engine/render/tests/test_paper_scale.py
"""

import os
import subprocess
from pathlib import Path

import pytest

from engine.fixtures import dwg
from engine.read import read
from engine.recognise.types import SheetCandidate, SheetLocation
from engine.render import buffers

LAYOUTS: dict[str, tuple[float, float]] = {
    "A1 mm under inch units at 1 to 25.4": (1, 25.4),
    "A1 mm under inch units at 1 to 1": (1, 1),
}


@pytest.fixture(scope="module")
def artefact(tmp_path_factory: pytest.TempPathFactory) -> object:
    folder: Path = tmp_path_factory.mktemp("paper-scale")
    doc = dwg.new_drawing()
    doc.header["$INSUNITS"] = 4
    doc.modelspace().add_line((0, 0), (1000, 0))
    for name, scale in LAYOUTS.items():
        layout = doc.layouts.new(name)
        layout.page_setup(size=(841 / 25.4, 594 / 25.4), margins=(0, 0, 0, 0), units="inch", scale=scale)
        layout.add_lwpolyline([(0, 0), (841, 0), (841, 594), (0, 594)], close=True)
        layout.add_line((50, 50), (800, 550))
    writer = dwg.build_writer(folder)
    dxf, out = folder / "p.dxf", folder / "p.dwg"
    doc.saveas(dxf)
    env = {**os.environ, "DOTNET_CLI_TELEMETRY_OPTOUT": "1", "DOTNET_NOLOGO": "1"}
    done = subprocess.run(
        [str(dwg.dotnet()), str(writer), str(dxf), str(out), "AC1032"],
        capture_output=True, text=True, timeout=120, env=env, check=False,
    )  # fmt: skip
    assert done.returncode == 0, done.stdout + done.stderr
    return read(out)


@pytest.mark.needs_toolchain
@pytest.mark.parametrize("layout", list(LAYOUTS))
def test_a_layout_drawn_in_mm_under_inch_paper_units_is_its_true_size(
    artefact: object, layout: str
) -> None:
    paper = buffers.build(artefact, SheetCandidate(SheetLocation(layout=layout))).paper  # type: ignore[arg-type]

    assert paper.width_mm == pytest.approx(841, abs=2), paper
    assert paper.height_mm == pytest.approx(594, abs=2), paper

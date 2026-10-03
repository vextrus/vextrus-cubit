"""157's review (N3): a frame-only page with no text, against two sheets on its paper, one sparse and
one dense, ink-matched the sparse one, whose ink is mostly the frame they share. Scored beyond the
ink both draw alike, it names neither. Needs the toolchain:

    uv run pytest -m needs_toolchain -rf engine/plot/tests/test_ink_two_sparse.py
"""

from pathlib import Path
from typing import Any

import pytest
from ezdxf.document import Drawing

from engine import harness
from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing
from engine.fixtures.dwg.sheet_set_layouts import _frame
from engine.fixtures.pdf._writer import Page, Pdf, document
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T

pytestmark = pytest.mark.needs_toolchain
REGION_C = (100_000.0, 5_000.0)
ATTRIBS = {"TITLE": "A", "TITLE2": "B", "REV": "R0", "DATE": "01.09.2026"}


def _sparse(cx: float) -> list[tuple[str, tuple[float, ...]]]:
    return [("line", (cx - 4000, 5000, cx + 4000, 5000)), ("line", (cx, 1000, cx, 9000))]


def _draw() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)), 841, 594, (700, 0, 841, 594))
    model = doc.modelspace()
    for kind, v in T._shapes() + _sparse(REGION_C[0]):
        if kind == "line":
            model.add_line((v[0], v[1]), (v[2], v[3]))
        else:
            model.add_circle((v[0], v[1]), v[2])
    middle = (841 / 2, 594 / 2)
    for number, view in (("S-202", T.REGION_A), ("S-201", REGION_C)):
        layout = doc.layouts.new(number)
        layout.add_blockref("BORDER-L", (0, 0)).add_auto_attribs({"DWG_NO": number, **ATTRIBS})
        layout.add_viewport(center=middle, size=(841, 594), view_center_point=middle, view_height=594)
        layout.add_viewport(
            center=T.CENTRE, size=T.SIZE, view_center_point=view, view_height=T.VIEW_HEIGHT
        )
    return doc


def test_a_frame_only_page_names_neither_a_sparse_nor_a_dense_sheet(tmp_path: Path) -> None:
    build = tmp_path / "build"
    build.mkdir()
    writer = dwg.build_writer(build)
    dxf, out = build / "s.dxf", build / "s.dwg"
    _draw().saveas(dxf)
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(out), T.VERSION], 120)
    folder = tmp_path / "set"
    folder.mkdir()
    (folder / "S-sheets.dwg").write_bytes(out.read_bytes())
    page = Page(content=T._border_and_strip(), size=T.A1)
    info = {"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"}
    (folder / "S-plot.pdf").write_bytes(document(Pdf(), [page], info=info))

    export: Any = harness.run(folder, tmp_path / "out" / "export.json")

    [match] = export["plot"]
    assert match["sheet"] is None, match
    assert match["reason"] == "no_text"

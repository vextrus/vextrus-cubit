"""The review's case (157): one sheet on the page's paper. A frame-only page, and a page of another
sheet's body, matched it by ink alone (no rival to measure against): a single candidate is never
ink-matched. Needs the toolchain."""

from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing
from engine.fixtures.dwg.sheet_set_layouts import _frame
from engine.fixtures.pdf._writer import Page, Pdf, document
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T

pytestmark = pytest.mark.needs_toolchain
REGION_C = (100_000.0, 5_000.0)


def _sparse(cx: float) -> list[tuple[str, tuple[float, ...]]]:
    return [("line", (cx - 4000, 5000, cx + 4000, 5000)), ("line", (cx, 1000, cx, 9000))]


def _draw(view: Any) -> Any:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)), 841, 594, (700, 0, 841, 594))
    model = doc.modelspace()
    for kind, v in T._shapes() + _sparse(REGION_C[0]):
        if kind == "line":
            model.add_line((v[0], v[1]), (v[2], v[3]))
        else:
            model.add_circle((v[0], v[1]), v[2])
    layout = doc.layouts.new("S-201")
    ref = layout.add_blockref("BORDER-L", (0, 0))
    ref.add_auto_attribs(
        {"DWG_NO": "S-201", "TITLE": "A", "TITLE2": "B", "REV": "R0", "DATE": "01.09.2026"}
    )
    middle = (841 / 2, 594 / 2)
    layout.add_viewport(center=middle, size=(841, 594), view_center_point=middle, view_height=594)
    layout.add_viewport(center=T.CENTRE, size=T.SIZE, view_center_point=view, view_height=T.VIEW_HEIGHT)
    return doc


@pytest.mark.parametrize("which", ["sparse", "dense"])
def test_one_sheet_frame_only_and_wrong_body(tmp_path: Path, which: str) -> None:
    build = tmp_path / "b"
    build.mkdir()
    writer = dwg.build_writer(build)
    dxf, out = build / "s.dxf", build / "s.dwg"
    _draw(REGION_C if which == "sparse" else T.REGION_A).saveas(dxf)
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(out), T.VERSION], 120)
    folder = tmp_path / "set"
    folder.mkdir()
    (folder / "S-sheets.dwg").write_bytes(out.read_bytes())
    frame = T._border_and_strip()
    wrong = frame + T._body(T.REGION_B, T._region_b(T.REGION_B[0]))
    pdf = Pdf()
    (folder / "S-plot.pdf").write_bytes(
        document(
            pdf,
            [Page(content=frame, size=T.A1), Page(content=wrong, size=T.A1)],
            info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"},
        )
    )
    doc: Any = harness.run(folder, tmp_path / "out" / "export.json")
    got = {m["page"]["page"]: (m["sheet"], m.get("reason"), m.get("residual")) for m in doc["plot"]}
    print(
        [
            (k, f.get("name"), [s.get("number") for s in (f.get("sheets") or [])])
            for k, f in enumerate(doc["files"])
        ]
    )
    print(which, got)
    assert got[1][0] is None, got
    assert got[2][0] is None, got

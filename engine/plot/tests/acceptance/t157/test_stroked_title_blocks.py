"""Ticket 157's engine acceptance (#157, "A Plot whose title blocks are stroked (no text) registers by
geometry"): a Plot page with no extractable text at all, its title block only lines, is still
matched to the sheet it plots, and placed on it, through the harness's export (ticket 18's seam,
`engine.harness.run`; `registration.match`'s signature is the builder's).

The set is synthetic, built in the test's folder by the repo's writers: two sheets on the same paper
(landscape A1, set A's frame block, `engine/fixtures/dwg/sheet_set_layouts.py`) whose bodies differ,
so neither size nor text can tell their pages apart, only their ink:

- S-201's viewport shows region A: 12 upright lines and 12 small circles;
- S-202's viewport shows region B: 12 level lines and 4 large circles.

The Plot (the repo's PDF writer, `engine/fixtures/pdf/_writer.py`) holds no text object: page 1 plots
S-202, page 2 plots S-201 (each its border, its title-block strip, short strokes in the strip where
its lettering was outlined, and its body), page 3 only a border and a strip (either sheet, so
neither). Needs the toolchain:

    uv run pytest -m "needs_toolchain" -rf engine/plot/tests/acceptance/t157
"""

import math
from pathlib import Path
from typing import Any

import pytest
from ezdxf.document import Drawing

from engine import harness
from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing
from engine.fixtures.dwg.sheet_set_layouts import _frame
from engine.fixtures.pdf._writer import Page, Pdf, document, num
from engine.read import pdf as pdf_reader

pytestmark = pytest.mark.needs_toolchain

PT_PER_MM = 72 / 25.4
A1 = (841 * PT_PER_MM, 594 * PT_PER_MM)
VERSION = "AC1032"
CENTRE, SIZE, VIEW_HEIGHT = (350.0, 297.0), (650.0, 520.0), 10_000.0
SCALE = SIZE[1] / VIEW_HEIGHT
"""Paper millimetres per model millimetre in each sheet's body viewport."""
REGION_A, REGION_B = (10_000.0, 5_000.0), (55_000.0, 5_000.0)
SHEETS = (
    ("S-201", ("PILE CAP", "LAYOUT PLAN"), "R0", "01.09.2026", REGION_A),
    ("S-202", ("RAFT", "LAYOUT PLAN"), "R0", "01.09.2026", REGION_B),
)


# The drawing ------------------------------------------------------------------------------------------


def _region_a(cx: float) -> list[tuple[str, tuple[float, ...]]]:
    out: list[tuple[str, tuple[float, ...]]] = []
    for i in range(12):
        out.append(("line", (cx - 4000 + 700 * i, 1000, cx - 4000 + 700 * i, 9000)))
        out.append(("circle", (cx - 3500 + 700 * i, 5000, 150)))
    return out


def _region_b(cx: float) -> list[tuple[str, tuple[float, ...]]]:
    out: list[tuple[str, tuple[float, ...]]] = []
    for j in range(12):
        out.append(("line", (cx - 4500, 1500 + 600 * j, cx + 4500, 1500 + 600 * j)))
    for k in range(4):
        out.append(("circle", (cx - 3000 + 2000 * k, 3000, 700)))
    return out


def _shapes() -> list[tuple[str, tuple[float, ...]]]:
    return _region_a(REGION_A[0]) + _region_b(REGION_B[0])


def _draw() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)), 841, 594, (700, 0, 841, 594))
    model = doc.modelspace()
    for kind, v in _shapes():
        if kind == "line":
            model.add_line((v[0], v[1]), (v[2], v[3]))
        else:
            model.add_circle((v[0], v[1]), v[2])
    for number, (line1, line2), mark, date, view in SHEETS:
        layout = doc.layouts.new(number)
        ref = layout.add_blockref("BORDER-L", (0, 0))
        ref.add_auto_attribs(
            {"DWG_NO": number, "TITLE": line1, "TITLE2": line2, "REV": mark, "DATE": date}
        )
        middle = (841 / 2, 594 / 2)
        layout.add_viewport(center=middle, size=(841, 594), view_center_point=middle, view_height=594)
        layout.add_viewport(center=CENTRE, size=SIZE, view_center_point=view, view_height=VIEW_HEIGHT)
    return doc


@pytest.fixture(scope="module")
def drawing(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    build = tmp_path_factory.mktemp("t157-build")
    writer = dwg.build_writer(build)
    dxf, out = build / "S-sheets.dxf", build / "S-sheets.dwg"
    _draw().saveas(dxf)
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(out), VERSION], 120)
    return out.read_bytes()


# The Plot: strokes only ----------------------------------------------------------------------------


def _segment(a: tuple[float, float], b: tuple[float, float]) -> bytes:
    (x0, y0), (x1, y1) = a, b
    k = PT_PER_MM
    return b"%s %s m %s %s l S\n" % (num(x0 * k), num(y0 * k), num(x1 * k), num(y1 * k))


def _rect(x0: float, y0: float, x1: float, y1: float) -> bytes:
    c = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    return b"".join(_segment(c[i], c[i + 1]) for i in range(4))


def _paper(view: tuple[float, float], x: float, y: float) -> tuple[float, float]:
    return CENTRE[0] + (x - view[0]) * SCALE, CENTRE[1] + (y - view[1]) * SCALE


def _body(view: tuple[float, float], shapes: list[tuple[str, tuple[float, ...]]]) -> bytes:
    out = b""
    for kind, v in shapes:
        if kind == "line":
            out += _segment(_paper(view, v[0], v[1]), _paper(view, v[2], v[3]))
        else:
            ring = [
                _paper(
                    view,
                    v[0] + v[2] * math.cos(math.tau * i / 36),
                    v[1] + v[2] * math.sin(math.tau * i / 36),
                )
                for i in range(37)
            ]
            out += b"".join(_segment(ring[i], ring[i + 1]) for i in range(36))
    return out


def _border_and_strip() -> bytes:
    """The frame and its title-block strip, with its lettering outlined: short strokes, no text."""
    out = _rect(0, 0, 841, 594) + _rect(700, 0, 841, 594)
    for i in range(60):
        x, y = 704 + 3 * (i % 20), 566 - 22 * (i // 20)
        out += _segment((x, y), (x + 2, y + 4))
    return out


def _plot() -> bytes:
    pdf = Pdf()
    s201 = _border_and_strip() + _body(REGION_A, _region_a(REGION_A[0]))
    s202 = _border_and_strip() + _body(REGION_B, _region_b(REGION_B[0]))
    pages = [
        Page(content=s202, size=A1),
        Page(content=s201, size=A1),
        Page(content=_border_and_strip(), size=A1),
    ]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


# The export ----------------------------------------------------------------------------------------


def _run(tmp_path: Path, drawing: bytes) -> Any:
    folder = tmp_path / "set"
    folder.mkdir(parents=True)
    (folder / "S-sheets.dwg").write_bytes(drawing)
    (folder / "S-plot.pdf").write_bytes(_plot())
    return harness.run(folder, tmp_path / "out" / "export.json")


def _by_page(document: Any) -> dict[int, Any]:
    return {m["page"]["page"]: m for m in document["plot"]}


def _number(document: Any, match: Any) -> str | None:
    sheet = match["sheet"]
    if sheet is None:
        return None
    return str(document["files"][sheet["file"]]["sheets"][sheet["sheet"]]["number"]["value"])


def test_the_fixture_is_what_it_says(drawing: bytes, tmp_path: Path) -> None:
    """Both sheets are read with their numbers, and the Plot's pages hold no text for a match to read."""
    document = _run(tmp_path, drawing)

    numbers = {
        s["number"]["value"] for f in document["files"] for s in f.get("sheets") or [] if s.get("number")
    }
    assert numbers == {"S-201", "S-202"}
    pages = pdf_reader.page_text(tmp_path / "set" / "S-plot.pdf")
    assert len(pages) == 3
    assert all(not p.items for p in pages), "the Plot must carry no extractable text"
    assert len(document["plot"]) == 3


def test_a_page_with_no_text_is_matched_to_the_sheet_whose_drawing_it_plots(
    drawing: bytes, tmp_path: Path
) -> None:
    document = _run(tmp_path, drawing)
    pages = _by_page(document)

    assert _number(document, pages[1]) == "S-202", pages[1]
    assert _number(document, pages[2]) == "S-201", pages[2]


def test_a_page_matched_by_its_geometry_is_placed_on_its_sheet(drawing: bytes, tmp_path: Path) -> None:
    """Registered, not only named: the transform that places the sheet on the page (plotted 1:1, upright,
    at the page's origin)."""
    document = _run(tmp_path, drawing)

    for page in (1, 2):
        transform = _by_page(document)[page]["transform"]
        assert transform is not None, page
        assert transform["scale"] == pytest.approx(PT_PER_MM, rel=0.01)
        assert transform["rotation"] == 0
        assert transform["offset"][0] == pytest.approx(0, abs=2 * PT_PER_MM)
        assert transform["offset"][1] == pytest.approx(0, abs=2 * PT_PER_MM)


def test_a_page_with_no_text_that_could_plot_either_sheet_is_matched_to_neither(
    drawing: bytes, tmp_path: Path
) -> None:
    """Page 3 is only a border and a strip, which both sheets draw alike: geometry names no one sheet,
    so the page says why it matched none rather than taking one by its size."""
    document = _run(tmp_path, drawing)
    third = _by_page(document)[3]

    assert third["sheet"] is None, third
    assert isinstance(third["reason"], str)
    assert third["reason"]

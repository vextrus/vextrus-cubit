"""Ticket 18's acceptance: the consultant's Plot registered to the sheets read, and the render check's
F1, through the harness's export (docs/plans/M0.md, "18 Plot registration and the render check").

The set is synthetic and built in the test's own folder: the sheets are 13's set A
(`engine/fixtures/dwg/sheet_set_layouts.py`, written by the repo's DWG writer: S-101 landscape A1,
S-102 portrait A3, S-103 landscape A1), and the Plot is a PDF written here by the repo's PDF writer
(`engine/fixtures/pdf/_writer.py`) that plots them page by page, in paper millimetres times 72/25.4:

- page 1 plots S-102, its title block in real text;
- page 2 plots S-101, its title block in real text;
- page 3 plots S-103 with its title block drawn as strokes: its number and title are only in the
  page's body text (the review Q4; Edison's title blocks are strokes);
- page 4 is a sheet no drawing has (X-999).

The two widened functions (`registration.match`, `render_f1.score`) are reached only through
`engine.harness.run`, so their signatures are the builder's. Needs the toolchain:

    uv run pytest -m needs_toolchain -rf engine/plot/tests/acceptance/t18
"""

import math
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.export import load_schema, validate
from engine.fixtures import dwg
from engine.fixtures.pdf._writer import A3, Page, Pdf, document, num, text, truetype_font

PT_PER_MM = 72 / 25.4
A1 = (841 * PT_PER_MM, 594 * PT_PER_MM)
A3_PORTRAIT = (A3[1], A3[0])


def _segment(a: tuple[float, float], b: tuple[float, float]) -> bytes:
    (x0, y0), (x1, y1) = a, b
    k = PT_PER_MM
    return b"%s %s m %s %s l S\n" % (num(x0 * k), num(y0 * k), num(x1 * k), num(y1 * k))


def _rect(x0: float, y0: float, x1: float, y1: float) -> bytes:
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    return b"".join(_segment(corners[i], corners[i + 1]) for i in range(4))


def _circle(cx: float, cy: float, r: float) -> bytes:
    points = [
        (cx + r * math.cos(2 * math.pi * i / 36), cy + r * math.sin(2 * math.pi * i / 36))
        for i in range(37)
    ]
    return b"".join(_segment(points[i], points[i + 1]) for i in range(36))


def _label(x_mm: float, y_mm: float, value: str, height_mm: float) -> bytes:
    return text(x_mm * PT_PER_MM, y_mm * PT_PER_MM, value, size=height_mm * PT_PER_MM)


def _grid(centre: tuple[float, float], scale: float, view: tuple[float, float]) -> bytes:
    """The fixture's model-space grid (12 lines and 12 circles) as its viewport shows it on paper."""
    (px, py), (vx, vy) = centre, view

    def paper(x: float, y: float) -> tuple[float, float]:
        return px + (x - vx) * scale, py + (y - vy) * scale

    out = b""
    for i in range(12):
        out += _segment(paper(vx - 4000 + 700 * i, 1000), paper(vx - 4000 + 700 * i, 9000))
        cx, cy = paper(vx - 3500 + 700 * i, 5000)
        out += _circle(cx, cy, 150 * scale)
    return out


def _title_block(strip: tuple[float, float, float, float], values: Iterable[str | None]) -> bytes:
    """The frame's labels and filled attributes where the fixture's frame block puts them."""
    x0, _, _, y1 = strip
    rows = (("DRAWING NO.", 6.0), ("DRAWING TITLE", 4.0), ("REV.", 4.0), ("DATE", 3.0), ("SCALE", 3.0))
    out = b""
    for i, ((label, size), value) in enumerate(zip(rows, values, strict=True)):
        top = y1 - 12 - 22 * i
        out += _label(x0 + 4, top, label, 2.5)
        if value is not None:
            out += _label(x0 + 4, top - 8, value, size)
    return out


def _landscape(number: str, title: tuple[str, str], mark: str, date: str, body: bool = True) -> bytes:
    strip = (700.0, 0.0, 841.0, 594.0)
    out = _rect(0, 0, 841, 594) + _rect(*strip)
    out += _title_block(strip, (number, title[0], mark, date, None))
    if title[1]:
        out += _label(704, 594 - 12 - 22 - 13, title[1], 4.0)
    if body:
        out += _grid((350, 297), 520 / 10_000, (10_000.0, 5_000.0))
    return out


def _plot(*, s101_body: bool = True) -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    fonts = {"F1": font}
    strip_p = (0.0, 0.0, 297.0, 130.0)
    s102 = _rect(0, 0, 297, 420) + _rect(*strip_p)
    s102 += _title_block(strip_p, ("S-102", "2ND & 4TH FLOOR", "R0", "12.08.2026", None))
    s102 += _label(4, 130 - 12 - 22 - 13, "BEAM LAYOUT PLAN", 4.0)
    s102 += _grid((148, 280), 250 / 10_000, (55_000.0, 5_000.0))
    s101 = _landscape("S-101", ("PILE CAP", "LAYOUT PLAN"), "R1", "12.08.2026", body=s101_body)
    # S-103: the title block is strokes (its lettering outlined), so its words are only in the body.
    s103 = _rect(0, 0, 841, 594) + _rect(700, 0, 841, 594)
    for i in range(40):
        x, y = 704 + 3 * (i % 20), 566 - 6 * (i // 20)
        s103 += _segment((x, y), (x + 2, y + 4))
    s103 += _grid((350, 297), 520 / 10_000, (10_000.0, 5_000.0))
    s103 += _label(40, 570, "S-103", 6.0) + _label(40, 560, "COLUMN SCHEDULE", 4.0)
    stranger = _rect(0, 0, 297, 420) + _label(10, 40, "X-999", 6.0)
    stranger += _label(10, 30, "SITE PHOTOGRAPHS", 4.0)
    pages = [
        Page(content=s102, size=A3_PORTRAIT, fonts=fonts),
        Page(content=s101, size=A1, fonts=fonts),
        Page(content=s103, size=A1, fonts=fonts),
        Page(content=stranger, size=A3_PORTRAIT, fonts=fonts),
    ]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


@pytest.fixture(scope="module")
def drawing(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    build = tmp_path_factory.mktemp("t18-build")
    writer = dwg.build_writer(build)
    return dwg.build("sheet_set_layouts", build, writer).read_bytes()


def _run(tmp_path: Path, dwg_bytes: bytes, plot: bytes) -> Any:
    folder = tmp_path / "set"
    folder.mkdir(parents=True)
    (folder / "S-sheets.dwg").write_bytes(dwg_bytes)
    (folder / "S-plot.pdf").write_bytes(plot)
    return harness.run(folder, tmp_path / "out" / "export.json")


def _pages_to_numbers(document: Any) -> dict[int, str | None]:
    """Each page of the Plot (from 1) and the number of the sheet it was matched to, or None."""
    files = document["files"]
    found: dict[int, str | None] = {}
    for match in document["plot"]:
        page = match["page"]
        assert files[page["file"]]["format"] == "pdf", match
        sheet = match["sheet"]
        found[page["page"]] = (
            None if sheet is None else files[sheet["file"]]["sheets"][sheet["sheet"]]["number"]["value"]
        )
    return found


def _sheets_by_number(document: Any) -> dict[str, Any]:
    return {
        s["number"]["value"]: s
        for f in document["files"]
        for s in f.get("sheets") or []
        if s.get("number")
    }


@pytest.mark.needs_toolchain
def test_the_plot_stage_runs_and_the_export_is_valid(drawing: bytes, tmp_path: Path) -> None:
    document = _run(tmp_path, drawing, _plot())

    assert document["stages"]["plot"]["built"] is True
    assert document["stages"]["render_f1"]["built"] is True
    assert document["set_stages"]["plot"]["state"] == "ok", document["set_stages"]["plot"]
    assert document["set_stages"]["render_f1"]["state"] == "ok", document["set_stages"]["render_f1"]
    assert validate(document, load_schema()) == []


@pytest.mark.needs_toolchain
def test_each_plot_page_is_matched_to_its_sheet_by_its_title_block_text(
    drawing: bytes, tmp_path: Path
) -> None:
    found = _pages_to_numbers(_run(tmp_path, drawing, _plot()))

    assert found[1] == "S-102"
    assert found[2] == "S-101"


@pytest.mark.needs_toolchain
def test_a_page_whose_title_block_is_strokes_is_matched_by_its_body_text(
    drawing: bytes, tmp_path: Path
) -> None:
    found = _pages_to_numbers(_run(tmp_path, drawing, _plot()))

    assert found[3] == "S-103"


@pytest.mark.needs_toolchain
def test_a_page_no_sheet_matches_states_its_reason(drawing: bytes, tmp_path: Path) -> None:
    document = _run(tmp_path, drawing, _plot())

    (stranger,) = [m for m in document["plot"] if m["page"]["page"] == 4]
    assert stranger["sheet"] is None
    assert isinstance(stranger["reason"], str)
    assert stranger["reason"]
    assert stranger["transform"] is None
    assert len(document["plot"]) == 4, "every page of the Plot is accounted for, matched or not"


@pytest.mark.needs_toolchain
def test_a_matched_page_carries_its_scale_rotation_offset_and_residual(
    drawing: bytes, tmp_path: Path
) -> None:
    document = _run(tmp_path, drawing, _plot())

    (s102,) = [m for m in document["plot"] if m["page"]["page"] == 1]
    transform = s102["transform"]
    assert transform is not None
    # The fixture's layouts are in millimetres; the page plots them 1:1 in points.
    assert transform["scale"] == pytest.approx(PT_PER_MM, rel=0.01)
    assert transform["rotation"] == 0
    assert transform["offset"][0] == pytest.approx(0, abs=2 * PT_PER_MM)
    assert transform["offset"][1] == pytest.approx(0, abs=2 * PT_PER_MM)
    assert isinstance(s102["residual"], int | float)
    assert s102["residual"] >= 0


@pytest.mark.needs_toolchain
def test_every_matched_sheet_gets_a_render_f1_from_0_to_1(drawing: bytes, tmp_path: Path) -> None:
    sheets = _sheets_by_number(_run(tmp_path, drawing, _plot()))

    for number in ("S-101", "S-102", "S-103"):
        f1 = sheets[number]["render_f1"]
        assert isinstance(f1, int | float), (number, f1)
        assert 0 <= f1 <= 1, (number, f1)


@pytest.mark.needs_toolchain
def test_the_render_f1_is_scored_from_the_drawing_against_its_page(
    drawing: bytes, tmp_path: Path
) -> None:
    """A page that plots the sheet's whole drawing scores higher than one that plots only its frame and
    title block: the F1 compares what the drawing renders with what the page shows."""
    full = _sheets_by_number(_run(tmp_path / "full", drawing, _plot()))
    hollow = _sheets_by_number(_run(tmp_path / "hollow", drawing, _plot(s101_body=False)))

    f1_full, f1_hollow = full["S-101"]["render_f1"], hollow["S-101"]["render_f1"]
    assert f1_full is not None
    assert f1_hollow is not None
    assert f1_full >= 0.5, f1_full
    assert f1_full > f1_hollow, (f1_full, f1_hollow)

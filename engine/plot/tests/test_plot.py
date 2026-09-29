"""Ticket 18's own tests: which sheet a page names, where it lands (turned, off-centre, fitted), the
ink's arithmetic, and the page picture's trust boundary.

The sheets are render buffers built here (lines only, each text's box drawn as its own primitive), and
the pages are PDFs written by the repo's writer (engine/fixtures/pdf/_writer.py) that plot the same
lines through a known transform, read by 12's real reader. The picture's child runs directly
(`VEXTRUS_SANDBOX=off`, allowed only inside a test) except in the test marked `needs_bwrap`.
"""

import math
import os
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

from engine.check import render_f1
from engine.fixtures.pdf._writer import Page as PdfPage
from engine.fixtures.pdf._writer import Pdf, document, num, nums, text, truetype_font
from engine.plot import ink, picture, registration
from engine.read.anchor import DwgAnchor, PdfAnchor
from engine.read.pdf import page_text
from engine.read.pdf.types import Page, TextItem, TextSource
from engine.recognise.types import (
    PlotTransform,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
)
from engine.render import buffers as B

PT = 72 / 25.4
SHA = "a" * 64
A1 = (841.0, 594.0)
TITLE_BLOCK = {  # handle: (value, box on paper in mm)
    "B1": ("S-201", (720.0, 540.0, 760.0, 548.0)),
    "B2": ("R2", (720.0, 520.0, 728.0, 526.0)),
    "B3": ("01.09.2026", (720.0, 500.0, 750.0, 505.0)),
}


@pytest.fixture(autouse=True)
def _sandbox(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    if request.node.get_closest_marker("needs_bwrap") is None:
        monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    else:
        monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)
    picture._kept.clear()
    ink._last.clear()


# The sheet ---------------------------------------------------------------------------------------------


def body(paper: tuple[float, float]) -> list[tuple[float, float, float, float]]:
    """A frame, a title-block strip and an irregular grid of lines and circles, in paper mm."""
    w, h = paper
    segments = [(0, 0, w, 0), (w, 0, w, h), (w, h, 0, h), (0, h, 0, 0), (w - 140, 0, w - 140, h)]
    for i in range(14):
        x = 40 + 47 * i + (i * i) % 11
        segments.append((x, 60, x, h - 60 - 3 * i))
        cx, cy, r = x + 20, 150 + 17 * (i % 5), 6 + i % 4
        points = [
            (cx + r * math.cos(2 * math.pi * k / 24), cy + r * math.sin(2 * math.pi * k / 24))
            for k in range(25)
        ]
        segments += [(*points[k], *points[k + 1]) for k in range(24)]
    return [tuple(map(float, s)) for s in segments]  # type: ignore[misc]


def box_segments(box: tuple[float, float, float, float]) -> list[tuple[float, float, float, float]]:
    x0, y0, x1, y1 = box
    return [(x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)]


def sheet_buffers(paper: tuple[float, float] = A1) -> B.SheetBuffers:
    strings = ["", "LINE", "0", *TITLE_BLOCK]
    prims = np.zeros(1 + len(TITLE_BLOCK), dtype=B.PRIM)
    for i in range(len(TITLE_BLOCK)):
        prims[1 + i] = (3 + i, 1, 2, 0, 3 + i)
    records = [(*s, 0.35, 0, 0) for s in body(paper)]
    for i, (_, box) in enumerate(TITLE_BLOCK.values()):
        records += [(*s, 0.25, 0, 1 + i) for s in box_segments(box)]
    return B.SheetBuffers(
        paper=B.Paper(paper[0], paper[1], 1.0, 0, (0.0, 0.0)),
        strings=strings,
        chains=[()],
        primitives=prims,
        lines=np.array(records, dtype=B.LINE),
        triangles=np.zeros(0, dtype=B.TRIS),
        glyphs=np.zeros(0, dtype=B.GLYF),
        atlas_glyphs=np.zeros(0, dtype=B.AGLY),
        atlas=np.zeros((1, 1), dtype=np.uint8),
        fonts=np.zeros(0, dtype=B.FONT),
        stats={},
    )


def anchor(handle: str) -> DwgAnchor:
    return DwgAnchor(SHA, "libredwg", "0.14", "S-201", (), handle)


def sheet(number: str = "S-201", layout: str = "S-201") -> SheetCandidate:
    return SheetCandidate(
        SheetLocation(layout=layout),
        number=Sourced(number, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        revision_mark=Sourced("R2", ValueSource.TITLE_BLOCK_ATTRIBUTE),
        issue_date=Sourced("01.09.2026", ValueSource.TITLE_BLOCK_ATTRIBUTE),
        anchors=(anchor("81"), *(anchor(h) for h in TITLE_BLOCK)),
    )


# The page ----------------------------------------------------------------------------------------------


def plot(
    tmp_path: Path,
    transform: PlotTransform,
    page_size: tuple[float, float],
    *,
    texts: bool = True,
    rotate: int | None = None,
) -> Path:
    """A PDF of one page plotting the sheet through `transform` (sheet mm to page points), its title
    block's values in real text where the transform puts the sheet's boxes' lower-left corners."""
    c, s = {0: (1, 0), 90: (0, 1), 180: (-1, 0), 270: (0, -1)}[transform.rotation]
    k, (ox, oy) = transform.scale, transform.offset

    def at(x: float, y: float) -> tuple[float, float]:
        return k * (c * x - s * y) + ox, k * (s * x + c * y) + oy

    content = b"0.5 w\n"
    for x0, y0, x1, y1 in body(A1):
        (a, b), (e, f) = at(x0, y0), at(x1, y1)
        content += b"%s %s m %s %s l S\n" % (num(a), num(b), num(e), num(f))
    pdf = Pdf()
    font = truetype_font(pdf)
    if texts:
        for value, (x0, y0, _, y1) in TITLE_BLOCK.values():
            px, py = at(x0, y0)
            content += text(px, py, value, size=(y1 - y0) * k, angle=transform.rotation)
    else:  # the number in the body only, far from the title block's (a stroked title block)
        px, py = at(40.0, 30.0)
        content += text(px, py, "S-201", size=5 * k, angle=transform.rotation)
    path = tmp_path / "plot.pdf"
    page = PdfPage(content=content, size=page_size, fonts={"F1": font}, rotate=rotate)
    path.write_bytes(document(pdf, [page], info={"Producer": "AutoCAD"}))
    return path


def registered(path: Path, buffers: B.SheetBuffers) -> tuple[Page, PlotTransform, float | None]:
    (page,) = page_text(path)
    (found,) = registration.match([page], [sheet()], [buffers], {page.source_sha256: path})
    assert found.transform is not None, found
    return page, found.transform, found.residual


def lands(transform: PlotTransform, x: float, y: float) -> tuple[float, float]:
    c, s = {0: (1, 0), 90: (0, 1), 180: (-1, 0), 270: (0, -1)}[transform.rotation]
    k, (ox, oy) = transform.scale, transform.offset
    return k * (c * x - s * y) + ox, k * (s * x + c * y) + oy


def assert_same_place(found: PlotTransform, truth: PlotTransform, within_mm: float = 0.5) -> None:
    assert found.rotation == truth.rotation
    for x, y in ((0, 0), A1, (A1[0], 0)):
        a, b = lands(found, x, y), lands(truth, x, y)
        assert math.dist(a, b) <= within_mm * PT, (found, truth, (x, y))


# Which sheet a page names ------------------------------------------------------------------------------


def item(
    value: str, size: float = 10.0, box: tuple[float, float, float, float] | None = None
) -> TextItem:
    box = box or (10.0, 10.0, 10.0 + size * len(value) * 0.6, 10.0 + size)
    return TextItem(
        value, TextSource.TEXT, PdfAnchor(SHA, "pdfminer", "1", 1, 0, box), size, 0.0, False, None
    )


def page_of(
    *items: TextItem, scan: bool = False, size: tuple[float, float] = (A1[0] * PT, A1[1] * PT)
) -> Page:
    return Page(SHA, 1, size[0], size[1], 0, (0.0, 0.0, *size), scan, tuple(items))


def named(
    page: Page, sheets: Sequence[SheetCandidate], geometry: Sequence[B.SheetBuffers | None] = ()
) -> object:
    (found,) = registration.match([page], sheets, geometry)
    return found.reason if found.sheet is None else sheets.index(found.sheet)


def test_a_number_as_a_whole_item_names_its_sheet_over_one_mentioned_in_a_note() -> None:
    sheets = [sheet("S-201"), sheet("S-202", "S-202")]
    page = page_of(item("SEE DETAIL 4 ON S-202", size=20), item("S-201", size=8))

    assert named(page, sheets) == 0


def test_two_numbers_as_sure_as_each_other_name_several_sheets() -> None:
    sheets = [sheet("S-201"), sheet("S-202", "S-202")]
    page = page_of(item("S-201", size=10), item("S-202", size=9.5))

    assert named(page, sheets) == "names_several_sheets"


def test_the_larger_of_two_whole_numbers_names_the_sheet() -> None:
    sheets = [sheet("S-201"), sheet("S-202", "S-202")]
    page = page_of(item("S-201", size=4), item("S-202", size=12))

    assert named(page, sheets) == 1


def test_a_number_two_sheets_carry_is_told_apart_by_the_papers_size() -> None:
    sheets = [sheet("S-201"), sheet("S-201", "S-201 A3")]
    page = page_of(item("S-201"))

    assert named(page, sheets, [sheet_buffers((420.0, 297.0)), sheet_buffers()]) == 1
    assert named(page, sheets, [sheet_buffers(), sheet_buffers()]) == "names_several_sheets"


@pytest.mark.parametrize(
    ("page", "reason"),
    [
        (page_of(item("GENERAL NOTES")), "names_no_sheet"),
        (page_of(), "no_text"),
        (page_of(item("S-201"), scan=True), "scan"),
    ],
)
def test_a_page_that_names_no_sheet_says_why(page: Page, reason: str) -> None:
    assert named(page, [sheet()]) == reason


def test_every_reason_is_worded_for_the_qs() -> None:
    from engine.messages import plot as codes

    words = (Path(__file__).parents[3] / "web/src/messages/engine/plot/en.po").read_text()
    assert set(codes.REASONS) == {"names_no_sheet", "names_several_sheets", "no_text", "scan"}
    for code in codes.REASONS.values():
        assert f'msgid "{code.code}"' in words


# Where the page lands --------------------------------------------------------------------------------


def test_a_sheet_plotted_at_1_to_1_and_off_centre_is_found_by_its_ink(tmp_path: Path) -> None:
    truth = PlotTransform(PT, 0, (7.3 * PT, -4.1 * PT))
    path = plot(tmp_path, truth, (A1[0] * PT, A1[1] * PT), texts=False)

    page, found, residual = registered(path, sheet_buffers())

    assert_same_place(found, truth)
    assert residual is not None
    assert residual <= 0.5
    assert render_f1.score(sheet_buffers(), page, found, path) >= 0.9


def test_a_landscape_sheet_turned_onto_a_portrait_page_is_turned_back(tmp_path: Path) -> None:
    truth = PlotTransform(PT, 90, (A1[1] * PT, 0.0))
    path = plot(tmp_path, truth, (A1[1] * PT, A1[0] * PT))

    page, found, _ = registered(path, sheet_buffers())

    assert_same_place(found, truth)
    assert render_f1.score(sheet_buffers(), page, found, path) >= 0.9


def test_a_page_turned_by_its_rotate_entry_is_read_as_displayed(tmp_path: Path) -> None:
    """The content is drawn upright on a portrait MediaBox and the page turned by /Rotate 90: 12's
    reader and pdfium both give the page as displayed, landscape, so the sheet lands unturned."""
    upright = PlotTransform(PT, 90, (A1[1] * PT, 0.0))  # drawn on the portrait box, turned
    path = plot(tmp_path, upright, (A1[1] * PT, A1[0] * PT), rotate=90)

    page, found, _ = registered(path, sheet_buffers())

    assert (page.width, page.height) == pytest.approx((A1[0] * PT, A1[1] * PT), abs=0.5)
    assert render_f1.score(sheet_buffers(), page, found, path) >= 0.9


def test_a_sheet_fitted_to_a_smaller_page_is_found_at_its_scale(tmp_path: Path) -> None:
    scale = PT * 0.97 * 420 / 841  # an A1 fitted onto an A3, a little inside its margins
    truth = PlotTransform(scale, 0, (8.0, 12.0))
    path = plot(tmp_path, truth, (420 * PT, 297 * PT), texts=False)

    page, found, _ = registered(path, sheet_buffers())

    assert found.scale == pytest.approx(scale, rel=0.004)
    assert render_f1.score(sheet_buffers(), page, found, path) >= 0.85


def test_the_title_blocks_text_alone_places_a_page_without_its_ink(tmp_path: Path) -> None:
    truth = PlotTransform(PT, 0, (5.0 * PT, 3.0 * PT))
    path = plot(tmp_path, truth, (A1[0] * PT, A1[1] * PT))
    (page,) = page_text(path)

    (found,) = registration.match([page], [sheet()], [sheet_buffers()])  # no path: text and size

    assert found.transform is not None
    # A plotted text's box and the renderer's differ by their fonts: the text alone is good to AGREE_MM.
    assert_same_place(found.transform, truth, within_mm=registration.AGREE_MM)
    assert found.residual is not None
    assert found.residual <= registration.AGREE_MM


# The ink's arithmetic ---------------------------------------------------------------------------------


@pytest.mark.parametrize("turn", [0, 90, 180, 270])
def test_shifting_and_rescaling_move_the_page_as_they_say(turn: int) -> None:
    grid = ink.Grid(4.0, 594.0, (2376, 3364))
    base = PlotTransform(2.0, turn, (100.0, 50.0))

    moved = ink.shifted(base, 8, -4, grid)  # the page 2 mm right and 1 mm up on the sheet
    x, y = 300.0, 200.0
    assert lands(moved, x + 2.0, y + 1.0) == pytest.approx(lands(base, x, y))

    bigger = ink.rescaled(base, 1.02, (420.5, 297.0))
    assert lands(bigger, 420.5, 297.0) == pytest.approx(lands(base, 420.5, 297.0))
    assert bigger.scale == pytest.approx(2.04)


def test_the_shift_found_is_the_one_made() -> None:
    rng = np.random.default_rng(18)
    sheet_ink = rng.random((300, 400)) > 0.97
    page_ink = ink.moved(sheet_ink, -6, 3)

    assert ink.best_shift(sheet_ink, page_ink, 10)[:2] == (6, -3)
    assert ink.nearby_shift(sheet_ink, ink.moved(sheet_ink, 2, -1), 4) == (-2, 1)


def test_f1_counts_ink_within_two_pixels_and_says_how_empty_pages_agree() -> None:
    a = np.zeros((50, 50), dtype=bool)
    a[25, 10:40] = True
    assert ink.f1(a, ink.moved(a, 0, 2), 2) == 1.0
    assert ink.f1(a, ink.moved(a, 0, 3), 2) == 0.0
    assert ink.f1(a, np.zeros_like(a), 2) == 0.0
    assert ink.f1(np.zeros_like(a), np.zeros_like(a), 2) == 1.0


# The picture's trust boundary --------------------------------------------------------------------------


def one_page(tmp_path: Path, size: tuple[float, float] = (200.0, 100.0)) -> Path:
    path = tmp_path / "one.pdf"
    path.write_bytes(document(Pdf(), [PdfPage(content=b"0 0 m 200 100 l S\n", size=size)]))
    return path


def read(path: Path) -> Page:
    (page,) = page_text(path)
    return page


def test_a_page_is_drawn_grey_as_displayed(tmp_path: Path) -> None:
    path = one_page(tmp_path)

    drawn = picture.picture(path, read(path), 1.0)

    assert drawn.pixels.shape == (100, 200)
    assert drawn.pixels.dtype == np.uint8
    assert (drawn.pixels < 128).sum() > 150  # the diagonal


def test_a_file_whose_contents_changed_since_it_was_read_is_refused(tmp_path: Path) -> None:
    path = one_page(tmp_path)

    with pytest.raises(picture.PictureError) as refused:
        picture.picture(path, replace(read(path), source_sha256="0" * 64), 1.0)
    assert refused.value.reason == "changed"


def test_what_is_not_a_regular_file_is_refused_unread(tmp_path: Path) -> None:
    fifo = tmp_path / "plot.pdf"
    os.mkfifo(fifo)

    with pytest.raises(picture.PictureError) as refused:
        picture.picture(fifo, read(one_page(tmp_path)), 1.0)
    assert refused.value.reason == "unreadable"


def test_a_page_past_the_last_and_a_picture_past_its_pixels_are_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = one_page(tmp_path)
    with pytest.raises(picture.PictureError) as refused:
        picture.picture(path, replace(read(path), number=2), 1.0)
    assert refused.value.reason == "no_page"

    monkeypatch.setattr(picture, "MAX_PIXELS", 19_999)
    with pytest.raises(picture.PictureError) as refused:
        picture.picture(path, read(path), 1.0)
    assert refused.value.reason == "too_large"


def test_a_density_past_the_densest_is_refused_before_the_child_starts(tmp_path: Path) -> None:
    path = one_page(tmp_path)

    with pytest.raises(ValueError, match="not a page to draw"):
        picture.picture(path, read(path), picture.MAX_PX_PER_PT)


@pytest.mark.parametrize(
    "output",
    [
        b"",
        b"VXPP",
        picture.HEADER.pack(b"VXPP", 10, 10) + bytes(99),  # a pixel short
        picture.HEADER.pack(b"VXPP", 10, 10) + bytes(101),  # a pixel over
        picture.HEADER.pack(b"XXXX", 10, 10) + bytes(100),
        picture.HEADER.pack(b"VXPP", 100_000, 100_000),  # past the most pixels, before reading them
        b"NO::" + b"a b",
    ],
)
def test_the_childs_output_is_read_only_when_it_is_exactly_a_picture(output: bytes) -> None:
    import io

    with pytest.raises(picture.PictureError):
        picture._parse(io.BytesIO(output), 1.0)


def test_an_undrawable_page_leaves_the_text_and_size_placement(tmp_path: Path) -> None:
    truth = PlotTransform(PT, 0, (0.0, 0.0))
    path = plot(tmp_path, truth, (A1[0] * PT, A1[1] * PT))
    (page,) = page_text(path)
    changed = tmp_path / "changed.pdf"
    changed.write_bytes(path.read_bytes() + b"\n%")

    (found,) = registration.match([page], [sheet()], [sheet_buffers()], {page.source_sha256: changed})

    assert found.transform is not None  # placed by the title block's text; the ink never drawn
    assert_same_place(found.transform, truth, within_mm=registration.AGREE_MM)


@pytest.mark.needs_bwrap
def test_the_page_is_drawn_in_bubblewrap(tmp_path: Path) -> None:
    path = one_page(tmp_path)

    assert picture.picture(path, read(path), 1.0).pixels.shape == (100, 200)


# The refuter's attacks (session 06, 18): each once proved a fault ------------------------------------


def test_a_page_of_no_size_still_names_its_sheet_and_the_others_keep_theirs(tmp_path: Path) -> None:
    """A MediaBox of 0 by 0 points: 12 reads the page and its text; placing it would divide by 0."""
    tiny, good = tmp_path / "tiny", tmp_path / "good"
    tiny.mkdir()
    good.mkdir()
    zero = plot(tiny, PlotTransform(PT, 0, (0.0, 0.0)), (0.0004, 0.0004))
    whole = plot(good, PlotTransform(PT, 0, (0.0, 0.0)), (A1[0] * PT, A1[1] * PT))
    pages = [read(zero), read(whole)]

    found = registration.match(
        pages,
        [sheet()],
        [sheet_buffers()],
        {p.source_sha256: f for p, f in zip(pages, (zero, whole), strict=True)},
    )

    assert (found[0].sheet, found[0].transform) == (sheet(), None)
    assert found[1].transform is not None


def test_texts_placed_far_off_the_page_are_no_evidence(tmp_path: Path) -> None:
    far = b"5" + b"0" * 307  # 5e307 points, as a PDF integer
    pdf = Pdf()
    font = truetype_font(pdf)
    content = b"".join(
        b"BT /F1 4 Tf 1 0 0 1 2040.945 " + far + b" Tm (" + v.encode() + b") Tj ET\n"
        for v, _ in TITLE_BLOCK.values()
    )
    path = tmp_path / "far.pdf"
    page = PdfPage(content=content, size=(A1[0] * PT, A1[1] * PT), fonts={"F1": font})
    path.write_bytes(document(pdf, [page]))

    (found,) = registration.match([read(path)], [sheet()], [sheet_buffers()])

    assert found.transform is not None  # centred by the sizes alone
    assert_same_place(found.transform, PlotTransform(PT, 0, (0.0, 0.0)), within_mm=0.01)
    assert found.residual is None


def test_a_rotate_that_is_no_right_angle_is_not_drawn_turned_against_the_text(tmp_path: Path) -> None:
    """12 reads /Rotate 100 as 0; pdfium turns the page. The picture is refused, and the page keeps
    the placement its title block's text gives."""
    truth = PlotTransform(PT, 0, (0.0, 0.0))
    path = plot(tmp_path, truth, (A1[0] * PT, A1[1] * PT), rotate=100)
    page = read(path)

    with pytest.raises(picture.PictureError) as refused:
        picture.picture(path, page, 0.5)
    assert refused.value.reason == "not_the_page"
    (found,) = registration.match([page], [sheet()], [sheet_buffers()], {page.source_sha256: path})
    assert found.transform is not None
    assert_same_place(found.transform, truth, within_mm=registration.AGREE_MM)


def test_a_page_tree_that_lists_a_page_twice_never_draws_another_page(tmp_path: Path) -> None:
    from engine.fixtures.pdf._writer import dictionary, nums, ref, refs

    pdf = Pdf()
    font = truetype_font(pdf)
    tree = pdf.reserve()
    kids = []
    for x, name in ((50, "PAGE ALPHA"), (500, "PAGE BRAVO")):
        content = pdf.stream(b"%d 100 200 200 re f\n" % x + text(x, 350, name, size=20))
        kids.append(pdf.add(dictionary({
            "Type": b"/Page", "Parent": ref(tree), "MediaBox": nums((0, 0, 800, 500)),
            "Resources": dictionary({"Font": dictionary({"F1": ref(font)})}), "Contents": ref(content),
        })))  # fmt: skip
    pdf.put(tree, dictionary({"Type": b"/Pages", "Kids": refs([kids[0], *kids]), "Count": b"3"}))
    path = tmp_path / "twice.pdf"
    path.write_bytes(pdf.write(pdf.add(dictionary({"Type": b"/Catalog", "Pages": ref(tree)}))))

    bravo = [p for p in page_text(path) if any("BRAVO" in i.text for i in p.items)]
    assert bravo
    for page in bravo:  # drawn only as page B (its square on the right), else refused
        outcome = _drawn_or_refused(path, page)
        assert outcome == "not_the_page" or (isinstance(outcome, float) and outcome > 40), outcome


def _drawn_or_refused(path: Path, page: Page) -> str | float:
    try:
        drawn = picture.picture(path, page, 0.1)
    except picture.PictureError as refused:
        return refused.reason
    return float(np.flatnonzero((drawn.pixels < 128).any(axis=0)).mean())


def test_a_cropbox_written_corners_reversed_is_drawn(tmp_path: Path) -> None:
    path = tmp_path / "crop.pdf"
    page = PdfPage(
        content=b"0 0 m 200 100 l S\n", size=(200.0, 100.0), entries={"CropBox": nums((200, 100, 0, 0))}
    )
    path.write_bytes(document(Pdf(), [page]))

    assert picture.picture(path, read(path), 1.0).pixels.shape == (100, 200)


def test_a_sandbox_that_cannot_start_is_a_page_not_drawn(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = one_page(tmp_path)
    page = read(path)
    monkeypatch.setenv("VEXTRUS_SANDBOX", "on")
    monkeypatch.setattr("engine.read.sandbox.BWRAP", "/nonexistent/bwrap")

    with pytest.raises(picture.PictureError) as refused:
        picture.picture(path, page, 1.0)
    assert refused.value.reason == "sandbox"


def test_an_upside_down_sheet_is_turned_by_its_ink(tmp_path: Path) -> None:
    truth = PlotTransform(PT, 180, (A1[0] * PT, A1[1] * PT))
    path = plot(tmp_path, truth, (A1[0] * PT, A1[1] * PT), texts=False)

    page, found, _ = registered(path, sheet_buffers())

    assert_same_place(found, truth)
    assert render_f1.score(sheet_buffers(), page, found, path) >= 0.9

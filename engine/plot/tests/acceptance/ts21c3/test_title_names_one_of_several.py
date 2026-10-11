"""S21-C3's acceptance: a Plot page that names several sheets alike is the one candidate's whose title
it reads.

The defect (G1's script layer on Train B's head, 61afc0a3): a structural Plot page whose title block's
number is smaller than several other whole numbers on the page (grid and detail marks that are other
sheets' numbers) names several sheets (`names_several_sheets`), its ink does not tell them apart, and
the sheet it plots gets no second source, so it is not bulk-confirmable. The fix (`engine.plot.
registration.match`): among the sheets whose number is a whole item on the page, the one whose title
the page reads (`registration.title_read`, #229) is the page's sheet. When the page reads no
candidate's title, or two candidates' titles, it still names several, as before: a title read twice
tells nothing apart, and a sheet whose number is not whole on the page is no candidate, whatever its
title.

Every page is a PDF written here by the repo's writer (`engine/fixtures/pdf/_writer.py`) and read by
12's reader (`engine.read.pdf.page_text`, run directly: `VEXTRUS_SANDBOX=off`, allowed only inside a
test). Every number and title is invented; the shape (whole numbers 10.3 pt high over a title block's
9.0 pt number) is the diagnosis's, nothing else of a drawing is:

    uv run pytest engine/plot/tests/acceptance/ts21c3 -rf
"""

from collections.abc import Mapping, Sequence
from pathlib import Path

import pytest

from engine.fixtures.pdf._writer import Page as PdfPage
from engine.fixtures.pdf._writer import Pdf, document, text, truetype_font
from engine.plot import registration
from engine.read.anchor import DwgAnchor
from engine.read.pdf import page_text
from engine.read.pdf.types import Page
from engine.recognise.types import PlotMatch, SheetCandidate, SheetLocation, Sourced, ValueSource

PT = 72 / 25.4
A1 = (841.0 * PT, 594.0 * PT)
"""An A1 page laid landscape, in points."""
MARK_PT = 10.3
"""The other whole numbers on the page (grid and detail marks), larger than the title block's number."""
NUMBER_PT = 9.0
"""The title block's number: under nine tenths of a mark's size, so it is not even among the tied."""
TITLE_PT = 7.0
STRUCTURAL = "structural"

TITLES = {
    "01": "SYNTHETIC ALPHA FRAMING",
    "02": "SYNTHETIC BRAVO FRAMING",
    "03": "SYNTHETIC CHARLIE FRAMING",
    "04": "SYNTHETIC DELTA FRAMING",
    "05": "SYNTHETIC ECHO FRAMING",
    "06": "SYNTHETIC FOXTROT FRAMING",
    "07": "SYNTHETIC GOLF FRAMING",
    "08": "SYNTHETIC HOTEL FRAMING",
    "09": "SYNTHETIC INDIA FRAMING",
    "10": "SYNTHETIC JULIET FRAMING",
}
"""The set's sheets: an invented number and title each, every title different."""
MARKS = ("03", "04", "05", "06", "07", "08", "09")
"""The page's other whole numbers: seven, each another sheet's number, as the diagnosis found."""


@pytest.fixture(autouse=True)
def _sandbox(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def sheet(number: str, title: str, discipline: str | None = STRUCTURAL) -> SheetCandidate:
    """A sheet of a layout named by its number, its number and title read from its title block."""
    return SheetCandidate(
        SheetLocation(layout=number),
        number=Sourced(number, ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced(title, ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced(discipline, ValueSource.FILE) if discipline is not None else None,
        anchors=(DwgAnchor("b" * 64, "libredwg", "0.14", number, (), "81"),),
    )


def the_set(
    titles: Mapping[str, str] = TITLES, discipline: str | None = STRUCTURAL
) -> list[SheetCandidate]:
    return [sheet(number, title, discipline) for number, title in titles.items()]


def plotted(
    tmp_path: Path,
    name: str,
    *,
    number: str | None = "02",
    number_pt: float = NUMBER_PT,
    titles: Sequence[str] = (TITLES["02"],),
    marks: Sequence[str] = MARKS,
    notes: Sequence[str] = (),
) -> Path:
    """A PDF of one A1 page: the marks spread across its body, whole, `MARK_PT` high; its title block
    in the lower right corner, the number `number_pt` high with each title on its own line above it;
    each note a line of its own at the top left. Every item stands far from the others but the title
    block's lines, so the reader keeps each its own item."""
    pdf = Pdf()
    font = truetype_font(pdf)
    content = b""
    for k, mark in enumerate(marks):
        content += text(150.0 + 250.0 * k, 900.0 + 60.0 * (k % 3), mark, size=MARK_PT)
    for k, note in enumerate(notes):
        content += text(80.0, 1550.0 - 40.0 * k, note, size=TITLE_PT)
    for k, title in enumerate(titles):
        content += text(1950.0, 140.0 + 14.0 * k, title, size=TITLE_PT)
    if number is not None:
        content += text(2250.0, 60.0, number, size=number_pt)
    path = tmp_path / f"{name}.pdf"
    page = PdfPage(content=content, size=A1, fonts={"F1": font})
    path.write_bytes(document(pdf, [page], info={"Producer": "AutoCAD"}))
    return path


def matched(
    paths: Sequence[Path], sheets: Sequence[SheetCandidate], discipline: str | None = STRUCTURAL
) -> list[PlotMatch]:
    """Each PDF's one page matched against the set as the harness's `plot` stage does: with each PDF
    given (so ink is tried, and cannot tell the sheets apart: none of them was drawn) and the PDFs'
    Discipline default, where they have one."""
    pages: list[Page] = []
    plots: dict[str, Path] = {}
    for path in paths:
        (page,) = page_text(path)
        pages.append(page)
        plots[page.source_sha256] = path
    disciplines = dict.fromkeys(plots, discipline) if discipline is not None else None
    return registration.match(pages, sheets, (), plots, disciplines)


def number_of(found: PlotMatch) -> str | None:
    """The number of the sheet the page plots, or none when it plots none."""
    if found.sheet is None or found.sheet.number is None:
        return None
    return found.sheet.number.value


# The page reads one candidate's title: that sheet ------------------------------------------------------


@pytest.mark.parametrize("discipline", [STRUCTURAL, None], ids=["structural_pdf", "no_default"])
def test_a_page_naming_several_sheets_is_the_one_whose_title_it_reads(
    tmp_path: Path, discipline: str | None
) -> None:
    sheets = the_set(discipline=discipline)
    path = plotted(tmp_path, "p02")

    (found,) = matched([path], sheets, discipline)

    assert number_of(found) == "02", found.reason
    assert found.sheet is sheets[1]
    assert found.reason is None


def test_a_title_block_number_as_large_as_the_marks_is_told_apart_by_the_title_too(
    tmp_path: Path,
) -> None:
    sheets = the_set()
    path = plotted(tmp_path, "p02", number_pt=MARK_PT)

    (found,) = matched([path], sheets)

    assert number_of(found) == "02", found.reason


def test_each_page_of_a_plot_naming_several_is_its_own_sheet(tmp_path: Path) -> None:
    sheets = the_set()
    paths = [
        plotted(tmp_path, f"p{number}", number=number, titles=(TITLES[number],), marks=marks)
        for number, marks in (
            ("02", MARKS),
            ("03", ("04", "05", "06", "07", "08", "09", "10")),
            ("04", ("03", "05", "06", "07", "08", "09", "10")),
        )
    ]

    found = matched(paths, sheets)

    assert [number_of(m) for m in found] == ["02", "03", "04"], [m.reason for m in found]


# The page reads no candidate's title, or two: still several (unchanged) ------------------------------


@pytest.mark.parametrize(
    "titles",
    [(), ("SYNTHETIC ZULU NOTES",)],
    ids=["no_title", "a_title_of_no_sheet"],
)
def test_a_page_reading_no_candidates_title_still_names_several_sheets(
    tmp_path: Path, titles: tuple[str, ...]
) -> None:
    path = plotted(tmp_path, "p02", titles=titles)

    (found,) = matched([path], the_set())

    assert found.sheet is None
    assert found.reason == "names_several_sheets"


def test_a_page_reading_two_candidates_titles_still_names_several_sheets(tmp_path: Path) -> None:
    path = plotted(tmp_path, "p02", titles=(TITLES["02"], TITLES["05"]))

    (found,) = matched([path], the_set())

    assert found.sheet is None
    assert found.reason == "names_several_sheets"


def test_a_title_two_candidates_share_names_neither(tmp_path: Path) -> None:
    shared = {**TITLES, "05": TITLES["02"]}
    path = plotted(tmp_path, "p02")

    (found,) = matched([path], the_set(shared))

    assert found.sheet is None
    assert found.reason == "names_several_sheets"


# A sheet whose number is not whole on the page is no candidate, whatever its title ---------------------


@pytest.mark.parametrize(
    "notes",
    [(), ("SEE 10 FOR DETAILS",)],
    ids=["number_absent", "number_in_a_note"],
)
def test_a_sheet_whose_title_reads_but_whose_number_is_not_whole_on_the_page_is_not_taken(
    tmp_path: Path, notes: tuple[str, ...]
) -> None:
    path = plotted(tmp_path, "p02", titles=(TITLES["10"],), notes=notes)

    (found,) = matched([path], the_set())

    assert found.sheet is None
    assert found.reason == "names_several_sheets"

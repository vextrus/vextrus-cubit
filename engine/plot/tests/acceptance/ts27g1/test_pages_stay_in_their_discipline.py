"""S27-G1's engine acceptance (#827, #830): a page of a PDF whose Discipline is known never names a
sheet of another known Discipline, by its text or by its ink; a PDF of no Discipline still plots
whichever sheet its page names.

docs/design/m0-screens.md 4.5, "PDF before its DWG": "Plot: waiting for its DWG. Its pages are
matched when the DWG is read." So a Structural Plot read while only the General notes' DWG is read
matches none of its pages: the General sheets share its bare numbers (01 to 08), and before this
ticket each page named the General sheet of its number.

The sets are synthetic, built in the test's folder by the repo's writers. The text pages are the PDF
writer's, read by 12's `page_text` run directly (`VEXTRUS_SANDBOX=off`, allowed only inside a
test), and matched by `registration.match` (its signature: 18's). The
pages with no text reuse ticket 157's stroked fixture (its sheets' bodies differ only by their ink)
through the harness's export, numbered 01 and 02 in an Architectural DWG (the harness's default
conventions have no General Discipline; the rule is the same for any two known Disciplines); that
part needs the toolchain and bubblewrap:

    uv run pytest -m "needs_toolchain or not needs_toolchain" -rf engine/plot/tests/acceptance/ts27g1
"""

from pathlib import Path
from typing import Any

import pytest
from ezdxf.document import Drawing

from engine import harness
from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing
from engine.fixtures.dwg.sheet_set_layouts import _frame
from engine.fixtures.pdf._writer import Page as PdfPage
from engine.fixtures.pdf._writer import Pdf, document, text, truetype_font
from engine.plot import registration
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T
from engine.read import pdf as pdf_reader
from engine.recognise.types import PlotMatch, SheetCandidate, SheetLocation, Sourced, ValueSource

NUMBERS = [f"{k:02d}" for k in range(1, 9)]


@pytest.fixture(autouse=True)
def _sandbox(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """The text pages read with no bubblewrap (CI's shards have none), as engine/plot's own tests
    read theirs; the harness's tests (`needs_bwrap`) keep the sandbox they read under."""
    if request.node.get_closest_marker("needs_bwrap") is None:
        monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


# Pages with text ------------------------------------------------------------------------------------


def _sheet(number: str, discipline: str) -> SheetCandidate:
    return SheetCandidate(
        SheetLocation(layout=f"{discipline}-{number}"),
        number=Sourced(number, ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced(discipline, ValueSource.FILE),
    )


def _pages(tmp_path: Path) -> list[Any]:
    """Eight pages, page k with sheet 0k as its title block's number, read as 12 reads them."""
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    pages = [PdfPage(content=text(60, 60, n, size=10), fonts=fonts) for n in NUMBERS]
    path = tmp_path / "plot.pdf"
    path.write_bytes(document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"}))
    return pdf_reader.page_text(path)


def _named(found: list[PlotMatch]) -> list[tuple[str, str] | None]:
    """Each page's sheet, as (its Discipline, its number), or none."""
    out: list[tuple[str, str] | None] = []
    for m in found:
        sheet = m.sheet
        if sheet is None or sheet.number is None or sheet.discipline is None:
            out.append(None)
        else:
            out.append((sheet.discipline.value, sheet.number.value))
    return out


def test_a_structural_page_names_no_general_sheet_of_its_number(tmp_path: Path) -> None:
    """Only the General sheets are listed (the Structural DWG is not read): no page names one."""
    pages = _pages(tmp_path)
    sheets = [_sheet(n, "general") for n in NUMBERS]
    disciplines = {pages[0].source_sha256: "structural"}

    found = registration.match(pages, sheets, disciplines=disciplines)

    assert len(found) == 8
    named = [n for n in _named(found) if n is not None]
    assert named == [], f"a Structural page names a General sheet: {named}"


def test_a_structural_page_names_the_structural_sheet_of_its_number(tmp_path: Path) -> None:
    """Both Disciplines listed: page k names Structural 0k, never General 0k."""
    pages = _pages(tmp_path)
    sheets = [_sheet(n, "general") for n in NUMBERS] + [_sheet(n, "structural") for n in NUMBERS]
    disciplines = {pages[0].source_sha256: "structural"}

    found = registration.match(pages, sheets, disciplines=disciplines)

    assert _named(found) == [("structural", n) for n in NUMBERS]


def test_a_page_of_a_pdf_with_no_discipline_names_the_sheet_of_its_number(tmp_path: Path) -> None:
    """A PDF of no Discipline keeps today's rule: page k names the one listed sheet 0k, General."""
    pages = _pages(tmp_path)
    sheets = [_sheet(n, "general") for n in NUMBERS]

    found = registration.match(pages, sheets, disciplines={pages[0].source_sha256: None})

    assert _named(found) == [("general", n) for n in NUMBERS]


# Pages with no text (157's fixture), through the harness's export -----------------------------------

ARCHITECTURAL_DWG = "ARC-R0.dwg"
STRUCTURAL_PDF = "STR-PLOT-R0.pdf"
UNNAMED_PDF = "PLOT-R0.pdf"
SHEETS = (("01", T.REGION_A), ("02", T.REGION_B))


def _draw() -> Drawing:
    """157's two sheets, numbered 01 (region A) and 02 (region B), in an Architectural DWG."""
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)), 841, 594, (700, 0, 841, 594))
    model = doc.modelspace()
    for kind, v in T._shapes():
        if kind == "line":
            model.add_line((v[0], v[1]), (v[2], v[3]))
        else:
            model.add_circle((v[0], v[1]), v[2])
    for number, view in SHEETS:
        layout = doc.layouts.new(number)
        ref = layout.add_blockref("BORDER-L", (0, 0))
        ref.add_auto_attribs(
            {
                "DWG_NO": number,
                "TITLE": "FLOOR PLAN",
                "TITLE2": "SHEET " + number,
                "REV": "R0",
                "DATE": "01.09.2026",
            }
        )
        middle = (841 / 2, 594 / 2)
        layout.add_viewport(center=middle, size=(841, 594), view_center_point=middle, view_height=594)
        layout.add_viewport(
            center=T.CENTRE, size=T.SIZE, view_center_point=view, view_height=T.VIEW_HEIGHT
        )
    return doc


@pytest.fixture(scope="module")
def architectural_drawing(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    build = tmp_path_factory.mktemp("ts27g1-build")
    writer = dwg.build_writer(build)
    dxf, out = build / "architectural.dxf", build / "architectural.dwg"
    _draw().saveas(dxf)
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(out), T.VERSION], 120)
    return out.read_bytes()


def _stroked_plot() -> bytes:
    """Two pages with no text: page 1 plots region B's sheet (02), page 2 region A's (01)."""
    pdf = Pdf()
    page_02 = T._border_and_strip() + T._body(T.REGION_B, T._region_b(T.REGION_B[0]))
    page_01 = T._border_and_strip() + T._body(T.REGION_A, T._region_a(T.REGION_A[0]))
    pages = [PdfPage(content=page_02, size=T.A1), PdfPage(content=page_01, size=T.A1)]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


def _export(tmp_path: Path, drawing: bytes, plot_name: str) -> Any:
    folder = tmp_path / "set"
    folder.mkdir(parents=True)
    (folder / ARCHITECTURAL_DWG).write_bytes(drawing)
    (folder / plot_name).write_bytes(_stroked_plot())
    return harness.run(folder, tmp_path / "out" / "export.json")


def _ink_named(export: Any) -> dict[int, str | None]:
    """Each page's sheet number, by page, or none."""
    out: dict[int, str | None] = {}
    for m in export["plot"]:
        sheet = m["sheet"]
        number = (
            None
            if sheet is None
            else export["files"][sheet["file"]]["sheets"][sheet["sheet"]]["number"]["value"]
        )
        out[m["page"]["page"]] = number
    return out


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_the_stroked_set_is_architectural_sheets_and_a_structural_plot_with_no_text(
    architectural_drawing: bytes, tmp_path: Path
) -> None:
    """The set's premise: the DWG's sheets 01 and 02 are Architectural, the Plot is Structural by its
    name, and its two pages hold no text."""
    export = _export(tmp_path, architectural_drawing, STRUCTURAL_PDF)

    by_name = {f["name"]: f for f in export["files"]}
    assert by_name[STRUCTURAL_PDF]["discipline_default"] == "structural"
    listed = {
        (s["number"]["value"], s["discipline"]["value"]) for s in by_name[ARCHITECTURAL_DWG]["sheets"]
    }
    assert listed == {("01", "architectural"), ("02", "architectural")}
    pages = pdf_reader.page_text(tmp_path / "set" / STRUCTURAL_PDF)
    assert [bool(p.items) for p in pages] == [False, False]


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_a_structural_page_with_no_text_is_never_matched_to_an_architectural_sheet_by_its_ink(
    architectural_drawing: bytes, tmp_path: Path
) -> None:
    export = _export(tmp_path, architectural_drawing, STRUCTURAL_PDF)

    named = {page: n for page, n in _ink_named(export).items() if n is not None}
    assert named == {}, f"a Structural page names an Architectural sheet: {named}"


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_a_page_with_no_text_of_a_pdf_with_no_discipline_is_still_matched_by_its_ink(
    architectural_drawing: bytes, tmp_path: Path
) -> None:
    export = _export(tmp_path, architectural_drawing, UNNAMED_PDF)

    by_name = {f["name"]: f for f in export["files"]}
    assert by_name[UNNAMED_PDF]["discipline_default"] is None
    assert _ink_named(export) == {1: "02", 2: "01"}

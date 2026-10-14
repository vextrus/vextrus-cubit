"""S27-G1 (#827, #830, #331): a PDF of a known Discipline never plots a sheet of another known
Discipline, and the order its files are read in never changes the Plot.

docs/specs/M0.md, Finish line item 3: the QS "cancels one file mid-read and restarts it … nothing is
duplicated", so a PDF read before its DWG ends as it would after it. docs/design/m0-screens.md 4.5,
"PDF before its DWG": "Plot: waiting for its DWG. Its pages are matched when the DWG is read."

The set, invented: a Structural DWG and a General DWG (general notes in their own bare-numbered
series) that both list sheets 01 to 08, and a Structural Plot of eight pages, page k naming sheet
0k. Read before the Structural DWG, the Plot's pages named the General sheets of their numbers (its
row read "Plot: 8 of 8 pages matched" with its DWG unread), and a General sheet kept a structural
page after the Structural DWG was read. A PDF of no Discipline still plots whichever sheet its page
names.
"""

import uuid
from itertools import permutations

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from engine.read.pdf.types import Page as ReadPage
from engine.recognise.types import PlotMatch
from vextrus.drawings import services
from vextrus.drawings.messages import files as words
from vextrus.takeoff.services.read_propose import plot
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db

NUMBERS = [f"{k:02d}" for k in range(1, 9)]
STRUCTURAL_DWG = "KR-STR-R0.dwg"
GENERAL_DWG = "KR-GENERAL-NOTES-R0.dwg"
STRUCTURAL_PDF = "KR-STR-R0.pdf"
UNNAMED_PDF = "KR-PLOT-R0.pdf"
TITLES = {
    STRUCTURAL_DWG: [f"STRUCTURAL PLAN {n}" for n in NUMBERS],
    GENERAL_DWG: [f"GENERAL NOTES {n}" for n in NUMBERS],
}
DISCIPLINE = {STRUCTURAL_DWG: "structural", GENERAL_DWG: "general"}


@pytest.fixture
def qs(qs_project: QsProject) -> QsProject:
    return qs_project


@pytest.fixture(autouse=True)
def _reader_unsandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def _plot(note: str) -> bytes:
    """Eight pages, page k naming sheet 0k as its title block's number."""
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    pages = [
        Page(content=text(60, 60, n, size=10) + text(60, 200, note, size=6), fonts=fonts)
        for n in NUMBERS
    ]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


def _read(qs: QsProject, name: str, ids: dict[str, uuid.UUID]) -> None:
    """Add the file and read it as its read job would: a PDF through the job (its `matching`), a
    DWG's sheets listed and then its `finishing` step's set-level match."""
    member = qs.member
    if name.endswith(".pdf"):
        ids[name] = add(member, qs.project_id, name, _plot(name)).file.id
        run_inline(
            read_file.read_file,
            tenant_id=member.developer_id,
            user_id=member.user.pk,
            abort_reason=lambda: None,
            file_id=ids[name],
        )
        return
    ids[name] = add(member, qs.project_id, name, drawing(marker=name)).file.id
    read_dwg(member, ids[name], NUMBERS, titles=TITLES[name])
    with member.acting():
        plot.match(ids[name])  # the DWG's `finishing` step's match


def _plots(qs: QsProject, ids: dict[str, uuid.UUID]) -> dict[tuple[str, str], tuple[str, int] | None]:
    """Each listed sheet, by its DWG's Discipline and its number: the Plot file's name and the page
    it is plotted on, or none where no page is kept for it."""
    names = {file_id: name for name, file_id in ids.items()}
    some = next(iter(ids.values()))
    with qs.member.acting():
        listed = services.sheets(services.file(some).set_id)
    out: dict[tuple[str, str], tuple[str, int] | None] = {}
    for s in listed:
        key = (DISCIPLINE[names[s.file_id]], s.number or "")
        page = s.plot.page
        out[key] = (names[s.plot.file_id], page) if page is not None and s.plot.file_id else None
    return out


def _status(qs: QsProject, file_id: uuid.UUID) -> object:
    with qs.member.acting():
        return services.file(file_id).status


def test_the_dwgs_and_the_plot_have_the_disciplines_the_set_needs(qs: QsProject) -> None:
    """The set's premise: each file's Discipline comes from its name, and each DWG lists 01 to 08."""
    ids: dict[str, uuid.UUID] = {}
    for name in (GENERAL_DWG, STRUCTURAL_DWG, STRUCTURAL_PDF):
        _read(qs, name, ids)
    with qs.member.acting():
        found = {name: services.file(file_id).discipline for name, file_id in ids.items()}
        listed = services.sheets(services.file(ids[GENERAL_DWG]).set_id)
    assert found == {GENERAL_DWG: "general", STRUCTURAL_DWG: "structural", STRUCTURAL_PDF: "structural"}
    assert sorted((s.discipline, s.number) for s in listed) == sorted(
        (d, n) for d in ("general", "structural") for n in NUMBERS
    )


def test_a_structural_plot_read_before_its_dwg_plots_no_general_sheet(qs: QsProject) -> None:
    """The General DWG read, then the Structural Plot: no General sheet takes a page of it."""
    ids: dict[str, uuid.UUID] = {}
    _read(qs, GENERAL_DWG, ids)
    _read(qs, STRUCTURAL_PDF, ids)
    plotted = {key: kept for key, kept in _plots(qs, ids).items() if kept is not None}
    assert plotted == {}, f"a General sheet plots a page of the Structural Plot: {plotted}"


def test_a_structural_plot_read_before_its_dwg_says_it_waits_for_its_dwg(qs: QsProject) -> None:
    """m0-screens 4.5, "PDF before its DWG": "Plot: waiting for its DWG. Its pages are matched when
    the DWG is read." Never "Plot: 8 of 8 pages matched" on another Discipline's sheets."""
    ids: dict[str, uuid.UUID] = {}
    _read(qs, GENERAL_DWG, ids)
    _read(qs, STRUCTURAL_PDF, ids)
    status = _status(qs, ids[STRUCTURAL_PDF])
    assert status == words.PLOT_WAITING(), f"the Plot's row does not wait for its DWG: {status}"


def test_the_plot_says_its_pages_matched_once_its_dwg_is_read(qs: QsProject) -> None:
    """Once the Structural DWG is read, the Plot's row reads "Plot: 8 of 8 pages matched"."""
    ids: dict[str, uuid.UUID] = {}
    for name in (GENERAL_DWG, STRUCTURAL_PDF, STRUCTURAL_DWG):
        _read(qs, name, ids)
    assert _status(qs, ids[STRUCTURAL_PDF]) == words.PLOT_MATCHED(matched=8, pages=8)


@pytest.mark.parametrize(
    "order", list(permutations([STRUCTURAL_DWG, GENERAL_DWG, STRUCTURAL_PDF])), ids="-".join
)
def test_every_read_order_ends_with_the_plots_of_the_normal_order(
    qs: QsProject, order: tuple[str, ...]
) -> None:
    """The set-level match after a DWG's read decides every sheet's Plot again, keeping nothing an
    earlier read matched: each order ends as the normal order (the DWGs, then the Plot) does,
    Structural 0k on page k and no General sheet on any page."""
    ids: dict[str, uuid.UUID] = {}
    for name in order:
        _read(qs, name, ids)
    expected: dict[tuple[str, str], tuple[str, int] | None] = {
        ("structural", n): (STRUCTURAL_PDF, k) for k, n in enumerate(NUMBERS, start=1)
    }
    expected |= {("general", n): None for n in NUMBERS}
    got = _plots(qs, ids)
    wrong = {key: kept for key, kept in got.items() if expected.get(key, "unlisted") != kept}
    assert got.keys() == expected.keys()
    assert wrong == {}, f"the Plots differ from the normal order's: {wrong}"


def test_a_plot_of_no_discipline_still_plots_the_sheets_its_pages_name(qs: QsProject) -> None:
    """A PDF whose name gives no Discipline keeps today's rule: its page plots the sheet it names,
    whatever that sheet's Discipline (here the General DWG's, the only one read)."""
    ids: dict[str, uuid.UUID] = {}
    _read(qs, GENERAL_DWG, ids)
    _read(qs, UNNAMED_PDF, ids)
    with qs.member.acting():
        assert services.file(ids[UNNAMED_PDF]).discipline is None
    assert _plots(qs, ids) == {("general", n): (UNNAMED_PDF, k) for k, n in enumerate(NUMBERS, start=1)}
    assert _status(qs, ids[UNNAMED_PDF]) == words.PLOT_MATCHED(matched=8, pages=8)


def test_a_dwgs_read_takes_back_a_page_a_sheet_of_another_discipline_held(qs: QsProject) -> None:
    """No stale keep: a General sheet left holding the Structural Plot's page 1 (as an earlier read
    left it on the walked set) lets it go when the Structural DWG is read, and Structural 01 takes
    it. The set-level match decides every sheet's Plot again, not only the sheets it gives a page."""
    ids: dict[str, uuid.UUID] = {}
    _read(qs, GENERAL_DWG, ids)
    _read(qs, STRUCTURAL_PDF, ids)
    with qs.member.acting():
        pdf = services.file(ids[STRUCTURAL_PDF])
        listed = services.sheets(pdf.set_id)
        [general_01] = [s for s in listed if s.file_id == ids[GENERAL_DWG] and s.number == "01"]
        w, h = 841 * 72 / 25.4, 594 * 72 / 25.4
        page_1 = ReadPage(pdf.sha256, 1, w, h, 0, (0.0, 0.0, w, h), False, ())
        services.record_plot(general_01.id, PlotMatch(page_1, sheet=plot.candidate(general_01)))
    held = _plots(qs, ids)[("general", "01")]
    assert held == (STRUCTURAL_PDF, 1), held  # the set as the walk found it

    _read(qs, STRUCTURAL_DWG, ids)

    plots = _plots(qs, ids)
    assert plots[("structural", "01")] == (STRUCTURAL_PDF, 1)
    kept = plots[("general", "01")]
    assert kept is None, f"a General sheet keeps a page of the Structural Plot: {kept}"

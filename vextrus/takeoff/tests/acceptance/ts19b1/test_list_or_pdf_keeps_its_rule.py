"""S19-B1: the run counts only "when a Discipline has no drawing list and no PDF" (the owner's ruling,
session 18, `step1.second_source.no_list_no_pdf = unbroken-number-run`). A Discipline with a standing
drawing list keeps the list as its second source, and one with a PDF keeps its Plot pages (#229): the
run never adds agreement the list or the Plot denies, nor overrides two lists that disagree. The test
of "no PDF" is the Discipline's: another Discipline's PDF does not take the run from it.

Two fixture styles, each the one the rule it pins was proved with: lists through 21c's read job and
the `drawing-list` endpoint (ticket 21c's fixtures), the Plot through `drawings.record_plot`, the seam
the read job's Plot matching keeps a page through (ticket 229's).
"""

import pytest

from engine.read.anchor import PdfAnchor
from engine.read.pdf.types import Page, TextItem, TextSource
from engine.recognise.types import PlotMatch
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1 as step1_service
from vextrus.takeoff.services.read_propose import plot
from vextrus.takeoff.services.read_propose import proposals as read_proposals
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    step1,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
STRUCTURAL_PDF = "KR-STR-R0.pdf"
ARCHITECTURAL = "KR-ARC-R0.dwg"
FIVE = ["S-01", "S-02", "S-03", "S-04", "S-05"]
TITLES = ["GENERAL NOTES", "PILE LAYOUT PLAN", "PILE CAP DETAILS", "COLUMN LAYOUT", "COLUMN SCHEDULE"]
A1 = (2384.0, 1684.0)


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def agrees(qs: QsProject) -> dict[str | None, bool]:
    return {p["number"]: p["agrees"] for p in proposals(api_as(qs.member), qs.project_id)}


# A standing drawing list --------------------------------------------------------------------------


def _run(register: tuple[tuple[str, str], ...] = ()) -> list[Sheet]:
    """S-01 to S-05, an unbroken run; `register` drawn on S-01 under "DRAWING LIST"."""
    return [
        Sheet(n, t, (t,), register=register if i == 0 else ())
        for i, (n, t) in enumerate(zip(FIVE, TITLES, strict=True))
    ]


def _read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> None:
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)
    run_job(qs.member, file_id, monkeypatch, readers({STRUCTURAL: sheets}))


def _typed(qs: QsProject, text: str) -> None:
    response = api_as(qs.member).post(
        f"{step1(qs.project_id)}/drawing-list", {"discipline": "structural", "text": text}
    )
    assert response.status_code == 200, response.content


def test_a_typed_list_stays_the_second_source_over_the_run(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A Discipline with a drawing list keeps it: the QS types "S-01 to S-03"; S-04 and S-05, in the
    run but not on the list, do not agree; S-01 to S-03 do."""
    _read(qs_project, monkeypatch, _run())
    _typed(qs_project, "S-01 to S-03")

    assert agrees(qs_project) == {
        "S-01": True, "S-02": True, "S-03": True, "S-04": False, "S-05": False,
    }  # fmt: skip


def test_a_list_drawn_on_a_sheet_stays_the_second_source_over_the_run(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A drawing list read from S-01 naming S-01 to S-03: S-04 and S-05 do not agree, though their
    numbers run on unbroken."""
    listed = tuple(zip(FIVE[:3], TITLES[:3], strict=True))
    _read(qs_project, monkeypatch, _run(register=listed))

    assert agrees(qs_project) == {
        "S-01": True, "S-02": True, "S-03": True, "S-04": False, "S-05": False,
    }  # fmt: skip


def test_two_lists_that_disagree_leave_no_sheet_of_the_run_agreeing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A list read from S-01 (S-01 to S-05) and one typed ("S-01 to S-04") disagree: their
    `conflict` Question is open and no sheet agrees, the unbroken run notwithstanding."""
    _read(qs_project, monkeypatch, _run(register=tuple(zip(FIVE, TITLES, strict=True))))
    _typed(qs_project, "S-01 to S-04")
    assert open_questions(api_as(qs_project.member), qs_project.project_id, "conflict") != []

    assert agrees(qs_project) == dict.fromkeys(FIVE, False)


# A PDF in the Discipline --------------------------------------------------------------------------


def _page(pdf_sha256: str, page: int, number: str, title: str) -> Page:
    """A PDF page whose title block reads `number` and `title`, as `engine.read.pdf` returns it."""

    def item(text: str, i: int, size: float) -> TextItem:
        box = (2000.0, 100.0 + 60.0 * i, 2300.0, 140.0 + 60.0 * i)
        anchor = PdfAnchor(pdf_sha256, "vextrus-pdf", "1", page, i, box)
        return TextItem(text, TextSource.TEXT, anchor, size, 0.0, False, "Arial")

    return Page(
        source_sha256=pdf_sha256,
        number=page,
        width=A1[0],
        height=A1[1],
        rotate=0,
        crop=(0.0, 0.0, A1[0], A1[1]),
        scan=False,
        items=(item(number, 0, 40.0), item(title, 1, 20.0)),
    )


class _Plotted:
    """DWGs read through `read_dwg` (number and title from the title block); a PDF beside one, its
    pages kept as Plot pages through `drawings.record_plot`; the Questions asked as the read job asks
    them (ticket 229's `PlottedSet`)."""

    def __init__(self, qs: QsProject) -> None:
        self.member = qs.member
        self.project_id = qs.project_id

    def read(
        self, dwg_name: str, numbers: list[str], titles: list[str], *, pdf: str | None = None,
        plotted: tuple[str, ...] = (),
    ) -> None:  # fmt: skip
        dwg = add(self.member, self.project_id, dwg_name, drawing()).file
        shown = add(self.member, self.project_id, pdf, drawing("pdf")).file if pdf else None
        read_dwg(self.member, dwg.id, numbers, titles=titles)
        with self.member.acting():
            drawing_set = drawings.set_of(self.project_id)
            assert drawing_set is not None
            sheets = {s.number: s for s in drawings.sheets(drawing_set.id) if s.number in numbers}
            for page, number in enumerate(numbers, start=1):
                sheet = sheets[number]
                step1_service.propose_sheet(sheet.id)
                step1_service.record_coverage(sheet.id)
                if shown is not None and number in plotted:
                    found = _page(shown.sha256, page, number, sheet.title)
                    drawings.record_plot(sheet.id, PlotMatch(found, sheet=plot.candidate(sheet)))
            read_proposals.set_questions(self.project_id, trigger_file=dwg.id)


def test_a_run_sheet_whose_plot_page_did_not_match_keeps_one_source_when_the_discipline_has_a_pdf(
    qs_project: QsProject,
) -> None:
    """A Discipline with a PDF keeps the Plot as its second source (#229): S-03, no Plot page matched,
    does not agree though its number runs on unbroken; the four whose pages matched do."""
    the_set = _Plotted(qs_project)
    plotted = ("S-01", "S-02", "S-04", "S-05")
    the_set.read(STRUCTURAL, FIVE, TITLES, pdf=STRUCTURAL_PDF, plotted=plotted)

    assert agrees(qs_project) == {
        "S-01": True, "S-02": True, "S-03": False, "S-04": True, "S-05": True,
    }  # fmt: skip


def test_another_disciplines_pdf_does_not_take_the_run_from_a_discipline_with_none(
    qs_project: QsProject,
) -> None:
    """ "When a Discipline has no drawing list and no PDF": Structural's PDF is Structural's; the
    architectural run A-01 to A-03, no list and no PDF of its own, agrees."""
    the_set = _Plotted(qs_project)
    the_set.read(STRUCTURAL, FIVE, TITLES, pdf=STRUCTURAL_PDF, plotted=tuple(FIVE))
    arch = ["A-01", "A-02", "A-03"]
    the_set.read(ARCHITECTURAL, arch, ["GROUND FLOOR PLAN", "FIRST FLOOR PLAN", "ROOF PLAN"])

    shown = agrees(qs_project)

    assert {n: shown[n] for n in arch} == dict.fromkeys(arch, True)
    assert {n: shown[n] for n in FIVE} == dict.fromkeys(FIVE, True)

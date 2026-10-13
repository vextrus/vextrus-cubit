"""S24-C1 (#717; G1 walk 1 of 59524e39, f-1, M0-FL8): a continuation run of sheets with one source
each, confirmed as its row, confirms in one act.

The defect: a continuation row whose sheets have one source each is offered on the bar with Enter;
the web sends the row's sheets in one act and Step 1's confirm refuses any act of two or more sheets
naming a sheet with one source (`takeoff.step1.one_source`, 409), so a Discipline whose sheets are
such a run can never be confirmed.

The authority:
- m0-screens 6.2, continuation sheets: "sheets with the same title on consecutive numbers are one
  continuation and one row ... Confirming or excluding the row does it to all three, and the Count
  counts three sheets."
- m0-screens 6.4 and 5: "Sheets "with one source" (5) are never in the bulk act; the QS confirms each
  in sheet mode (6.5)." A run's row is one row, not the bulk act: the bulk act's refusal stands for
  any act that is not exactly one whole run (ticket 166's contract, `t166`).
- The run is the server's own grouping (T-W334): every sheet of one run carries one `continuation`
  value in `GET .../takeoff/step1/proposals`.

The set (invented): one structural DWG read through `read_dwg`, numbered S-01 to S-05 with no gap
and no drawing list; S-02 to S-04 share one title (one continuation run); a PDF in the set whose page
for S-01 matches its number and title, kept through `drawings.record_plot` as the read job keeps a
Plot page. With a Plot in the Discipline, a sheet with no matching page has one source (m0-screens 5:
"a sheet with only one source (no list and no Plot and in no run of numbers, or a Plot page that shows
another title)"), so S-02 to S-05 have one source each, S-01 agrees, and no Question is open.

Not pinned (no authority gives them): an act of two whole runs, a run with an agreeing sheet, the
toast's words.
"""

from typing import Any

import pytest

from engine.read.anchor import PdfAnchor
from engine.read.pdf.types import Page, TextItem, TextSource
from engine.recognise.types import PlotMatch
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import plot, proposals
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg

pytestmark = pytest.mark.django_db

ONE_SOURCE = "takeoff.step1.one_source"
A1 = (2384.0, 1684.0)
"""An A1 page, landscape, in points."""

RUN_TITLE = "STAIR REINFORCEMENT DETAILS"
TITLES = {
    "S-01": "GENERAL NOTES",
    "S-02": RUN_TITLE,
    "S-03": RUN_TITLE,
    "S-04": RUN_TITLE,
    "S-05": "LIFT CORE DETAILS",
}
RUN = ["S-02", "S-03", "S-04"]
LONE = "S-05"


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


class _Set:
    """The invented structural set, read and asked as the read job does."""

    def __init__(self, qs_project: QsProject) -> None:
        self.member = qs_project.member
        self.project_id = qs_project.project_id
        dwg = add(self.member, self.project_id, "QR-STR-R0.dwg", drawing()).file
        pdf = add(self.member, self.project_id, "QR-STR-R0.pdf", drawing("pdf")).file
        numbers = list(TITLES)
        read_dwg(self.member, dwg.id, numbers, titles=[TITLES[n] for n in numbers])
        with self.member.acting():
            drawing_set = drawings.set_of(self.project_id)
            assert drawing_set is not None
            sheets = {s.number: s for s in drawings.sheets(drawing_set.id)}
            for sheet in sheets.values():
                step1.propose_sheet(sheet.id)
                step1.record_coverage(sheet.id)
            first = sheets["S-01"]
            shown = _page(pdf.sha256, 1, "S-01", first.title)
            drawings.record_plot(first.id, PlotMatch(shown, sheet=plot.candidate(first)))
            proposals.set_questions(self.project_id, trigger_file=dwg.id)

    def base(self) -> str:
        return f"/api/projects/{self.project_id}/takeoff/step1"

    def listed(self) -> dict[str, dict[str, Any]]:
        response = api_as(self.member).get(f"{self.base()}/proposals")
        assert response.status_code == 200, response.content
        return {p["number"]: p for p in response.json()["proposals"]}

    def open_questions(self) -> list[dict[str, Any]]:
        response = api_as(self.member).get(f"{self.base()}/questions")
        assert response.status_code == 200, response.content
        return [q for q in response.json()["questions"] if q["status"] == "open"]

    def confirm(self, numbers: list[str]) -> Any:
        listed = self.listed()
        ids = [listed[n]["id"] for n in numbers]
        return api_as(self.member).post(f"{self.base()}/confirm", {"proposals": ids})

    def undo(self) -> Any:
        return api_as(self.member).post(f"{self.base()}/undo", {})

    def decisions(self) -> dict[str, str | None]:
        return {n: p["decision"] for n, p in self.listed().items()}


@pytest.fixture
def the_set(qs_project: QsProject) -> _Set:
    made = _Set(qs_project)
    listed = made.listed()
    # The scene the promises stand on: one run of one-source sheets, one lone one-source sheet,
    # one agreeing sheet, nothing held by a Question.
    run = {listed[n]["continuation"] for n in RUN}
    assert len(run) == 1, f"S-02 to S-04 are not one continuation: {run}"
    assert None not in run, "S-02 to S-04 are in no continuation"
    assert listed[LONE]["continuation"] is None
    assert listed["S-01"]["continuation"] is None
    assert [listed[n]["agrees"] for n in [*RUN, LONE]] == [False] * 4, "not one source each"
    assert listed["S-01"]["agrees"] is True
    assert made.open_questions() == []
    return made


def test_a_whole_continuation_run_of_one_source_sheets_confirms_in_one_act(the_set: _Set) -> None:
    response = the_set.confirm(RUN)

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 3
    decided = the_set.decisions()
    assert [decided[n] for n in RUN] == ["confirmed"] * 3
    assert decided[LONE] is None
    assert decided["S-01"] is None


def test_one_undo_restores_every_sheet_of_the_run(the_set: _Set) -> None:
    confirmed = the_set.confirm(RUN)
    assert confirmed.status_code == 200, confirmed.content

    undone = the_set.undo()

    assert undone.status_code == 200, undone.content
    assert undone.json()["sheets"] == 3
    decided = the_set.decisions()
    assert [decided[n] for n in RUN] == [None] * 3


def test_the_run_and_another_one_source_sheet_are_still_refused_whole(the_set: _Set) -> None:
    response = the_set.confirm([*RUN, LONE])

    assert response.status_code == 409, response.content
    assert response.json()["code"] == ONE_SOURCE
    decided = the_set.decisions()
    assert [decided[n] for n in [*RUN, LONE]] == [None] * 4


def test_part_of_a_run_alone_is_still_refused(the_set: _Set) -> None:
    response = the_set.confirm(RUN[:2])

    assert response.status_code == 409, response.content
    assert response.json()["code"] == ONE_SOURCE
    decided = the_set.decisions()
    assert [decided[n] for n in RUN] == [None] * 3

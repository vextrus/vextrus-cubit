"""Ticket 229 (issue #229; the owner's ruling, session 11, "Plot match + gap local"): "a sheet whose
Plot page matched (number and title read alike) has its second source; a numbering gap holds only the
sheets beside it, not the whole Discipline; all of one Discipline's gaps are asked as one Question."

The set: one structural DWG (KR-STR-R0.dwg), no drawing list, each sheet's number and title from its
title block (`read_dwg`), and a PDF in the set whose pages are kept as each sheet's Plot through
`drawings.record_plot`, the seam the read job's Plot matching keeps a page through
(`read_propose.plot`), given the page with its text as the PDF reader returns it. Whether a page's
number and title read alike is judged from that page's text against the sheet's title block. The
Questions are asked as the read job asks them (`read_propose.proposals.set_questions`).

"Beside a gap": the two numbered sheets either side of it, as the gap Check names them (`after` and
`before`); with a gap between S-04 and S-06, S-04 and S-06.
"""

import json
from typing import Any

import pytest

from engine.check import register as register_check
from engine.read.anchor import PdfAnchor
from engine.read.pdf.types import Page, TextItem, TextSource
from engine.recognise.types import PlotMatch
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import plot, proposals
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

A1 = (2384.0, 1684.0)
"""An A1 page, landscape, in points."""


def _title(number: str) -> str:
    return f"COLUMN LAYOUT {number}"


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
    def __init__(self, qs_project: QsProject, numbers: list[str]) -> None:
        self.member: Member = qs_project.member
        self.project_id = qs_project.project_id
        dwg = add(self.member, self.project_id, "KR-STR-R0.dwg", drawing()).file
        self.pdf = add(self.member, self.project_id, "KR-STR-R0.pdf", drawing("pdf")).file
        read_dwg(self.member, dwg.id, numbers, titles=[_title(n) for n in numbers])
        with self.member.acting():
            drawing_set = drawings.set_of(self.project_id)
            assert drawing_set is not None
            self.sheets = {s.number: s for s in drawings.sheets(drawing_set.id)}
            self.proposal = {n: step1.propose_sheet(s.id) for n, s in self.sheets.items()}
            for s in self.sheets.values():
                step1.record_coverage(s.id)

    def plot(self, number: str, page: int, *, title: str | None = None) -> None:
        """Keep a page of the PDF as the sheet's Plot, its title block reading the sheet's number and
        `title` (the sheet's own title unless given)."""
        sheet = self.sheets[number]
        shown = _page(self.pdf.sha256, page, number, title if title is not None else sheet.title)
        with self.member.acting():
            drawings.record_plot(sheet.id, PlotMatch(shown, sheet=plot.candidate(sheet)))

    def ask(self) -> None:
        """The set's Questions, as the read job asks them once its files are read."""
        with self.member.acting():
            proposals.set_questions(self.project_id)

    def agrees(self) -> dict[str | None, bool]:
        path = f"/api/projects/{self.project_id}/takeoff/step1/proposals"
        body: dict[str, Any] = api_as(self.member).get(path).json()
        return {p["number"]: p["agrees"] for p in body["proposals"]}

    def questions(self) -> list[dict[str, Any]]:
        path = f"/api/projects/{self.project_id}/takeoff/step1/questions"
        found: list[dict[str, Any]] = api_as(self.member).get(path).json()["questions"]
        return found

    def gap_questions(self) -> list[dict[str, Any]]:
        """The open register Check Questions (with no drawing list, only the numbering's gaps)."""
        return [
            q
            for q in self.questions()
            if q["check_code"] == register_check.CODE and q["status"] == "open"
        ]


def _strings(value: object) -> set[str]:
    """Every string a Question's params hold, however nested."""
    if isinstance(value, str):
        return {value}
    if isinstance(value, dict):
        return set().union(*(_strings(v) for v in value.values())) if value else set()
    if isinstance(value, list | tuple):
        return set().union(*(_strings(v) for v in value)) if value else set()
    return set()


# (1) A matched Plot page is a second source, gap or no gap ----------------------------------------


def test_a_sheet_whose_plot_page_matched_agrees_though_its_discipline_has_a_gap(
    qs_project: QsProject,
) -> None:
    """ "A sheet whose Plot page matched (number and title read alike) has its second source". The
    gap between S-04 and S-06 holds S-04 and S-06 alone; S-01, S-02, S-03, S-07 and S-08 agree."""
    numbers = ["S-01", "S-02", "S-03", "S-04", "S-06", "S-07", "S-08"]
    the_set = _Set(qs_project, numbers)
    for page, number in enumerate(numbers, start=1):
        the_set.plot(number, page)
    the_set.ask()

    shown = the_set.agrees()

    for number in ("S-01", "S-02", "S-03", "S-07", "S-08"):
        assert shown[number] is True, number


def test_sheets_whose_plot_matched_join_the_bulk_act_though_the_discipline_has_a_gap(
    qs_project: QsProject,
) -> None:
    """Only a sheet two sources agree on joins the bulk act (m0-screens 6.4); a numbering gap no
    longer cancels the Plot for a whole Discipline (issue #229: "0 of 38 structural sheets can be
    confirmed in bulk")."""
    numbers = ["S-01", "S-02", "S-03", "S-04", "S-06", "S-07", "S-08"]
    the_set = _Set(qs_project, numbers)
    for page, number in enumerate(numbers, start=1):
        the_set.plot(number, page)
    the_set.ask()
    away = ["S-01", "S-02", "S-03", "S-07", "S-08"]

    response = api_as(the_set.member).post(
        f"/api/projects/{the_set.project_id}/takeoff/step1/confirm",
        {"proposals": [str(the_set.proposal[n]) for n in away]},
    )

    assert response.status_code == 200, response.json()
    shown = {p["number"]: p["decision"] for p in _proposals(the_set)}
    assert {n: shown[n] for n in away} == dict.fromkeys(away, "confirmed")


def _proposals(the_set: _Set) -> list[dict[str, Any]]:
    path = f"/api/projects/{the_set.project_id}/takeoff/step1/proposals"
    found: list[dict[str, Any]] = api_as(the_set.member).get(path).json()["proposals"]
    return found


# (2) Number alike, title not: not a second source -------------------------------------------------


def test_a_plot_page_with_the_sheets_number_but_another_title_is_not_a_second_source(
    qs_project: QsProject,
) -> None:
    """ "(number and title read alike)": S-02's page reads S-02 but another title. With no drawing
    list and numbering without a gap, S-02 has one source; S-01 and S-03, whose pages read alike,
    agree. Today the title is not compared and S-02 agrees."""
    the_set = _Set(qs_project, ["S-01", "S-02", "S-03"])
    the_set.plot("S-01", 1)
    the_set.plot("S-02", 2, title="ROOF SLAB REINFORCEMENT DETAILS")
    the_set.plot("S-03", 3)
    the_set.ask()

    assert the_set.agrees() == {"S-01": True, "S-02": False, "S-03": True}


def test_a_plot_page_with_another_title_raises_no_question_of_its_own(qs_project: QsProject) -> None:
    """What a title that differs raises today is kept: no Question (the sheet is a Proposal "with
    one source", confirmed on its own, m0-screens §5)."""
    the_set = _Set(qs_project, ["S-01", "S-02", "S-03"])
    the_set.plot("S-01", 1)
    the_set.plot("S-02", 2, title="ROOF SLAB REINFORCEMENT DETAILS")
    the_set.plot("S-03", 3)
    the_set.ask()

    assert [q for q in the_set.questions() if q["status"] == "open"] == []


def test_a_sheet_with_no_plot_page_still_has_one_source(qs_project: QsProject) -> None:
    """m0-screens §5: "A sheet with only one source (no list and no Plot) is a Proposal 'with one
    source'": numbering without a gap is never a second source alone."""
    the_set = _Set(qs_project, ["S-01", "S-02", "S-03"])
    the_set.plot("S-01", 1)
    the_set.plot("S-03", 3)
    the_set.ask()

    assert the_set.agrees() == {"S-01": True, "S-02": False, "S-03": True}


# (3) A gap holds only the sheets beside it ---------------------------------------------------------


def test_a_gap_holds_only_the_two_sheets_beside_it(qs_project: QsProject) -> None:
    """ "A numbering gap holds only the sheets beside it, not the whole Discipline": with S-05
    missing, S-04 and S-06 do not agree while the gap is asked, though their Plot pages matched;
    every other sheet does."""
    numbers = ["S-01", "S-02", "S-03", "S-04", "S-06", "S-07", "S-08"]
    the_set = _Set(qs_project, numbers)
    for page, number in enumerate(numbers, start=1):
        the_set.plot(number, page)
    the_set.ask()

    assert the_set.agrees() == {
        "S-01": True,
        "S-02": True,
        "S-03": True,
        "S-04": False,
        "S-06": False,
        "S-07": True,
        "S-08": True,
    }


def test_a_bulk_act_naming_a_sheet_beside_a_gap_is_refused(qs_project: QsProject) -> None:
    """A sheet the gap holds is not in the bulk act: one naming it is refused whole (409, as for any
    sheet that does not agree), and nothing is confirmed."""
    numbers = ["S-01", "S-02", "S-03", "S-04", "S-06", "S-07", "S-08"]
    the_set = _Set(qs_project, numbers)
    for page, number in enumerate(numbers, start=1):
        the_set.plot(number, page)
    the_set.ask()

    response = api_as(the_set.member).post(
        f"/api/projects/{the_set.project_id}/takeoff/step1/confirm",
        {"proposals": [str(the_set.proposal[n]) for n in ("S-03", "S-04")]},
    )

    assert response.status_code == 409
    assert {p["decision"] for p in _proposals(the_set)} == {None}


# (4) One Question for all of one Discipline's gaps -------------------------------------------------


def test_three_gaps_in_one_discipline_are_asked_as_one_question_naming_all_three(
    qs_project: QsProject,
) -> None:
    """ "All of one Discipline's gaps are asked as one Question": S-02, S-04 and S-06 missing give
    one open gap Question for Structural, whose params name the sheets either side of each gap."""
    numbers = ["S-01", "S-03", "S-05", "S-07"]
    the_set = _Set(qs_project, numbers)
    for page, number in enumerate(numbers, start=1):
        the_set.plot(number, page)
    the_set.ask()

    asked = the_set.gap_questions()

    assert len(asked) == 1, json.dumps(asked, default=str)
    [question] = asked
    assert question["discipline"] == "structural"
    assert {"S-01", "S-03", "S-05", "S-07"} <= _strings(question["params"])


def test_the_gap_question_is_asked_once_however_often_the_set_is_read(qs_project: QsProject) -> None:
    """The read job asks the set's Questions after each file (`set_questions`): asked again, the
    Discipline still has one gap Question."""
    numbers = ["S-01", "S-03", "S-05", "S-07"]
    the_set = _Set(qs_project, numbers)
    the_set.ask()
    the_set.ask()

    assert len(the_set.gap_questions()) == 1


def test_the_gap_question_offers_todays_gap_options_none_picked(qs_project: QsProject) -> None:
    """Its answers are today's per-gap answers (the drawing list's Check, m0-screens §5): "Not sent
    yet", "Not part of this set", "It is in a file I haven't added yet", "Keep open, ask the
    consultant", in that order, none pre-picked."""
    the_set = _Set(qs_project, ["S-01", "S-03", "S-05", "S-07"])
    the_set.ask()

    [question] = the_set.gap_questions()

    assert question["options"] == [
        {"key": "not_sent_yet", "picked": False},
        {"key": "not_in_set", "picked": False},
        {"key": "file_not_added", "picked": False},
        {"key": "keep_open", "picked": False},
    ]


@pytest.mark.parametrize("option", ["not_sent_yet", "not_in_set", "file_not_added"])
def test_answering_the_gap_question_settles_every_gap_of_the_discipline(
    qs_project: QsProject, option: str
) -> None:
    """One answer, as today's per-gap answer did for its gap, settles the Question: it is answered
    under the QS, and the Discipline has no open Question left (it can be confirmed)."""
    the_set = _Set(qs_project, ["S-01", "S-03", "S-05", "S-07"])
    the_set.ask()
    [question] = the_set.gap_questions()

    response = api_as(the_set.member).post(
        f"/api/projects/{the_set.project_id}/takeoff/step1/questions/{question['id']}/answer",
        {"option": option},
    )

    assert response.status_code == 200, response.json()
    assert the_set.gap_questions() == []
    [answered] = [q for q in the_set.questions() if q["id"] == question["id"]]
    assert (answered["status"], answered["answer"]["option"]) == ("answered", option)
    assert _open_questions(the_set, "structural") == 0


def test_keeping_the_gap_question_open_keeps_the_discipline_held(qs_project: QsProject) -> None:
    """ "Keep open, ask the consultant" keeps the Question open, as today: the Discipline keeps one
    open Question."""
    the_set = _Set(qs_project, ["S-01", "S-03", "S-05", "S-07"])
    the_set.ask()
    [question] = the_set.gap_questions()

    response = api_as(the_set.member).post(
        f"/api/projects/{the_set.project_id}/takeoff/step1/questions/{question['id']}/answer",
        {"option": "keep_open"},
    )

    assert response.status_code == 200, response.json()
    assert [q["id"] for q in the_set.gap_questions()] == [question["id"]]
    assert _open_questions(the_set, "structural") == 1


def _open_questions(the_set: _Set, discipline: str) -> int:
    path = f"/api/projects/{the_set.project_id}/takeoff/step1/progress"
    body: dict[str, Any] = api_as(the_set.member).get(path).json()
    [row] = [d for d in body["disciplines"] if d["discipline"] == discipline]
    count: int = row["open_questions"]
    return count

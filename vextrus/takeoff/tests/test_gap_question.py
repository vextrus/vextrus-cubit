"""Ticket #229's own tests, beyond its acceptance tests: the merged gap Question's life (its hold lifts
once answered; a later read that fills a gap retires it for one naming the gaps left; a sheet already
decided is not held) and the Plot's title kept by `drawings.record_plot` (a page matched again, or
none, says so afresh)."""

from typing import Any

import pytest

from engine.messages import register_check as list_codes
from engine.read.anchor import PdfAnchor
from engine.read.pdf.types import Page, TextItem, TextSource
from engine.recognise.types import PlotMatch
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import Question, QuestionLink
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import plot, proposals
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg

pytestmark = pytest.mark.django_db

A1 = (2384.0, 1684.0)


def _page(sha256: str, page: int, *texts: str) -> Page:
    items = tuple(
        TextItem(
            text,
            TextSource.TEXT,
            PdfAnchor(
                sha256, "vextrus-pdf", "1", page, i, (2000.0, 100.0 + 60 * i, 2300.0, 140.0 + 60 * i)
            ),
            20.0,
            0.0,
            False,
            "Arial",
        )
        for i, text in enumerate(texts)
    )
    return Page(sha256, page, A1[0], A1[1], 0, (0.0, 0.0, *A1), False, items)


class _Set:
    def __init__(self, qs_project: QsProject, numbers: list[str]) -> None:
        self.member = qs_project.member
        self.project_id = qs_project.project_id
        self.pdf = add(self.member, self.project_id, "KR-STR-R0.pdf", drawing("pdf")).file
        self.read("KR-STR-R0.dwg", numbers)

    def read(self, name: str, numbers: list[str]) -> None:
        dwg = add(self.member, self.project_id, name, drawing()).file
        read_dwg(self.member, dwg.id, numbers, titles=[f"COLUMN LAYOUT {n}" for n in numbers])
        with self.member.acting():
            drawing_set = drawings.set_of(self.project_id)
            assert drawing_set is not None
            self.sheets = {s.number: s for s in drawings.sheets(drawing_set.id)}
            for s in self.sheets.values():
                step1.propose_sheet(s.id)
                step1.record_coverage(s.id)

    def plot_all(self) -> None:
        with self.member.acting():
            for page, (number, sheet) in enumerate(sorted(self.sheets.items()), start=1):
                shown = _page(self.pdf.sha256, page, number or "", sheet.title)
                drawings.record_plot(sheet.id, PlotMatch(shown, sheet=plot.candidate(sheet)))

    def ask(self) -> None:
        with self.member.acting():
            proposals.set_questions(self.project_id)

    def agrees(self) -> dict[str | None, bool]:
        body = api_as(self.member).get(f"/api/projects/{self.project_id}/takeoff/step1/proposals").json()
        return {p["number"]: p["agrees"] for p in body["proposals"]}

    def gap_questions(self, status: str = "open") -> list[dict[str, Any]]:
        body = api_as(self.member).get(f"/api/projects/{self.project_id}/takeoff/step1/questions").json()
        return [
            q for q in body["questions"] if q["code"] == list_codes.GAPS.code and q["status"] == status
        ]


def test_the_gap_question_names_each_gap_and_holds_only_the_sheets_beside_them(
    qs_project: QsProject,
) -> None:
    the_set = _Set(qs_project, ["S-01", "S-02", "S-04", "S-05", "S-06", "S-09"])
    the_set.ask()

    [question] = the_set.gap_questions()

    assert question["params"] == {
        "discipline": "structural",
        "gaps": [
            {"after": "S-02", "before": "S-04", "missing": 1},
            {"after": "S-06", "before": "S-09", "missing": 2},
        ],
    }
    held = {the_set.sheets[n].id for n in ("S-02", "S-04", "S-06", "S-09")}
    linked = QuestionLink.objects.filter(question_id=question["id"]).values_list(
        "proposal__subject_id", flat=True
    )
    assert set(linked) == held


def test_once_the_gap_question_is_answered_the_sheets_beside_it_agree(qs_project: QsProject) -> None:
    the_set = _Set(qs_project, ["S-01", "S-02", "S-04", "S-05"])
    the_set.plot_all()
    the_set.ask()
    [question] = the_set.gap_questions()
    assert the_set.agrees() == {"S-01": True, "S-02": False, "S-04": False, "S-05": True}

    response = api_as(the_set.member).post(
        f"/api/projects/{the_set.project_id}/takeoff/step1/questions/{question['id']}/answer",
        {"option": "not_in_set"},
    )

    assert response.status_code == 200, response.json()
    assert the_set.agrees() == dict.fromkeys(["S-01", "S-02", "S-04", "S-05"], True)
    the_set.ask()  # read again: the answered Question is the one asked, and stays answered
    assert the_set.gap_questions() == []
    assert the_set.agrees() == dict.fromkeys(["S-01", "S-02", "S-04", "S-05"], True)


def test_a_read_that_fills_a_gap_retires_the_question_for_one_naming_the_gaps_left(
    qs_project: QsProject,
) -> None:
    the_set = _Set(qs_project, ["S-01", "S-03", "S-05"])
    the_set.ask()
    [first] = the_set.gap_questions()

    the_set.read("KR-STR-R1.dwg", ["S-02"])
    the_set.ask()

    [now] = the_set.gap_questions()
    assert now["id"] != first["id"]
    assert now["params"]["gaps"] == [{"after": "S-03", "before": "S-05", "missing": 1}]
    assert [q["id"] for q in the_set.gap_questions("withdrawn")] == [first["id"]]


def test_a_filled_numbering_leaves_no_gap_question_open(qs_project: QsProject) -> None:
    the_set = _Set(qs_project, ["S-01", "S-03"])
    the_set.ask()
    assert len(the_set.gap_questions()) == 1

    the_set.read("KR-STR-R1.dwg", ["S-02"])
    the_set.ask()

    assert the_set.gap_questions() == []


def test_a_per_gap_question_of_an_older_reading_is_retired_for_the_merged_one(
    qs_project: QsProject,
) -> None:
    """A database asked before #229 holds one Question per gap: the next read retires it, so the
    Discipline is not asked about one gap twice."""
    the_set = _Set(qs_project, ["S-01", "S-03"])
    with the_set.member.acting():
        old = step1.raise_question(
            the_set.project_id,
            "check",
            list_codes.GAP(after="S-01", before="S-03", missing=1, discipline="structural"),
            discipline="structural",
            options=proposals.options(proposals.CHECK_OPTIONS),
            check_code="register",
        )
    the_set.ask()

    with the_set.member.acting():
        assert Question.objects.get(id=old).status == "withdrawn"
    assert len(the_set.gap_questions()) == 1


def test_a_sheet_beside_a_gap_already_confirmed_is_not_held(qs_project: QsProject) -> None:
    the_set = _Set(qs_project, ["S-01", "S-02", "S-04"])
    with the_set.member.acting():
        proposal_of = step1.proposal_ids(the_set.project_id)
        step1.confirm(the_set.project_id, [proposal_of[the_set.sheets["S-02"].id]], actor_name="QS")
    the_set.ask()

    [question] = the_set.gap_questions()

    linked = QuestionLink.objects.filter(question_id=question["id"]).values_list(
        "proposal__subject_id", flat=True
    )
    assert set(linked) == {the_set.sheets["S-04"].id}


def test_a_plot_kept_again_reads_its_title_afresh(qs_project: QsProject) -> None:
    """The title read alike belongs to the page kept: a page with another title, or none, clears it."""
    the_set = _Set(qs_project, ["S-01"])
    sheet = the_set.sheets["S-01"]
    with the_set.member.acting():
        found = plot.candidate(sheet)
        kept = drawings.record_plot(
            sheet.id, PlotMatch(_page(the_set.pdf.sha256, 1, "S-01", sheet.title), sheet=found)
        )
        assert kept.plot.title_alike is True
        other = _page(the_set.pdf.sha256, 1, "S-01", "ROOF PLAN")
        assert drawings.record_plot(sheet.id, PlotMatch(other, sheet=found)).plot.title_alike is False
        drawings.record_plot(
            sheet.id, PlotMatch(_page(the_set.pdf.sha256, 1, "S-01", sheet.title), sheet=found)
        )
        none = drawings.record_plot(sheet.id, "no_page", pdf_file_id=the_set.pdf.id)
        assert (none.plot.page, none.plot.title_alike) == (None, False)


# The refuter's round (session 11): each class it proved, held by a test -------------------------


def _bulk(the_set: _Set, *numbers: str) -> int:
    with the_set.member.acting():
        proposal_of = step1.proposal_ids(the_set.project_id)
    response = api_as(the_set.member).post(
        f"/api/projects/{the_set.project_id}/takeoff/step1/confirm",
        {"proposals": [str(proposal_of[the_set.sheets[n].id]) for n in numbers]},
    )
    status: int = response.status_code
    return status


def test_an_undo_brings_a_sheet_beside_an_open_gap_back_into_its_hold(qs_project: QsProject) -> None:
    """S-02, confirmed on its own before the gap was asked, is undone while the gap Question is open:
    it is beside the gap, so it does not agree and no bulk act may take it (the refuter: 200)."""
    the_set = _Set(qs_project, ["S-01", "S-02", "S-04", "S-05"])
    the_set.plot_all()
    with the_set.member.acting():
        proposal_of = step1.proposal_ids(the_set.project_id)
        step1.confirm(the_set.project_id, [proposal_of[the_set.sheets["S-02"].id]], actor_name="QS")
    the_set.ask()
    assert len(the_set.gap_questions()) == 1

    assert (
        api_as(the_set.member).post(f"/api/projects/{the_set.project_id}/takeoff/step1/undo").status_code
        == 200
    )

    assert the_set.agrees() == {"S-01": True, "S-02": False, "S-04": False, "S-05": True}
    assert _bulk(the_set, "S-01", "S-02") == 409


def _answer(the_set: _Set, question: dict[str, Any], option: str = "not_in_set") -> None:
    path = f"/api/projects/{the_set.project_id}/takeoff/step1/questions/{question['id']}/answer"
    response = api_as(the_set.member).post(path, {"option": option})
    assert response.status_code == 200, response.json()


def test_a_gap_answered_stays_settled_when_another_gap_appears(qs_project: QsProject) -> None:
    """The next Question asks only the new gap and holds only its neighbours: the answered gap's
    sheets keep agreeing (the refuter: S-02 and S-04 held again)."""
    the_set = _Set(qs_project, ["S-01", "S-02", "S-04", "S-05"])
    the_set.plot_all()
    the_set.ask()
    [question] = the_set.gap_questions()
    _answer(the_set, question)

    the_set.read("KR-STR-R1.dwg", ["S-08"])
    the_set.plot_all()
    the_set.ask()

    [now] = the_set.gap_questions()
    assert now["params"]["gaps"] == [{"after": "S-05", "before": "S-08", "missing": 2}]
    shown = the_set.agrees()
    assert (shown["S-02"], shown["S-04"], shown["S-05"], shown["S-08"]) == (True, True, False, False)


def test_gaps_answered_stay_settled_when_one_of_them_is_filled(qs_project: QsProject) -> None:
    """Two gaps answered, then a file fills one: the other is not asked again."""
    the_set = _Set(qs_project, ["S-01", "S-03", "S-05"])
    the_set.ask()
    [question] = the_set.gap_questions()
    _answer(the_set, question)

    the_set.read("KR-STR-R1.dwg", ["S-02"])
    the_set.ask()

    assert the_set.gap_questions() == []
    [answered] = the_set.gap_questions("answered")
    assert answered["id"] == question["id"]


def test_a_sheet_with_a_suffix_beside_a_gap_is_held(qs_project: QsProject) -> None:
    """S-04A is S-04's running number: with S-05 missing it is beside the gap the Check names after
    S-04 (the refuter: it agreed and was not held)."""
    the_set = _Set(qs_project, ["S-03", "S-04", "S-04A", "S-06", "S-07"])
    the_set.plot_all()
    the_set.ask()

    [question] = the_set.gap_questions()

    shown = the_set.agrees()
    assert {n: shown[n] for n in ("S-03", "S-04", "S-04A", "S-06", "S-07")} == {
        "S-03": True,
        "S-04": False,
        "S-04A": False,
        "S-06": False,
        "S-07": True,
    }
    linked = QuestionLink.objects.filter(question_id=question["id"]).values_list(
        "proposal__subject_id", flat=True
    )
    assert set(linked) == {the_set.sheets[n].id for n in ("S-04", "S-04A", "S-06")}


def test_a_title_read_again_differently_clears_the_plots_title(qs_project: QsProject) -> None:
    """The page read the old title, not the new one: until it is matched again it reads none (the
    refuter: the flag stayed true over a changed title)."""
    member, project_id = qs_project.member, qs_project.project_id
    pdf = add(member, project_id, "KR-STR-R0.pdf", drawing("pdf")).file
    dwg = add(member, project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["S-01"], titles=["COLUMN LAYOUT PLAN"])
    with member.acting():
        drawing_set = drawings.set_of(project_id)
        assert drawing_set is not None
        [sheet] = drawings.sheets(drawing_set.id)
        shown = _page(pdf.sha256, 1, "S-01", "COLUMN LAYOUT PLAN")
        kept = drawings.record_plot(sheet.id, PlotMatch(shown, sheet=plot.candidate(sheet)))
        assert kept.plot.title_alike is True

    read_dwg(member, dwg.id, ["S-01"], titles=["ROOF SLAB DETAILS"])

    with member.acting():
        [again] = drawings.sheets(drawing_set.id)
        assert (again.id, again.title, again.plot.page) == (sheet.id, "ROOF SLAB DETAILS", 1)
        assert again.plot.title_alike is False


def test_the_proposal_says_whether_its_plot_page_reads_its_title(qs_project: QsProject) -> None:
    """The bar says why a sheet with a Plot page has one source (the words gate: "Nothing else
    confirms it" over a visible Plot page): the proposal carries the title read alike."""
    the_set = _Set(qs_project, ["S-01", "S-02", "S-03"])
    with the_set.member.acting():
        for page, number in enumerate(("S-01", "S-02"), start=1):
            sheet = the_set.sheets[number]
            title = sheet.title if number == "S-01" else "ROOF PLAN"
            shown = _page(the_set.pdf.sha256, page, number, title)
            drawings.record_plot(sheet.id, PlotMatch(shown, sheet=plot.candidate(sheet)))

    path = f"/api/projects/{the_set.project_id}/takeoff/step1/proposals"
    body = api_as(the_set.member).get(path).json()

    plots = {p["number"]: (p["plot_page"], p["plot_title_alike"]) for p in body["proposals"]}
    assert plots == {"S-01": (1, True), "S-02": (2, False), "S-03": (None, False)}

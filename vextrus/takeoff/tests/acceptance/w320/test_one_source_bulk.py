"""Ticket W320 (#320, the owner's ruling of 5 Oct 2026, "Make them bulk-confirmable"): a printed Sheet
with one source joins the bulk act when its number and title come from its title block, in numbering
that runs without a gap beside it, and no open Question holds it (the title-block basis).

The authority (the ticket's section 2, "The rule"):
- A Sheet agrees with `agrees_on == "title_block"` when its Discipline has no standing drawing list,
  its number parses and no other Sheet of the Discipline prints it, its number and title both come
  from the title block and it is not held, no open Question holds it, and it is not beside an
  unanswered gap ("a gap holds only the Sheets beside it until the QS answers it").
- A Sheet that agrees on a list keeps `agrees_on == "list"`; `agrees_on` is null exactly when `agrees`
  is false.
- A bulk act naming a Sheet that does not agree is refused whole (409, nothing decided), with the code
  `_no_one_source_in_bulk` already gives: `question_first` for a Sheet an open Question holds,
  `held_file` for a held file's Sheet, else `one_source`.

Names chosen by the writer where the ticket gives none (the builder meets them):
- The gap Question is found as the open Step 1 Question of the Discipline whose `code` names a gap
  ("gap" in it), and answered with its first option that is not `keep_open`; the ticket's base raises
  one per gap (`engine.register_check.gap`), #229 one per Discipline: both are answered alike.
- A bulk act naming a Sheet beside an unanswered gap is 409 `one_source` or `question_first`: the
  ticket says `one_source`, but a gap Question that links the Sheets beside it (#229's `gap_linked`)
  holds them, and `_holding` (which the ticket keeps) then answers `question_first`.

Every Sheet, title and file name here is invented.
"""

import re
import uuid
from collections.abc import Callable, Sequence
from dataclasses import replace
from typing import Any

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from vextrus.drawings import services as drawings
from vextrus.projects import services as projects
from vextrus.takeoff.messages import step1 as step1_codes
from vextrus.takeoff.services import step1 as step1_service
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    KEEP_OPEN,
    Sheet,
    answer,
    confirm,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    step1,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

ELECTRICAL = "QM-ELE-R2.dwg"
STRUCTURAL = "QM-STR-R2.dwg"
TITLES = {
    "E-01": "WIRING SYMBOLS AND NOTES",
    "E-02": "LUMINAIRE GRID PLAN",
    "E-03": "SOCKET RUN PLAN",
    "E-04": "CABLE TRAY ROUTE PLAN",
    "E-05": "SWITCH ROOM LAYOUT",
    "E-06": "BONDING SCHEMATIC",
    "S-01": "PILE CAP NOTES",
    "S-02": "RAFT EDGE DETAILS",
    "S-03": "STAIR CORE SECTION",
    "S-04": "LINTEL BAND SCHEDULE",
}
TITLE_BLOCK = "title_block"
ONE_SOURCE = "takeoff.step1.one_source"
QUESTION_FIRST = "takeoff.step1.question_first"
HELD_FILE = "takeoff.step1.held_file"
BESIDE_A_GAP = {ONE_SOURCE, QUESTION_FIRST}
"""A Sheet beside an unanswered gap: `one_source`, or `question_first` where a gap Question links it."""


def drawn(*numbers: str) -> list[Sheet]:
    return [Sheet(n, TITLES[n], (TITLES[n],)) for n in numbers]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, files: dict[str, list[Sheet]]) -> None:
    for name, sheets in files.items():
        file_id = uploaded(qs.member, qs.project_id, name)
        run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))


def listed(qs: QsProject) -> dict[str | None, dict[str, Any]]:
    """The Proposals by printed number (each fixture prints a number once unless a test says)."""
    return {p["number"]: p for p in proposals(api_as(qs.member), qs.project_id)}


def bases(qs: QsProject) -> dict[str | None, str | None]:
    """What each Sheet agrees on (null for none), checking `agrees` says the same."""
    found = {}
    for number, p in listed(qs).items():
        assert p["agrees"] is (p.get("agrees_on") is not None), p
        found[number] = p.get("agrees_on", "absent")
    return found


def bulk(qs: QsProject, numbers: Sequence[str]) -> Any:
    by_number = listed(qs)
    return confirm(api_as(qs.member), qs.project_id, [by_number[n]["id"] for n in numbers])


def undecided(qs: QsProject) -> bool:
    return all(p["decision"] is None for p in listed(qs).values())


def refused(response: Any, codes: set[str]) -> None:
    assert response.status_code == 409, (response.status_code, response.content)
    assert response.json()["code"] in codes, response.json()


def gap_questions(qs: QsProject, discipline: str) -> list[dict[str, Any]]:
    return [
        q
        for q in open_questions(api_as(qs.member), qs.project_id)
        if "gap" in q["code"] and q["discipline"] == discipline
    ]


def answer_gaps(qs: QsProject, discipline: str, *, keep_open: bool = False) -> None:
    """Answer the Discipline's gap Question(s) once each: its first option other than "keep open",
    or "keep open"."""
    asked = gap_questions(qs, discipline)
    assert asked, f"no open gap Question for {discipline}"
    api = api_as(qs.member)
    for question in asked:
        options = [o["key"] for o in question["options"]]
        option = KEEP_OPEN if keep_open else next(k for k in options if k != KEEP_OPEN)
        response = answer(api, qs.project_id, question["id"], option)
        assert response.status_code == 200, response.content


def changed(
    monkeypatch: pytest.MonkeyPatch, number: str, change: Callable[[drawings.SheetView], Any]
) -> None:
    """Step 1 sees the Sheet printed `number` changed (`dataclasses.replace` on its SheetView)."""
    sheets_of = step1_service._sheets

    def seen(project_id: uuid.UUID) -> list[drawings.SheetView]:
        return [change(s) if s.number == number else s for s in sheets_of(project_id)]

    monkeypatch.setattr(step1_service, "_sheets", seen)


# 1. No list, no Plot, numbering without a gap ----------------------------------------------------


def test_a_continuous_unlisted_discipline_agrees_on_its_title_blocks(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn("E-01", "E-02", "E-03", "E-04")})

    assert bases(qs_project) == dict.fromkeys(["E-01", "E-02", "E-03", "E-04"], TITLE_BLOCK)


def test_the_four_title_block_sheets_are_confirmed_in_one_bulk_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn("E-01", "E-02", "E-03", "E-04")})

    response = bulk(qs_project, ["E-01", "E-02", "E-03", "E-04"])

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 4
    after = listed(qs_project)
    assert {
        n: (p["decision"], p["decided_act"], p["decided_with"]) for n, p in after.items()
    } == dict.fromkeys(["E-01", "E-02", "E-03", "E-04"], ("confirmed", "bulk", 4))
    acts = {p["decided_at"] for p in after.values()}
    assert len(acts) == 1, "one act decided all four"


# 2-3. A gap holds the Sheets beside it, until it is answered -------------------------------------

GAPPED = ("E-01", "E-02", "E-04", "E-05", "E-06")
"""E-03 missing: E-02 and E-04 sit beside the gap."""


def test_an_unanswered_gap_holds_only_the_sheets_beside_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*GAPPED)})
    assert gap_questions(qs_project, "electrical"), "the fixture's premise: the gap is asked"

    assert bases(qs_project) == {
        "E-01": TITLE_BLOCK, "E-02": None, "E-04": None, "E-05": TITLE_BLOCK, "E-06": TITLE_BLOCK,
    }  # fmt: skip


def test_the_sheets_away_from_an_unanswered_gap_are_confirmed_in_bulk(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*GAPPED)})

    response = bulk(qs_project, ["E-06", "E-01", "E-05"])

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 3


@pytest.mark.parametrize("beside", ["E-02", "E-04"])
def test_a_bulk_act_naming_a_sheet_beside_an_unanswered_gap_is_refused(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, beside: str
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*GAPPED)})

    response = bulk(qs_project, ["E-05", beside])

    refused(response, BESIDE_A_GAP)
    assert undecided(qs_project)


def test_one_sheet_beside_a_gap_refuses_the_whole_bulk_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*GAPPED)})

    response = bulk(qs_project, ["E-01", "E-05", "E-06", "E-04"])

    refused(response, BESIDE_A_GAP)
    assert undecided(qs_project)


def test_answering_the_gap_lets_the_sheets_beside_it_join(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*GAPPED)})

    answer_gaps(qs_project, "electrical")

    assert bases(qs_project) == dict.fromkeys(GAPPED, TITLE_BLOCK)
    response = bulk(qs_project, list(GAPPED))
    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 5


def test_a_gap_kept_open_still_holds_the_sheets_beside_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*GAPPED)})

    answer_gaps(qs_project, "electrical", keep_open=True)

    assert bases(qs_project) == {
        "E-01": TITLE_BLOCK, "E-02": None, "E-04": None, "E-05": TITLE_BLOCK, "E-06": TITLE_BLOCK,
    }  # fmt: skip


# 4. Each Discipline is judged apart --------------------------------------------------------------


def test_a_gap_in_one_discipline_holds_nothing_in_another(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(
        qs_project,
        monkeypatch,
        {STRUCTURAL: drawn("S-01", "S-02", "S-04"), ELECTRICAL: drawn("E-01", "E-02", "E-03")},
    )
    electrical = dict.fromkeys(["E-01", "E-02", "E-03"], TITLE_BLOCK)

    assert bases(qs_project) == {"S-01": TITLE_BLOCK, "S-02": None, "S-04": None} | electrical

    answer_gaps(qs_project, "structural")

    assert bases(qs_project) == dict.fromkeys(["S-01", "S-02", "S-04"], TITLE_BLOCK) | electrical


# 6. What keeps a Sheet out -----------------------------------------------------------------------

CONTINUOUS = ("E-01", "E-02", "E-03", "E-04")


def _file_name_number(sheet: drawings.SheetView) -> drawings.SheetView:
    return replace(sheet, sources={**sheet.sources, "number": "file_name"})


def _file_name_title(sheet: drawings.SheetView) -> drawings.SheetView:
    return replace(sheet, sources={**sheet.sources, "title": "file_name"})


def _held(sheet: drawings.SheetView) -> drawings.SheetView:
    return replace(sheet, held=True)


def _no_discipline(sheet: drawings.SheetView) -> drawings.SheetView:
    return replace(sheet, discipline=None)


def _unparsed(sheet: drawings.SheetView) -> drawings.SheetView:
    return replace(sheet, number="ELEC/A")


KEPT_OUT: dict[str, tuple[Callable[[drawings.SheetView], drawings.SheetView], str, str]] = {
    "a number read from the file name": (_file_name_number, "E-03", ONE_SOURCE),
    "a title read from the file name": (_file_name_title, "E-03", ONE_SOURCE),
    "a held file's sheet read anyway": (_held, "E-03", HELD_FILE),
    "a sheet of no Discipline": (_no_discipline, "E-03", ONE_SOURCE),
    "a number that does not parse": (_unparsed, "ELEC/A", ONE_SOURCE),
}
"""The change to E-03, the number it is then listed by, and the code a bulk act naming it gets."""


@pytest.mark.parametrize("why", list(KEPT_OUT))
def test_a_sheet_that_fails_the_title_block_basis_stays_out_and_the_others_agree(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, why: str
) -> None:
    change, shown_as, code = KEPT_OUT[why]
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*CONTINUOUS)})
    changed(monkeypatch, "E-03", change)

    assert bases(qs_project) == {
        "E-01": TITLE_BLOCK, "E-02": TITLE_BLOCK, shown_as: None, "E-04": TITLE_BLOCK,
    }  # fmt: skip
    response = bulk(qs_project, ["E-01", shown_as])
    refused(response, {code})
    assert undecided(qs_project)


def _ask_low_confidence(qs: QsProject, number: str, *, by: str) -> None:
    """An open `low_confidence` Question holding the Sheet: by its subject, or by a link."""
    sheet = listed(qs)[number]
    with qs.member.acting():
        step1_service.raise_question(
            qs.project_id,
            "low_confidence",
            step1_codes.NO_NUMBER(),
            subject_id=uuid.UUID(sheet["sheet_id"]) if by == "subject" else None,
            discipline="electrical",
            options=[{"key": "yes", "picked": False}, {"key": KEEP_OPEN, "picked": False}],
            blocks=[uuid.UUID(sheet["id"])] if by == "link" else [],
        )


@pytest.mark.parametrize("by", ["subject", "link"])
def test_a_sheet_an_open_question_holds_stays_out(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, by: str
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*CONTINUOUS)})
    _ask_low_confidence(qs_project, "E-03", by=by)

    assert bases(qs_project) == {
        "E-01": TITLE_BLOCK, "E-02": TITLE_BLOCK, "E-03": None, "E-04": TITLE_BLOCK,
    }  # fmt: skip
    refused(bulk(qs_project, ["E-02", "E-03"]), {QUESTION_FIRST})
    assert undecided(qs_project)


def test_two_sheets_of_one_number_never_agree_and_the_rest_do(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    twice = [
        *drawn("E-01", "E-02"),
        Sheet("E-03", "SOCKET RUN PLAN", ("SOCKET RUN PLAN",), rev="R3", date="21.09.2026"),
        Sheet("E-03", "SOCKET RUN PLAN", ("SOCKET RUN PLAN",), rev="R1", date="03.07.2026"),
        *drawn("E-04"),
    ]
    read(qs_project, monkeypatch, {ELECTRICAL: twice})

    seen = proposals(api_as(qs_project.member), qs_project.project_id)
    on: dict[str | None, list[str | None]] = {}
    for p in seen:
        assert p["agrees"] is (p.get("agrees_on") is not None), p
        on.setdefault(p["number"], []).append(p.get("agrees_on", "absent"))
    assert on == {
        "E-01": [TITLE_BLOCK], "E-02": [TITLE_BLOCK], "E-03": [None, None], "E-04": [TITLE_BLOCK],
    }  # fmt: skip
    copy = next(p for p in seen if p["number"] == "E-03")
    first = next(p for p in seen if p["number"] == "E-01")
    response = confirm(api_as(qs_project.member), qs_project.project_id, [first["id"], copy["id"]])
    refused(response, {QUESTION_FIRST, ONE_SOURCE})
    assert all(
        p["decision"] is None for p in proposals(api_as(qs_project.member), qs_project.project_id)
    )


# 7. A drawing list is not widened ----------------------------------------------------------------


def test_a_sheet_a_standing_list_does_not_name_stays_out(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn("E-01", "E-02", "E-03")})
    given = api_as(qs_project.member).post(
        f"{step1(qs_project.project_id)}/drawing-list",
        {"discipline": "electrical", "text": "E-01 to E-02"},
    )
    assert given.status_code == 200, given.content

    assert bases(qs_project) == {"E-01": "list", "E-02": "list", "E-03": None}
    refused(bulk(qs_project, ["E-01", "E-03"]), {ONE_SOURCE})


def test_two_lists_that_disagree_leave_every_sheet_out(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    on_e01 = (("E-01", TITLES["E-01"]), ("E-02", TITLES["E-02"]), ("E-03", TITLES["E-03"]))
    sheets = [
        Sheet("E-01", TITLES["E-01"], (TITLES["E-01"],), register=on_e01),
        *drawn("E-02", "E-03"),
    ]
    read(qs_project, monkeypatch, {ELECTRICAL: sheets})
    given = api_as(qs_project.member).post(
        f"{step1(qs_project.project_id)}/drawing-list",
        {"discipline": "electrical", "text": "E-01 to E-05"},
    )
    assert given.status_code == 200, given.content

    assert bases(qs_project) == dict.fromkeys(["E-01", "E-02", "E-03"], None)


# 9. The work does not grow with the Sheets -------------------------------------------------------

_TAKEOFF_TABLE = re.compile(r'\bFROM "takeoff_')


def _takeoff_queries(qs: QsProject, project_id: uuid.UUID) -> int:
    """The queries `GET .../proposals` issues against Takeoff's own tables (its Proposals, Questions
    and their links, drawing lists, acts). The drawings module's per-Sheet reads are not this
    ticket's and are left out."""
    api = api_as(qs.member)
    with CaptureQueriesContext(connection) as ran:
        proposals(api, project_id)
    return sum(1 for q in ran.captured_queries if _TAKEOFF_TABLE.search(q["sql"]))


def _numbered(count: int, *, without: int | None = None) -> list[Sheet]:
    return [
        Sheet(f"E-{n:02d}", f"FLOOR {n} SOCKET RUN", (f"FLOOR {n} SOCKET RUN",))
        for n in range(1, count + 1)
        if n != without
    ]


def _another_project(qs: QsProject) -> QsProject:
    with qs.member.acting():
        made = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another invented project")
    return QsProject(qs.member, made.id)


def test_the_title_block_basis_costs_the_same_for_three_sheets_or_thirty(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: _numbered(3)})
    big = _another_project(qs_project)
    read(big, monkeypatch, {"QN-ELE-R2.dwg": _numbered(30)})
    assert set(bases(qs_project).values()) == {TITLE_BLOCK}, "the premise: all three agree"
    assert set(bases(big).values()) == {TITLE_BLOCK}, "the premise: all thirty agree"

    assert _takeoff_queries(big, big.project_id) <= _takeoff_queries(qs_project, qs_project.project_id)


def test_a_gap_beside_some_of_thirty_sheets_costs_no_more_than_three_without_one(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: _numbered(3)})
    gapped = _another_project(qs_project)
    read(gapped, monkeypatch, {"QN-ELE-R2.dwg": _numbered(31, without=16)})
    on = bases(gapped)
    assert (on["E-15"], on["E-17"]) == (None, None), "the premise: the gap holds its two neighbours"
    assert sum(1 for v in on.values() if v == TITLE_BLOCK) == 28

    assert _takeoff_queries(gapped, gapped.project_id) <= _takeoff_queries(
        qs_project, qs_project.project_id
    )


# The field is null exactly when the Sheet does not agree -----------------------------------------


def test_every_proposal_carries_agrees_on(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, {ELECTRICAL: drawn(*GAPPED)})

    for p in proposals(api_as(qs_project.member), qs_project.project_id):
        assert "agrees_on" in p, p
        assert p["agrees_on"] in {"list", "plot", TITLE_BLOCK, None}

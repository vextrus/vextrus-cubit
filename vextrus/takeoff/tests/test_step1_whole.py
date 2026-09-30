"""Ticket 21c's own tests beside its acceptance tests: the answer's refusals, a view left out on its
own, and the walls of the acts it adds (on hand-built artefacts, as `acceptance/t21c` builds them)."""

import uuid
from collections.abc import Callable

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    KEEP_OPEN,
    NOT_FOUND,
    Sheet,
    answer,
    confirm,
    coverage,
    exclude,
    jev_says,
    keys,
    open_questions,
    proposals,
    questions,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

NAME = "KR-STR-R0.dwg"
DUPLICATE = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
]
LOOSE = [Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN", "SECTION A-A"))]
"""A pile plan and a section no step reads: one view unaccounted."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: sheets}))
    return file_id


def test_a_question_answered_once_refuses_a_second_answer_and_keeps_the_first(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")
    assert answer(api, qs_project.project_id, q["id"], "keep_latest").status_code == 200

    again = answer(api, qs_project.project_id, q["id"], "keep_all")

    assert (again.status_code, again.json()) == (
        409,
        {"code": "takeoff.proposals.answered_already", "params": {}},
    )
    [done] = [x for x in questions(api, qs_project.project_id) if x["id"] == q["id"]]
    assert done["answer"]["option"] == "keep_latest"


def test_keep_open_then_an_answer_settles_the_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")
    assert answer(api, qs_project.project_id, q["id"], KEEP_OPEN).status_code == 200

    response = answer(api, qs_project.project_id, q["id"], keys(q)[0])

    assert response.status_code == 200, response.content
    assert open_questions(api, qs_project.project_id, "conflict") == []


def test_a_view_left_out_on_its_own_stays_out_when_its_sheet_is_confirmed_and_undo_brings_it_back(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, LOOSE)
    api = api_as(qs_project.member)
    [lone] = coverage(api, qs_project.project_id)["unaccounted_views"]

    left_out = exclude(api, qs_project.project_id, [lone["id"]], "other", "part of the title block")
    assert left_out.status_code == 200, left_out.content
    confirm(api, qs_project.project_id, [p["id"] for p in proposals(api, qs_project.project_id)])

    # (A title block, once the engine emits it as a view, is left out for information: not counted
    # here.)
    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["by_reason"].get("other")) == (0, 1)
    # The confirmation first, then the view's own exclusion: each undo takes back one act.
    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200
    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200
    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["by_reason"].get("other")) == (1, None)
    assert [v["view_id"] for v in shown["unaccounted_views"]] == [lone["view_id"]]


def test_a_typed_number_holding_a_drawing_code_is_refused_and_changes_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing")

    raw = answer(api, qs_project.project_id, q["id"], "type_number", text="S-%%C02")
    empty = answer(api, qs_project.project_id, q["id"], "type_number")

    assert (raw.status_code, raw.json()["code"]) == (400, "drawings.sheets.number_unreadable")
    assert (empty.status_code, empty.json()["code"]) == (400, "takeoff.proposals.number_needed")
    assert the(proposals(api, qs_project.project_id), None)["sheet_id"] == q["subject_id"]
    assert [x["id"] for x in open_questions(api, qs_project.project_id, "missing")] == [q["id"]]


def test_another_developers_view_cannot_be_left_out_nor_its_question_answered(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    read(qs_project, monkeypatch, LOOSE)
    mine = api_as(qs_project.member)
    [lone] = coverage(mine, qs_project.project_id)["unaccounted_views"]
    other = sign_in(role="qs")
    with other.acting():
        from vextrus.projects import services as projects

        theirs = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Their project").id
    api = api_as(other)

    refused = exclude(api, theirs, [lone["id"]], "other", "not theirs")
    across = exclude(api, qs_project.project_id, [lone["id"]], "other", "not theirs")

    assert (refused.status_code, refused.json()) == (404, NOT_FOUND)
    assert (across.status_code, across.json()) == (404, NOT_FOUND)
    assert coverage(mine, qs_project.project_id)["unaccounted"] == 1


def test_undoing_a_sheets_confirmation_keeps_a_view_the_qs_left_out_on_its_own(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The refuter's case (score 60): undoing act 2 (the sheet confirmed) put back act 1 (the view
    left out on its own), leaving the view unaccounted for good."""
    read(qs_project, monkeypatch, LOOSE)
    api = api_as(qs_project.member)
    [lone] = coverage(api, qs_project.project_id)["unaccounted_views"]
    exclude(api, qs_project.project_id, [lone["id"]], "other", "part of the title block")
    confirm(api, qs_project.project_id, [p["id"] for p in proposals(api, qs_project.project_id)])

    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200

    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["by_reason"].get("other"), shown["by_step"]) == (
        0,
        1,
        {"foundations": 1},
    )
    confirm(api, qs_project.project_id, [p["id"] for p in proposals(api, qs_project.project_id)])
    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["by_reason"].get("other"), shown["assigned"]) == (0, 1, 1)


def test_undoing_an_assigned_views_own_exclusion_puts_it_back_under_its_confirmed_sheet(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, LOOSE)
    api = api_as(qs_project.member)
    confirm(api, qs_project.project_id, [p["id"] for p in proposals(api, qs_project.project_id)])
    with qs_project.member.acting():
        from vextrus.takeoff.models import Proposal

        [assigned] = [
            str(p.id)
            for p in Proposal.objects.filter(project_id=qs_project.project_id, subject="view")
            if p.values.get("steps")
        ]
    left_out = exclude(api, qs_project.project_id, [assigned], "duplicate")
    assert left_out.status_code == 200, left_out.content

    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200

    shown = coverage(api, qs_project.project_id)
    assert (shown["assigned"], shown["proposed"], shown["by_reason"].get("duplicate")) == (1, 0, None)


@pytest.mark.parametrize("typed", ["S-\n02", "S-\t02", "S-02‮", "S-​02"])
def test_a_typed_number_holding_a_control_or_format_character_is_refused(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, typed: str
) -> None:
    """The refuter's case (score 35): a line break or a bidi override was kept in the number."""
    read(qs_project, monkeypatch, [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing")

    response = answer(api, qs_project.project_id, q["id"], "type_number", text=typed)

    assert (response.status_code, response.json()) == (
        400,
        {"code": "drawings.sheets.number_unreadable", "params": {}},
    )
    assert [p["number"] for p in proposals(api, qs_project.project_id)] == ["S-01", None]


def test_an_answer_keeps_the_qs_words_only_where_the_option_takes_them(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")

    response = answer(api, qs_project.project_id, q["id"], KEEP_OPEN, text="%%C\x07" + "x" * 100_000)

    assert response.status_code == 200, response.content
    assert "text" not in response.json()["answer"]


def test_a_sheet_with_no_number_is_named_by_its_title_in_its_questions_words(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The words gate's must M2: a bare title stood in for a missing number ("Which Discipline is
    COLUMN LAYOUT PLAN?"); a sheet is named by `named` (number, title or none)."""
    jev_says(jev_offline, "0.34")
    file_id = uploaded(qs_project.member, qs_project.project_id, "GENERAL NOTES.dwg")
    run_job(qs_project.member, file_id, monkeypatch, readers({"GENERAL NOTES.dwg": [
        Sheet(None, "GENERAL NOTES", ("GENERAL NOTES",)),
    ]}))  # fmt: skip
    asked = open_questions(api_as(qs_project.member), qs_project.project_id)

    by_kind = {q["kind"]: q["params"] for q in asked}

    assert by_kind["missing_discipline"] == {"sheet": "GENERAL NOTES", "named": "title"}


def test_a_withdrawn_question_refuses_an_answer_as_no_longer_asked(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The words gate's must M1: a lists Question withdrawn by a newer list is refused by the code
    whose words say "already answered or no longer asked"."""
    rows = (("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"))
    read(qs_project, monkeypatch, [
        Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=rows),
        Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    path = f"{step1(qs_project.project_id)}/drawing-list"
    api.post(path, {"discipline": "structural", "text": "S-01 to S-04"})
    [first] = open_questions(api, qs_project.project_id, "conflict")
    assert first["params"] == {"sheet": "S-01", "named": "number", "source": "typed"}
    api.post(path, {"discipline": "structural", "text": "S-01 to S-05"})

    late = answer(api, qs_project.project_id, first["id"], "use_read")

    assert (late.status_code, late.json()) == (
        409,
        {"code": "takeoff.proposals.answered_already", "params": {}},
    )


def test_the_questions_queue_by_sheets_held_then_conflicts_missing_items_and_checks(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5's queue: the held file first, then the Questions holding the most sheets, then
    conflicts, missing items and low-confidence ones, then the rest as raised (here the check on a
    listed number in no file, raised before the missing number's Question)."""
    held = uploaded(qs_project.member, qs_project.project_id, "KR-STR-old.dwg")
    run_job(
        qs_project.member,
        held,
        monkeypatch,
        readers({"KR-STR-old.dwg": DUPLICATE}, held=["KR-STR-old.dwg"]),
    )
    read(qs_project, monkeypatch, [
        Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=(
            ("S-01", "GENERAL NOTES"), ("S-02", "COLUMN SCHEDULE"), ("S-03", "STAIR DETAILS"),
            ("S-04", "ROOF BEAM LAYOUT PLAN"),
        )),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
        Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
    ])  # fmt: skip

    asked = open_questions(api_as(qs_project.member), qs_project.project_id)

    assert [q["kind"] for q in asked][:3] == ["file_misread", "conflict", "missing"]
    assert asked[-1]["kind"] == "check"


# Fix round 1 -------------------------------------------------------------------------------------

UNNUMBERED = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
]


def test_a_typed_number_another_sheet_has_raises_a_same_number_conflict(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review finding 1 (75): typing S-01 on the unnumbered sheet left two S-01s and no Question."""
    read(qs_project, monkeypatch, UNNUMBERED)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing")

    assert answer(api, qs_project.project_id, q["id"], "type_number", text="S-01").status_code == 200

    copies = [p["id"] for p in proposals(api, qs_project.project_id) if p["number"] == "S-01"]
    [conflict] = open_questions(api, qs_project.project_id, "conflict")
    assert conflict["code"] == "engine.conflicts.same_number"
    assert sorted(conflict["proposals"]) == sorted(copies)


def test_a_sheet_held_by_an_open_missing_question_cannot_be_confirmed_until_it_is_answered(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review finding 3 (50): confirming first left the Question unanswerable (409)."""
    read(qs_project, monkeypatch, UNNUMBERED)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    unnumbered = the(listed, None)["id"]

    single = confirm(api, qs_project.project_id, [unnumbered])
    bulk = confirm(api, qs_project.project_id, [p["id"] for p in listed])

    for refused in (single, bulk):
        assert (refused.status_code, refused.json()) == (
            409,
            {
                "code": "takeoff.step1.question_first",
                "params": {"count": 1, "asks": "number", "sheet": "STAIR DETAILS", "named": "title"},
            },
        )
    assert all(p["decision"] is None for p in proposals(api, qs_project.project_id))
    [q] = open_questions(api, qs_project.project_id, "missing")
    assert answer(api, qs_project.project_id, q["id"], "no_number").status_code == 200
    assert confirm(api, qs_project.project_id, [unnumbered]).status_code == 200


def test_once_the_lists_question_is_answered_the_sheets_agree_against_the_chosen_list(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review finding 2, the orchestrator's ruling: answered lists agree against the list chosen."""
    rows = (("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"))
    read(qs_project, monkeypatch, [
        Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=rows),
        Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    path = f"{step1(qs_project.project_id)}/drawing-list"
    # A typed list shorter than the one read, so the list the answer chose is told from the other.
    assert api.post(path, {"discipline": "structural", "text": "S-01 to S-02"}).status_code == 200
    assert not any(p["agrees"] for p in proposals(api, qs_project.project_id))
    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert answer(api, qs_project.project_id, q["id"], "use_read").status_code == 200

    assert [p["agrees"] for p in proposals(api, qs_project.project_id)] == [True, True, True]


def test_the_boundary_storey_question_names_the_storey_where_the_ranges_meet(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The words gate's M2: "... include the 1st storey? The range on S-08 also starts at the 1st.\""""
    read(qs_project, monkeypatch, [
        Sheet("S-07", "COLUMN LAYOUT PLAN BASEMENT TO 1ST FLOOR",
              ("COLUMN LAYOUT PLAN BASEMENT TO 1ST FLOOR",)),
        Sheet("S-08", "COLUMN LAYOUT PLAN 1ST TO 9TH FLOOR", ("COLUMN LAYOUT PLAN 1ST TO 9TH FLOOR",)),
    ])  # fmt: skip
    [q] = open_questions(api_as(qs_project.member), qs_project.project_id, "convention")

    params = q["params"]
    assert (params["level"], params["number"], params["next_sheet"]) == ("floor", 1, "S-08")


def test_the_bangla_sections_header_counts_the_same_texts_as_its_sheet_links(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The words gate's M3: on a read (not the seed's lines) the header was missing."""
    file_id = read(qs_project, monkeypatch, [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-02", "GROUND FLOOR PLAN", ("GROUND FLOOR BEAM LAYOUT PLAN",), bangla=2),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), bangla=1),
    ])  # fmt: skip
    path = f"/api/projects/{qs_project.project_id}/drawings/files/{file_id}/report"
    report = api_as(qs_project.member).get(path).json()

    [header] = report["bangla"]
    assert header["code"] == "engine.bangla_ansi.found"
    assert header["params"]["texts"] == sum(s["texts"] for s in report["bangla_sheets"]) == 3
    assert header["params"]["sheets"] == len(report["bangla_sheets"]) == 2


def test_the_storeys_a_boundary_question_names_are_words_never_keys() -> None:
    """The words gate's round-1 must 4: "the pile cap storey" printed a key."""
    from vextrus.takeoff.services.read_propose.proposals import storey_named

    assert storey_named("floor_1") == {"level": "floor", "number": 1, "storey": "floor_1"}
    assert storey_named("basement_2")["level"] == "basement"
    assert storey_named("basement_2")["number"] == 2
    assert storey_named("roof")["level"] == "roof"
    assert storey_named("pile_cap")["level"] == "other"


def test_a_held_file_read_anyway_that_found_no_sheet_can_be_marked_for_vextrus(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The words gate's round-1 must 1: its report says to mark it; its row stays held."""
    held = uploaded(qs_project.member, qs_project.project_id, "KR-STR-old.dwg")
    use = readers({"KR-STR-old.dwg": []}, held=["KR-STR-old.dwg"])
    run_job(qs_project.member, held, monkeypatch, use)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "file_misread")
    assert answer(api, qs_project.project_id, q["id"], "read_anyway").status_code == 200
    run_job(qs_project.member, held, monkeypatch, use)

    marked = api.post(f"/api/projects/{qs_project.project_id}/drawings/files/{held}/mark-for-vextrus")

    assert marked.status_code == 200, marked.content
    assert marked.json()["marked_for_vextrus"] is True


# Fix round 2 -------------------------------------------------------------------------------------


def test_answering_the_kind_of_a_sheet_whose_number_is_asked_keeps_the_kind_until_it_is_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """Review round 2, finding 2 (50): the kind's answer was refused "confirm again" while the
    number's Question held the sheet; now the kind is kept and the sheet confirms once numbered."""
    jev_says(jev_offline, "0.34")
    read(qs_project, monkeypatch, UNNUMBERED)
    api = api_as(qs_project.member)
    unnumbered = the(proposals(api, qs_project.project_id), None)
    [kind_q] = [
        q
        for q in open_questions(api, qs_project.project_id, "low_confidence")
        if q["proposals"] == [unnumbered["id"]]
    ]
    chosen = keys(kind_q)[1]

    response = answer(api, qs_project.project_id, kind_q["id"], chosen)

    assert response.status_code == 200, response.content
    shown = the(proposals(api, qs_project.project_id), None)
    assert (shown["kind"], shown["decision"]) == (chosen, None)
    [number_q] = open_questions(api, qs_project.project_id, "missing")
    assert answer(api, qs_project.project_id, number_q["id"], "no_number").status_code == 200
    assert confirm(api, qs_project.project_id, [unnumbered["id"]]).status_code == 200
    assert the(proposals(api, qs_project.project_id), None)["confirmed_kind"] == chosen


def test_leaving_out_a_sheet_withdraws_its_discipline_question_and_undo_asks_it_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review round 2, finding 3 (50): an excluded sheet's missing_discipline Question could only be
    answered 409 decided_already."""
    file_id = uploaded(qs_project.member, qs_project.project_id, "GENERAL NOTES.dwg")
    run_job(qs_project.member, file_id, monkeypatch, readers({"GENERAL NOTES.dwg": [
        Sheet("N-01", "GENERAL NOTES", ("GENERAL NOTES",)),
    ]}))  # fmt: skip
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing_discipline")
    sheet = the(proposals(api, qs_project.project_id), "N-01")

    left_out = exclude(api, qs_project.project_id, [sheet["id"]], "for_information")

    assert left_out.status_code == 200, left_out.content
    assert open_questions(api, qs_project.project_id, "missing_discipline") == []
    [gone] = [x for x in questions(api, qs_project.project_id) if x["id"] == q["id"]]
    assert gone["status"] == "withdrawn"
    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200
    assert [x["id"] for x in open_questions(api, qs_project.project_id, "missing_discipline")] == [
        q["id"]
    ]

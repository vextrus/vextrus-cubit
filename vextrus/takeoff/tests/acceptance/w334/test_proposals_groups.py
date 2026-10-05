"""Ticket T-W334's acceptance on the read job and Step 1's API (#334, #321, the data half of #232): the
group data T-W322's screen reads, the Questions a series no longer raises, and the counts a conflict
Question words.

The contract this ticket fixes: each `GET .../takeoff/step1/proposals` item carries `continuation`
(one value on every Sheet of one continuation run, `None` for a Sheet alone), `continuation_title` (the
group row's title, its member-mark ranges joined; `None` when `continuation` is) and `series` (one
value on every Sheet of one series, else `None`); all three default to `None` in the schema. A
`same_title` or `same_storey` Question's `params["sheets"]` is the number of Proposals it holds.

Invented sheets drawn by 21c's fixtures (`step1_whole`) and read by the real sheet and view finders,
Jev offline. Every title, number and mark is invented.
"""

from collections.abc import Sequence
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.api import api as ninja_api
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    exclude,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STRUCTURAL = "QW-STR-R0.dwg"
FIELDS = ("continuation", "continuation_title", "series")


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> list[dict[str, Any]]:
    """Read the invented sheets as one structural file; the Proposals the API lists."""
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)
    run_job(qs.member, file_id, monkeypatch, readers({STRUCTURAL: sheets}))
    return proposals(api_as(qs.member), qs.project_id)


def by_number(listed: Sequence[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    found = {p["number"]: p for p in listed}
    assert len(found) == len(listed), "one Proposal per number in these sets"
    return found


def held_numbers(question: dict[str, Any], listed: Sequence[dict[str, Any]]) -> list[str]:
    numbers = {p["id"]: p["number"] for p in listed}
    return sorted(numbers[i] for i in question["proposals"])


def conflict_questions(qs: QsProject, code: str) -> list[dict[str, Any]]:
    return [q for q in open_questions(api_as(qs.member), qs.project_id, "conflict") if q["code"] == code]


# 1. Member-mark ranges are one continuation ------------------------------------------------------

RANGES = [
    Sheet("S-17", "LINTEL L3-L8 DETAILS", ("LINTEL L3-L8 DETAILS",)),
    Sheet("S-18", "LINTEL L9-L14 DETAILS", ("LINTEL L9-L14 DETAILS",)),
    Sheet("S-19", "LINTEL L15-L21 DETAILS", ("LINTEL L15-L21 DETAILS",)),
]


def test_titles_equal_but_for_member_mark_ranges_share_one_continuation_and_its_title(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    listed = read(qs_project, monkeypatch, RANGES)

    assert len(listed) == 3
    assert {p["continuation"] for p in listed} != {None}
    assert len({p["continuation"] for p in listed}) == 1
    assert {p["continuation_title"] for p in listed} == {"LINTEL L3-L21 DETAILS"}
    assert {p["series"] for p in listed} == {None}
    assert open_questions(api_as(qs_project.member), qs_project.project_id, "conflict") == []


# 2. Runs that follow different floors' layout plans are one series, no Question ------------------

DETAILS = "BEAM REBAR DETAILS"


def framing(floor: str) -> str:
    return f"{floor} FLOOR BEAM FRAMING PLAN"


FLOORS = [
    Sheet("S-31", framing("5TH"), (framing("5TH"),)),
    Sheet("S-32", DETAILS, (DETAILS,)),
    Sheet("S-33", DETAILS, (DETAILS,)),
    Sheet("S-36", framing("6TH"), (framing("6TH"),)),
    Sheet("S-37", DETAILS, (DETAILS,)),
    Sheet("S-38", DETAILS, (DETAILS,)),
    Sheet("S-39", DETAILS, (DETAILS,)),
    Sheet("S-42", framing("7TH"), (framing("7TH"),)),
    Sheet("S-43", DETAILS, (DETAILS,)),
]


def test_runs_of_one_title_after_different_floors_layout_plans_are_one_series_and_ask_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    shown = by_number(read(qs_project, monkeypatch, FLOORS))

    assert conflict_questions(qs_project, conflict_codes.SAME_TITLE.code) == []
    details = ["S-32", "S-33", "S-37", "S-38", "S-39", "S-43"]
    assert shown["S-32"]["series"] is not None
    assert {shown[n]["series"] for n in details} == {shown["S-32"]["series"]}
    assert {shown[n]["series"] for n in ("S-31", "S-36", "S-42")} == {None}
    first, second = shown["S-32"]["continuation"], shown["S-37"]["continuation"]
    assert None not in (first, second)
    assert first != second
    assert shown["S-33"]["continuation"] == first
    assert shown["S-38"]["continuation"] == shown["S-39"]["continuation"] == second
    assert shown["S-43"]["continuation"] is None
    assert shown["S-43"]["continuation_title"] is None
    assert shown["S-32"]["continuation_title"] == DETAILS


# 3. Two runs that draw one storey keep the Question ----------------------------------------------


def test_two_runs_after_one_layout_plan_keep_the_same_title_question_and_are_no_series(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    listed = read(qs_project, monkeypatch, [
        Sheet("S-31", framing("5TH"), (framing("5TH"),)),
        Sheet("S-32", DETAILS, (DETAILS,)),
        Sheet("S-33", DETAILS, (DETAILS,)),
        Sheet("S-35", DETAILS, (DETAILS,)),
    ])  # fmt: skip

    [question] = conflict_questions(qs_project, conflict_codes.SAME_TITLE.code)

    assert held_numbers(question, listed) == ["S-32", "S-33", "S-35"]
    assert {p["series"] for p in listed} == {None}


# 4. A layout plan and the details that enlarge it ask nothing ------------------------------------

FOOTING_PLAN = "FOOTING PLAN"


def test_a_layout_plan_and_two_details_sheets_of_its_subject_and_storey_ask_no_same_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [
        Sheet("S-05", "FOOTING LAYOUT PLAN", (FOOTING_PLAN,)),
        Sheet("S-06", "FOOTING REINFORCEMENT DETAILS", (FOOTING_PLAN,)),
        Sheet("S-07", "FOOTING REINFORCEMENT DETAILS", (FOOTING_PLAN,)),
    ])  # fmt: skip

    assert conflict_questions(qs_project, conflict_codes.SAME_STOREY.code) == []


# 5. A Question's count is the Sheets it holds ----------------------------------------------------


def test_a_same_title_question_counts_only_the_sheets_it_still_holds(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    listed = read(qs_project, monkeypatch, [
        Sheet("S-70", "STAIR DETAILS", ("STAIR DETAILS",)),
        Sheet("S-74", "STAIR DETAILS", ("STAIR DETAILS",)),
        Sheet("S-78", "STAIR DETAILS", ("STAIR DETAILS",)),
    ])  # fmt: skip
    [asked] = conflict_questions(qs_project, conflict_codes.SAME_TITLE.code)
    assert asked["params"]["sheets"] == len(asked["proposals"]) == 3

    response = confirm(
        api_as(qs_project.member), qs_project.project_id, [by_number(listed)["S-70"]["id"]]
    )

    assert response.status_code == 200, response.content
    [question] = conflict_questions(qs_project, conflict_codes.SAME_TITLE.code)
    assert held_numbers(question, listed) == ["S-74", "S-78"]
    assert question["params"]["sheets"] == len(question["proposals"]) == 2


THIRD_FLOOR_SLAB = "3RD FLOOR SLAB PLAN"


def test_a_same_storey_question_counts_only_the_sheets_it_still_holds(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    listed = read(qs_project, monkeypatch, [
        Sheet("S-41", "3RD FLOOR SLAB LAYOUT PLAN", (THIRD_FLOOR_SLAB,)),
        Sheet("S-44", "3RD FLOOR SLAB REINFORCEMENT PLAN", (THIRD_FLOOR_SLAB,)),
        Sheet("S-47", "3RD FLOOR SLAB SETTING OUT PLAN", (THIRD_FLOOR_SLAB,)),
    ])  # fmt: skip
    [asked] = conflict_questions(qs_project, conflict_codes.SAME_STOREY.code)
    assert asked["params"]["sheets"] == len(asked["proposals"]) == 3

    response = exclude(
        api_as(qs_project.member), qs_project.project_id, [by_number(listed)["S-47"]["id"]], "duplicate"
    )

    assert response.status_code == 200, response.content
    [question] = conflict_questions(qs_project, conflict_codes.SAME_STOREY.code)
    assert held_numbers(question, listed) == ["S-41", "S-44"]
    assert question["params"]["sheets"] == len(question["proposals"]) == 2


# 6. The schema: the three fields are optional ----------------------------------------------------


def test_the_three_group_fields_are_optional_and_nullable_in_the_openapi_response() -> None:
    """Not required, so a client built without them (the web's fixtures) still parses."""
    schema = ninja_api.get_openapi_schema()
    proposal = schema["components"]["schemas"]["Step1ProposalOut"]

    for name in FIELDS:
        assert name in proposal["properties"], name
        assert name not in proposal.get("required", []), name
        assert {"type": "null"} in proposal["properties"][name].get("anyOf", []), name

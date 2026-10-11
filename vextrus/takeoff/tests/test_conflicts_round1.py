"""#161's fix round 1: 19b compares every listed sheet, a decided one keeping a run's context, and
each Conflict is trimmed to its undecided sheets (F1); copies of a number one of which is confirmed
are no `same_number` Question (the refuter's 35); a Question the QS kept open hands that answer to
the Question that supersedes it (F2)."""

import uuid
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    exclude,
    jev_says,
    proposals,
    questions,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
STRUCTURAL_B = "KR-STR-B-R0.dwg"
THREE_S04 = [
    Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev=rev, date=date)
    for rev, date in (("R0", "02.08.2026"), ("R1", "14.08.2026"), ("R2", "30.08.2026"))
]
RUN = [
    Sheet(f"S-{n:02d}", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)) for n in (9, 10, 11)
]  # one title on consecutive numbers: a continuation, no conflict


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def open_conflicts(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    return [q for q in questions(api, project_id) if q["kind"] == "conflict" and q["status"] == "open"]


def of_number(api: Any, project_id: uuid.UUID, number: str) -> list[dict[str, Any]]:
    return sorted(
        (p for p in proposals(api, project_id) if p["number"] == number),
        key=lambda p: p["revision_mark"],
    )


@pytest.mark.parametrize("act", ["confirm", "exclude"])
def test_a_decided_sheet_in_the_middle_of_a_run_keeps_the_run_a_continuation(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, act: str
) -> None:
    """F1: S-09, S-10, S-11 all "COLUMN SCHEDULE"; S-10 decided, S-09 and S-11 are still a run, not
    a same_title Question."""
    read(qs_project, monkeypatch, STRUCTURAL, RUN)
    api = api_as(qs_project.member)
    assert open_conflicts(api, qs_project.project_id) == []
    [s10] = of_number(api, qs_project.project_id, "S-10")

    if act == "confirm":
        response = confirm(api, qs_project.project_id, [s10["id"]])
    else:
        response = exclude(api, qs_project.project_id, [s10["id"]], "for_information")
    assert response.status_code == 200, response.content
    read(qs_project, monkeypatch, STRUCTURAL_B, [Sheet("S-20", "BEAM SCHEDULE", ("BEAM SCHEDULE",))])

    assert open_conflicts(api, qs_project.project_id) == []


def test_three_copies_one_confirmed_by_hand_ask_no_same_number(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The refuter's 35: R2 confirmed by hand; R0 and R1 are no new "Two sheets are numbered S-04"
    (its "keep latest" would confirm R1 beside R2), and no open Question holds R2."""
    read(qs_project, monkeypatch, STRUCTURAL, THREE_S04)
    api = api_as(qs_project.member)
    r2 = of_number(api, qs_project.project_id, "S-04")[-1]
    assert r2["revision_mark"] == "R2"

    response = confirm(api, qs_project.project_id, [r2["id"]])

    assert response.status_code == 200, response.content
    assert open_conflicts(api, qs_project.project_id) == []


def test_three_copies_one_left_out_by_hand_ask_of_the_other_two(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """F1's trim: R0 left out; the Question is of R1 and R2, its words counting two."""
    read(qs_project, monkeypatch, STRUCTURAL, THREE_S04)
    api = api_as(qs_project.member)
    r0, r1, r2 = of_number(api, qs_project.project_id, "S-04")

    response = exclude(api, qs_project.project_id, [r0["id"]], "superseded")

    assert response.status_code == 200, response.content
    [q] = open_conflicts(api, qs_project.project_id)
    assert q["code"] == conflict_codes.SAME_NUMBER.code
    assert q["params"] == {"number": "S-04", "copies": 2}
    assert sorted(str(i) for i in q["proposals"]) == sorted([r1["id"], r2["id"]])


def test_a_question_kept_open_hands_its_answer_to_the_one_that_supersedes_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """F2: R0 and R1 kept open (ask the consultant); a later file brings R2: the Question of three
    is kept open as the QS said, not asked afresh."""
    read(qs_project, monkeypatch, STRUCTURAL, THREE_S04[:2])
    api = api_as(qs_project.member)
    [asked] = open_conflicts(api, qs_project.project_id)
    response = answer(api, qs_project.project_id, asked["id"], "keep_open")
    assert response.status_code == 200, response.content

    read(qs_project, monkeypatch, STRUCTURAL_B, THREE_S04[2:])

    [now] = open_conflicts(api, qs_project.project_id)
    assert now["params"]["copies"] == 3
    assert now["answer"]["option"] == "keep_open"


# Review 1 of #638: a same storey Question's words name only the sheets it holds ---------------------


def test_a_same_storey_questions_words_name_only_the_sheets_it_still_holds(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """S-41, S-44 and S-47 draw one 3rd floor slab. The QS leaves S-41 out: the Question holds S-44
    and S-47 and names them, not S-41. Then S-44 out: it holds S-47 alone and names it alone."""
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, exclude, jev_says
    from vextrus.takeoff.tests.acceptance.w334.test_proposals_groups import (
        THIRD_FLOOR_SLAB,
        by_number,
        conflict_questions,
        read,
    )

    jev_says(jev_offline, "0.97")
    listed = read(qs_project, monkeypatch, [
        Sheet("S-41", "3RD FLOOR SLAB LAYOUT PLAN", (THIRD_FLOOR_SLAB,)),
        Sheet("S-44", "3RD FLOOR SLAB REINFORCEMENT PLAN", (THIRD_FLOOR_SLAB,)),
        Sheet("S-47", "3RD FLOOR SLAB SETTING OUT PLAN", (THIRD_FLOOR_SLAB,)),
    ])  # fmt: skip
    numbers = by_number(listed)
    api = api_as(qs_project.member)
    [asked] = conflict_questions(qs_project, conflict_codes.SAME_STOREY.code)
    assert (asked["params"]["first"], asked["params"]["second"]) == ("S-41", "S-44")

    for number in ("S-41", "S-44"):
        response = exclude(api, qs_project.project_id, [numbers[number]["id"]], "duplicate")
        assert response.status_code == 200, response.content
        [question] = conflict_questions(qs_project, conflict_codes.SAME_STOREY.code)
        held = sorted(p["number"] for p in listed if p["id"] in question["proposals"])
        named = [question["params"]["first"], question["params"]["second"]][: len(held)]
        assert question["params"]["sheets"] == len(held)
        assert named == held, (number, named, held)


# Review 2 of #638: the plans a narrowed same storey quotes are the held sheets' own ------------------

PLANS = {
    "S-41": "3RD FLOOR SLAB PLAN",
    "S-44": "3RD FLOOR SLAB REINFORCEMENT PLAN",
    "S-47": "3RD FLOOR SLAB SETTING OUT PLAN",
}


def _three_plans(qs: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline) -> Any:
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, jev_says
    from vextrus.takeoff.tests.acceptance.w334.test_proposals_groups import by_number, read

    jev_says(jev_offline, "0.97")
    listed = read(qs, monkeypatch, [Sheet(n, f"SHEET {n}", (plan,)) for n, plan in PLANS.items()])
    return by_number(listed)


def _storey_question(qs: QsProject) -> dict[str, Any]:
    from vextrus.takeoff.tests.acceptance.w334.test_proposals_groups import conflict_questions

    [question] = conflict_questions(qs, conflict_codes.SAME_STOREY.code)
    return question


@pytest.mark.parametrize(("left_out", "held"), [("S-41", ["S-44", "S-47"]), ("S-44", ["S-41", "S-47"])])
def test_a_narrowed_same_storey_quotes_only_the_held_sheets_plans(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    jev_offline: Offline,
    left_out: str,
    held: list[str],
) -> None:
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import exclude

    numbers = _three_plans(qs_project, monkeypatch, jev_offline)
    asked = _storey_question(qs_project)["params"]
    assert asked["sheets"] == 3, asked

    response = exclude(
        api_as(qs_project.member), qs_project.project_id, [numbers[left_out]["id"]], "duplicate"
    )
    assert response.status_code == 200, response.content

    params = _storey_question(qs_project)["params"]
    assert (params["first"], params["second"]) == tuple(held)
    assert params["titled"] == "differ", params
    assert (params["plan"], params["other"]) == (PLANS[held[0]], PLANS[held[1]])
    assert PLANS[left_out] not in (params["plan"], params["other"])


def test_one_held_sheet_quotes_its_own_plan_alone(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import exclude

    numbers = _three_plans(qs_project, monkeypatch, jev_offline)
    api = api_as(qs_project.member)
    for number in ("S-41", "S-44"):
        response = exclude(api, qs_project.project_id, [numbers[number]["id"]], "duplicate")
        assert response.status_code == 200, response.content

    params = _storey_question(qs_project)["params"]
    assert (params["sheets"], params["first"]) == (1, "S-47")
    assert (params["titled"], params["plan"], params["other"]) == ("same", PLANS["S-47"], "")
    assert (params["second"], params["second_named"]) == ("S-41", "number")  # like S-41, left out


# Review 3 of #638: the two sheets a narrowed same storey names lie at two places ---------------------


def test_copies_of_one_number_left_alone_ask_no_same_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """S-41 R0, S-41 R1 and S-44 draw one 3rd floor slab; the two copies of S-41 lie at one place.
    S-44 left out: never "S-41 and S-41 both draw": one storey drawn at one place is no same storey
    (19b's `_same_storey`), so the Question is retired; the copies' own Question stays."""
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, exclude, jev_says
    from vextrus.takeoff.tests.acceptance.w334.test_proposals_groups import (
        THIRD_FLOOR_SLAB,
        conflict_questions,
        read,
    )

    jev_says(jev_offline, "0.97")
    listed = read(qs_project, monkeypatch, [
        Sheet("S-41", "3RD FLOOR SLAB LAYOUT PLAN", (THIRD_FLOOR_SLAB,), rev="R0", date="02.08.2026"),
        Sheet("S-41", "3RD FLOOR SLAB LAYOUT PLAN", (THIRD_FLOOR_SLAB,), rev="R1", date="14.09.2026"),
        Sheet("S-44", "3RD FLOOR SLAB REINFORCEMENT PLAN", (THIRD_FLOOR_SLAB,)),
    ])  # fmt: skip
    [asked] = conflict_questions(qs_project, conflict_codes.SAME_STOREY.code)
    assert {asked["params"]["first"], asked["params"]["second"]} == {"S-41", "S-44"}, asked
    [s44] = [p for p in listed if p["number"] == "S-44"]

    response = exclude(api_as(qs_project.member), qs_project.project_id, [s44["id"]], "duplicate")

    assert response.status_code == 200, response.content
    assert conflict_questions(qs_project, conflict_codes.SAME_STOREY.code) == []
    assert conflict_questions(qs_project, conflict_codes.SAME_NUMBER.code)


# Review 1 of #641: copies at one place beside a confirmed sheet at another still ask ---------------

S41_COPIES = [
    Sheet("S-41", "3RD FLOOR SLAB LAYOUT PLAN", ("3RD FLOOR SLAB PLAN",), rev="R0", date="02.08.2026"),
    Sheet("S-41", "3RD FLOOR SLAB LAYOUT PLAN", ("3RD FLOOR SLAB PLAN",), rev="R1", date="14.09.2026"),
]
S44 = Sheet("S-44", "3RD FLOOR SLAB REINFORCEMENT PLAN", ("3RD FLOOR SLAB REINFORCEMENT PLAN",))


def _storey_questions(qs: QsProject) -> list[dict[str, Any]]:
    from vextrus.takeoff.tests.acceptance.w334.test_proposals_groups import conflict_questions

    return conflict_questions(qs, conflict_codes.SAME_STOREY.code)


@pytest.mark.parametrize("later", [True, False], ids=["s44-confirmed-then-a-new-file", "one-file"])
def test_copies_at_one_place_beside_a_confirmed_sheet_ask_the_same_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, later: bool
) -> None:
    """Review 1 of #641 (scored 70): S-44 confirmed draws the 3rd floor slab; two copies of S-41
    (R0, R1), one place, draw it too. The same storey is asked, holding both copies and counting them
    (T-W334), naming S-41 once, like S-44: "S-41 draws “3RD FLOOR SLAB PLAN”, like S-44, already
    confirmed or left out". Before the fix it was retired, and the copies' "keep latest" confirmed
    S-41 beside S-44: one storey drawn twice, nothing asked."""
    api = api_as(qs_project.member)
    if later:
        read(qs_project, monkeypatch, STRUCTURAL, [S44])
    else:
        read(qs_project, monkeypatch, STRUCTURAL, [*S41_COPIES, S44])
    [s44] = of_number(api, qs_project.project_id, "S-44")
    response = confirm(api, qs_project.project_id, [s44["id"]])
    assert response.status_code == 200, response.content
    if later:
        read(qs_project, monkeypatch, STRUCTURAL_B, S41_COPIES)
    copies = of_number(api, qs_project.project_id, "S-41")
    assert len(copies) == 2

    [question] = _storey_questions(qs_project)
    params = question["params"]
    assert sorted(question["proposals"]) == sorted(c["id"] for c in copies)
    assert params["sheets"] == len(question["proposals"]) == 2
    assert (params["first"], params["first_named"]) == ("S-41", "number")
    assert (params["second"], params["second_named"]) == ("S-44", "number")
    assert params["alone"] == "yes"
    assert (params["titled"], params["plan"], params["other"]) == ("same", "3RD FLOOR SLAB PLAN", "")
    assert conflict_questions_of(api, qs_project.project_id, conflict_codes.SAME_NUMBER.code)


def conflict_questions_of(api: Any, project_id: uuid.UUID, code: str) -> list[dict[str, Any]]:
    return [q for q in open_conflicts(api, project_id) if q["code"] == code]


@pytest.mark.parametrize("act", ["exclude", "none"])
def test_copies_at_one_place_beside_no_confirmed_sheet_ask_no_same_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, act: str
) -> None:
    """Review 3 of #638 still holds: the copies of S-41 alone at one place, S-44 left out (or S-44
    not read at all), are one storey drawn once: no same storey."""
    api = api_as(qs_project.member)
    read(qs_project, monkeypatch, STRUCTURAL, [*S41_COPIES, *([S44] if act == "exclude" else [])])
    if act == "exclude":
        [s44] = of_number(api, qs_project.project_id, "S-44")
        response = exclude(api, qs_project.project_id, [s44["id"]], "duplicate")
        assert response.status_code == 200, response.content

    assert _storey_questions(qs_project) == []
    assert conflict_questions_of(api, qs_project.project_id, conflict_codes.SAME_NUMBER.code)


def test_two_held_sheets_at_two_places_beside_a_confirmed_one_name_the_two_held(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """Two sheets held at two places are named as before ("S-44 and S-47 both draw"), never the
    confirmed S-41, and never alone."""
    numbers = _three_plans(qs_project, monkeypatch, jev_offline)
    api = api_as(qs_project.member)
    response = confirm(api, qs_project.project_id, [numbers["S-41"]["id"]])
    assert response.status_code == 200, response.content

    question = _storey_question(qs_project)
    params = question["params"]
    assert params["sheets"] == len(question["proposals"]) == 2
    assert (params["first"], params["second"], params["alone"]) == ("S-44", "S-47", "no")


def test_one_held_sheet_is_named_like_the_confirmed_sheet_before_one_left_out(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """S-41 left out, S-44 confirmed: S-47, held alone, draws the storey like S-44, the sheet that
    draws it in the model, not like S-41."""
    numbers = _three_plans(qs_project, monkeypatch, jev_offline)
    api = api_as(qs_project.member)
    response = exclude(api, qs_project.project_id, [numbers["S-41"]["id"]], "duplicate")
    assert response.status_code == 200, response.content
    response = confirm(api, qs_project.project_id, [numbers["S-44"]["id"]])
    assert response.status_code == 200, response.content

    params = _storey_question(qs_project)["params"]
    assert (params["sheets"], params["first"], params["alone"]) == (1, "S-47", "yes")
    assert (params["second"], params["second_named"]) == ("S-44", "number")

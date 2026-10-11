"""Review 1 of #648 (65): a boundary storey the convention settled is asked again when a later file
brings a third plan claiming the storey, so the ruling ("it asks only when a third plan of the same
subject also claims that storey", session 19) holds whichever file is read first. The seam is
ts19b2's: invented column plans read by 21c's read job, the Questions read through the API as the QS.
Every number and title is invented.
"""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.ts19b2.test_boundary_convention import (
    EXCLUDES,
    boundary,
    plan,
    read,
)
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db

TWO = [
    plan("S-21", "COLUMN SETTING-OUT PLAN GRD TO 3RD FLOOR"),
    plan("S-22", "COLUMN SETTING-OUT PLAN 3RD TO 5TH FLOOR"),
]
THIRD = [plan("S-23", "COLUMN SETTING-OUT PLAN AT 3RD FLOOR")]


@pytest.mark.parametrize("third_first", [False, True], ids=["two-then-third", "third-then-two"])
def test_a_third_plan_in_another_file_asks_the_boundary_storey_in_either_order(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, third_first: bool
) -> None:
    files = [("KR-STR-COL-R0.dwg", TWO), ("KR-STR-SETOUT-R0.dwg", THIRD)]
    if third_first:
        files.reverse()
    name, sheets = files[0]
    read(qs_project, monkeypatch, sheets, name)
    if not third_first:
        [settled] = boundary(qs_project)
        assert (settled["status"], settled["answer"]["option"]) == ("answered", EXCLUDES)
    name, sheets = files[1]
    read(qs_project, monkeypatch, sheets, name)

    [q] = boundary(qs_project)
    assert (q["status"], q["kind"]) == ("open", "convention")
    assert not q.get("answer")
    assert (q["params"]["sheet"], q["params"]["storey"], q["params"]["next_sheet"]) == (
        "S-21",
        "floor_3",
        "S-22",
    )


def open_boundaries(qs: QsProject) -> list[dict[str, Any]]:
    return [q for q in boundary(qs) if q["status"] == "open"]


@pytest.mark.parametrize("revised_first", [False, True], ids=["r0-then-r1", "r1-then-r0"])
def test_a_revised_copy_of_the_two_meeting_plans_is_no_third_plan(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, revised_first: bool
) -> None:
    """Review 2 of #648 (50, strict): S-21 and S-22 again in a later file (their R1) are the same two
    plans, never a third: the meeting stays settled by the convention and no boundary storey is open."""
    files = [("KR-STR-COL-R0.dwg", TWO), ("KR-STR-COL-R1.dwg", TWO)]
    if revised_first:
        files.reverse()
    for name, sheets in files:
        read(qs_project, monkeypatch, sheets, name)

    assert open_boundaries(qs_project) == []
    assert boundary(qs_project)
    assert all(
        (q["status"], (q["answer"] or {}).get("option")) == ("answered", EXCLUDES)
        for q in boundary(qs_project)
    )


def test_a_third_plan_after_a_revised_copy_still_reopens_the_boundary_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The copies of S-21 and S-22 claim nothing; S-23, another number, still does."""
    read(qs_project, monkeypatch, TWO, "KR-STR-COL-R0.dwg")
    read(qs_project, monkeypatch, TWO, "KR-STR-COL-R1.dwg")
    assert open_boundaries(qs_project) == []
    read(qs_project, monkeypatch, THIRD, "KR-STR-SETOUT-R0.dwg")

    assert open_boundaries(qs_project)


def test_a_second_plan_view_on_a_meeting_sheet_is_a_third_plan(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review 3 of #648 (55): a plan is a view. S-21 drawing "GRD TO 3RD" and "AT 3RD" beside S-22
    "3RD TO 5TH" asks the boundary storey, as the same "AT 3RD" view on a sheet of its own does."""
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet

    both = ("COLUMN SETTING-OUT PLAN GRD TO 3RD FLOOR", "COLUMN SETTING-OUT PLAN AT 3RD FLOOR")
    read(qs_project, monkeypatch, [
        Sheet("S-21", "COLUMN SETTING-OUT PLANS", both),
        plan("S-22", "COLUMN SETTING-OUT PLAN 3RD TO 5TH FLOOR"),
    ], "KR-STR-COL-R0.dwg")  # fmt: skip

    [q] = open_boundaries(qs_project)
    assert (q["params"]["sheet"], q["params"]["storey"], q["params"]["next_sheet"]) == (
        "S-21",
        "floor_3",
        "S-22",
    )


def test_leaving_the_third_plan_out_settles_the_meeting_and_undo_asks_it_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review 3 of #648 (50): the act path re-runs the boundary storeys. Leaving S-23 out takes its
    claim away, so the convention settles S-21/S-22 at once, with no later read; undoing the exclusion
    gives the claim back and the Question is asked again."""
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import exclude, proposals, step1, the
    from vextrus.testing.auth import api_as

    read(qs_project, monkeypatch, [*TWO, *THIRD], "KR-STR-R0.dwg")
    assert open_boundaries(qs_project)
    api = api_as(qs_project.member)
    s23 = the(proposals(api, qs_project.project_id), "S-23")["id"]

    assert exclude(api, qs_project.project_id, [s23], "superseded").status_code == 200
    assert open_boundaries(qs_project) == []
    [settled] = boundary(qs_project)
    assert (settled["status"], settled["answer"]["option"]) == ("answered", EXCLUDES)

    api.post(f"{step1(qs_project.project_id)}/undo", {})
    [asked] = open_boundaries(qs_project)
    assert asked["id"] == settled["id"]


@pytest.mark.parametrize("halved", ["first", "then"])
def test_a_meeting_plan_drawn_as_two_halves_of_one_range_is_one_plan(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, halved: str
) -> None:
    """#650 (55): a plan is its subject and storey range. A meeting plan drawn as two viewports of one
    range (left half, right half) is that one plan, never a third: the convention settles the meeting
    and nothing is open, as with one viewport each."""
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet

    first = "COLUMN SETTING-OUT PLAN GRD TO 3RD FLOOR"
    then = "COLUMN SETTING-OUT PLAN 3RD TO 5TH FLOOR"

    def halves(title: str) -> tuple[str, str]:
        return (f"{title} LEFT HALF", f"{title} RIGHT HALF")

    sheets = [
        Sheet("S-21", first, halves(first) if halved == "first" else (first,)),
        Sheet("S-22", then, halves(then) if halved == "then" else (then,)),
    ]
    read(qs_project, monkeypatch, sheets, "KR-STR-COL-R0.dwg")

    assert open_boundaries(qs_project) == []
    assert boundary(qs_project)
    answered = [q for q in boundary(qs_project) if q["status"] == "answered"]
    assert [q["answer"]["option"] for q in answered] == [EXCLUDES]


def test_a_meeting_whose_own_sheet_is_left_out_is_not_asked(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#650 (40): S-21/S-22 meet and S-23 claims the storey, so it is asked; leaving S-22 (the meeting's
    own sheet) out withdraws the Question; undoing that asks it again."""
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import exclude, proposals, step1, the
    from vextrus.testing.auth import api_as

    read(qs_project, monkeypatch, [*TWO, *THIRD], "KR-STR-R0.dwg")
    [asked] = open_boundaries(qs_project)
    api = api_as(qs_project.member)
    s22 = the(proposals(api, qs_project.project_id), "S-22")["id"]

    assert exclude(api, qs_project.project_id, [s22], "superseded").status_code == 200
    assert open_boundaries(qs_project) == []

    api.post(f"{step1(qs_project.project_id)}/undo", {})
    [again] = open_boundaries(qs_project)
    assert again["id"] == asked["id"]

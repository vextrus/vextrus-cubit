"""S19-B2's acceptance: the boundary storey settled by the Dhaka column-change convention.

The owner's ruling (session 19, 9 Oct 2026, "Settle by convention (Recommended)"): when two column or
shear-wall plans state storey ranges that share an end ("footing to 3rd" and "3rd to 6th"), Vextrus
settles it by the convention that the first plan's columns stop at that slab (`excludes_storey`),
records both titles as Trace, and asks no Question; it asks only when a third plan of the same subject
also claims that storey. Rule R1 (the Question's own premise): a meeting counts only when both views
state a two-ended "X to Y" range; a list ("grd and mezz") or a "below ground" phrase never meets.

The seam: a synthetic DWG read by 21c's read job (`acceptance/t21c/step1_whole`'s invented sheets and
readers), then the API `GET /api/projects/{id}/takeoff/step1/questions` and `.../proposals` as
the QS. A settled meeting is recorded where an answered boundary storey is
recorded today (the Question's answer, `excludes_storey`, which M1's `place_views` applies), with its
Trace on `ProposalTrace.question`. Every number and title is invented.

    uv run pytest vextrus/takeoff/tests/acceptance/ts19b2 -rf
"""

import uuid
from typing import Any

import pytest

from vextrus.takeoff.models import ProposalTrace
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    jev_says,
    proposals,
    questions,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

BOUNDARY = "takeoff.proposals.boundary_storey"
EXCLUDES = "excludes_storey"

CHAIN = [
    "COLUMN SETTING-OUT PLAN FOOTING TO 3RD FLOOR",
    "COLUMN SETTING-OUT PLAN 3RD TO 6TH FLOOR",
    "COLUMN SETTING-OUT PLAN 6TH FLOOR TO ROOF",
]
"""Three column plans whose ranges meet at the 3rd and at the 6th (S-13, S-14, S-15)."""

RAISED = "no two ranges meet here, yet a boundary storey Question was raised"
LEFT_OPEN = "a convention Question was left open"
NOT_SETTLED = "the shared end was not settled as excludes_storey"


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def plan(number: str, title: str) -> Sheet:
    """A sheet drawing one plan, its view titled as the sheet."""
    return Sheet(number, title, (title,))


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet], name: str) -> None:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))


def read_chain(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> None:
    sheets = [plan(n, t) for n, t in zip(("S-13", "S-14", "S-15"), CHAIN, strict=True)]
    read(qs, monkeypatch, sheets, "KR-STR-R0.dwg")


def boundary(qs: QsProject) -> list[dict[str, Any]]:
    """Every boundary storey Question of the project, open, answered or withdrawn."""
    return [q for q in questions(api_as(qs.member), qs.project_id) if q["code"] == BOUNDARY]


def still_open(qs: QsProject) -> list[dict[str, Any]]:
    """The open convention Questions (the boundary storey's kind)."""
    listed = questions(api_as(qs.member), qs.project_id)
    return [q for q in listed if q["kind"] == "convention" and q["status"] == "open"]


def settled(qs: QsProject) -> set[tuple[str, str, str, str]]:
    """Each boundary storey recorded as answered: (sheet, storey, next sheet, option)."""
    return {
        (q["params"]["sheet"], q["params"]["storey"], q["params"]["next_sheet"], q["answer"]["option"])
        for q in boundary(qs)
        if q["status"] == "answered"
    }


# R1: no meeting unless both plans state a two-ended range -----------------------------------------


def test_a_below_ground_plan_beside_a_ground_and_mezzanine_list_raises_no_boundary_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """R1: a "below ground" phrase and a list ("grd and mezz") never meet; nor does a range beside the
    list (the analysis, fixture 1: 0 Questions)."""
    read(qs_project, monkeypatch, [
        plan("S-02", "COLUMN SETTING-OUT PLAN BELOW GROUND"),
        plan("S-03", "COLUMN SETTING-OUT PLAN GRD AND MEZZ FLOORS"),
        plan("S-04", "COLUMN SETTING-OUT PLAN 1ST THRU 8TH FLOORS"),
    ], "KR-STR-R0.dwg")  # fmt: skip

    assert boundary(qs_project) == [], RAISED


def test_a_range_followed_by_a_two_storey_list_raises_no_boundary_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """R1: "grd thru 2nd" then "2nd and 3rd": the next view states a list, not a range (fixture 2: 0)."""
    read(qs_project, monkeypatch, [
        plan("S-07", "COLUMN SETTING-OUT PLAN GRD THRU 2ND FLOOR"),
        plan("S-08", "COLUMN SETTING-OUT PLAN 2ND AND 3RD FLOORS"),
    ], "KR-STR-R0.dwg")  # fmt: skip

    assert boundary(qs_project) == [], RAISED


# R2: ranges sharing an end are settled by the convention ------------------------------------------


def test_column_ranges_that_share_their_ends_leave_no_convention_question_open(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The ruling: "Vextrus settles it by the Dhaka convention ... and asks no Question"."""
    read_chain(qs_project, monkeypatch)

    assert still_open(qs_project) == [], LEFT_OPEN


def test_each_shared_end_is_settled_as_the_first_plans_columns_stopping_at_that_slab(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The ruling: "the first plan's columns stop at that slab (`excludes_storey`)", once per pair."""
    read_chain(qs_project, monkeypatch)

    assert settled(qs_project) == {
        ("S-13", "floor_3", "S-14", EXCLUDES),
        ("S-14", "floor_6", "S-15", EXCLUDES),
    }, NOT_SETTLED


def test_each_settled_boundary_records_both_plans_as_its_trace(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The ruling: the convention "records both titles as Trace" (m0-screens 6.7's card: "Trace: S-07
    title block; S-08 title block")."""
    read_chain(qs_project, monkeypatch)
    listed = proposals(api_as(qs_project.member), qs_project.project_id)
    sheet_of = {n: str(the(listed, n)["sheet_id"]) for n in ("S-13", "S-14", "S-15")}
    answered = [q for q in boundary(qs_project) if q["status"] == "answered"]
    assert len(answered) == 2, NOT_SETTLED

    with qs_project.member.acting():
        for q in answered:
            traced = {
                str(t.anchor.get("sheet_revision_id"))
                for t in ProposalTrace.objects.filter(
                    project_id=qs_project.project_id, question_id=uuid.UUID(str(q["id"]))
                )
            }
            pair = {sheet_of[q["params"]["sheet"]], sheet_of[q["params"]["next_sheet"]]}
            assert pair <= traced, (q["params"]["sheet"], q["params"]["next_sheet"], traced)


def test_reading_another_file_of_the_set_leaves_the_settled_boundaries_settled_once(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Every later read asks the set's Questions again: a settled meeting is neither asked nor recorded
    twice."""
    read_chain(qs_project, monkeypatch)
    read(qs_project, monkeypatch, [plan("S-01", "PILE SETTING-OUT PLAN")], "KR-STR-PILE-R0.dwg")

    assert still_open(qs_project) == [], LEFT_OPEN
    assert len(boundary(qs_project)) == 2, "a settled boundary storey was recorded twice"
    assert settled(qs_project) == {
        ("S-13", "floor_3", "S-14", EXCLUDES),
        ("S-14", "floor_6", "S-15", EXCLUDES),
    }, NOT_SETTLED


def test_shear_wall_ranges_that_share_an_end_are_settled_by_the_same_convention(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The ruling covers "two column or shear-wall plans"."""
    read(qs_project, monkeypatch, [
        plan("S-41", "SHEAR WALL SETTING-OUT PLAN GRD TO 3RD FLOOR"),
        plan("S-42", "SHEAR WALL SETTING-OUT PLAN 3RD TO 6TH FLOOR"),
    ], "KR-STR-R0.dwg")  # fmt: skip

    assert still_open(qs_project) == [], LEFT_OPEN
    assert settled(qs_project) == {("S-41", "floor_3", "S-42", EXCLUDES)}, NOT_SETTLED


# When it stays a Question --------------------------------------------------------------------------


def test_a_third_column_plan_claiming_the_meeting_storey_keeps_the_boundary_storey_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The ruling: "it asks only when a third plan of the same subject also claims that storey"; the
    words gate's M2 re-pinned to it: the Question names the storey where the ranges meet and the
    sheet whose range starts there."""
    read(qs_project, monkeypatch, [
        plan("S-21", "COLUMN SETTING-OUT PLAN GRD TO 3RD FLOOR"),
        plan("S-22", "COLUMN SETTING-OUT PLAN 3RD TO 5TH FLOOR"),
        plan("S-23", "COLUMN SETTING-OUT PLAN AT 3RD FLOOR"),
    ], "KR-STR-R0.dwg")  # fmt: skip

    [q] = boundary(qs_project)
    assert (q["status"], q["kind"]) == ("open", "convention")
    params = q["params"]
    assert (params["sheet"], params["storey"]) == ("S-21", "floor_3")
    assert (params["level"], params["number"], params["next_sheet"]) == ("floor", 3, "S-22")


def test_beam_ranges_that_share_an_end_raise_no_boundary_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Beams are drawn at floor level, not floor to floor: two beam plans naming one floor both draw
    it (19b's same-storey conflict when they do), never a boundary storey (the analysis: the boundary
    is asked of `floor_to_floor` subjects only, column and shear wall)."""
    read(qs_project, monkeypatch, [
        plan("S-31", "BEAM SETTING-OUT PLAN 2ND THRU 4TH FLOORS"),
        plan("S-32", "BEAM SETTING-OUT PLAN 4TH THRU 7TH FLOORS"),
    ], "KR-STR-R0.dwg")  # fmt: skip

    assert boundary(qs_project) == [], RAISED

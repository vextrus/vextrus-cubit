"""S21-C4's acceptance: a storey range that runs to the roof, or to the top floor, lists every floor up
to the set's highest numbered floor when Step 1 builds its set view.

The defect (G1's script layer on Train B's head): a sheet titled "2nd floor to roof" reads to the keys
floor_2, roof and the symbolic `top` (13's `storeys._range`: the floors between are "Step 3's"), and
nothing resolves `top`, so the sheet's storeys do not match. The fix (the session-20 diagnosis's rule):
where a sheet's storeys hold `top` beside a concrete start, Step 1 shows in its place the floors above
the start up to the highest `floor_<n>` stated anywhere in the Project's Drawing Set (sheet titles and
view storeys, every file), keeping every other key (the roof only where the title states it); with no
numbered floor in the set, `top` stays as today (no guess).

The seam: sheets and views recorded through the drawings services as the read job records them
(W318's invented recorder, `acceptance/w318/storey_set`), then the API
`GET /api/projects/{id}/takeoff/step1/proposals` as the QS: each Proposal's `storeys_titled` and its
views' `storeys`. Every number and title is invented.

    uv run pytest vextrus/takeoff/tests/acceptance/ts21c4 -rf
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.projects import services as projects
from vextrus.takeoff.tests.acceptance.w318.storey_set import Plan, Sheet, record
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

SIX = ["floor_2", "floor_3", "floor_4", "floor_5", "floor_6"]
"""The 2nd floor up to the set's highest numbered floor, the 6th."""


def proposals(member: Member, project_id: uuid.UUID) -> dict[str | None, dict[str, Any]]:
    response = api_as(member).get(f"/api/projects/{project_id}/takeoff/step1/proposals")
    assert response.status_code == 200, response.content
    return {p["number"]: p for p in response.json()["proposals"]}


def titled(member: Member, project_id: uuid.UUID, number: str) -> list[str] | None:
    found: list[str] | None = proposals(member, project_id)[number]["storeys_titled"]
    return found


def plans(member: Member, project_id: uuid.UUID, number: str) -> list[list[str]]:
    """The storeys of the sheet's plans, in reading order (the title block left out)."""
    views = proposals(member, project_id)[number]["views"]
    return [v["storeys"] for v in views if v["kind"] == "plan"]


def sixth_floor(number: str = "S-01") -> Sheet:
    """A sheet whose title states the 6th floor and whose plan draws it: the set's highest floor."""
    return Sheet(number, "6TH FLOOR", (Plan(("floor_6",), title="6TH FLOOR SLAB PLAN"),))


def to_roof(number: str = "S-02") -> Sheet:
    """A sheet titled for the 2nd floor to the roof, with no view (its row shows its title's storeys)."""
    return Sheet(number, "2ND FLOOR TO ROOF")


def other_project(member: Member) -> uuid.UUID:
    with member.acting():
        return projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another test project").id


# The range resolved ----------------------------------------------------------------------------------


def test_a_range_to_the_roof_lists_every_floor_to_the_sets_highest_and_the_roof(
    qs_project: QsProject,
) -> None:
    """A set whose highest floor is the 6th; a sheet titled "2nd floor to roof" -> its storeys are
    the 2nd to the 6th floor and the roof, and no symbolic `top`."""
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "KR-STR-R0.dwg", [sixth_floor(), to_roof()])

    assert titled(member, project_id, "S-02") == [*SIX, "roof"]


def test_a_plan_that_takes_its_sheets_range_shows_the_resolved_storeys(qs_project: QsProject) -> None:
    """The sheet's only plan states no storey and took its title's (`storeys_source` "sheet_title",
    stored as read: floor_2, roof, top) -> Step 1 shows that plan's storeys as the 2nd to the 6th
    floor and the roof."""
    member, project_id = qs_project.member, qs_project.project_id
    taken = Plan(("floor_2", "roof", "top"), title="COLUMN LAYOUT PLAN", source="sheet_title")
    record(
        member,
        project_id,
        "KR-STR-R0.dwg",
        [sixth_floor(), Sheet("S-02", "2ND FLOOR TO ROOF", (taken,))],
    )

    assert plans(member, project_id, "S-02") == [[*SIX, "roof"]]


def test_a_range_to_the_top_floor_ends_at_the_sets_highest_floor_with_no_roof(
    qs_project: QsProject,
) -> None:
    """A sheet titled "1st to top floor" in a set whose highest floor is the 6th -> the 1st to the
    6th floor; the roof is not added (it is kept only where a title states it)."""
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "KR-STR-R0.dwg", [sixth_floor(), Sheet("S-02", "1ST TO TOP FLOOR")])

    assert titled(member, project_id, "S-02") == ["floor_1", *SIX]


def test_the_highest_floor_is_read_across_every_file_of_the_set(qs_project: QsProject) -> None:
    """The 6th floor is stated only in the architectural file; the range is in the structural file ->
    the range still runs to the 6th floor (the highest floor is the whole set's, not one file's)."""
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "KR-ARC-R0.dwg", [Sheet("A-01", "6TH FLOOR", discipline="architectural")])
    record(member, project_id, "KR-STR-R0.dwg", [to_roof()])

    assert titled(member, project_id, "S-02") == [*SIX, "roof"]


def test_a_floor_only_a_views_storeys_state_counts_as_the_sets_highest(qs_project: QsProject) -> None:
    """The 6th floor is stated by no sheet title, only by a plan's own title on a sheet that states no
    storey -> the range still runs to the 6th floor (view storeys count, as titles do)."""
    member, project_id = qs_project.member, qs_project.project_id
    drawn = Sheet("S-01", None, (Plan(("floor_6",), title="6TH FLOOR SLAB PLAN"),))
    record(member, project_id, "KR-STR-R0.dwg", [drawn, to_roof()])

    assert titled(member, project_id, "S-02") == [*SIX, "roof"]


# No guess, and only this set's floors ----------------------------------------------------------------


def test_a_set_with_no_numbered_floor_leaves_top_unresolved(qs_project: QsProject) -> None:
    """No sheet or view of the set states a numbered floor; a sheet titled "ground floor to roof" ->
    its storeys stay ground, roof, top, as today (no floor is guessed)."""
    member, project_id = qs_project.member, qs_project.project_id
    roof = Sheet("S-01", "ROOF", (Plan(("roof",), title="ROOF PLAN"),))
    record(member, project_id, "KR-STR-R0.dwg", [roof, Sheet("S-02", "GROUND FLOOR TO ROOF")])

    assert titled(member, project_id, "S-02") == ["ground", "roof", "top"]


def test_another_projects_higher_floor_does_not_count(qs_project: QsProject) -> None:
    """The same Developer's other Project has a 9th floor; this Project's set's highest is the 6th ->
    the range runs to the 6th, not the 9th."""
    member, project_id = qs_project.member, qs_project.project_id
    elsewhere = other_project(member)
    record(member, elsewhere, "KR-STR-R0.dwg", [Sheet("S-01", "9TH FLOOR")])
    record(member, project_id, "KR-STR-R0.dwg", [sixth_floor(), to_roof()])

    assert titled(member, project_id, "S-02") == [*SIX, "roof"]


def test_a_second_tenants_higher_floor_does_not_count(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    """A second Developer's set has a 9th floor; this Developer's set's highest is the 6th -> the
    range runs to the 6th, not the 9th."""
    stranger = sign_in(role="qs")
    theirs = other_project(stranger)
    record(stranger, theirs, "KR-STR-R0.dwg", [Sheet("S-01", "9TH FLOOR")])
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "KR-STR-R0.dwg", [sixth_floor(), to_roof()])

    assert titled(member, project_id, "S-02") == [*SIX, "roof"]

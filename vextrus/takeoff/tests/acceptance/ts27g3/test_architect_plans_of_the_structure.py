"""Ticket S27-G3 (#336): the architect's plans that draw the structure are proposed out, "the
structural set governs", as column-layout plans already are.

docs/specs/M0.md, Finish line item 7 (review Q2): "the architect's plans that draw structure are
proposed out, 'the structural set governs'". docs/specs/M0.md, Step proposals by Discipline: "An
architectural plan that draws structure (the architect's column or beam layout, a coordination copy)
is proposed as excluded, 'duplicate or another Discipline's copy', worded 'the structural set
governs'". m0-screens 6.18: "an architectural plan that draws structure (a column or beam layout in
the architect's set), 'duplicate: the structural set governs'". docs/plans/M0.md 17: "proposed out as
`duplicate`".

The walk (S26 G1, finding f-14) found the architect's slab outline plans that draw the beams proposed
to Steps 11 and 12 while its column-layout plans were proposed out: a title naming the slab before
the beam, and a view whose own title names nothing on a sheet whose title names the beams.

A plan that draws no structure, and the architect's lintel layouts (`NOT_STRUCTURE_WORDS`: a lintel
is the architect's), stay in Steps 11 and 12.

"Framing" is the ticket's word (the orchestrator's brief for S27-G3), not the conventions': neither
`engine/recognise/conventions/sheet-default.json` nor `view-default.json` holds it today; the builder
adds it.

The exclusion is pinned as its code (`duplicate`); the screen's words for it are not this ticket's.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    coverage,
    jev_says,
    proposals,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from .architect_sheets import DUPLICATE, WALLS_AND_ROOMS, drawn_views, read

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


SLAB_THEN_BEAM_UNTITLED = Sheet("A-13", "SLAB OUTLINE AND BEAM LAYOUT", ("PLAN 13",))

# (its name, the invented sheet: one plan view). Each plan draws the structure the structural set
# governs.
STRUCTURE: list[tuple[str, Sheet]] = [
    ("a column layout, as today",
     Sheet("A-10", "COLUMN LAYOUT", ("COLUMN LAYOUT",))),
    ("a slab outline naming the beams after the slab, its view titled as its sheet",
     Sheet("A-11", "SLAB OUTLINE AND BEAM LAYOUT", ("SLAB OUTLINE AND BEAM LAYOUT",))),
    ("a beam layout and slab outline, its view titled as its sheet",
     Sheet("A-12", "BEAM LAYOUT AND SLAB OUTLINE", ("BEAM LAYOUT AND SLAB OUTLINE",))),
    ("a slab outline naming the beams after the slab, its view's title naming nothing",
     SLAB_THEN_BEAM_UNTITLED),
    ("a beam layout and slab outline, its view's title naming nothing",
     Sheet("A-14", "BEAM LAYOUT AND SLAB OUTLINE", ("PLAN 14",))),
    ("a framing layout",
     Sheet("A-15", "FRAMING LAYOUT", ("FRAMING LAYOUT",))),
]  # fmt: skip

# (its name, the invented sheet: one plan view). None draws the structure: Steps 11 and 12.
ARCHITECTS: list[tuple[str, Sheet]] = [
    ("a plan naming nothing",
     Sheet("A-01", "PLAN 1", ("PLAN 1",))),
    ("a lintel layout, its view's title naming nothing",
     Sheet("A-02", "LINTEL LAYOUT", ("PLAN 2",))),
    ("a slab and lintel layout, its view's title naming nothing",
     Sheet("A-03", "SLAB AND LINTEL LAYOUT", ("PLAN 3",))),
]  # fmt: skip


@pytest.mark.parametrize("sheet", [pytest.param(s, id=name) for name, s in STRUCTURE])
def test_an_architect_plan_that_draws_the_structure_is_proposed_out_as_a_duplicate(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sheet: Sheet
) -> None:
    read(qs_project, monkeypatch, [sheet])

    [plan] = drawn_views(proposals(api_as(qs_project.member), qs_project.project_id), sheet.number)

    shown = (plan["proposed_exclusion"], plan["steps"], plan["part"])
    assert shown == (DUPLICATE, [], None), (
        f"{sheet.number}'s plan proposed {shown}, not out as duplicate (the structural set governs)"
    )


@pytest.mark.parametrize("sheet", [pytest.param(s, id=name) for name, s in ARCHITECTS])
def test_an_architect_plan_that_draws_no_structure_stays_in_walls_and_rooms(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sheet: Sheet
) -> None:
    read(qs_project, monkeypatch, [sheet])

    [plan] = drawn_views(proposals(api_as(qs_project.member), qs_project.project_id), sheet.number)

    out = plan["proposed_exclusion"]
    assert out is None, f"{sheet.number}'s plan proposed out as {out}"
    assert set(plan["steps"]) == WALLS_AND_ROOMS
    assert len(plan["steps"]) == 2
    assert plan["part"] is None


def test_a_structure_plan_confirmed_leaves_its_plan_out_and_nothing_unaccounted(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The QS confirms the sheet as proposed: its plan is left out as a duplicate, Coverage counts no
    view in Steps 11 and 12 and none unaccounted (Finish line item 7: "every view assigned or
    excluded, 0 unaccounted")."""
    read(qs_project, monkeypatch, [SLAB_THEN_BEAM_UNTITLED])
    api = api_as(qs_project.member)
    [proposal] = [p for p in proposals(api, qs_project.project_id) if p["number"] == "A-13"]

    response = confirm(api, qs_project.project_id, [proposal["id"]])

    assert response.status_code == 200, response.content
    shown = coverage(api, qs_project.project_id)
    assert shown["by_reason"].get(DUPLICATE) == 1, (
        f"by reason {shown['by_reason']}, by step {shown['by_step']}: the plan not out as duplicate"
    )
    assert shown["by_step"] == {}
    assert (shown["unaccounted"], shown["unaccounted_views"]) == (0, [])

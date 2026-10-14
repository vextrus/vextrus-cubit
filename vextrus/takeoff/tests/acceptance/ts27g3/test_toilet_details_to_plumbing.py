"""Ticket S27-G3 (#336): every section of the architect's toilet details sheet goes to the Plumbing and
sanitary Part as well as Steps 11 and 12, not only one whose own title says "toilet".

docs/specs/M0.md, Step proposals by Discipline (review Q2): "Architectural fixture plans and toilet
details are proposed to the Plumbing and sanitary Part as well as to steps 11-12, since sanitary
fixtures are drawn there (ADR 0040)". m0-screens §5: "Architectural fixture plans and toilet details
go to steps 11 and 12 and to the Plumbing and sanitary Part as well".

The walk (S26 G1, finding f-14) found a toilet details sheet routing 1 of its 8 sections to the Part:
only one section's own title held a subject word. The rule pinned here reads the sheet's title as
Structural views already do (`engine/recognise/views/routing.py`: a view whose own title names no
subject takes its sheet's): a section of a sheet titled as toilet details whose own title names no
subject is a toilet detail.

Invented titles only. A section on a sheet whose title names no toilet stays out of the Part.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, jev_says, proposals
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from .architect_sheets import PLUMBING, WALLS_AND_ROOMS, drawn_views, read

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


SECTIONS = ("SECTION 1-1", "SECTION 2-2", "SECTION 3-3", "SECTION 4-4")
"""Sections whose own titles name no subject word (view-default.json)."""
TOILET_DETAILS = Sheet("A-21", "TOILET DETAILS", SECTIONS)


@pytest.mark.parametrize("title", SECTIONS)
def test_a_section_of_the_toilet_details_sheet_goes_to_the_plumbing_and_sanitary_part(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, title: str
) -> None:
    read(qs_project, monkeypatch, [TOILET_DETAILS])
    views = drawn_views(proposals(api_as(qs_project.member), qs_project.project_id), "A-21")

    [section] = [v for v in views if v["title"] == title]

    assert section["part"] == PLUMBING, (
        f"{title!r} proposed to part {section['part']}, not to the Plumbing and sanitary Part"
    )
    assert set(section["steps"]) == WALLS_AND_ROOMS
    assert section["proposed_exclusion"] is None


def test_every_section_of_the_toilet_details_sheet_routes_alike(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [TOILET_DETAILS])
    views = drawn_views(proposals(api_as(qs_project.member), qs_project.project_id), "A-21")

    routes = {v["title"]: (v["part"], sorted(v["steps"]), v["proposed_exclusion"]) for v in views}

    assert set(routes) == set(SECTIONS)
    alike = (PLUMBING, sorted(WALLS_AND_ROOMS), None)
    assert all(r == alike for r in routes.values()), (
        f"sections routed {routes}: not to the Plumbing and sanitary Part alike"
    )


def test_a_section_on_a_sheet_naming_no_toilet_stays_out_of_the_plumbing_and_sanitary_part(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = Sheet("A-01", "PLAN 1", ("PLAN 1", "SECTION 5-5"))
    read(qs_project, monkeypatch, [sheet])
    views = drawn_views(proposals(api_as(qs_project.member), qs_project.project_id), "A-01")

    [section] = [v for v in views if v["title"] == "SECTION 5-5"]

    assert section["part"] is None
    assert set(section["steps"]) == WALLS_AND_ROOMS

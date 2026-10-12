"""Ticket S22-FL7 (G1 blocker M0-FL7, #657, #335): a Structural sheet's site works route to Step 14.

The owner's ruling (11 Oct 2026, session 22): "a Structural sheet's site works (boundary wall, compound
wall, setback, site) route to Step 14 (site_mep)". Step 14's key is the seed's (`vextrus/seed/
drawings.py`: `site_mep`). Read through 17's public readers (`views.find`, `views.kind_steps`) on
invented sheets (sheet.py); a view counts in Coverage once it has a step, a Part or an exclusion
(m0-screens 6.11), so a view proposed for Step 14 is not unaccounted.
"""

import pytest

from engine.recognise import views
from engine.recognise.types import ViewCandidate, ViewKind

from .sheet import LEFT, LOWER, MIDDLE, RIGHT, WHOLE, structural_views

SITE = ("site_mep",)


def _accounted(found: list[ViewCandidate]) -> bool:
    return all(v.steps or v.part is not None or v.exclusion is not None for v in found)


def test_every_section_and_detail_of_a_boundary_wall_sheet_goes_to_step_14() -> None:
    found = structural_views(
        "PERIMETER BOUNDARY WALL TYPICALS ZQ",
        [
            ("SECTION ZQ-1", LEFT),
            ("SECTION ZQ-2", MIDDLE),
            ("SECTION ZQ-3", RIGHT),
            ("DETAIL ZQ-A", LOWER),
        ],
    )

    assert len(found) == 4
    assert {v.kind for v in found} == {ViewKind.SECTION, ViewKind.DETAIL}
    assert [v.steps for v in found] == [SITE] * 4


def test_no_view_of_a_boundary_wall_sheet_is_unaccounted() -> None:
    found = structural_views(
        "PERIMETER BOUNDARY WALL TYPICALS ZQ",
        [("SECTION ZQ-4", LEFT), ("SECTION ZQ-5", MIDDLE), ("DETAIL ZQ-B", LOWER)],
    )

    assert found
    assert _accounted(found)


def test_a_compound_wall_sheets_sections_go_to_step_14() -> None:
    found = structural_views(
        "COMPOUND WALL ARRANGEMENT ZQ", [("SECTION ZQ-6", LEFT), ("SECTION ZQ-7", MIDDLE)]
    )

    assert [v.steps for v in found] == [SITE, SITE]


@pytest.mark.parametrize(
    ("sheet_title", "view_title"),
    [
        ("PLOT SETBACK ARRANGEMENT ZQ", "SETBACK PLAN ZQ"),
        ("SITE ARRANGEMENT ZQ", "SITE PLAN ZQ"),
        ("SITE AND SETBACK ARRANGEMENT ZQ", "PLAN ZQ"),
    ],
)
def test_a_structural_setback_or_site_plan_goes_to_step_14(sheet_title: str, view_title: str) -> None:
    found = structural_views(sheet_title, [(view_title, WHOLE)], number="S-01")

    assert [(v.kind, v.steps) for v in found] == [(ViewKind.PLAN, SITE)]
    assert _accounted(found)


def test_a_structural_site_plan_kind_names_step_14() -> None:
    assert "site_mep" in views.kind_steps("site_plan", "structural")


def test_a_beam_details_sheets_section_keeps_beams() -> None:
    """Green on main (the tripwire): ordinary structural subjects keep their Steps."""
    found = structural_views("BEAM REINFORCEMENT ZQ", [("SECTION ZQ-8", LEFT)])

    assert [v.steps for v in found] == [("beams",)]


@pytest.mark.parametrize(
    ("kind", "steps"),
    [
        ("beam_details", ("beams",)),
        ("column_schedule", ("columns",)),
        ("pile_cap_details", ("foundations",)),
    ],
)
def test_ordinary_structural_kinds_keep_their_steps(kind: str, steps: tuple[str, ...]) -> None:
    """Green on main (the tripwire)."""
    assert views.kind_steps(kind, "structural") == steps


def test_a_titled_column_plan_on_a_site_sheet_is_not_hidden_from_columns() -> None:
    """Green on main (the tripwire): a view whose own title names a structural subject keeps its Step."""
    found = structural_views("SITE ARRANGEMENT ZQ", [("COLUMN POSITIONS PLAN ZQ", WHOLE)], number="S-01")

    assert [v.steps for v in found] == [("columns",)]
